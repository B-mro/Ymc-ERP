/*
 * ============================================================================
 * ShipGrid UPS Ground 账单计费核心引擎
 * 文件: engine/ups-billing.js
 * ----------------------------------------------------------------------------
 * 本文件实现 UPS Ground（商业/住宅/Hundredweight）账单的完整客户账单生成逻辑。
 * 输入为 UPS 原始账单（270列无表头CSV 或 带表头Excel）+ GTS系统数据 + 客户报价表，
 * 输出为逐单客户账单 + 客户汇总 + 异常清单 + 计费说明的完整 Excel 工作簿。
 *
 * 核心流程：
 *   1. parseRaw()  — 解析原始账单（支持270列无表头格式或带表头格式）
 *   2. gtsIndex()  — 建立 GTS 主单号/子单号/转单号 → 订单信息映射
 *   3. quote()     — 解析客户报价 Excel，生成 Commercial / Residential 双价表结构
 *   4. calculate() — 主计算循环：逐运单进行计费重决策、附加费匹配、燃油计算
 *   5. workbook()  — 将结果组织为多工作表 Excel 工作簿
 *   6. bytes()     — 给结果 Excel 添加红色高亮（用于警示行）后输出 xlsx 二进制
 *
 * 暴露全局对象：root.UPSBilling = { quote, calculate, parseRaw, workbook, bytes, grade, date }
 *
 * 依赖：
 *   root.XLSX                    — SheetJS Excel 读写库
 *   root.UPSInvoiceFuel          — UPS 燃油费率历史查询 + 270列表头定义（同模块）
 *   root.ShipGridChildInvoice    — 子单账单匹配引擎（跨模块共享）
 *   root.ShipGridWeightPolicy    — 重量政策算法（跨模块共享）
 *   root.ShipGridStandardQuotes  — 标准价表解析器（跨模块共享）
 *
 * UPS Ground 专属计费规则摘要：
 *   • 报价仅支持 Zone 2–8（美国本土），重量 1–150 LB
 *   • AHS（Additional Handling）最低计费重：2026-12-21 前 40LB，之后 50LB
 *   • OS（Large Package / Over Maximum）最低计费重 90LB
 *   • DIM 取报价表中约定的体积除数（通常 139）
 *   • 尺寸等级 grade()：3级 → 超出Ground范围；2级 → OS触发；1级 → AHS触发；0级 → 无附加
 *   • 燃油 = 燃油基数 × 官方费率 × 客户燃油支付比例（factor）
 * ============================================================================
 */
/*SG-AUDIT:finance-33.js*/ (function (root) {
	"use strict";

	// ---------- 通用工具函数 ----------
	// ceil: 进一法取整（考虑浮点误差），round: 保留2位小数，kg: 公斤→磅换算常数
	const X = () => root.XLSX,
		ceil = (v) => Math.ceil(v - 1e-10),
		round = (v) => Math.round((v + Number.EPSILON) * 100 + 1e-8) / 100,
		kg = 2.2046226218487757;
	// GTS 尺寸截断到毫米精度，然后进一到厘米
	const gtsTrunc = (v) => Math.trunc(v * 1000 + 1e-7) / 1000,
		gtsCeil = (v) => Math.ceil(gtsTrunc(v));
	// text: 安全转字符串并去空白；number: 解析金额/数值（去除$和千分位逗号）
	const text = (v) => String(v ?? "").trim(),
		number = (v) =>
			text(v) === "" ? null : Number(text(v).replace(/[$,]/g, ""));
	// value: 非负数值校验，缺失/非法时抛异常；positive: 正数校验
	function value(v, name) {
		const n = number(v);
		if (n === null || !Number.isFinite(n) || n < 0)
			throw Error("缺少有效报价：" + name);
		return n;
	}
	function positive(v, name) {
		const n = value(v, name);
		if (n <= 0) throw Error("缺少有效" + name);
		return n;
	}
	// matrix: 将 Excel 工作表转为二维数组（header:1 模式），保留所有空行
	function matrix(wb, name) {
		return X().utils.sheet_to_json(wb.Sheets[name || wb.SheetNames[0]], {
			header: 1,
			raw: true,
			defval: null,
			blankrows: true,
		});
	}
	// date: 解析多种日期格式（Excel序列号 / 2024-01-15 / 2024/1/15 / ISO字符串），返回 YYYY-MM-DD 或 null
	function date(v) {
		if (typeof v === "number" && v < 100000) {
			const d = X().SSF.parse_date_code(v);
			if (d) v = [d.y, d.m, d.d].join("-");
		}
		const s = text(v),
			m = s.match(/^(20\d\d)[/.-]?(\d{1,2})[/.-]?(\d{1,2})(?:\s|T|$)/);
		if (!m) return null;
		const d = m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
		return new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d
			? d
			: null;
	}
	// period: 解析日期区间字符串 "2024.01.01-2024.01.15" → {start, end}，用于旺季附加费区间匹配
	function period(v) {
		const m = text(v).match(
			/(20\d\d)[.\/-](\d+)[.\/-](\d+)\s*-\s*(20\d\d)[.\/-](\d+)[.\/-](\d+)/,
		);
		return m
			? {
					start: date(m.slice(1, 4).join("-")),
					end: date(m.slice(4, 7).join("-")),
				}
			: null;
	}
	/**
	 * quote(wb) — 解析 UPS 客户报价 Excel
	 * 参数: wb — XLSX 工作簿对象
	 * 返回: { comm: 商业报价结构, resi: 住宅报价结构 }
	 *
	 * 报价结构关键字段：
	 *   base       — "重量|分区" → 基础运费 映射（key 示例 "10|3"，支持 Zone 2-8、重量 1-150LB）
	 *   factor     — 燃油支付比例（0–1 之间的小数，表示客户承担的燃油费率百分比）
	 *   dim        — 体积重量除数（DIM Divisor，通常为 139）
	 *   resi       — 住宅附加费 [Z2, Z3-4, Z5-6, Z7-8] 四档
	 *   ahsD       — 尺寸型 AHS 四档
	 *   ahsW       — 重量型 AHS 四档
	 *   ahsP       — 包装型 AHS 四档
	 *   os         — 超大件附加费四档
	 *   dasR/dasC  — 住宅/商业 DAS（Delivery Area Surcharge）四档
	 *   edasR/edasC — 住宅/商业 EDAS（Extended DAS）四档
	 *   remoteR/remoteC — 住宅/商业 Remote Area 四档
	 *   direct/indirect/adult — 签名费四档
	 *   declaredMin — 申报价值最低收费
	 *   declaredPer100 — 每 $100 申报价值保费
	 *   demand     — 旺季非住宅附加费区间 [{start,end,ahs,os,unauthorized}]
	 *   resiDemand — 旺季住宅附加费区间 [{start,end,fee}]
	 */
	function quote(wb) {
		if (root.ShipGridStandardQuotes?.is(wb))
			return root.ShipGridStandardQuotes.parse(wb, "ups");
		const comm = wb.SheetNames.find((n) => /COMM|Base Rate Comm/i.test(n)),
			resi = wb.SheetNames.find((n) => /RESI/i.test(n));
		if (!comm || !resi)
			throw Error(
				"UPS报价需含Commercial和Residential两张价表，或使用UPS标准价表",
			);
		const parseSheet = (name, isResi) => {
			const a = matrix(wb, name),
				hf = name.toUpperCase().startsWith("UPS GROUND"),
				get = (r, c) => a[r - 1]?.[c - 1],
				g = (r) =>
					[8, 9, 10, 11].map((c) => value(get(r, c), "附加费第" + r + "行")),
				p = (r) => value(get(r, 18), "附加费第" + r + "行"),
				pg = (r) => [0, 1, 2, 3].map((i) => p(r + i));
			const base = {};
			let count = 0;
			for (const r of a) {
				if (
					typeof r[0] === "number" &&
					Number.isInteger(r[0]) &&
					r[0] >= 1 &&
					r[0] <= 150
				) {
					if (base[r[0] + "|2"] !== undefined) throw Error("基础运费重量重复");
					for (let z = 2; z <= 8; z++)
						base[r[0] + "|" + z] = positive(r[z - 1], "基础运费");
					count++;
				}
			}
			if (count !== 150) throw Error("UPS基础价需完整1–150LB、2–8区");
			let out;
			if (hf) {
				const fm = text(get(168, 8)).match(/(?:\*|×)\s*(\d+(?:\.\d+)?)/),
					dm = a
						.flat()
						.filter((x) => typeof x === "string")
						.join(" ")
						.match(/DIM\s*(\d+)/i);
				if (!fm || !dm) throw Error("无法识别UPS燃油支付比例或DIM");
				out = {
					base,
					factor: +fm[1],
					dim: +dm[1],
					resi: g(170),
					ahsD: g(171),
					ahsW: g(175),
					ahsP: g(179),
					os: g(186),
					unauthorized: g(187),
					dasR: g(190),
					dasC: g(191),
					edasR: g(192),
					edasC: g(193),
					remoteR: g(194),
					remoteC: Array(4).fill(value(get(195, 8), "Remote Commercial")),
					indirect: g(196),
					direct: g(197),
					adult: g(198),
					address: g(199),
					declaredMin: value(get(201, 8), "Declared minimum"),
					declaredPer100: positive(
						text(get(202, 8)).match(/USD\s*(\d+(?:\.\d+)?)/i)?.[1],
						"Declared per100",
					),
					demand: [],
					resiDemand: [],
				};
				for (const r of a) {
					const d = period(r[0]);
					if (d) {
						if (r[6] !== null && r[6] !== undefined)
							out.demand.push({
								...d,
								ahs: value(r[3], "Demand AHS"),
								os: value(r[6], "Demand OS"),
								unauthorized: value(r[9], "Demand Unauthorized"),
							});
						else
							out.resiDemand.push({
								...d,
								fee: value(r[3], "Demand Residential"),
							});
					}
				}
			} else {
				const f = text(get(3, 14)).match(/(\d+(?:\.\d+)?)\s*折/);
				if (!f) throw Error("无法识别UPS燃油折扣");
				const same = (r) => Array(4).fill(p(r));
				out = {
					base,
					factor: +f[1] / 10,
					dim: positive(get(5, 18), "DIM"),
					resi: same(isResi ? 7 : 6),
					ahsD: pg(8),
					ahsW: pg(12),
					ahsP: pg(16),
					os: pg(isResi ? 24 : 20),
					unauthorized: same(28),
					address: same(31),
					dasC: same(32),
					dasR: same(33),
					edasC: same(34),
					edasR: same(35),
					remoteC: same(36),
					remoteR: same(37),
					indirect: same(38),
					direct: same(39),
					adult: same(40),
					declaredMin: p(42),
					declaredPer100: positive(get(43, 16), "Declared per100"),
					demand: [],
					resiDemand: [],
				};
				for (let i = 44; i <= 46; i++) {
					const d = period(get(i, 14));
					if (!d) throw Error("旺季住宅日期无法识别");
					out.resiDemand.push({ ...d, fee: p(i) });
				}
				for (let i = 47; i <= 49; i++) {
					const d = period(get(i, 14));
					if (!d) throw Error("旺季日期无法识别");
					out.demand.push({
						...d,
						ahs: p(i),
						os: p(i + 3),
						unauthorized: null,
					});
				}
			}
			if (out.factor < 0 || out.factor > 1) throw Error("燃油支付比例须为0–1");
			return out;
		};
		return { comm: parseSheet(comm, false), resi: parseSheet(resi, true) };
	}
	/**
	 * parseRaw(wb) — 解析 UPS 原始账单
	 * 支持两种格式：
	 *   1. 带表头的 Excel（通过 "Tracking Number" + "Net Amount" 定位表头行）
	 *   2. 270 列无表头 CSV/Excel（调用 UPSInvoiceFuel.isHeaderless 自动识别）
	 * 返回: { headers: string[], raw: [{...headers映射, __row: 原始行号}] }
	 */
	function parseRaw(wb) {
		const name =
				wb.SheetNames.find((n) => /原始/.test(n)) ||
				wb.SheetNames.find((n) => n.trim().toUpperCase() !== "GTS"),
			a = matrix(wb, name),
			hi = a.findIndex(
				(r) => r.includes("Tracking Number") && r.includes("Net Amount"),
			);
		let headers, start;
		if (hi >= 0) {
			headers = a[hi].map(text);
			start = hi + 1;
		} else if (
			a[0]?.length <= root.UPSInvoiceFuel.headerlessSchema.length &&
			root.UPSInvoiceFuel.isHeaderless(
				Array.from(
					{ length: root.UPSInvoiceFuel.headerlessSchema.length },
					(_, i) => a[0][i] ?? "",
				),
			)
		) {
			headers = root.UPSInvoiceFuel.headerlessSchema;
			start = 0;
		} else throw Error("未识别UPS原始账单：支持带表头或270列无表头CSV/Excel");
		const raw = a
			.slice(start)
			.filter((r) => r.some((v) => v !== null && v !== ""))
			.map((r, i) => ({
				...Object.fromEntries(headers.map((h, j) => [h, r[j] ?? ""])),
				__row: i + start + 1,
			}));
		return { headers, raw };
	}
	/**
	 * gtsIndex(wb) — 建立 GTS 系统数据索引
	 * 参数: wb — GTS Excel 工作簿（可选，支持账单内嵌 GTS 工作表）
	 * 返回: {
	 *   entries: Map<订单ID, GTS订单信息对象>,
	 *   index:   Map<主单号|子单号|转单号, Set<订单ID>>  — 用于通过运单号反查订单
	 * }
	 */
	function gtsIndex(wb) {
		const entries = new Map(),
			index = new Map();
		if (!wb) return { entries, index };
		const name =
				wb.SheetNames.find((n) => n.trim().toUpperCase() === "GTS") ||
				wb.SheetNames[0],
			a = matrix(wb, name);
		if (!a.length) return { entries, index };
		const h = a[0].map(text);
		if (!["主单号", "子单号", "转单号"].some((k) => h.includes(k)))
			throw Error("GTS缺少主单号/子单号/转单号表头");
		for (let i = 1; i < a.length; i++) {
			const g = Object.fromEntries(h.map((k, j) => [k, a[i][j] ?? ""]));
			let id = text(g["订单ID"]) || "row-" + (i + 1);
			if (entries.has(id)) id += "@row-" + (i + 1);
			entries.set(id, g);
			const keys = new Set(
				["主单号", "子单号", "转单号"].map((k) => text(g[k])).filter(Boolean),
			);
			for (const k of keys) {
				if (!index.has(k)) index.set(k, new Set());
				index.get(k).add(id);
			}
		}
		return { entries, index };
	}
	// z: UPS Zone 校验器，仅允许 2–8（美国本土 Ground），返回整数或抛异常
	function z(v) {
		const n = Number(v);
		if (!Number.isInteger(n) || n < 2 || n > 8)
			throw Error("报价仅支持美国本土2–8区：" + v);
		return n;
	}
	// weight: 重量解析，支持 LB/KG 单位，KG 自动换算为 LB 后进一取整；返回 null 表示无有效重量
	function weight(v, unit) {
		const n = number(v);
		if (n === null || n <= 0) return null;
		const u = text(unit).toUpperCase();
		if (!["L", "LB", "LBS", "K", "KG", "KGS"].includes(u))
			throw Error("未识别UPS重量单位：" + unit);
		return ceil(n * (u.startsWith("K") ? kg : 1));
	}
	// dimensions: 解析 "Package Dimensions" 字段，返回 [L, W, H]（英寸，降序排列），单位自动转换 CM→IN
	function dimensions(r) {
		const s = text(r["Package Dimensions"]),
			m = s.match(
				/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/,
			);
		if (!m) return null;
		const unit = text(r["Package Dimension Unit Of Measure"]).toUpperCase(),
			factor = ["C", "CM"].includes(unit) ? 2.54 : 1;
		if (unit && !["C", "CM", "I", "IN", "INCH"].includes(unit))
			throw Error("未识别UPS尺寸单位：" + unit);
		return m
			.slice(1)
			.map((v) => ceil(+v / factor))
			.sort((a, b) => b - a);
	}
	function grade(d, a) {
		const [L, W, H] = d,
			g = L + 2 * W + 2 * H,
			v = L * W * H;
		return L > 108 || g > 165 || a > 150
			? 3
			: L > 96 || g > 130 || v > 17280 || a > 110
				? 2
				: L > 48 || W > 30 || g > 105 || v > 10368 || a > 50
					? 1
					: 0;
	}
	/**
	 * chargeCode(r) — 将原始账单费用行归类为内部代码
	 * 参数: r — 原始账单行对象（含 "Charge Description" 等字段）
	 * 返回的代码值：
	 *   fuel / demandUA / demandOS / demandAHS / demandResi / unauthorized / os
	 *   ahsP / ahsW / ahsD / ahsUnknown（Additional Handling 三类 + 未知）
	 *   remote / edas / das（Delivery Area 三档）
	 *   resi / adult / indirect / direct / declared / address / unknown
	 */
	function chargeCode(r) {
		const s = (
			text(r["Charge Description"]) +
			" " +
			text(r["Miscellaneous Line 1"])
		).toLowerCase();
		if (/fuel/.test(s)) return "fuel";
		if (/demand|peak|surge/.test(s))
			return /over maximum|unauthorized/.test(s)
				? "demandUA"
				: /large package|oversize/.test(s)
					? "demandOS"
					: /handling/.test(s)
						? "demandAHS"
						: /residential/.test(s)
							? "demandResi"
							: "unknown";
		if (/over maximum|unauthorized/.test(s)) return "unauthorized";
		if (/large package|oversize/.test(s)) return "os";
		if (/additional handling/.test(s))
			return /non.corrugated|packaging|irregular/.test(s)
				? "ahsP"
				: /weight/.test(s)
					? "ahsW"
					: /length|width|girth|dimension/.test(s)
						? "ahsD"
						: "ahsUnknown";
		if (/delivery area|remote area/.test(s))
			return /remote/.test(s) ? "remote" : /extended/.test(s) ? "edas" : "das";
		if (/residential/.test(s)) return "resi";
		if (/signature/.test(s))
			return /adult/.test(s)
				? "adult"
				: /indirect/.test(s)
					? "indirect"
					: "direct";
		if (/declared|insured/.test(s)) return "declared";
		if (/address correction/.test(s)) return "address";
		return "unknown";
	}
	// feeNames: 输出 Excel 中附加费列的名称列表，与 chargeCode 返回值一一对应
	const feeNames = [
		"Residential Surcharge",
		"Delivery Area Surcharge",
		"Delivery Area Surcharge - Extended",
		"Delivery Area Surcharge - Remote",
		"Additional Handling - Dimension",
		"Additional Handling - Weight",
		"Additional Handling - Packaging",
		"Large Package Surcharge",
		"Address Correction",
		"Signature Required",
		"Adult Signature Required",
		"Declared Value",
		"Demand Additional Handling",
		"Demand Large Package",
		"Demand Residential",
		"Fuel Surcharge",
	];
	// headers: 客户账单 Excel 输出的完整表头（35 列）
	const headers = [
		"客户ID",
		"客户名称",
		"采用报价表",
		"Tracking Number",
		"Lead Shipment Number",
		"订单号",
		"原始服务",
		"客户服务",
		"Transaction Date",
		"Zone",
		"Actual Weight LB",
		"Billed Weight LB",
		"Length IN",
		"Width IN",
		"Height IN",
		"DIM",
		"尺寸重量来源",
		"取值说明",
		"Transportation Charge",
		...feeNames,
		"其他费用",
		"Total Charge",
		"原始账单成本",
		"费用差额",
		"警示",
		"原始最终计费重LB",
		"GTS实重LB（进一）",
		"GTS体积重LB（重算）",
		"价格保护说明",
	];
	/**
	 * calculate(rawWb, gtsWb, qWb, options) — UPS Ground 主计算函数
	 *
	 * 参数:
	 *   rawWb    — UPS 原始账单工作簿
	 *   gtsWb    — GTS 系统数据工作簿（账单内嵌 GTS 时可从 rawWb 取）
	 *   qWb      — 客户报价工作簿；或 resolver 函数（function(g){return{wb, customerId, customerName, name}}）
	 *   options.childInvoice — 子单账单数据（用于分区代码和住宅/偏远证据）
	 *
	 * 返回结构:
	 *   rows[]      — 逐单计费结果，每行含计费明细 + data（Excel 行数组）
	 *   errors[]    — 异常清单（含 tracking, 原因, 原始净额）
	 *   headers     — Excel 输出表头
	 *   customers[] — 客户汇总
	 *   accounts[]  — 账号级费用行（无运单号的）
	 *   excluded[]  — 公司承担费用行
	 *   summary     — 整体统计摘要
	 *   quote       — 报价元信息
	 *   childIndex  — 子单账单索引
	 *
	 * 核心决策链（逐运单）：
	 *   1. 分组 — 按 Account|Invoice|Tracking 聚合多行费用
	 *   2. 匹配 GTS — 通过主/子/转单号反查订单数据（尺寸/重量/客户信息）
	 *   3. 尺寸/重量候选 — UPS 原始完整数据 VS GTS 完整数据，按 grade→基础运费→计费重 三级取高
	 *   4. 附加费匹配 — 依据 chargeCode 分组统计，对照报价表四档价格
	 *   5. 燃油计算 — 燃油基数（基础费+适用附加费）× 官方燃油费率 × 客户 factor
	 */
	function calculate(rawWb, gtsWb, qWb, options = {}) {
		const childIndex = root.ShipGridChildInvoice.build(options.childInvoice);
		const { raw } = parseRaw(rawWb),
			{ entries, index } = gtsIndex(gtsWb),
			resolver = typeof qWb === "function" ? qWb : null,
			cache = new Map();
		let tariff = resolver ? null : quote(qWb);
		const groups = new Map(),
			accounts = [],
			informational = [],
			rows = [],
			errors = [],
			used = new Set();
		const paid = (r) => {
			const n = number(r["Net Amount"]);
			if (n === null || !Number.isFinite(n))
				throw Error("无效Net Amount，第" + r.__row + "行");
			return n;
		};
		for (const r of raw) {
			paid(r);
			const track = text(r["Tracking Number"]),
				cat = text(r["Charge Category Code"]);
			if (!track || cat === "MIS") {
				accounts.push(r);
				continue;
			}
			const key = [
				text(r["Account Number"]),
				text(r["Invoice Number"]),
				track,
			].join("|");
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(r);
		}
		const mainCounts = new Map();
		for (const r of raw)
			if (
				r["Charge Category Code"] === "SHP" &&
				r["Charge Classification Code"] === "FRT" &&
				/^Ground (Commercial|Residential|Hundredweight)$/.test(
					text(r["Charge Description"]),
				)
			)
				mainCounts.set(
					text(r["Tracking Number"]),
					(mainCounts.get(text(r["Tracking Number"])) || 0) + 1,
				);
		const leads = new Map();
		for (const rs of groups.values()) {
			const main = rs.find(
				(r) =>
					r["Charge Category Code"] === "SHP" &&
					r["Charge Classification Code"] === "FRT" &&
					/^Ground (Commercial|Residential|Hundredweight)$/.test(
						text(r["Charge Description"]),
					),
			);
			if (main) {
				const key = [
					main["Account Number"],
					main["Invoice Number"],
					main["Transaction Date"],
					main["Lead Shipment Number"] || main["Tracking Number"],
				].join("|");
				if (!leads.has(key)) leads.set(key, { residential: false });
				if (
					rs.reduce(
						(sum, r) => sum + (chargeCode(r) === "resi" ? paid(r) : 0),
						0,
					) > 0
				)
					leads.get(key).residential = true;
			}
		}
		for (const rs of groups.values()) {
			const track = text(rs[0]["Tracking Number"]),
				ids = [...(index.get(track) || [])];
			let g = ids.length === 1 ? { ...entries.get(ids[0]) } : {};
			const warnings = [];
			try {
				const mains = rs.filter(
					(r) =>
						r["Charge Category Code"] === "SHP" &&
						r["Charge Classification Code"] === "FRT" &&
						/^Ground (Commercial|Residential|Hundredweight)$/.test(
							text(r["Charge Description"]),
						),
				);
				if (mains.length !== 1)
					throw Error(
						mains.length
							? "存在多条原始基础运费，需核对是否重复收费"
							: "仅有调整/附加费，缺少原始基础运费，需配对历史账单",
					);
				if (mainCounts.get(track) > 1)
					throw Error("同一运单存在跨账单重复基础费，需核实");
				const main = mains[0],
					transaction = date(main["Transaction Date"]);
				if (!transaction) throw Error("无效Transaction Date");
				const ahsRuleDate = date(main["Shipment Date"]) || transaction,
					ahsMinimum = ahsRuleDate >= "2026-12-21" ? 50 : 40;
				if (text(main["Shipment Date"]) && !date(main["Shipment Date"]))
					throw Error("无效Shipment Date，无法判断AHS最低计费重生效日期");
				if (!text(main["Shipment Date"]))
					warnings.push(
						"Shipment Date缺失：AHS最低计费重按原始运输费Transaction Date " +
							transaction +
							"判定，请核对实际发货日期",
					);
				if (
					rs.some(
						(r) =>
							text(r["Transaction Currency Code"]) !== "USD" && paid(r) !== 0,
					)
				)
					throw Error("仅支持USD账单");
				if (ids.length > 1) throw Error("GTS匹配不唯一");
				if (ids.length === 0) {
					warnings.push("GTS无匹配数据：按原始完整数据计费，同时计入异常");
				} else {
					used.add(ids[0]);
					if (
						g["件数"] !== "" &&
						g["件数"] !== undefined &&
						Number(g["件数"]) !== 1
					)
						throw Error("GTS合件订单需拆分核实");
				}
				const chosen = resolver ? resolver(g) : null;
				if (chosen) {
					if (!cache.has(chosen.wb)) cache.set(chosen.wb, quote(chosen.wb));
					tariff = cache.get(chosen.wb);
					if (chosen.customerId) g["客户ID"] = chosen.customerId;
					if (chosen.customerName) g["客户名称"] = chosen.customerName;
				}
				const customerId = text(g["客户ID"]),
					customerName = text(g["客户名称"] || g["客户名"]);
				if (!customerId)
					warnings.push(
						"客户ID缺失：仅本批统一报价可生成，分客户出账前请补充GTS",
					);
				const childResidential = root.ShipGridChildInvoice.evidence(
					childIndex,
					track,
					g,
					/Residential/.test(main["Charge Description"]) ||
						leads.get(
							[
								main["Account Number"],
								main["Invoice Number"],
								main["Transaction Date"],
								main["Lead Shipment Number"] || track,
							].join("|"),
						)?.residential === true,
				);
				const leadkey = [
						main["Account Number"],
						main["Invoice Number"],
						main["Transaction Date"],
						main["Lead Shipment Number"] || track,
					].join("|"),
					residential =
						/Residential/.test(main["Charge Description"]) ||
						leads.get(leadkey)?.residential === true ||
						childResidential.amount > 0,
					t = residential ? tariff.resi : tariff.comm;
				// INF and zero-amount correction rows contain UPS measurement evidence, not duplicate freight.
				const detail = rs.filter(
					(r) =>
						text(r["Charge Category Code"]) === "ADJ" &&
						/correction|adjustment/i.test(text(r["Charge Description"])) &&
						dimensions(r),
				);
				const dates = [
					...new Set(
						detail.map((r) => date(r["Transaction Date"])).filter(Boolean),
					),
				].sort();
				const finalMeasurements = detail.filter(
					(r) => date(r["Transaction Date"]) === dates.at(-1),
				);
				if (
					finalMeasurements.length > 1 &&
					new Set(
						finalMeasurements.map((r) =>
							[r["Package Dimensions"], r["Billed Weight"]].join("|"),
						),
					).size > 1
				)
					throw Error("同日存在冲突的更正尺寸/重量，需核实最终测量");
				const measurement =
					finalMeasurements.at(-1) ||
					rs.find(
						(r) => r["Charge Classification Code"] === "INF" && dimensions(r),
					) ||
					main;
				const weightCorrections = rs.filter(
					(r) =>
						text(r["Charge Category Code"]) === "ADJ" &&
						/^(Shipping Charge Correction(?: Ground)?|ZONE ADJUSTMENT Ground|Commercial Adjustment|Residential Adjustment)$/i.test(
							text(r["Charge Description"]),
						) &&
						number(r["Billed Weight"]) > 0,
				);
				const weightDates = [
					...new Set(weightCorrections.map((r) => date(r["Transaction Date"]))),
				];
				if (weightDates.includes(null)) throw Error("重量更正日期无效");
				const latestWeightDate = weightDates.sort().at(-1),
					finalWeights = weightCorrections.filter(
						(r) => date(r["Transaction Date"]) === latestWeightDate,
					);
				if (
					new Set(
						finalWeights.map((r) =>
							weight(
								r["Billed Weight"],
								r["Billed Weight Unit of Measure"] ||
									main["Billed Weight Unit of Measure"],
							),
						),
					).size > 1
				)
					throw Error("同日重量更正冲突，需核实最终计费重");
				const weightMeasurement = finalWeights.at(-1) || measurement;
				const rd = dimensions(measurement) || dimensions(main),
					ra =
						weight(
							measurement["Entered Weight"],
							measurement["Entered Weight Unit of Measure"] ||
								main["Entered Weight Unit of Measure"],
						) ||
						weight(
							main["Entered Weight"],
							main["Entered Weight Unit of Measure"],
						),
					rb =
						weight(
							weightMeasurement["Billed Weight"],
							weightMeasurement["Billed Weight Unit of Measure"] ||
								main["Billed Weight Unit of Measure"],
						) ||
						weight(
							main["Billed Weight"],
							main["Billed Weight Unit of Measure"],
						);
				const eventTotals = new Map();
				for (const r of rs) {
					const c = chargeCode(r);
					eventTotals.set(c, (eventTotals.get(c) || 0) + paid(r));
				}
				const codes = new Set(
						[...eventTotals].filter(([c, amt]) => amt > 0).map(([c]) => c),
					),
					event = codes.has("unauthorized")
						? 3
						: codes.has("os")
							? 2
							: [...codes].some((c) => /^ahs/.test(c))
								? 1
								: 0;
				let rz = z(main["Zone"]);
				const zoneChanges = rs.filter((r) =>
					/ZONE ADJUSTMENT/i.test(text(r["Charge Description"])),
				);
				const correctedZones = [
					...new Set(
						zoneChanges
							.map((r) => number(r["Corrected Zone"]) || number(r["Zone"]))
							.filter((v) => v >= 2 && v <= 8),
					),
				];
				if (correctedZones.length > 1)
					throw Error("存在多次不同分区调整，需确认最终分区");
				if (correctedZones.length) rz = correctedZones[0];
				const childZone = root.ShipGridChildInvoice.zoneFor(childResidential);
				const gz =
						text(g["分区"]) && number(g["分区"]) !== 0 ? z(g["分区"]) : null,
					zone = childZone,
					group = zone === 2 ? 0 : zone <= 4 ? 1 : zone <= 6 ? 2 : 3;
				const wi = root.ShipGridWeightPolicy.prepare(g, {
					rawActual: ra,
					rawBilled: rb,
					rawDims: rd,
					divisor: t.dim,
				});
				warnings.push(...wi.warnings);
				const packagingGtsBilled = wi.reference;
				const candidate = (d, a, b, source, evt) => {
					if (!d || !a || !b) return null;
					if (d.some((v) => !v || v <= 0)) return null;
					const [L, W, H] = d,
						volume = L * W * H,
						girth = L + 2 * W + 2 * H,
						gr = Math.max(grade(d, a), evt),
						os = gr >= 2,
						dim = ceil(volume / t.dim),
						billed = Math.max(
							a,
							codes.has("ahsP") ? Math.max(rb || 0, packagingGtsBilled) : b,
							dim,
							os || codes.has("os")
								? 90
								: L > 48 ||
									  W > 30 ||
									  girth > 105 ||
									  volume > 10368 ||
									  codes.has("ahsD")
									? ahsMinimum
									: 0,
						);
					return {
						d,
						a,
						b,
						source,
						gr,
						os,
						volume,
						girth,
						dim,
						billed,
						price: t.base[billed + "|" + zone] ?? null,
					};
				};
				const rc = candidate(rd, ra, rb, "UPS", event);
				let gc = null;
				if (ids.length === 1) {
					const gd = wi.dims,
						ga = wi.actual,
						gb = wi.reference;
					gc = candidate(gd, ga, gb, "GTS", rc ? 0 : event);
				}
				let selected, reason;
				if (!rc && !gc)
					throw Error("UPS缺少完整尺寸/重量且无可用GTS，无法计算体积重");
				if (!rc) {
					selected = gc;
					reason = "UPS尺寸或重量缺失，采用GTS完整一套";
					warnings.push(reason);
				} else if (!gc) {
					selected = rc;
					reason = "GTS无数据，采用UPS完整一套";
				} else if (rc.gr !== gc.gr) {
					selected = rc.gr > gc.gr ? rc : gc;
					reason = "触发等级优先";
				} else if (
					rc.price !== null &&
					gc.price !== null &&
					rc.price !== gc.price
				) {
					selected = rc.price > gc.price ? rc : gc;
					reason = "同等级按客户基础运费取高";
				} else {
					selected = rc.billed >= gc.billed ? rc : gc;
					reason = "同等级基础费相同，计费重取大";
				}
				if (selected.gr >= 3 || selected.billed > 150)
					throw Error(
						"超出Ground服务或1–150LB报价范围，需人工核实（不套150LB价格）",
					);
				const { d, a: actual, volume, girth } = selected,
					dim = wi.gtsDim ?? 0,
					[L, W, H] = d,
					os = selected.os || codes.has("os"),
					dEligible =
						!os &&
						(L > 48 ||
							W > 30 ||
							girth > 105 ||
							volume > 10368 ||
							codes.has("ahsD")),
					wEligible = !os && (actual > 50 || codes.has("ahsW")),
					pEligible = !os && codes.has("ahsP");
				let billed = Math.max(wi.maximum, os ? 90 : dEligible ? ahsMinimum : 0);
				if (billed > 150)
					throw Error("三项取大后超出1–150LB报价范围，需人工核实");
				if (codes.has("ahsUnknown") && !dEligible && !wEligible && !pEligible)
					throw Error(
						"UPS Additional Handling未明确类型，需补充尺寸/重量/包装依据",
					);
				const areaEvidence = root.ShipGridChildInvoice.areas(
					childResidential,
					new Set(["das", "edas", "remote"].filter((k) => codes.has(k))),
					residential,
				);
				for (const k of areaEvidence.types) codes.add(k);
				const fees = new Map(),
					put = (name, amt) => {
						const n = value(amt, name);
						if (n) fees.set(name, round(n));
					};
				if (residential) put("Residential Surcharge", t.resi[group]);
				for (const [c, name, k] of [
					["das", "Delivery Area Surcharge", residential ? "dasR" : "dasC"],
					[
						"edas",
						"Delivery Area Surcharge - Extended",
						residential ? "edasR" : "edasC",
					],
					[
						"remote",
						"Delivery Area Surcharge - Remote",
						residential ? "remoteR" : "remoteC",
					],
				])
					if (codes.has(c)) put(name, t[k][group]);
				if (["das", "edas", "remote"].filter((k) => codes.has(k)).length > 1)
					throw Error("同票存在不同DAS类型，需核对调整关系");
				let ahs = "";
				if (os) put("Large Package Surcharge", t.os[group]);
				else {
					const options = [
						["D", dEligible ? t.ahsD[group] : null],
						["W", wEligible ? t.ahsW[group] : null],
						["P", pEligible ? t.ahsP[group] : null],
					]
						.filter((x) => x[1] !== null)
						.sort((a, b) => b[1] - a[1]);
					if (options.length) {
						ahs = options[0][0];
						put(
							"Additional Handling - " +
								{ D: "Dimension", W: "Weight", P: "Packaging" }[ahs],
							options[0][1],
						);
					}
				}
				for (const [c, name, k] of [
					["address", "Address Correction", "address"],
					["indirect", "Signature Required", "indirect"],
					["direct", "Signature Required", "direct"],
					["adult", "Adult Signature Required", "adult"],
				])
					if (codes.has(c)) put(name, t[k][group]);
				if (codes.has("declared")) {
					const declared =
						number(main["Shipment Value Amount"]) ||
						number(g["申报价值"]) ||
						number(g["申报货值"]);
					if (!declared) throw Error("Declared Value缺少申报货值");
					put(
						"Declared Value",
						declared <= 100
							? 0
							: declared <= 300
								? t.declaredMin
								: ceil(declared / 100) * t.declaredPer100,
					);
				}
				const dp = t.demand.find(
						(x) => transaction >= x.start && transaction <= x.end,
					),
					rp = t.resiDemand.find(
						(x) => transaction >= x.start && transaction <= x.end,
					);
				if (dp) {
					if (os) put("Demand Large Package", dp.os);
					else if (ahs) put("Demand Additional Handling", dp.ahs);
				}
				if (rp && residential) put("Demand Residential", rp.fee);
				if (
					((codes.has("demandOS") || codes.has("demandAHS")) && !dp) ||
					(codes.has("demandResi") && !rp)
				)
					throw Error("原账单有旺季收费，但价表日期未覆盖");
				const other = new Map();
				for (const r of rs) {
					const cat = text(r["Charge Category Code"]),
						cls = text(r["Charge Classification Code"]),
						amt = paid(r);
					if (cls === "INF" || amt === 0) {
						informational.push(r);
						continue;
					}
					if (r === main || cls === "FSC" || chargeCode(r) !== "unknown")
						continue;
					if (
						cat === "ADJ" &&
						/shipping charge correction|zone adjustment|address correction ground/i.test(
							text(r["Charge Description"]),
						)
					)
						continue;
					if (cls === "FRT")
						throw Error(
							"无法识别运输费/调整：" + text(r["Charge Description"]),
						);
					if (/discount|incentive/i.test(text(r["Charge Description"])))
						throw Error("独立折扣行需核实费用归属");
					const published =
						amt + value(r["Incentive Amount"] || 0, "原始优惠金额");
					if (published < 0) throw Error("负数未映射费用需核实");
					const name = text(r["Charge Description"]);
					other.set(name, round((other.get(name) || 0) + published));
					warnings.push(name + "按UPS原账单公布金额（Net + Incentive）收取");
				}
				const fuelRecord = root.UPSInvoiceFuel.lookup(transaction, "Ground");
				if (!fuelRecord)
					throw Error("燃油历史未覆盖Transaction Date：" + transaction);
				const pricePolicy = root.ShipGridWeightPolicy.price(
					t.base,
					zone,
					billed,
					Math.max(selected.price || 0, paid(main)),
					selected.billed,
				);
				const ratingOriginalWeight = billed;
				billed = pricePolicy.weight;
				const base = pricePolicy.value,
					surcharge = round(
						[...fees.values()].reduce((s, v) => s + v, 0) +
							[...other.values()].reduce((s, v) => s + v, 0),
					);
				let fuelBase = base;
				for (const [name, amt] of [...fees, ...other])
					if (
						root.UPSInvoiceFuel.eligible({
							"Charge Description": name,
							"Charge Classification Code": "ACC",
						})
					)
						fuelBase += amt;
				const fuel = round(fuelBase * fuelRecord.rate * t.factor);
				fees.set("Fuel Surcharge", fuel);
				const total = round(base + surcharge + fuel),
					originalNet = round(rs.reduce((s, r) => s + paid(r), 0)),
					provenance =
						"AHS尺寸最低计费重" +
						ahsMinimum +
						"LB，规则日期" +
						ahsRuleDate +
						"（2026-12-21起50LB，之前40LB）；" +
						wi.reason +
						"；" +
						pricePolicy.reason +
						"；尺寸及费用判定取" +
						selected.source +
						"：" +
						reason +
						"；最终计费重" +
						billed +
						"LB（含适用最低计费重）；分区取子单账单分区代码；燃油按Transaction Date " +
						transaction +
						" × " +
						fuelRecord.rate +
						" × " +
						t.factor;
				const row = {
					gtsPieces:
						ids.length === 1 ? root.ShipGridChildInvoice.pieces(g) : null,
					zoneSource: "子单账单分区代码",
					areaAdded: areaEvidence.added,
					ratingOriginalWeight,
					childResidential,
					tracking: track,
					order: text(g["订单号"]),
					customerId,
					customerName,
					quoteName: chosen?.name || "单次上传报价",
					service: text(main["Charge Description"]),
					total,
					base,
					surcharge,
					fuel,
					billed,
					actual,
					dims: d.join("×"),
					zone,
					ahsType: ahs,
					os,
					red: [],
					warnings: [...new Set(warnings)].join("；"),
					volume,
					dim,
					provenance,
					originalNet,
					fees: Object.fromEntries(fees),
					other: Object.fromEntries(other),
					sourceRows: rs.map((r) => r.__row),
					transaction,
				};
				row.data = [
					customerId,
					customerName,
					row.quoteName,
					track,
					text(main["Lead Shipment Number"]),
					row.order,
					row.service,
					residential ? "Ground Residential" : "Ground Commercial",
					transaction,
					zone,
					actual,
					billed,
					...d,
					t.dim,
					selected.source,
					provenance,
					base,
					...feeNames.map((n) => fees.get(n) || 0),
					round([...other.values()].reduce((s, v) => s + v, 0)),
					total,
					originalNet,
					round(total - originalNet),
					row.warnings,
					wi.rawBilled,
					wi.gtsActual,
					wi.gtsDim,
					pricePolicy.reason,
				];
				if (selected.source === "UPS" && gc) {
					if (actual > gc.a) row.red.push(10);
					if (billed > gc.billed) row.red.push(11);
				}
				if (selected.source === "UPS" && gc)
					for (let i = 0; i < 3; i++) if (d[i] > gc.d[i]) row.red.push(12 + i);
				if (gz !== null && rz > gz) row.red.push(9);
				rows.push(row);
			} catch (e) {
				errors.push({
					row: rs[0].__row,
					tracking: track,
					customerId: text(g["客户ID"]),
					customerName: text(g["客户名称"]),
					reason: e.message,
					originalNet: round(rs.reduce((s, r) => s + paid(r), 0)),
				});
			}
		}
		const customers = [...new Set(rows.map((r) => r.customerId))].map((id) => {
			const rs = rows.filter((r) => r.customerId === id);
			return {
				id,
				name: rs[0].customerName,
				count: rs.length,
				orders: rs.length,
				total: round(rs.reduce((s, r) => s + r.total, 0)),
				warnings: rs.filter((r) => r.warnings).length,
			};
		});
		const excluded = accounts.filter((r) =>
				/payment processing|late payment|proof of delivery|service charge|fuel surcharge/i.test(
					text(r["Charge Description"]) + " " + text(r["Miscellaneous Line 1"]),
				),
			),
			accountReview = accounts.filter((r) => !excluded.includes(r));
		return root.ShipGridChildInvoice.finalize(
			{
				rows,
				errors,
				headers,
				customers,
				accounts,
				excluded,
				accountReview,
				raw,
				informational,
				unmatchedGts: [...entries]
					.filter(([id]) => !used.has(id))
					.map(([id, g]) => ({ id, order: g["订单号"] })),
				quote: { factor: tariff?.comm.factor || 0 },
				summary: {
					raw: groups.size,
					rawLines: raw.length,
					priced: rows.length,
					errors: errors.length,
					warnings: rows.filter((r) => r.warnings).length,
					total: round(rows.reduce((s, r) => s + r.total, 0)),
					base: round(rows.reduce((s, r) => s + r.base, 0)),
					surcharge: round(rows.reduce((s, r) => s + r.surcharge, 0)),
					fuel: round(rows.reduce((s, r) => s + r.fuel, 0)),
					originalTotal: round(raw.reduce((s, r) => s + paid(r), 0)),
					accountReview: round(accountReview.reduce((s, r) => s + paid(r), 0)),
					excluded: round(excluded.reduce((s, r) => s + paid(r), 0)),
				},
				quoteName: "客户报价",
			},
			childIndex,
		);
	}
	/**
	 * workbook(result, customer) — 将 calculate 结果组织为多工作表 Excel 工作簿
	 * 参数:
	 *   result   — calculate() 返回的结果对象
	 *   customer — "all" 全部客户，或具体客户ID（用于分客户出账）
	 * 返回: { wb: XLSX工作簿, list: 过滤后的逐单结果 }
	 *
	 * 工作表清单:
	 *   1. UPS客户账单（逐单明细）
	 *   2. 客户汇总（按客户聚合）
	 *   3. 异常清单（需人工核对的运单）
	 *   4. 账号费用（无运单号的 MIS/账号级费用）
	 *   5. 公司承担费用（Payment Processing / Late Payment 等）
	 *   6. 费用说明（计费规则摘要）
	 */
	function workbook(result, customer = "all") {
		const wb = X().utils.book_new(),
			list = result.rows.filter(
				(r) => customer === "all" || r.customerId === customer,
			),
			add = (name, a) => {
				const s = X().utils.aoa_to_sheet(a);
				s["!cols"] = a[0].map(() => ({ wch: 22 }));
				s["!autofilter"] = {
					ref: X().utils.encode_range(
						{ r: 0, c: 0 },
						{ r: a.length - 1, c: a[0].length - 1 },
					),
				};
				X().utils.book_append_sheet(wb, s, name);
				return s;
			};
		add("UPS客户账单", [result.headers, ...list.map((r) => r.data)]);
		add("客户汇总", [
			[
				"客户ID",
				"客户名称",
				"订单数",
				"Transportation Charge",
				"附加费（不含燃油）",
				"Fuel Surcharge",
				"账单合计USD",
				"警示订单数",
			],
			...result.customers
				.filter((c) => customer === "all" || c.id === customer)
				.map((c) => {
					const rs = list.filter((r) => r.customerId === c.id);
					return [
						c.id,
						c.name,
						rs.length,
						round(rs.reduce((s, r) => s + r.base, 0)),
						round(rs.reduce((s, r) => s + r.surcharge, 0)),
						round(rs.reduce((s, r) => s + r.fuel, 0)),
						c.total,
						c.warnings,
					];
				}),
		]);
		add("异常清单", [
			["原始行号", "Tracking Number", "客户ID", "原因", "处理"],
			...result.errors
				.filter((e) => customer === "all" || e.customerId === customer)
				.map((e) => [
					e.row,
					e.tracking,
					e.customerId,
					e.reason,
					"未计入客户账单",
				]),
			...list
				.filter((r) => r.warnings)
				.map((r) => [
					r.sourceRows[0],
					r.tracking,
					r.customerId,
					r.warnings,
					"已计费，出账前核实",
				]),
		]);
		add("逐项其他费用", [
			[
				"客户ID",
				"客户名称",
				"Tracking Number",
				"Charge Description",
				"客户金额USD",
			],
			...list.flatMap((r) =>
				Object.entries(r.other).map(([n, v]) => [
					r.customerId,
					r.customerName,
					r.tracking,
					n,
					v,
				]),
			),
		]);
		if (customer === "all")
			add("账号级费用", [
				["原始行号", "Charge Description", "原始金额USD", "处理"],
				...result.accounts.map((r) => [
					r.__row,
					text(r["Charge Description"]) || text(r["Miscellaneous Line 1"]),
					number(r["Net Amount"]),
					result.excluded.includes(r)
						? "公司承担，不计客户账单"
						: "待分配客户，不计入逐单账单",
				]),
			]);
		add("计费说明", [
			["项目", "说明"],
			[
				"子单住宅费",
				"原始或GTS内嵌子单账单优先；运单号优先匹配，系统订单号/客户单号唯一关联作为后备。原始未收、子单已收时按客户报价补收；原始已收不叠加。补收后按承运商原有日期、燃油比例与适用费用基数重算燃油。子单金额只作收费事件依据，不直接作为客户报价。",
			],
			["报价", result.quoteName],
			[
				"完整性",
				"已计费" +
					result.rows.length +
					"票；未计费异常" +
					result.errors.length +
					"票。客户账单合计不包含未计费异常及待分配账号费用，请处理后出完整账单。",
			],
			[
				"HWT",
				"原始HWT按客户Ground Commercial/Residential逐件报价；本次价表不是HWT整票报价。",
			],
			[
				"取值",
				"尺寸与触发判定：触发等级→客户基础运费取高→参考重量；最终计费重独立取原始计费重/GTS实重/GTS尺寸重/最低重最大值；不使用GTS计费重；分区取子单账单分区代码。缺GTS按UPS完整数据计费并列异常；缺UPS尺寸时采用GTS完整数据并警示。",
			],
			[
				"更正",
				"同票先合并SHP/INF/ADJ；使用最终可确认测量结果后只出一次客户账单，不把承运商运费更正金额重复加入客户运费。缺少原运费或测量冲突不自动出账。",
			],
			[
				"单位",
				"GTS为KG/CM；统一转为LB/IN进一；AHS-D最低40LB，OS最低90LB，DIM取报价。",
			],
			[
				"燃油",
				"按Transaction Date查内置UPS官网历史，乘客户燃油支付比例；仅UPS适用费用计燃油。超出历史范围进入异常。",
			],
			[
				"附加费",
				"DAS、住宅、签名等按原收费事件及整票住宅归属判断；AHS三类取较贵且与OS互斥；旺季按价表日期。",
			],
			[
				"未列费用",
				"逐票附加费以原账单Net + Incentive作为UPS公布金额并警示；账号级费用单独列示，尚未分配客户的不计入账单。",
			],
			[
				"公司承担",
				"Payment Processing Fee、Late Payment Fee、POD、Service Charge及账号Fuel不计入客户账单。",
			],
			[
				"账单汇总",
				"账号费用页与原始成本是核对信息，不要重复加入客户账单Total Charge。",
			],
			["燃油来源", root.UPSOfficialFuel.source],
		]);
		return { wb, list };
	}
	/**
	 * bytes(r, customer) — 生成带红色高亮的 xlsx 二进制输出
	 * 参数: r=calculate()返回值，customer同workbook
	 * 返回: Uint8Array（xlsx 二进制）
	 *
	 * 实现原理: 利用 XLSX.CFB 直接操作 zip 内部结构，向 styles.xml 注入红色字体样式，
	 *          再将警示行的单元格 style index 替换为新样式，避免创建额外依赖。
	 */
	function bytes(r, customer = "all") {
		const { wb, list } = workbook(r, customer);
		const zip = XLSX.CFB.read(
				new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })),
				{ type: "array" },
			),
			enc = new TextEncoder(),
			dec = new TextDecoder();
		const read = (p) =>
				dec.decode(XLSX.CFB.find(zip, zip.FullPaths[0] + p).content),
			write = (p, s) =>
				XLSX.CFB.utils.cfb_add(zip, zip.FullPaths[0] + p, enc.encode(s));
		let styles = read("xl/styles.xml");
		const fonts = styles.match(/<fonts\b[^>]*count="(\d+)"/),
			xfs = styles.match(/<cellXfs\b[^>]*count="(\d+)"/);
		if (!fonts || !xfs) throw Error("Excel样式结构无法识别");
		const fid = +fonts[1],
			sid = +xfs[1];
		styles = styles
			.replace(
				/(<fonts\b[^>]*count=")(\d+)(")/,
				(_, a, b, c) => a + (+b + 1) + c,
			)
			.replace(
				"</fonts>",
				'<font><sz val="11"/><color rgb="FFFF0000"/><name val="Arial"/></font></fonts>',
			)
			.replace(
				/(<cellXfs\b[^>]*count=")(\d+)(")/,
				(_, a, b, c) => a + (+b + 1) + c,
			)
			.replace(
				"</cellXfs>",
				'<xf numFmtId="0" fontId="' +
					fid +
					'" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>',
			);
		write("xl/styles.xml", styles);
		const marks = new Set();
		list.forEach((r, i) =>
			r.red.forEach((c) => marks.add(XLSX.utils.encode_cell({ r: i + 1, c }))),
		);
		let sheet = read("xl/worksheets/sheet1.xml");
		sheet = sheet.replace(/<c\b([^>]*)>/g, (tag, attrs) => {
			const a = attrs.match(/\br="([^"]+)"/);
			if (!a || !marks.has(a[1])) return tag;
			const stripped = attrs.replace(/\s+s="[^"]*"/, "");
			return "<c" + stripped + ' s="' + sid + '">';
		});
		write("xl/worksheets/sheet1.xml", sheet);
		return XLSX.CFB.write(zip, {
			type: "array",
			fileType: "zip",
			compression: true,
		});
	}
	root.UPSBilling = {
		quote,
		calculate,
		parseRaw,
		workbook,
		bytes,
		grade,
		date,
	};
})(globalThis);
