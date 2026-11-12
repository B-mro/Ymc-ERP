/**
 * 文件：standard-quotes.js
 * 路径：fedex-billing/shared/
 * 职责：ShipGrid 标准价表（SG-QUOTE-1 / SG-QUOTE-2 两种格式）的生成、下载、解析、校验。
 *       是 quote-validators.js 遇到标准价表时调用的"解析后端"；也是 quote-manager.js 里
 *       "下载标准价表"按钮的实现。
 *
 * 对外暴露：globalThis.ShipGridStandardQuotes = { is, parse, validate, workbook, download, modelFor }
 *
 *   is(wb)                    → 布尔，判断 wb.SheetNames 是否含 "SG标准价表"
 *   modelFor(carrier)         → 深拷贝 ShipGridQuoteDefaults[carrier]（来自 peak-defaults.js，全是 null 的空模板）
 *   validate(model, carrier)  → 字段级校验：base 完整性、factor 范围（0–1）、日期格式、旺季区间不重叠、尺寸字段>0 等
 *   workbook(carrier, model?) → 把 model 写成 SG-QUOTE-2 结构的工作簿（UPS 分 Commercial/Residential，FedEx 含 SmartPost 附加列）
 *   parse(wb, carrier)        → 同时兼容 SG-QUOTE-1（单"基础运费"表）和 SG-QUOTE-2（多工作表），统一返回完整 model
 *   download(carrier, wb?)    → 浏览器直接下载 .xlsx；未给 wb 时用 modelFor(carrier) 构造空白模板
 *
 * 内部辅助（不对外暴露，文件内使用）：
 *   label(path)        → 把 "comm.demand.1.ahs" 之类字段路径翻译成可读中文标签，用于模板
 *   leaves(model)      → 把嵌套对象拍平成 { path, value } 数组，方便逐字段校验
 *   seasonal(path)     → 判断字段是否属于 demand / resiDemand 旺季数组
 *   seasonSpec(carrier) → 各家旺季字段结构定义（简单对象 or 数组，子键类型：date / number / optional）
 *   parseV1(wb, carrier) / workbookV1  → SG-QUOTE-1 格式的读写，SG-QUOTE-2 解析时先把多工作表合成 V1 再走这套
 *   engine(carrier)    → 取对应 carrier 的 billing engine（FedExBilling / OnTracBilling / UPSBilling），download 时用它解析已有报价
 *
 * 工作簿结构（SG-QUOTE-2，当前推荐格式）：
 *   ├─ "SG标准价表"    元信息（格式版本、承运商、币种、尺寸规则说明、旺季官网来源、核对日期等）
 *   ├─ "{承运商}基础运费"  主基础运费表（FedEx 附 SmartPost 分区列；UPS 分两张）
 *   ├─ "计费参数"      除 base 以外的所有单项参数（factor / dim / resi / ahsD / dasR 等）
 *   └─ "旺季参数"      demand / resiDemand 数组，字段代码形如 "demand.0.ahs"、"comm.resiDemand.2.fee"
 *
 * 调用方：
 *   - quote-validators.js.ontrac / fedex / ups  → 遇到 is(wb) 时委托 parse
 *   - quote-manager.js 的 downloadStandard / downloadQuoteTemplate
 *
 * 依赖：
 *   - ShipGridQuoteDefaults / ShipGridPeakDefaults（来自 peak-defaults.js）
 *   - XLSX（vendor/xlsx.full.min.js）
 */
/*SG-AUDIT:finance-09.js*/ (function (root) {
	"use strict";
	const X = () => root.XLSX,
		clone = (v) => JSON.parse(JSON.stringify(v)),
		names = { ontrac: "OnTrac", fedex: "FedEx", ups: "UPS" },
		baseKeys = {
			ontrac: ["base"],
			fedex: ["ngbase", "spbase"],
			ups: ["comm.base", "resi.base"],
		};
	const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o);
	function set(o, path, v) {
		const parts = path.split(".");
		let p = o;
		for (let i = 0; i < parts.length - 1; i++) {
			const k = parts[i];
			if (!Object.hasOwn(p, k)) p[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
			p = p[k];
		}
		p[parts.at(-1)] = v;
	}
	const labels = {
		base: "基础运费",
		ngbase: "Ground/Home Delivery",
		spbase: "SmartPost/Ground Economy",
		comm: "Ground Commercial",
		resi: "Residential Surcharge",
		factor: "燃油支付比例（0–1）",
		dim: "体积重除数DIM",
		sig: "Residential Signature",
		ahs: "Additional Handling",
		ahsD: "AHS – Dimension",
		ahsW: "AHS – Weight",
		ahsP: "AHS – Packaging",
		os: "Oversize / Large Package",
		das: "Delivery Area Surcharge",
		edas: "Extended Delivery Area",
		dasR: "DAS Residential",
		dasC: "DAS Commercial",
		edasR: "DAS Extended Residential",
		edasC: "DAS Extended Commercial",
		remoteR: "DAS Remote Residential",
		remoteC: "DAS Remote Commercial",
		indirect: "Indirect Signature",
		direct: "Direct Signature",
		adult: "Adult Signature",
		address: "Address Correction",
		declaredMin: "Declared Value 最低收费（100–300）",
		declaredPer100: "Declared Value 每100USD收费",
		unauthorized: "Unauthorized Package",
		sp: "SmartPost",
		fuel: "燃油支付比例（0–1）",
		delivery: "Delivery and Returns",
		nonMach: "Non-Machinable",
		relabel: "Package Relabel",
		fee: "金额USD",
		max: "Over Maximum",
		demand: "旺季",
		resiDemand: "旺季住宅",
	};
	function label(path) {
		return path
			.split(".")
			.map((k, i, a) =>
				/^\d+$/.test(k)
					? [
							"ahs",
							"ahsD",
							"ahsW",
							"ahsP",
							"os",
							"resi",
							"dasR",
							"dasC",
							"edasR",
							"edasC",
							"remoteR",
							"remoteC",
							"indirect",
							"direct",
							"adult",
							"address",
							"unauthorized",
						].includes(a[i - 1])
						? ["Zone 2", "Zones 3–4", "Zones 5–6", "Zones 7–8"][+k]
						: "第" + (+k + 1) + "期"
					: labels[k] || k,
			)
			.join(" / ");
	}
	function leaves(model, prefix = "", out = []) {
		for (const [k, v] of Object.entries(model)) {
			const path = prefix ? prefix + "." + k : k;
			if (baseKeys._current?.includes(path)) continue;
			if (v && typeof v === "object") leaves(v, path, out);
			else out.push({ path, value: v });
		}
		return out;
	}
	function fields(model, carrier) {
		baseKeys._current = baseKeys[carrier];
		const result = leaves(model);
		delete baseKeys._current;
		return result;
	}
	function is(wb) {
		return wb.SheetNames.includes("SG标准价表");
	}
	function rows(wb, name) {
		if (!wb.Sheets[name]) throw Error("标准价表缺少工作表：" + name);
		return X().utils.sheet_to_json(wb.Sheets[name], {
			header: 1,
			defval: null,
			raw: true,
			blankrows: false,
		});
	}
	function modelFor(carrier) {
		const m = root.ShipGridQuoteDefaults?.[carrier];
		if (!m) throw Error("承运商标准模板未配置");
		return clone(m);
	}
	function seasonal(path) {
		return /(?:^|\.)(?:demand|resiDemand)(?:\.|$)/.test(path);
	}
	function validate(model, carrier) {
		for (const path of baseKeys[carrier]) {
			const b = get(model, path),
				max = path === "spbase" ? 71 : 150;
			if (!b || Object.keys(b).length !== max * 7)
				throw Error("基础运费不完整：" + path);
			for (const n of Object.values(b))
				if (typeof n !== "number" || !Number.isFinite(n) || n <= 0)
					throw Error("基础运费必须大于0：" + path);
		}
		for (const f of fields(model, carrier)) {
			const k = f.path.split(".").at(-1),
				v = f.value;
			if (k === "start" || k === "end") {
				if (
					!/^20\d\d-\d\d-\d\d$/.test(v) ||
					!Number.isFinite(new Date(v + "T00:00:00Z").getTime()) ||
					new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
				)
					throw Error("旺季日期格式须为YYYY-MM-DD：" + f.path);
			} else if (
				v === null &&
				/\.demand\.\d+\.unauthorized$/.test("." + f.path)
			) {
				continue;
			} else if (
				typeof v !== "number" ||
				!Number.isFinite(v) ||
				v < 0 ||
				(k === "dim" && v <= 0) ||
				(["factor", "fuel"].includes(k) && v > 1)
			)
				throw Error("请填写有效非负数字：" + label(f.path));
		}
		function periods(o) {
			for (const [k, v] of Object.entries(o)) {
				if (k === "demand" || k === "resiDemand") {
					const ps = Array.isArray(v) ? v : [v];
					for (const p of ps) {
						if (p.start > p.end) throw Error("旺季结束日期早于开始日期");
					}
					const sorted = [...ps].sort((a, b) => a.start.localeCompare(b.start));
					for (let i = 1; i < sorted.length; i++)
						if (sorted[i].start <= sorted[i - 1].end)
							throw Error("同一收费项目旺季日期重叠");
				} else if (v && typeof v === "object") periods(v);
			}
		}
		periods(model);
		return model;
	}
	function seasonSpec(carrier) {
		const simple = { start: "date", end: "date", fee: "number" },
			demand = {
				start: "date",
				end: "date",
				ahs: "number",
				os: "number",
				unauthorized: "optional",
			};
		return carrier === "ontrac"
			? {
					demand: { array: false, keys: { ...demand, max: "number" } },
					resiDemand: { array: false, keys: simple },
				}
			: carrier === "fedex"
				? {
						demand: { array: true, keys: demand },
						resiDemand: { array: true, keys: simple },
						"sp.demand": { array: true, keys: simple },
					}
				: {
						"comm.demand": { array: true, keys: demand },
						"resi.demand": { array: true, keys: demand },
						"comm.resiDemand": { array: true, keys: simple },
						"resi.resiDemand": { array: true, keys: simple },
					};
	}
	function parseV1(wb, carrier) {
		const meta = rows(wb, "SG标准价表"),
			v = Object.fromEntries(meta.slice(1).map((r) => [r[0], r[1]]));
		if (v["格式版本"] !== "SG-QUOTE-1" || v["承运商"] !== names[carrier])
			throw Error("标准价表承运商或格式版本不匹配");
		const model = modelFor(carrier),
			spec = fields(model, carrier).filter((f) => !seasonal(f.path)),
			byPath = new Map(spec.map((f) => [f.path, f])),
			seen = new Set(),
			seasons = seasonSpec(carrier),
			seasonGroups = new Map();
		for (const [path, ss] of Object.entries(seasons))
			set(model, path, ss.array ? [] : {});
		for (const sheet of ["计费参数", "旺季参数"]) {
			const a = rows(wb, sheet);
			if (a[0]?.[0] !== "字段代码" || a[0]?.[2] !== "填写值")
				throw Error("请保留标准参数表头");
			for (const r of a.slice(1)) {
				if (!r.some((v) => v !== null && v !== "")) continue;
				const path = String(r[0] ?? "").trim();
				let type = "number",
					group = null;
				if (sheet === "计费参数") {
					if (!byPath.has(path)) throw Error("未知字段代码：" + path);
				} else {
					for (const [p, ss] of Object.entries(seasons)) {
						if (!path.startsWith(p + ".")) continue;
						const tail = path.slice(p.length + 1).split(".");
						if (ss.array) {
							if (tail.length !== 2 || !/^\d+$/.test(tail[0]) || +tail[0] > 99)
								continue;
							group = p + "." + tail[0];
						} else {
							if (tail.length !== 1) continue;
							group = p;
						}
						const key = tail.at(-1);
						if (!ss.keys[key]) {
							group = null;
							continue;
						}
						type = ss.keys[key];
						if (!seasonGroups.has(group))
							seasonGroups.set(group, { spec: ss, keys: new Set() });
						seasonGroups.get(group).keys.add(key);
						break;
					}
					if (!group) throw Error("未知旺季字段代码：" + path);
				}
				if (seen.has(path)) throw Error("重复字段代码：" + path);
				seen.add(path);
				const raw = r[2];
				let val;
				if (type === "date") {
					if (typeof raw === "number") {
						const d = X().SSF.parse_date_code(raw);
						val = d
							? [
									d.y,
									String(d.m).padStart(2, "0"),
									String(d.d).padStart(2, "0"),
								].join("-")
							: "";
					} else val = String(raw ?? "").trim();
				} else val = raw === null || raw === "" ? null : Number(raw);
				set(model, path, val);
			}
		}
		if (spec.some((f) => !seen.has(f.path)))
			throw Error("标准价表缺少参数，请重新下载完整模板");
		for (const [p, ss] of Object.entries(seasons)) {
			const season = get(model, p);
			if (!ss.array && !seasonGroups.has(p)) throw Error("缺少旺季字段：" + p);
			if (
				(ss.array && season.some((v) => !v)) ||
				(ss.array && Object.keys(season).length !== season.length)
			)
				throw Error("旺季序号须从0开始连续填写：" + p);
		}
		for (const [p, g] of seasonGroups)
			if (Object.keys(g.spec.keys).some((k) => !g.keys.has(k)))
				throw Error("旺季期间参数不完整：" + p);
		for (const path of baseKeys[carrier]) set(model, path, {});
		const b = rows(wb, "基础运费");
		if (
			b[0]?.[0] !== "服务代码" ||
			b[0]?.[1] !== "计费重LB" ||
			[2, 3, 4, 5, 6, 7, 8].some((z, i) => b[0][i + 2] !== "Zone " + z)
		)
			throw Error("请保留标准基础运费表头");
		for (const r of b.slice(1)) {
			if (!r.some((v) => v !== null && v !== "")) continue;
			const path = String(r[0] ?? ""),
				w = Number(r[1]);
			if (
				!baseKeys[carrier].includes(path) ||
				!Number.isInteger(w) ||
				w < 1 ||
				w > (path === "spbase" ? 71 : 150)
			)
				throw Error("无效服务/重量：" + path + " / " + r[1]);
			const rates = get(model, path);
			if (rates[w + "|2"] !== undefined)
				throw Error("基础运费行重复：" + path + " / " + w);
			for (let z = 2; z <= 8; z++)
				rates[w + "|" + z] = r[z] === null || r[z] === "" ? null : Number(r[z]);
		}
		return validate(model, carrier);
	}

	function workbookV1(carrier, model) {
		model = clone(model || modelFor(carrier));
		const wb = X().utils.book_new(),
			add = (name, a) => {
				const s = X().utils.aoa_to_sheet(a);
				s["!cols"] = a[0].map((v, i) => ({
					wch:
						name === "基础运费"
							? i === 0
								? 24
								: 15
							: i === 0
								? 34
								: i === 1
									? 64
									: 24,
				}));
				s["!autofilter"] = {
					ref: X().utils.encode_range(
						{ r: 0, c: 0 },
						{ r: a.length - 1, c: a[0].length - 1 },
					),
				};
				X().utils.book_append_sheet(wb, s, name);
				return s;
			};
		add("SG标准价表", [
			["项目", "内容"],
			["格式版本", "SG-QUOTE-1"],
			["承运商", names[carrier]],
			["币种", "USD"],
			["单位", "LB / INCH"],
			[
				"填写方式",
				"修改基础运费及参数值；保留工作表名、字段代码及服务代码。数值直接填写，不带公式。",
			],
			[
				"空白字段",
				"空白为待填写，不代表0；不收取的费用填0。基础运费必须完整且大于0。",
			],
			[
				"燃油比例",
				"填写支付比例，例如0.6代表支付公布燃油费率的60%，不要填写折扣OFF。",
			],
			["旺季", "同一项目日期不得重叠；更换年份直接修改日期和值，停收填0。"],
			[
				"尺寸规则",
				carrier === "ontrac"
					? "小体积同样计算体积重；AHS（含非标）最低40LB；整套触发等级→基础费→计费重"
					: carrier === "ups"
						? "AHS-D最低40LB；OS最低90LB；超过150LB/服务极限转异常"
						: "AHS-D最低40LB；OS最低90LB；SmartPost规则沿用模块",
			],
			["使用", "填写后作为固定报价或特殊报价上传；可将原有报价转换后再更新。"],
			[
				"报价来源",
				"当前选择的已解析报价；未选择时为内置参考/空白字段，请按实际客户报价确认。",
			],
		]);
		const b = [
			[
				"服务代码",
				"计费重LB",
				...Array.from({ length: 7 }, (_, i) => "Zone " + (i + 2)),
			],
		];
		for (const path of baseKeys[carrier])
			for (let w = 1; w <= (path === "spbase" ? 71 : 150); w++)
				b.push([
					path,
					w,
					...Array.from(
						{ length: 7 },
						(_, i) => get(model, path)?.[w + "|" + (i + 2)] ?? null,
					),
				]);
		add("基础运费", b);
		const f = fields(model, carrier),
			make = (season) => [
				["字段代码", "费用名称 / 分区", "填写值"],
				...f
					.filter((x) => seasonal(x.path) === season)
					.map((x) => [x.path, label(x.path), x.value]),
			];
		add("计费参数", make(false));
		add("旺季参数", make(true));
		return wb;
	}
	const carrierSheets = {
		ontrac: [{ name: "OnTrac基础运费", path: "base" }],
		fedex: [{ name: "FedEx基础运费", path: "ngbase" }],
		ups: [
			{ name: "UPS Commercial", path: "comm.base" },
			{ name: "UPS Residential", path: "resi.base" },
		],
	};
	function workbook(carrier, model) {
		const m = clone(model || modelFor(carrier)),
			wb = workbookV1(carrier, m);
		delete wb.Sheets["基础运费"];
		wb.SheetNames = wb.SheetNames.filter((n) => n !== "基础运费");
		const meta = wb.Sheets["SG标准价表"];
		meta.B2 = { t: "s", v: "SG-QUOTE-2" };
		const extra = [
			[
				"基础运费结构",
				carrier === "ups"
					? "Commercial和Residential各一张1–150LB基础费表，价格独立。"
					: carrier === "fedex"
						? "一张1–150LB基础费表。Ground/Home Delivery与SmartPost分列；SmartPost仅1–71LB适用，72–150LB留空。"
						: "一张1–150LB、2–8区基础费表。",
			],
			[
				"旺季默认日期",
				"按各承运商2026/2027美国国内官网公告预填；客户收费金额按报价填写，不用公布价替代客户价。",
			],
			["旺季官网来源", root.ShipGridPeakDefaults?.[carrier]?.source || ""],
			["官网核对日期", "2026-10-18"],
		];
		X().utils.sheet_add_aoa(meta, extra, { origin: -1 });
		let insert = 1;
		for (const item of carrierSheets[carrier]) {
			const zs = Array.from({ length: 7 }, (_, i) => "Zone " + (i + 2)),
				a = [
					[
						"计费重LB",
						...zs,
						...(carrier === "fedex" ? zs.map((z) => "SmartPost " + z) : []),
					],
				];
			for (let w = 1; w <= 150; w++)
				a.push([
					w,
					...zs.map((_, i) => get(m, item.path)?.[w + "|" + (i + 2)] ?? null),
					...(carrier === "fedex"
						? zs.map((_, i) =>
								w <= 71 ? (m.spbase?.[w + "|" + (i + 2)] ?? null) : null,
							)
						: []),
				]);
			const sheet = X().utils.aoa_to_sheet(a);
			sheet["!cols"] = a[0].map((_, i) => ({
				wch: i === 0 ? 16 : carrier === "fedex" && i > 7 ? 21 : 15,
			}));
			sheet["!autofilter"] = {
				ref: X().utils.encode_range(
					{ r: 0, c: 0 },
					{ r: 150, c: a[0].length - 1 },
				),
			};
			wb.Sheets[item.name] = sheet;
			wb.SheetNames.splice(insert++, 0, item.name);
		}
		return wb;
	}
	function parse(wb, carrier) {
		const v = Object.fromEntries(
			rows(wb, "SG标准价表")
				.slice(1)
				.map((r) => [r[0], r[1]]),
		);
		if (v["格式版本"] === "SG-QUOTE-1") return parseV1(wb, carrier);
		if (v["格式版本"] !== "SG-QUOTE-2" || v["承运商"] !== names[carrier])
			throw Error("标准价表承运商或格式版本不匹配");
		const converted = {
				SheetNames: ["SG标准价表", "基础运费", "计费参数", "旺季参数"],
				Sheets: {
					SG标准价表: X().utils.aoa_to_sheet([
						["项目", "内容"],
						["格式版本", "SG-QUOTE-1"],
						["承运商", names[carrier]],
					]),
					计费参数: wb.Sheets["计费参数"],
					旺季参数: wb.Sheets["旺季参数"],
				},
			},
			base = [
				[
					"服务代码",
					"计费重LB",
					...Array.from({ length: 7 }, (_, i) => "Zone " + (i + 2)),
				],
			];
		for (const item of carrierSheets[carrier]) {
			const a = rows(wb, item.name),
				h = a[0];
			if (
				h?.[0] !== "计费重LB" ||
				Array.from({ length: 7 }, (_, i) => "Zone " + (i + 2)).some(
					(z, i) => h[i + 1] !== z,
				)
			)
				throw Error("请保留" + item.name + "表头");
			if (
				carrier === "fedex" &&
				Array.from({ length: 7 }, (_, i) => "SmartPost Zone " + (i + 2)).some(
					(z, i) => h[i + 8] !== z,
				)
			)
				throw Error("请保留SmartPost分区列");
			const weights = new Set();
			for (const r of a.slice(1)) {
				if (!r.some((x) => x !== null && x !== "")) continue;
				const w = Number(r[0]);
				if (!Number.isInteger(w) || w < 1 || w > 150 || weights.has(w))
					throw Error(item.name + "重量需完整且不重复：1–150LB");
				weights.add(w);
				base.push([item.path, w, ...r.slice(1, 8)]);
				if (carrier === "fedex") {
					if (w <= 71) base.push(["spbase", w, ...r.slice(8, 15)]);
					else if (r.slice(8, 15).some((v) => v !== null && v !== ""))
						throw Error(
							"SmartPost 72–150LB不适用，请留空；不能据此扩展服务重量范围",
						);
				}
			}
			if (weights.size !== 150)
				throw Error(item.name + "必须提供1–150LB共150行基础运费");
		}
		converted.Sheets["基础运费"] = X().utils.aoa_to_sheet(base);
		return parseV1(converted, carrier);
	}

	function engine(carrier) {
		return carrier === "ups"
			? root.UPSBilling
			: carrier === "fedex"
				? root.FedExBilling
				: root.OnTracBilling;
	}
	function download(carrier, wb) {
		if (!wb && root.ShipGridStandardTemplateFiles?.[carrier]) {
			const bytes = Uint8Array.from(
					atob(root.ShipGridStandardTemplateFiles[carrier]),
					(c) => c.charCodeAt(0),
				),
				url = URL.createObjectURL(
					new Blob([bytes], {
						type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					}),
				),
				a = document.createElement("a");
			a.href = url;
			a.download = "ShipGrid_" + names[carrier] + "_标准价表.xlsx";
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			return;
		}
		const model = wb ? engine(carrier).quote(wb) : null;
		X().writeFile(
			workbook(carrier, model),
			"ShipGrid_" + names[carrier] + "_标准价表.xlsx",
		);
	}
	root.ShipGridStandardQuotes = {
		is,
		parse,
		validate,
		workbook,
		download,
		modelFor,
	};
})(globalThis);
