// ============================================================================
// engine/ontrac-cost.js —— OnTrac A/B 成本测算 核心引擎
// ----------------------------------------------------------------------------
// 对外暴露 globalThis.OnTracEngine = { calculate, workbook, defaultSettings }
//
// 入口函数 calculate(rawWb, aWb, bWb, settings) 返回：
//   { rows, errors, unmatched, summary, settings }
//
// 内部执行流程（按顺序）：
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │ 1. 解析三个 workbook                                                 │
//   │    rawWb → rows("原始"), GTS(gtsWb)                                  │
//   │    aWb / bWb → tariff() 解析成价表结构 tA / tB                      │
//   └─────────────────────────────────────────────────────────────────────┘
//                                    ↓
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │ 2. 构建索引                                                         │
//   │    idx: Map<tracking, [gtsRow...]>     单号 → GTS 行数组            │
//   │    used: Set<id>                       已匹配到的 GTS 订单集合        │
//   └─────────────────────────────────────────────────────────────────────┘
//                                    ↓
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │ 3. 逐行循环处理原始账单                                              │
//   │    for (r in raw rows):                                             │
//   │      a) 基础校验（单号、重量、尺寸、UA、DAS/EDAS 互斥等）              │
//   │      b) 查 idx 找 GTS，missingGts = (gs.length === 0)               │
//   │      c) if (hasUA && !missingGts) → UA 特殊分支                      │
//   │         强制用 GTS 整套数据，UA 不计成本                             │
//   │         else → selected(r, g, settings) 正常分支                     │
//   │      d) selected() 内部做：                                          │
//            - ShipGridWeightPolicy.prepare() 取重决策                     │
//            - grade() 计算原始/GTS 两套尺寸的触发等级 (0/1/2/3)          │
//            - 等级低者优先选整套；同等级选计费重小的                       │
//            - zone() 分区取低（GTS 分区缺失则用原始）                     │
//            - 算 os(LPS) / ahs / bw（最低收费重）                        │
//   │      e) day() 解析 Ship Date → 查 ShipGridFuelRates 匹配燃油费率     │
//   │      f) 旺季判定：Demand/Resi 日期区间 + os/ahs/resi 触发            │
//   │      g) price(t, s, r, fuel, peak) 分别算 A、B 两套完整成本          │
//   │         完整成本 = base + resi + ahs + os + das + edas + sig + addr   │
//                      + peak + fuel(=sum * factor * fuelRate)            │
//   │      h) costs[0] vs costs[1] 取低 → chosen                          │
//   │      i) 组装 output.push({...}) 一行完整结果                         │
//   │      j) errors.push(...) 异常判断链：                                │
//            missingGts → 进 errors（含 weightPolicy.warnings）             │
//            else hasUA → 进 errors（含 weightPolicy.warnings）            │
//            else warnings 非空 → 进 errors                                │
//            catch → 进 errors（priced=false 表示没算出成本）              │
//   └─────────────────────────────────────────────────────────────────────┘
//                                    ↓
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │ 4. unmatched = idx 中 used 没标记到的 GTS 订单（GTS 有但原始没有）    │
//   │ 5. summary = 汇总计数（raw/priced/errors/provisional/A/B/...）       │
//   │ 6. return { rows, errors, unmatched, summary, settings }             │
//   └─────────────────────────────────────────────────────────────────────┘
//
// workbook(result) 输出 Excel，5 个 sheet：
//   成本汇总 | 订单成本明细 | 异常清单 | 规则参数 | A/B 费用拆分
// ============================================================================
/*SG-AUDIT:finance-05.js*/ (function (root) {
	("use strict");
	// ---- 基础工具函数 ----
	const round = (v) => Math.round((v + Number.EPSILON) * 100 + 1e-9) / 100; // 保留两位小数
	const ceil = (v) => Math.ceil(v - 1e-10); // 向上取整（略减防浮点边界）
	function n(v) {
		// 转数字，NaN/Infinity 抛错
		const x = Number(v ?? 0);
		if (!Number.isFinite(x)) throw Error("无效数字");
		return x;
	}
	function pos(v, k) {
		// 转非负数字，<0 抛错
		const x = n(v);
		if (x < 0) throw Error("缺少有效" + k);
		return x;
	}
	function zone(v) {
		// 解析分区字符串，取末尾数字，限定 2–8
		const m = String(v ?? "")
			.trim()
			.match(/(\d+)$/);
		if (!m || +m[1] < 2 || +m[1] > 8) throw Error("分区不完整或超出2–8区");
		return +m[1];
	}
	// 把 sheet 转成对象数组：第一行当表头 key，后续每行变成 {key1: val1, key2: val2, ...}
	function rows(wb, name) {
		const sheet = wb.Sheets[name];
		if (!sheet) throw Error("缺少sheet：" + name);
		const a = root.XLSX.utils.sheet_to_json(sheet, {
			header: 1,
			raw: true,
			defval: null,
			range: 0,
		});
		if (!a.length) throw Error("空sheet：" + name);
		const h = Array.from(a[0], (v) => String(v ?? "").trim());
		return a
			.slice(1)
			.filter((r) => r.some((v) => v !== null && v !== ""))
			.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
	}
	// 解析 A 或 B 方案的成本价表
	//   base[`重量|分区`] = 基础费（weight 1-150lb × zone 2-8）
	//   factor = 燃油支付比例（从价表右下角单元格正则匹配 0.xxxx）
	//   resi/sig/das/edas/address = 各项固定附加费
	//   ahs/os = 四个分区档位的 AHS / LPS 费用数组
	//   shift: A 方案附加费区在价表第 174 行起，B 方案在第 173 行起，差 1 行
	function tariff(wb, label) {
		const name = wb.SheetNames.includes("OnTrac Rates")
			? "OnTrac Rates"
			: wb.SheetNames[0];
		const a = root.XLSX.utils.sheet_to_json(wb.Sheets[name], {
			header: 1,
			raw: true,
			defval: null,
			range: 0,
		});
		const cell = (r, c) => a[r - 1]?.[c - 1];
		const shift = label === "A" ? 1 : 0;
		const base = {};
		for (let w = 1; w <= 150; w++)
			for (let z = 2; z <= 8; z++)
				base[`${w}|${z}`] = pos(cell(w + 5, z), "基础费");
		const factor = String(cell(173 + shift, 8)).match(/0\.\d+/);
		if (!factor) throw Error(label + "燃油支付比例无法识别");
		return {
			label,
			base,
			factor: +factor[0],
			resi: pos(cell(175 + shift, 8), "住宅费"),
			sig: pos(cell(176 + shift, 8), "签名费"),
			ahs: [8, 9, 10, 11].map((c) => pos(cell(177 + shift, c), "AHS")),
			os: [8, 9, 10, 11].map((c) => pos(cell(181 + shift, c), "OS")),
			das: pos(cell(190 + shift, 8), "DAS"),
			edas: pos(cell(191 + shift, 8), "EDAS"),
			address: pos(cell(192 + shift, 8), "改址费"),
		};
	}
	// 把 Excel 日期（数字 / Date / 字符串 mm/dd/yy 或 yyyy-mm-dd）统一解析成 ISO 字符串
	// 返回 null 表示无效或日期不在 2026-01-01 ~ 2027-01-15 之间（超出燃油覆盖范围）
	function day(v) {
		let y, m, d;
		if (typeof v === "number") {
			const p = root.XLSX.SSF.parse_date_code(v);
			if (!p) return null;
			({ y, m, d } = p);
		} else if (v instanceof Date) {
			y = v.getUTCFullYear();
			m = v.getUTCMonth() + 1;
			d = v.getUTCDate();
		} else {
			const s = String(v ?? "").trim();
			let a = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
			if (a) {
				m = +a[1];
				d = +a[2];
				y = +a[3];
				if (y < 100) y += y < 69 ? 2000 : 1900;
			} else {
				a = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
				if (!a) return null;
				y = +a[1];
				m = +a[2];
				d = +a[3];
			}
		}
		const dt = new Date(Date.UTC(y, m - 1, d));
		if (
			dt.getUTCFullYear() !== y ||
			dt.getUTCMonth() + 1 !== m ||
			dt.getUTCDate() !== d
		)
			return null;
		const iso = dt.toISOString().slice(0, 10);
		return iso >= "2026-01-01" && iso <= "2027-01-15" ? iso : null;
	}
	function inPeriod(d, start, end) {
		return d && d >= start && d <= end;
	}
	// 核心决策函数：选定一套尺寸、一个分区、算出 os/ahs/bw
	// 参数：
	//   r        —— 原始账单的一行对象（含 CUST Lbs / DIML/W/H / Zone / 各项费用）
	//   g        —— GTS 的一行对象（含 下单实重 / 下单长/宽/高 / 分区）
	//              missingGts 时 g 是用原始数据伪造的替代对象
	//   settings —— { weightUnit, dimUnit, ... } 计算参数
	// 返回：{ dims, actual, bw, z, os, ahs, weightPolicy, dimensionChoice, zoneSource, ... }
	function selected(r, g, settings) {
		const wf = settings.weightUnit === "kg" ? 2.2046226218487757 : 1,
			df = settings.dimUnit === "cm" ? 2.54 : 1;
		const rd = ["DIML", "DIMW", "DIMH"]
			.map((k) => pos(r[k], k))
			.sort((a, b) => b - a);
		const prelim = root.ShipGridWeightPolicy.prepare(g, {
				rawActual: ceil(pos(r["Cust Lbs"], "账单实重")),
				rawBilled: pos(r.Weight, "账单计费重"),
				rawDims: rd,
				divisor: 275,
				weightUnit: settings.weightUnit,
				dimUnit: settings.dimUnit,
			}),
			gd = prelim.dims;
		const rawDims = rd.map(ceil),
			gtsDims = gd.map(ceil);
		// grade(dims降序, weight) —— 按 Ontrac 尺寸规则判定触发等级
		//   等级 0: 正常（不触发 AHS / LPS）
		//   等级 1: 触发 AHS
		//     长>48 或 宽>30 或 重>50 或 体积>8640
		//   等级 2: 触发 LPS (Oversize)
		//     长>72 或 重>110 或 体积>17280
		//   等级 3: 超限（需人工确认）
		//     长>108 或 长+2宽+2高>165
		const volume = (ds) => ds.reduce((a, b) => a * b, 1);
		const grade = (ds, weight) =>
			ds[0] > 108 || ds[0] + 2 * ds[1] + 2 * ds[2] > 165
				? 3
				: ds[0] > 72 || weight > 110 || volume(ds) > 17280
					? 2
					: ds[0] > 48 || ds[1] > 30 || weight > 50 || volume(ds) > 8640
						? 1
						: 0;
		const rawGrade = Math.max(
				grade(rawDims, ceil(pos(r["Cust Lbs"], "账单实重"))),
				n(r["Oversize Fee"]) > 0
					? 2
					: n(r["Additional Handling Fee"]) > 0 || n(r.Irregular) > 0
						? 1
						: 0,
			),
			gtsGrade = grade(gtsDims, prelim.actual),
			rawVolume = volume(rawDims),
			gtsVolume = volume(gtsDims);
		const rawBilled = ceil(pos(r.Weight, "账单计费重")),
			wi = root.ShipGridWeightPolicy.prepare(g, {
				rawActual: ceil(pos(r["Cust Lbs"], "账单实重")),
				rawBilled,
				rawDims: rd,
				divisor: 275,
				weightUnit: settings.weightUnit,
				dimUnit: settings.dimUnit,
			}),
			gtsBilled = wi.reference;
		const useRaw =
			rawGrade !== gtsGrade ? rawGrade < gtsGrade : rawBilled <= gtsBilled;
		const dims = useRaw ? rawDims : gtsDims;
		const dimensionChoice = {
			source: useRaw ? "原始" : "GTS",
			reason:
				rawGrade !== gtsGrade
					? "触发等级低者优先"
					: rawBilled === gtsBilled
						? "等级与计费重相同，选原始"
						: "同等级选计费重小的一套",
			rawGrade,
			gtsGrade,
			rawVolume,
			gtsVolume,
		};
		const actual = useRaw ? ceil(pos(r["Cust Lbs"], "账单实重")) : wi.actual;
		const billed = wi.maximum;
		const rawZone = zone(r.Zone);
		const zoneMissing =
			g["分区"] === null ||
			g["分区"] === undefined ||
			String(g["分区"]).trim() === "" ||
			String(g["分区"]).trim() === "0";
		const gtsZone = zoneMissing ? null : zone(g["分区"]);
		const z = zoneMissing ? rawZone : Math.min(rawZone, gtsZone);
		const zoneSource = zoneMissing
			? "GTS分区缺失，使用原始账单"
			: rawZone < gtsZone
				? "原始"
				: rawZone > gtsZone
					? "GTS"
					: "两者相同";
		const [L, W, H] = dims,
			vol = L * W * H;
			console.log(L, W, H, vol);
		// os = Oversize (LPS) 触发：长>72 或 重>110 或 体积>17280
		const os = L > 72 || actual > 110 || vol > 17280;
		// ahs = Additional Handling 触发：os=false 时满足以下任一
		//   长>48 / 宽>30 / 重>50 / 体积>8640
		//   如果选的是原始账单尺寸，还额外检查 Irregular / AHS 费用

		const ahs =
			!os &&
			(L > 48 ||
				W > 30 ||
				actual > 50 ||
				vol > 8640 ||
				(useRaw && n(r.Irregular) > 0));
		// || n(r["Additional Handling Fee"]) > 0 26-11-12 取消默认提高到40，额外附加费
		// bw = 最终计费重（base weight）
		//   先取重量政策算出的 billed，再按规则抬高：
		//   os → 至少 90lb，ahs → 至少 40lb，否则保持原样
		console.log(os, ahs);
		// const bw = Math.max(billed, os ? 90 : ahs ? 40 : 0);
		const bw = billed;
		if (actual > 150 || L > 108 || L + 2 * W + 2 * H > 165 || bw > 150)
			throw Error("超限订单需人工确认基础运费，旺季$595规则已保留");
		return {
			rd,
			gd,
			dims,
			actual,
			bw,
			z,
			os,
			ahs,
			dimensionChoice,
			zoneSource,
			zoneMissing,
			billedInput: billed,
			dimWeight: wi.gtsDim ?? 0,
			volume: vol,
			weightPolicy: wi,
		};
	}
	// 完整成本计算（A 或 B 单套方案）
	// 参数：
	//   t     —— tariff() 解析出的价表对象（含 base / resi / ahs[] / os[] / das / edas / sig / address / factor）
	//   s     —— selected() 返回的决策结果（含 bw / z / os / ahs / actual 等）
	//   r     —— 原始账单行（用来判断 Residential / DAS / EDAS / Sig / Wrong Address 哪些实际收了费）
	//   fuel  —— 燃油费率（从 ShipGridFuelRates 匹配到的那周费率，小数如 0.265）
	//   peak  —— 旺季附加费合计（AHS + LPS + Residential + Unauthorized 的 $ 值之和）
	// 计算：
	//   i 分区档位：zone=2 → 0，zone=3-4 → 1，zone=5-6 → 2，zone=7-8 → 3
	//   p.base = t.base[`bw|zone`]（价表直接查）
	//   p.residential / p.das / p.edas / p.signature / p.address
	//     —— 只在原始账单对应字段 > 0 时才计入，否则为 0
	//   p.ahs = s.ahs ? t.ahs[i] : 0
	//   p.oversize = s.os ? t.os[i] : 0
	//   p.peak = peak（旺季直接加）
	//   sum = base + resi + ahs + os + das + edas + sig + addr + peak
	//   p.fuel = round(sum * fuelRate * t.factor)
	//   p.total = sum + fuel
	function price(t, s, r, fuel, peak) {
		const i = s.z === 2 ? 0 : s.z <= 4 ? 1 : s.z <= 6 ? 2 : 3;
		const p = {
			base: round(t.base[`${s.bw}|${s.z}`]),
			residential: n(r["Residential Fee"]) > 0 ? t.resi : 0,
			ahs: s.ahs ? t.ahs[i] : 0,
			oversize: s.os ? t.os[i] : 0,
			das: n(r["Delivery Area Fee"]) > 0 ? t.das : 0,
			edas: n(r["Extended Area Fee"]) > 0 ? t.edas : 0,
			signature: n(r["Resi Sig"]) > 0 ? t.sig : 0,
			address: n(r["Wrong Address Fee"]) > 0 ? t.address : 0,
			peak,
		};
		const sum = Object.values(p).reduce((a, b) => a + b, 0);
		p.fuel = round(sum * fuel * t.factor);
		p.total = round(sum + p.fuel);
		return p;
	}
	// 主入口：读原始账单 + GTS + A/B 价表 → 逐行测算 → 返回完整结果
	//   input    —— 用户上传的工作簿（含「原始」和「GTS」两个 sheet）
	//   wa / wb  —— A / B 方案价表 workbook（内置在 data/ontrac-default-rates.js）
	//   settings —— { weightUnit, dimUnit, peakAhs, peakOs, peakResi,
	//                 peakMax, peakUnauthorized, demandStart, demandEnd, resiStart }
	function calculate(input, wa, wb, settings) {
		const raw = rows(input, "原始"),
			gts = rows(input, "GTS"),
			ts = [tariff(wa, "A"), tariff(wb, "B")];
		const idx = new Map(),
			count = new Map();
		for (const g of gts) {
			const key = String(g["转单号"] ?? "").trim();
			if (key) {
				if (!idx.has(key)) idx.set(key, []);
				idx.get(key).push(g);
			}
		}
		for (const r of raw) {
			const key = String(r["Waybill#/tracking#"] ?? "").trim();
			count.set(key, (count.get(key) || 0) + 1);
		}
		const output = [],
			errors = [],
			used = new Set();
		const unsupported = [
			"CODCharge",
			"DeclaredValueCharge",
			"Saturday Charge",
			"Hard Copy Fee",
			"No Release",
			"Rebill Fee",
		];
		const detail = [
			"Residential Fee",
			"Delivery Area Fee",
			"Extended Area Fee",
			"Additional Handling Fee",
			"Oversize Fee",
			"Resi Sig",
			"Wrong Address Fee",
			"Irregular",
			"Peak Oversize",
			"Peak Residential",
			"Peak Add Handling",
		];
		for (let i = 0; i < raw.length; i++) {
			const r = raw[i],
				tracking = String(r["Waybill#/tracking#"] ?? "").trim();
			try {
				if (!tracking) throw Error("缺少物流单号");
				if (count.get(tracking) !== 1) throw Error("原始单号重复");
				const gs = idx.get(tracking) || [];
				const missingGts = gs.length === 0;
				if (gs.length > 1)
					throw Error("GTS单号重复：GTS转单号中匹配到" + gs.length + "条记录");
				const wf = settings.weightUnit === "kg" ? 2.2046226218487757 : 1,
					df = settings.dimUnit === "cm" ? 2.54 : 1;
				const g = missingGts
					? {
							件数: 1,
							下单实重: n(r["Cust Lbs"]) / wf,
							计费重: n(r.Weight) / wf,
							下单长: n(r.DIML) * df,
							下单宽: n(r.DIMW) * df,
							下单高: n(r.DIMH) * df,
							分区: r.Zone,
						}
					: gs[0];
				if (missingGts) g.__weightPolicyMissingGts = true;
				if (!missingGts) used.add(tracking);
				if (n(g["件数"]) !== 1) throw Error("一行须对应一个包裹");
				if (
					["TotalCharge", "ServiceCharge", "Fuel Surcharge"].some(
						(k) => n(r[k]) < 0,
					)
				)
					throw Error("退款或调整需关联历史账单");
				const unknown = unsupported.filter((k) => n(r[k]) !== 0);
				if (unknown.length) throw Error("未映射费用：" + unknown.join(","));
				const uaAmount = n(r["Unauthorized Package"]),
					hasUA = uaAmount > 0;
				if (uaAmount < 0) throw Error("UA退款或调整需关联历史账单");
				if (n(r["Delivery Area Fee"]) && n(r["Extended Area Fee"]))
					throw Error("DAS和EDAS同时收费需复核");
				let s;
				if (hasUA && !missingGts) {
					const wf = settings.weightUnit === "kg" ? 2.2046226218487757 : 1,
						df = settings.dimUnit === "cm" ? 2.54 : 1;
					const uaPolicy = root.ShipGridWeightPolicy.prepare(g, {
							rawActual: n(r["Cust Lbs"]),
							rawBilled: r.Weight,
							rawDims: ["DIML", "DIMW", "DIMH"].map((k) => n(r[k])),
							divisor: 275,
							weightUnit: settings.weightUnit,
							dimUnit: settings.dimUnit,
						}),
						ga = uaPolicy.actual,
						gb = Math.max(ga, uaPolicy.gtsDim ?? 0),
						gd = uaPolicy.dims,
						gz = zone(
							g["分区"] === null ||
								g["分区"] === undefined ||
								String(g["分区"]).trim() === "" ||
								String(g["分区"]).trim() === "0"
								? r.Zone
								: g["分区"],
						);
					const proxy = {
						...r,
						"Cust Lbs": ga,
						Weight: gb,
						DIML: gd[0],
						DIMW: gd[1],
						DIMH: gd[2],
						Zone: gz,
						"Oversize Fee": 0,
						"Additional Handling Fee": 0,
						Irregular: 0,
					};
					s = selected(proxy, g, settings);
					s.rd = ["DIML", "DIMW", "DIMH"]
						.map((k) => n(r[k]))
						.sort((a, b) => b - a);
					s.dimensionChoice = {
						...s.dimensionChoice,
						source: "GTS",
						reason: "原账单含UA，强制使用GTS整套数据测算，UA费用不计入成本",
						rawGrade: 3,
						rawVolume: s.rd.reduce((a, b) => a * b, 1),
					};
					s.zoneSource = s.zoneMissing ? "GTS分区缺失，使用原始账单" : "GTS";
				} else {
					s = selected(r, g, settings);
					if (missingGts) {
						s.dimensionChoice = {
							...s.dimensionChoice,
							source: "原始",
							reason: "GTS单号缺失，使用整套原始数据",
						};
						s.zoneSource = "原始（GTS单号缺失）";
					}
				}
				const date = day(r["Ship date"]);
				if (!date) throw Error("Ship Date无效，无法匹配官方燃油费率");
				const official = (root.ShipGridFuelRates?.rates || []).find(
					(x) => date >= x.start && date <= x.end,
				);
				if (!official)
					throw Error(
						"Ship Date未匹配到官方燃油费率：" + date + "；请更新官网费率后重算",
					);
				const fuelBasis = n(r.TotalCharge) - n(r["Fuel Surcharge"]);
				const effective =
						fuelBasis > 0 ? n(r["Fuel Surcharge"]) / fuelBasis : null,
					reference = null,
					kind = "不适用（按Ship Date）",
					appliedReference = official.rate,
					fuelMethod = "OFFICIAL_SHIP_DATE";
				const peak = new Set(
					["Peak Oversize", "Peak Residential", "Peak Add Handling"].filter(
						(k) => n(r[k]) > 0,
					),
				);
				if (inPeriod(date, settings.demandStart, settings.demandEnd)) {
					if (s.os) peak.add("Peak Oversize");
					else if (s.ahs) peak.add("Peak Add Handling");
				}
				if (
					n(r["Residential Fee"]) > 0 &&
					inPeriod(date, settings.resiStart, settings.demandEnd)
				)
					peak.add("Peak Residential");
				let demand = 0;
				for (const k of peak) {
					if (
						(k === "Peak Oversize" && !s.os) ||
						(k === "Peak Add Handling" && !s.ahs)
					)
						continue;
					demand += n(
						k === "Peak Oversize"
							? settings.peakOs
							: k === "Peak Add Handling"
								? settings.peakAhs
								: settings.peakResi,
					);
				}
				const costs = ts.map((t) =>
					price(t, s, r, appliedReference, round(demand)),
				);
				const chosen = costs[0].total <= costs[1].total ? 0 : 1;
				output.push({
					row: i + 2,
					tracking,
					order: g["订单号"] ?? "",
					customerOrder: g["客户单号"] ?? "",
					customerId: g["客户ID"] ?? "",
					orderId: g["订单ID"] ?? "",
					carrierActual: ceil(n(r["Cust Lbs"])),
					gtsActual: missingGts ? null : s.weightPolicy.gtsActual,
					actual: s.actual,
					carrierBilled: ceil(n(r.Weight)),
					gtsBilled: missingGts ? null : s.weightPolicy.reference,
					billed: s.bw,
					weightPolicyReason: s.weightPolicy.reason,
					carrierDims: s.rd.map(ceil).join("×"),
					gtsDims: !s.weightPolicy.gtsDims
						? ""
						: s.weightPolicy.gtsDims.join("×"),
					gtsRoundedDims: !s.weightPolicy.gtsDims
						? ""
						: s.weightPolicy.gtsDims.join("×"),
					dims: s.dims.join("×"),
					dimensionChoice: s.dimensionChoice,
					zoneSource: s.zoneSource,
					volume: s.volume,
					dimWeight: s.dimWeight,
					billedInput: s.billedInput,
					carrierZone: r.Zone,
					gtsZone: missingGts ? null : g["分区"],
					zone: s.z,
					A: costs[0].total,
					B: costs[1].total,
					min: costs[chosen].total,
					chosen: ts[chosen].label,
					original: n(r.TotalCharge),
					difference: round(n(r.TotalCharge) - costs[chosen].total),
					effective,
					reference: appliedReference,
					inferredReference: reference,
					fuelMethod,
					fuelPeriod: official ? official.start + " ~ " + official.end : "",
					fuelSource: official
						? root.ShipGridFuelRates.source
						: "原账单倒推（日期异常）",
					fuelFetchedAt: official ? root.ShipGridFuelRates.fetchedAt : "",
					source: kind,
					date: date || String(r["Ship date"]),
					ahs: s.ahs,
					os: s.os,
					costs,
					uaAmount,
					missingGts,
					provisional: hasUA,
					warnings:
						s.weightPolicy.warnings.join("；") +
						(s.weightPolicy.warnings.length ? "；" : "") +
						(missingGts
							? "GTS单号缺失，已按整套原始数据测算；" +
								(hasUA ? "原账单含UA，UA费用及实际责任待核实" : "请核实GTS数据")
							: hasUA
								? "原账单含UA，已按GTS测算最低成本，UA费用及实际责任待核实"
								: ""),
				});
				if (missingGts)
					errors.push({
						row: i + 2,
						tracking,
						uaAmount,
						priced: true,
						reason:
							"GTS单号缺失，已按整套原始数据测算（测算已计入明细）" +
							(hasUA ? "；原账单含UA，UA费用及实际责任待核实" : ""),
					});
				else if (hasUA)
					errors.push({
						row: i + 2,
						tracking,
						uaAmount,
						priced: true,
						reason:
							"原账单含UA，已按GTS测算最低成本，UA费用及实际责任待核实（测算已计入明细）",
					});
			} catch (e) {
				errors.push({
					row: i + 2,
					tracking,
					uaAmount: n(r["Unauthorized Package"]),
					priced: false,
					reason: !(idx.get(tracking) || []).length
						? "GTS单号缺失；原始数据无法测算：" + e.message
						: e.message,
				});
			}
		}
		const unmatched = [...idx]
			.filter(([k]) => !used.has(k))
			.map(([tracking, g]) => ({ tracking, orderId: g[0]["订单ID"] }));
		const sum = output.reduce((a, r) => a + Math.round(r.min * 100), 0) / 100;
		return {
			rows: output,
			errors,
			unmatched,
			summary: {
				raw: raw.length,
				priced: output.length,
				errors: errors.length,
				A: output.filter((r) => r.chosen === "A").length,
				B: output.filter((r) => r.chosen === "B").length,
				warnings: output.filter((r) => r.warnings).length,
				provisional: output.filter((r) => r.provisional).length,
				excluded: errors.filter((r) => !r.priced).length,
				total: sum,
			},
			settings: { ...settings },
		};
	}
	const defaultSettings = {
		weightUnit: "kg",
		dimUnit: "cm",
		sourceTariff: "auto",
		peakAhs: 2.2,
		peakOs: 16.5,
		peakMax: 595,
		peakUnauthorized: 595,
		peakResi: 0.3,
		demandStart: "2026-09-26",
		demandEnd: "2027-01-15",
		resiStart: "2026-10-24",
	};
	const headers = [
		"系统订单号",
		"客户单号",
		"物流单号",
		"客户ID",
		"订单ID",
		"原始实重lb",
		"GTS实重LB",
		"触发判定实重lb",
		"原始计费重lb",
		"GTS重算参考重LB（忽略原计费重字段）",
		"最终计费重lb",
		"原始尺寸inch",
		"GTS尺寸INCH",
		"整套选用尺寸INCH",
		"原始分区",
		"GTS分区",
		"取低分区",
		"A总成本USD",
		"B总成本USD",
		"较低总成本USD",
		"选用价格",
		"原始账单金额USD",
		"原始减最低成本USD",
		"原始有效燃油率",
		"采用燃油公布或参考率",
		"原始发货日期",
		"AHS",
		"OS",
		"警示",
		"燃油费率来源",
		"官方费率适用区间",
		"费率出处",
		"官网抓取时间",
		"账单倒推参考率",
		"是否收取AHS",
		"是否收取LPS",
		"尺寸整套来源",
		"尺寸选取依据",
		"原始触发等级",
		"GTS触发等级",
		"原始体积INCH3",
		"GTS体积INCH3",
		"最终选用尺寸体积INCH3",
		"GTS体积重LB（重算）",
		"取值来源",
		"原始UA费用USD",
		"是否为UA参考测算",
	];
	function sourceDescription(r) {
		return (
			r.weightPolicyReason ||
			"新取重规则；尺寸整套取" +
				r.dimensionChoice.source +
				"：" +
				r.dimensionChoice.reason +
				"；实重" +
				r.actual +
				"LB；所选计费重" +
				r.billed +
				"LB；分区取" +
				r.zoneSource +
				"（" +
				r.zone +
				"区）"
		);
	}
	function resultMatrix(result) {
		return [
			headers,
			...result.rows
				.filter((r) => String(r.order ?? "").trim() !== "")
				.map((r) => [
					String(r.order),
					String(r.customerOrder),
					r.tracking,
					String(r.customerId),
					String(r.orderId),
					r.carrierActual,
					r.gtsActual === null ? null : ceil(r.gtsActual),
					ceil(r.actual),
					r.carrierBilled,
					r.gtsBilled === null ? null : ceil(r.gtsBilled),
					r.billed,
					r.carrierDims,
					r.missingGts
						? ""
						: r.gtsRoundedDims ||
							r.gtsDims
								.split("×")
								.map((x) => ceil(Number(x)))
								.join("×"),
					r.dims,
					r.carrierZone,
					r.gtsZone,
					r.zone,
					r.A,
					r.B,
					r.min,
					r.chosen + "价",
					r.original,
					r.difference,
					r.effective,
					r.reference,
					r.date,
					r.ahs ? "是" : "否",
					r.os ? "是" : "否",
					r.warnings,
					r.fuelMethod === "OFFICIAL_SHIP_DATE"
						? "官网按Ship Date"
						: "日期异常：原账单倒推",
					r.fuelPeriod,
					r.fuelSource,
					r.fuelFetchedAt,
					r.inferredReference,
					r.costs.some((c) => c.ahs > 0) ? "是" : "否",
					r.costs.some((c) => c.oversize > 0) ? "是" : "否",
					r.dimensionChoice.source,
					r.dimensionChoice.reason,
					["无", "AHS", "LPS", "超限"][r.dimensionChoice.rawGrade],
					["无", "AHS", "LPS", "超限"][r.dimensionChoice.gtsGrade],
					r.dimensionChoice.rawVolume,
					r.dimensionChoice.gtsVolume,
					r.volume,
					r.dimWeight,
					sourceDescription(r),
					r.uaAmount || 0,
					r.provisional ? "是" : "否",
				]),
		];
	}
	// 把 calculate() 返回的 result 打包成一个完整的 Excel 工作簿
	// 输出 5 个 sheet：
	//   1. 成本汇总    —— 原始订单数 / 成功测算数 / 异常数 / A/B 选择比 / 最低成本合计等
	//   2. 订单成本明细 —— 每订单 40+ 列的完整测算记录（系统订单号空白的行会被过滤掉）
	//   3. 异常清单    —— errors 数组里的所有异常行
	//   4. 规则参数    —— settings + 各项规则说明（分区来源、取重逻辑、尺寸选取、UA处理、燃油来源等）
	//   5. A/B 费用拆分 —— 每订单的 A 和 B 两套方案逐费用拆解（基础/住宅/AHS/OS/DAS/EDAS/签名/改址/旺季/燃油）
	// 返回的 workbook 对象直接交给 XLSX.writeFile 触发浏览器下载
	function workbook(result) {
		const X = root.XLSX,
			w = X.utils.book_new();
		function add(name, data, widths) {
			const s = X.utils.aoa_to_sheet(data);
			s["!cols"] = widths.map((wch) => ({ wch }));
			s["!autofilter"] = { ref: s["!ref"] };
			X.utils.book_append_sheet(w, s, name);
			return s;
		}
		const q = result.summary;
		add(
			"成本汇总",
			[
				["项目", "数值"],
				["原始订单数", q.raw],
				["成功测算数", q.priced],
				["异常记录数（含已测算待核实）", q.errors],
				["UA已测算待核实订单数", q.provisional || 0],
				["未生成成本订单数", q.excluded || 0],
				["A价订单数", q.A],
				["B价订单数", q.B],
				["待核实订单数", q.warnings],
				["较低成本合计USD", q.total],
				[
					"口径",
					"合计含UA参考测算成本；UA金额未计入测算，不代表承运商最终应付成本",
				],
			],
			[30, 65],
		);
		const d = add(
			"订单成本明细",
			resultMatrix(result),
			headers.map((_, i) => (i === 28 ? 72 : i >= 11 && i <= 13 ? 38 : 24)),
		);
		for (let r = 1; r <= result.rows.length; r++)
			for (const c of [17, 18, 19, 21, 22, 23, 24, 33]) {
				const cell = d[X.utils.encode_cell({ r, c })];
				if (cell) cell.z = c >= 23 ? "0.0000%" : "$#,##0.00";
			}
		for (let r = 1; r <= result.rows.length; r++)
			for (const c of [5, 6, 7, 8, 9]) {
				const cell = d[X.utils.encode_cell({ r, c })];
				if (cell) cell.z = [6, 9].includes(c) ? "0" : "0.000000";
			}
		add(
			"异常清单",
			[
				["原始行号", "物流单号", "原因", "原始UA费用USD", "是否已生成参考成本"],
				...result.errors.map((r) => [
					r.row,
					r.tracking,
					r.reason,
					r.uaAmount || 0,
					r.priced ? "是" : "否",
				]),
			],
			[14, 26, 80, 20, 24],
		);
		add(
			"规则参数",
			[
				["参数", "取值"],
				...Object.entries(result.settings),
				[
					"分区来源",
					"直接读取GTS原表分区，不根据邮编计算；为空时使用原始账单分区；非空非法分区进入异常",
				],
				[
					"最终计费重",
					"最终计费重=max(原始计费重、GTS实重、GTS进位尺寸重、适用最低重)；尺寸仍按原A/B取低逻辑；GTS原计费重不参与",
				],
				[
					"尺寸选取",
					"长宽高整套选取：触发等级低者优先；同等级选计费重小；相同选原始",
				],
				["A/B计算", "每个方案完整费用含燃油后取低"],
				[
					"GTS缺失",
					"使用整套原始实重、计费重、尺寸和分区测算，同时列入异常；原始数据无效时不生成成本并说明原因",
				],
				[
					"原始金额",
					"原始账单金额仅保留作对照，不检查原始收费明细与总额是否对平，不因此拦截测算",
				],
				[
					"UA处理",
					"原账单含UA时仅用GTS重量、计费重及整套尺寸测算A/B取低；分区优先GTS，GTS为空时使用原始账单分区；UA费用单独保留不计成本；同时进入异常清单，GTS缺失或超限仅列异常",
				],
				[
					"燃油",
					"仅按Ship Date匹配官方公布费率；不识别原始A/B方案、不倒推；日期无效或未覆盖进入异常",
				],
				["官网燃油数据来源", root.ShipGridFuelRates?.source || ""],
				["官方数据抓取时间", root.ShipGridFuelRates?.fetchedAt || ""],
			],
			[28, 90],
		);
		const breakdown = [
			[
				"物流单号",
				"方案",
				"基础费",
				"住宅",
				"AHS",
				"OS",
				"DAS",
				"EDAS",
				"签名",
				"改址",
				"旺季",
				"燃油",
				"合计",
			],
		];
		for (const r of result.rows)
			for (let i = 0; i < 2; i++) {
				const c = r.costs[i];
				breakdown.push([
					r.tracking,
					i ? "B" : "A",
					...[
						"base",
						"residential",
						"ahs",
						"oversize",
						"das",
						"edas",
						"signature",
						"address",
						"peak",
						"fuel",
						"total",
					].map((k) => c[k]),
				]);
			}
		add("成本分项", breakdown, [26, 10, ...Array(11).fill(16)]);
		return w;
	}
	root.OnTracEngine = {
		utils: { rows, day, round, ceil, zone, n, pos, tariff },
		calculate,
		defaultSettings,
		workbook,
		resultMatrix,
		selected,
		deriveRate: (total, fuel, factor) => ({
			effective: fuel / (total - fuel),
			reference: fuel / (total - fuel) / factor,
		}),
	};
})(typeof globalThis !== "undefined" ? globalThis : window);
