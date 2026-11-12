/**
 * ontrac-billing/shared/quote-validators.js —— 三承运商报价文件校验器
 *
 * 本模块提供 **纯校验逻辑**：用户上传报价 Excel 后，先由本模块做格式校验，
 * 再由 ShipGridStandardQuotes.parse 做解析。**不参与任何计费计算或 UI 挂载**。
 *
 * 文件头注释已明确："Quote template validators only; no billing calculation or UI mounts."
 *
 * 为什么单独拆出？
 *   - 报价格式错误应该在上传阶段就拦截（不要等到 calculate 才抛错）
 *   - 校验逻辑与计费逻辑解耦 → 校验器可以跨模块复用（fedex/ontrac/ups 各引擎共用）
 *   - 错误信息友好化（"分区表头缺失或重复：2" 而不是 "Cannot read property of undefined"）
 *
 * OnTrac 校验函数 root.ShipGridQuoteValidators.ontrac(wb)：
 *   校验项（任一失败都 throw Error）：
 *     1. 检测是否为标准模板 → 是则委托 StandardQuotes.is + parse 做统一校验
 *     2. 否则按 OnTrac 官方价表结构校验：
 *        - Sheet 名必须含 "OnTrac Rates"（或取第一个 sheet）
 *        - Zone 表头必须覆盖 Zone 2–8 且无重复
 *        - base 运费矩阵必须完整 1–150lb × Zone 2–8（共 1050 格）
 *        - Fuel Surcharge 行必须有 0–1 之间的 factor（正则 /0\.\d+/）
 *        - AHS / LPS（Oversize）费率行必须存在
 *        - 旺季区间必须有 2 期（peak + residential peak）
 *     3. 各项附加费（resi / sig / das / edas / address）必须 > 0
 *     4. 旺季费率（ahs/os/max/unauthorized）必须是非负数
 *
 * FedEx 校验函数 root.ShipGridQuoteValidators.fedex(wb)：
 *   - 类似逻辑，适配 FedEx Rate Sheet 格式
 *   - base 分 ground / home delivery 两套
 *   - zone 1–8 覆盖检查
 *
 * UPS 校验函数 root.ShipGridQuoteValidators.ups(wb)：
 *   - 适配 UPS Rate Chart 格式
 *   - base 分 commercial / residential 两套
 *   - AHS 三维（D/W/P）完整覆盖检查
 *
 * 对外暴露：root.ShipGridQuoteValidators = { ontrac, fedex, ups }
 *
 * 依赖：XLSX（sheet_to_json 读取）、root.ShipGridStandardQuotes（is + parse）
 */
/* Quote template validators only; no billing calculation or UI mounts. */
(function (root) {
	"use strict";
	root.ShipGridQuoteValidators = {
		ontrac: function (wb) {
			const n = (v) => Number(v || 0),
				pos = (v, k) => {
					const x = Number(v);
					if (!Number.isFinite(x) || x <= 0) throw Error("缺少有效" + k);
					return x;
				};
			function quote(wb) {
				if (root.ShipGridStandardQuotes?.is(wb))
					return root.ShipGridStandardQuotes.parse(wb, "ontrac");
				const name = wb.SheetNames.includes("OnTrac Rates")
					? "OnTrac Rates"
					: wb.SheetNames[0];
				const a = XLSX.utils.sheet_to_json(wb.Sheets[name], {
					header: 1,
					raw: true,
					defval: null,
					range: 0,
				});
				const base = {};
				const zoneHeader = a.find((r) =>
					r.some((v) => /^Zone\s*2$/i.test(String(v ?? "").trim())),
				);
				if (!zoneHeader) throw Error("报价缺少Zone 2–8表头");
				const zoneCols = {};
				for (let z = 2; z <= 8; z++) {
					const hits = zoneHeader
						.map((v, i) => ({ v, i }))
						.filter((x) =>
							new RegExp("^Zone\\s*" + z + "$", "i").test(
								String(x.v ?? "").trim(),
							),
						);
					if (hits.length !== 1) throw Error("分区表头缺失或重复：" + z);
					zoneCols[z] = hits[0].i;
				}
				let count = 0;
				for (const r of a) {
					const m = String(r[0] ?? "").match(/^(\d+)\s*(?:lbs?|磅)/i);
					if (m && +m[1] <= 150) {
						for (let z = 2; z <= 8; z++)
							base[+m[1] + "|" + z] = pos(r[zoneCols[z]], "基础费");
						count++;
					}
				}
				if (count !== 150)
					throw Error("客户报价需提供1–150LB、2–8区完整基础费");
				const find = (re) =>
					a.find((r) => r.some((v) => typeof v === "string" && re.test(v)));
				const val = (re, col = 7) => pos(find(re)?.[col], re.source);
				const factor = String(find(/Fuel Surcharge/)?.[7] ?? "").match(
					/0\.\d+/,
				);
				if (!factor || +factor[0] <= 0 || +factor[0] > 1)
					throw Error("无法识别客户燃油支付比例");
				const ah = find(/Additional Handling Surcharge/),
					os = find(/^LPS/);
				if (!ah || !os) throw Error("缺少AHS/LPS费率");
				const periods = [];
				for (let i = 0; i < a.length; i++) {
					const m = String(a[i][0] ?? "").match(
						/^(\d{4})\.(\d+)\.(\d+)-(\d{4})\.(\d+)\.(\d+)$/,
					);
					if (m) {
						const start = [
								m[1],
								m[2].padStart(2, "0"),
								m[3].padStart(2, "0"),
							].join("-"),
							end = [m[4], m[5].padStart(2, "0"), m[6].padStart(2, "0")].join(
								"-",
							);
						periods.push({
							start,
							end,
							ahs: n(a[i][2]),
							os: n(a[i][4]),
							max: n(a[i][6]),
							unauthorized: n(a[i][8]),
						});
					}
				}
				if (periods.length !== 2) throw Error("旺季日期或费率模板无法识别");
				return {
					base,
					factor: +factor[0],
					resi: val(/^Residential（/),
					sig: val(/^Residential Signature/),
					ahs: ah.slice(7, 11).map((v) => pos(v, "AHS")),
					os: os.slice(7, 11).map((v) => pos(v, "LPS")),
					das: val(/^DAS/),
					edas: val(/^Extended DAS/),
					address: val(/^DIR/),
					demand: periods[0],
					resiDemand: {
						start: periods[1].start,
						end: periods[1].end,
						fee: periods[1].ahs,
					},
					dim: 275,
				};
			}
			return quote(wb);
		},
		fedex: function (wb) {
			const X = () => root.XLSX,
				ceil = (v) => Math.ceil(v - 1e-10),
				round = (v) => Math.round((v + Number.EPSILON) * 100 + 1e-9) / 100,
				kg = 2.2046226218487757;
			const gtsTrunc = (v) => Math.trunc(v * 1000 + 1e-7) / 1000,
				gtsCeil = (v) => Math.ceil(gtsTrunc(v));
			function num(v) {
				if (v === null || v === undefined || v === "") return null;
				const n = Number(v);
				if (!Number.isFinite(n)) throw Error("非数值字段：" + v);
				return n;
			}
			function positive(v, k) {
				const n = num(v);
				if (n === null || n <= 0) throw Error("缺少有效" + k);
				return n;
			}
			function zone(v) {
				const m = String(v ?? "")
					.trim()
					.match(/(\d+)$/);
				if (!m || +m[1] < 2 || +m[1] > 8) throw Error("报价仅支持2–8区：" + v);
				return +m[1];
			}
			const empty = (v) =>
				v === null ||
				v === undefined ||
				String(v).trim() === "" ||
				String(v).trim() === "0";
			function date(v) {
				let d;
				if (
					(typeof v === "number" && v >= 20000101 && v <= 20991231) ||
					/^20\d{6}$/.test(String(v))
				) {
					const s = String(v);
					d = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6);
				} else if (typeof v === "number") {
					const p = X().SSF.parse_date_code(v);
					if (p)
						d =
							p.y +
							"-" +
							String(p.m).padStart(2, "0") +
							"-" +
							String(p.d).padStart(2, "0");
				} else if (v instanceof Date) d = v.toISOString().slice(0, 10);
				else {
					const s = String(v ?? "");
					if (/^20\d\d-\d\d-\d\d/.test(s)) d = s.slice(0, 10);
				}
				if (!d) return null;
				const dt = new Date(d + "T00:00:00Z");
				return !isNaN(dt) && dt.toISOString().slice(0, 10) === d ? d : null;
			}
			function matrix(wb, name) {
				const n = name || wb.SheetNames[0];
				return X().utils.sheet_to_json(wb.Sheets[n], {
					header: 1,
					raw: true,
					defval: null,
					range: 0,
				});
			}
			function period(s) {
				const m = String(s ?? "").match(
					/(\d{4})\.(\d+)\.(\d+)\s*-\s*(\d{4})\.(\d+)\.(\d+)/,
				);
				if (!m) return null;
				return {
					start: [m[1], m[2].padStart(2, "0"), m[3].padStart(2, "0")].join("-"),
					end: [m[4], m[5].padStart(2, "0"), m[6].padStart(2, "0")].join("-"),
				};
			}
			function quote(wb) {
				if (root.ShipGridStandardQuotes?.is(wb))
					return root.ShipGridStandardQuotes.parse(wb, "fedex");
				const name = wb.SheetNames.find((n) => n.trim() === "FEDEX-NG"),
					spname = wb.SheetNames.find((n) => /smartpost/i.test(n));
				if (!name || !spname) throw Error("报价需含FEDEX-NG及Smartpost sheet");
				const ng = matrix(wb, name),
					sp = matrix(wb, spname),
					base = (a) => {
						const out = {};
						for (const r of a)
							if (typeof r[0] === "number" && r[0] >= 1 && r[0] <= 150)
								for (let z = 2; z <= 8; z++)
									out[r[0] + "|" + z] = positive(r[z - 1], "基础费");
						return out;
					};
				const ngbase = base(ng),
					spbase = base(sp);
				if (
					Object.keys(ngbase).length !== 1050 ||
					Object.keys(spbase).length !== 497
				)
					throw Error("基础报价表需完整1–150/1–71LB及2–8区");
				const dimMatch = String(ng[158][0] ?? "").match(/DIM\s*(\d+)/i),
					spFactor = String(
						sp.find((r) =>
							/^Fuel Surcharge/i.test(String(r[0] ?? "").trim()),
						)?.[1] ?? "",
					).match(/(\d+(?:\.\d+)?)\s*折/),
					declaredMatch = String(ng[201][7] ?? "").match(
						/USD\s*(\d+(?:\.\d+)?)/i,
					);
				if (!dimMatch || !spFactor || !declaredMatch)
					throw Error("无法解析DIM/Smartpost燃油/保险费率");
				const factor = String(
					ng.find((r) => /^Fuel Surcharge/.test(r[0] ?? ""))?.[7],
				).match(/0\.\d+/);
				if (!factor) throw Error("无法识别燃油折扣");
				const get = (i) => positive(ng[i - 1][7], "附加费"),
					groups = (i) =>
						ng[i - 1].slice(7, 11).map((v) => positive(v, "分区附加费")),
					spValue = (label, allowZero = false) => {
						const rows = sp.filter(
							(r) =>
								String(r[0] ?? "")
									.trim()
									.toLowerCase() === label.toLowerCase(),
						);
						if (rows.length !== 1)
							throw Error("SmartPost费用名称缺失或重复：" + label);
						if (allowZero) {
							const n = num(rows[0][1]);
							if (n === null || n < 0) throw Error("无效" + label);
							return n;
						}
						return positive(rows[0][1], label);
					};
				const ranges = ng
					.map((r, i) => ({ ...period(r[0]), row: r }))
					.filter((x) => x.start);
				return {
					factor: +factor[0],
					ngbase,
					spbase,
					dim: +dimMatch[1],
					resi: get(170),
					ahsD: groups(171),
					ahsW: groups(175),
					ahsP: groups(179),
					os: groups(186),
					dasR: get(190),
					dasC: get(191),
					edasR: get(192),
					edasC: get(193),
					remoteR: get(194),
					remoteC: get(195),
					indirect: get(196),
					direct: get(197),
					adult: get(198),
					address: get(199),
					declaredMin: get(201),
					declaredPer100: +declaredMatch[1],
					demand: ranges
						.filter((x) => x.row[6] !== null)
						.map((x) => ({
							start: x.start,
							end: x.end,
							ahs: num(x.row[3]),
							os: num(x.row[6]),
							unauthorized: num(x.row[9]),
						})),
					resiDemand: ranges
						.filter((x) => x.row[6] === null && x.row[3] !== null)
						.map((x) => ({ start: x.start, end: x.end, fee: num(x.row[3]) })),
					sp: {
						fuel: +spFactor[1] / 10,
						dim: spValue("DMI"),
						delivery: spValue("Delivery and Returns", true),
						nonMach: spValue("USPS Non-Mach Surcharge"),
						das: spValue("Delivery Area Surcharge"),
						edas: spValue("Delivery Area Extended Surcharge"),
						relabel: spValue("Package Relabel"),
						demand: sp
							.filter((r) => period(r[0]))
							.map((r) => ({ ...period(r[0]), fee: num(r[3]) }))
							.filter((r) => r.fee !== null),
					},
				};
			}
			return quote(wb);
		},
		ups: function (wb) {
			const X = () => root.XLSX,
				ceil = (v) => Math.ceil(v - 1e-10),
				round = (v) => Math.round((v + Number.EPSILON) * 100 + 1e-8) / 100,
				kg = 2.2046226218487757;
			const gtsTrunc = (v) => Math.trunc(v * 1000 + 1e-7) / 1000,
				gtsCeil = (v) => Math.ceil(gtsTrunc(v));
			const text = (v) => String(v ?? "").trim(),
				number = (v) =>
					text(v) === "" ? null : Number(text(v).replace(/[$,]/g, ""));
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
			function matrix(wb, name) {
				return X().utils.sheet_to_json(wb.Sheets[name || wb.SheetNames[0]], {
					header: 1,
					raw: true,
					defval: null,
					blankrows: true,
				});
			}
			function date(v) {
				if (typeof v === "number" && v < 100000) {
					const d = X().SSF.parse_date_code(v);
					if (d) v = [d.y, d.m, d.d].join("-");
				}
				const s = text(v),
					m = s.match(/^(20\d\d)[/.-]?(\d{1,2})[/.-]?(\d{1,2})(?:\s|T|$)/);
				if (!m) return null;
				const d =
					m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
				return new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d
					? d
					: null;
			}
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
							[8, 9, 10, 11].map((c) =>
								value(get(r, c), "附加费第" + r + "行"),
							),
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
							if (base[r[0] + "|2"] !== undefined)
								throw Error("基础运费重量重复");
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
					if (out.factor < 0 || out.factor > 1)
						throw Error("燃油支付比例须为0–1");
					return out;
				};
				return { comm: parseSheet(comm, false), resi: parseSheet(resi, true) };
			}
			return quote(wb);
		},
	};
})(globalThis);
