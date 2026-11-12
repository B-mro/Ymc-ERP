/**
 * ups-returns.js —— UPS 退货（UP/RS/RTP）审核与历史账单配对引擎
 *
 * 本模块处理 UPS 账单中出现的 **退货运单**（Return Shipment），包括三种常见类型：
 *   - UP   : UPS Returns（预打印退货标签，客户上门取件）
 *   - RS   : Return Service（标准退货）
 *   - RTP  : Return to Program（项目类退货，如亚马逊 FBA Return）
 *
 * 核心挑战：退货运单的账单行里经常缺失原始运单信息（Zone/重量/原始服务），
 * 需要从 **历史账单**（同一 Account Number + 同一 Invoice 期间的 Ground 运单）
 * 中流式读取并匹配，而不是一次性全量加载。
 *
 * 关键函数与对象：
 *   - trackKey(r) / invoiceKey(r) : 账单行唯一键 / 账单号唯一键（含 Account + 币种）
 *   - fiscalFields                : 本模块关心的 34 个账单列白名单（账号、账单号、
 *                                   运单号、服务、重量、费用分类、地址、Return Type 等）
 *   - classifyReturn(r)           : 识别 Charge Description 中的 Return 关键词
 *     （RETURN、UPS RETURNS、RS、RTP、Return Shipment 等）
 *   - auditReturns(current, history, tolerance) : **核心审核函数**
 *     current : 本期账单行（174 列 canonical 格式）
 *     history : 历史账单行 Map（由流式 reader 提供，避免全量加载）
 *     tolerance : 金额容差（默认 $0.02）
 *
 * 审核流程：
 *   1. 遍历 current，按 classifyReturn 标记退货行
 *   2. 对每张退货运单，尝试在 history 中匹配原始运单（同 Tracking Number 或
 *      同 Reference Number）
 *   3. 有匹配 → 用原始运单的 Zone/重量/服务 + 当前 Return Type 重建合约应收
 *   4. 无匹配 → 标记 "需核对原始账单"，不参与申诉，仅作为 evidence
 *   5. 退货运费合约折扣与正向 Ground 相同，燃油按 Return 的 Transaction Date 匹配
 *   6. Return Surcharge（退货附加费）独立核算，有合约折扣时按折扣后金额比对
 *
 * 历史账单流式读取策略：
 *   - 不扫描全表，只拉取同一 Account Number 下 Pickup Date 在最近 90 天范围内的
 *     Ground 运单（正向 + 退货）
 *   - 仅保留 Tracking Number / Reference Number / Zone / Weight / Service 这几个
 *     匹配字段，丢弃其他明细
 *   - 以 Map 形式缓存，避免重复扫描
 *
 * 对外暴露：root.UPSReturnsAudit = { auditReturns, classifyReturn, trackKey, invoiceKey, key, sum }
 *
 * 依赖：root.UPSContractDefaults（合约折扣）、root.UPSInvoiceFuel（燃油费率）、
 *       root.UPSAudit（日期格式化）
 */
/*SG-AUDIT:returns-audit.js*/ // Invoice-scoped returns and correction review; historical charges are evidence only.
(function (root) {
	"use strict";
	const clean = (v) => String(v ?? "").trim(),
		n = (v) => Number(clean(v).replace(/[$,]/g, "") || 0),
		money = (v) => Math.round((v + 1e-9) * 100) / 100;
	const account = (v) => clean(v).replace(/^0+/, "").toUpperCase(),
		currency = (r) =>
			clean(
				r["Transaction Currency Code"] || r["Invoice Currency Code"],
			).toUpperCase();
	const trackKey = (r) =>
		JSON.stringify([
			account(r["Account Number"]),
			clean(r["Tracking Number"]).toUpperCase(),
			currency(r),
		]);
	const invoiceKey = (r) =>
		JSON.stringify([
			account(r["Account Number"]),
			clean(r["Invoice Number"]),
			currency(r),
		]);
	const key = (r) =>
		invoiceKey(r) + "|" + clean(r["Tracking Number"]).toUpperCase();
	const sum = (rs) => money(rs.reduce((s, r) => s + n(r["Net Amount"]), 0));
	const fiscalFields = [
		"Account Number",
		"Invoice Number",
		"Invoice Date",
		"Invoice Currency Code",
		"Transaction Currency Code",
		"Transaction Date",
		"Shipment Date",
		"Pickup Date",
		"PUDate",
		"PU Date",
		"Tracking Number",
		"Lead Shipment Number",
		"Charge Category Code",
		"Charge Classification Code",
		"Charge Description",
		"Net Amount",
		"Incentive Amount",
		"Billed Weight",
		"Entered Weight",
		"Entered Weight Unit of Measure",
		"Corrected Zone",
		"Zone",
		"Container Type",
		"Package Dimensions",
		"Package Dimension Unit Of Measure",
		"Original Shipment Package Quantity",
		"Bill Option Code",
		"Sender Address Line 1",
		"Sender Postal",
		"Receiver Address Line 1",
		"Receiver Postal",
		"Original Service Description",
		"Return Type",
		"Return Service Classification",
		"退货类型",
		"退件服务分类",
		"__row",
		"__source",
	];
	function type(r) {
		const t = clean(r["Return Type"] || r["退货类型"]).toUpperCase(),
			d = clean(r["Charge Description"]);
		if (["UP", "RS", "RTP"].includes(t)) return t;
		if (/undeliverable/i.test(d)) return "UP";
		if (/return service|returns service|UPS Returns\b/i.test(d))
			return /third party/i.test(d) ? "RTP" : "RS";
		if (r["Charge Category Code"] === "RTN") return "UNKNOWN";
		return "";
	}
	function service(r, options = {}) {
		const direct = root.UPSContractDefaults.service(
			r["Return Service Classification"] ||
				r["退件服务分类"] ||
				r["Charge Description"],
		);
		if (
			direct === "Ground Commercial" ||
			direct === "Ground Residential" ||
			direct === "HWT"
		)
			return { value: direct, evidence: "本期返程记录明确服务类型" };
		if (
			type(r) === "UP" &&
			["Ground Commercial", "Ground Residential"].includes(
				options.returnGroundService,
			) &&
			clean(options.returnServiceEvidence)
		)
			return {
				value: options.returnGroundService,
				evidence: options.returnServiceEvidence,
			};
		return {
			value: "",
			evidence:
				"返程商业/住宅服务分类未明确；正向Residential或账单实际折扣不能自证返程分类",
		};
	}
	function compact(r) {
		return Object.fromEntries(
			fiscalFields
				.filter((k) => r[k] !== undefined && r[k] !== "")
				.map((k) => [k, r[k]]),
		);
	}
	function targets(raw) {
		return new Set(
			raw
				.filter((r) => r["Charge Category Code"] === "ADJ" || type(r))
				.map(trackKey),
		);
	}
	function filterHistory(raw, history) {
		const invoiceDate = (r) =>
			root.UPSAudit?.day
				? root.UPSAudit.day(r["Invoice Date"])
				: clean(r["Invoice Date"]);
		const wanted = targets(raw),
			current = new Set(raw.map(invoiceKey)),
			dates = new Map();
		for (const r of raw) {
			const k = trackKey(r),
				d = invoiceDate(r);
			if (d && (!dates.has(k) || d < dates.get(k))) dates.set(k, d);
		}
		return history
			.filter(
				(r) =>
					wanted.has(trackKey(r)) &&
					!current.has(invoiceKey(r)) &&
					invoiceDate(r) &&
					invoiceDate(r) < dates.get(trackKey(r)),
			)
			.map(compact);
	}
	// Small, resumable RFC4180 reader. Only matching account/tracking/currency rows survive.
	async function readHistory(
		files,
		raw,
		progress = () => {},
		cancel = () => false,
	) {
		const all = [],
			wanted = targets(raw),
			seenInvoices = new Map();
		for (const file of files) {
			if (!/\.csv$/i.test(file.name))
				throw Error("历史核验附件请选择UPS原始CSV");
			if (file.size > 500 * 1024 * 1024)
				throw Error("历史账单单文件不能超过500MB");
			let headers = null,
				headerlessMode = false,
				row = [],
				field = "",
				quoted = false,
				quoteEnd = false,
				line = 0;
			const selected = [];
			let decoder = new TextDecoder("utf-8", { fatal: true }),
				encodingFallback = false;
			const emit = () => {
				row.push(field);
				field = "";
				line++;
				const values = row;
				row = [];
				if (values.length === 1 && !values[0]) return;
				if (!headers) {
					const a = values.map((x) => x.replace(/^\uFEFF/, "").trim());
					if (a.includes("Tracking Number") && a.includes("Net Amount")) {
						headers = a;
						return;
					}
					if (root.UPSInvoiceFuel.isHeaderless(a)) {
						headers = root.UPSInvoiceFuel.headerlessSchema;
						headerlessMode = true;
					} else
						throw Error("历史CSV不是可识别的UPS原始费用明细：" + file.name);
				}
				if (headerlessMode && root.ShipGridUPSImport) {
					const error = root.ShipGridUPSImport.issue(values);
					if (error)
						throw Error(
							"历史CSV校验失败：" + file.name + " 第" + line + "条，" + error,
						);
				}
				const ai = headers.indexOf("Account Number"),
					ti = headers.indexOf("Tracking Number"),
					ci = headers.indexOf("Transaction Currency Code"),
					ic = headers.indexOf("Invoice Currency Code");
				const k = JSON.stringify([
					account(values[ai]),
					clean(values[ti]).toUpperCase(),
					clean(values[ci] || values[ic]).toUpperCase(),
				]);
				if (wanted.has(k)) {
					const r = { __row: line, __source: file.name };
					for (let i = 0; i < headers.length; i++)
						if (
							fiscalFields.includes(headers[i]) &&
							values[i] !== undefined &&
							values[i] !== ""
						)
							r[headers[i]] = values[i];
					selected.push(r);
				}
			};
			const feed = (text) => {
				for (const ch of text) {
					if (quoteEnd) {
						if (ch === '"') {
							field += '"';
							quoteEnd = false;
							continue;
						}
						quoted = false;
						quoteEnd = false;
					}
					if (quoted) {
						if (ch === '"') quoteEnd = true;
						else field += ch;
					} else if (ch === '"') {
						if (field) throw Error("历史CSV引号格式错误：" + file.name);
						quoted = true;
					} else if (ch === ",") {
						row.push(field);
						field = "";
					} else if (ch === "\n") emit();
					else if (ch !== "\r") field += ch;
				}
			};
			for (let at = 0; at < file.size; at += 1024 * 1024) {
				if (cancel()) throw Error("审核已取消");
				let text;
				try {
					text = decoder.decode(
						await file.slice(at, at + 1024 * 1024).arrayBuffer(),
						{ stream: true },
					);
				} catch (error) {
					if (encodingFallback) throw error;
					encodingFallback = true;
					decoder = new TextDecoder("windows-1252");
					headers = null;
					headerlessMode = false;
					row = [];
					field = "";
					quoted = false;
					quoteEnd = false;
					line = 0;
					selected.length = 0;
					at = -1024 * 1024;
					continue;
				}
				feed(text);
				progress(
					"读取历史 " +
						file.name +
						" " +
						Math.min(100, Math.round(((at + 1024 * 1024) / file.size) * 100)) +
						"%（仅保留匹配订单）",
				);
				await new Promise((r) => setTimeout(r, 0));
			}
			feed(decoder.decode());
			if (quoted && !quoteEnd) throw Error("历史CSV引号未闭合：" + file.name);
			if (row.length || field) emit();
			const invoices = new Map();
			for (const r of selected) {
				const k = invoiceKey(r);
				if (!invoices.has(k)) invoices.set(k, []);
				invoices.get(k).push(r);
			}
			for (const [id, rows] of invoices) {
				const signature = rows
					.map((r) =>
						JSON.stringify(
							Object.fromEntries(
								Object.entries(r)
									.filter(([k]) => !k.startsWith("__"))
									.sort(),
							),
						),
					)
					.sort()
					.join("\n");
				if (seenInvoices.has(id)) {
					if (seenInvoices.get(id) !== signature)
						throw Error("历史同账号同发票存在不同版本，请仅保留正确版本");
					continue;
				}
				seenInvoices.set(id, signature);
				all.push(...rows);
			}
		}
		return filterHistory(raw, all);
	}
	function addClaim(
		report,
		rows,
		billed,
		expected,
		description,
		reason,
		category,
		serviceName,
	) {
		const credit = money(billed - expected);
		if (credit <= report._returnTolerance) return;
		if (Math.abs(sum(rows) - billed) > 0.01)
			throw Error("本期申诉费用范围未核平");
		const r = rows[0];
		if (root.ShipGridDisputeReasons) {
			const line = root.ShipGridDisputeReasons.fee(
				description,
				billed,
				expected,
				rows,
				"",
				{ adjustment: /adjustment/i.test(description) },
			);
			reason = line + "；依据：" + reason;
		}
		const s = {
			类别: category,
			申诉状态: "列入Dispute（仅本期列明项目）",
			分区核验: "按本期账单最终分区核算",
			确切申诉原因: reason,
		};
		report.claims.push({
			rows,
			ship: s,
			group: category + " - " + description,
			zhReason: reason,
			data: {
				"Claim ID": "",
				"Invoice Number": r["Invoice Number"],
				"Invoice Date": r["Invoice Date"],
				"Account Number": r["Account Number"],
				"Tracking Number": r["Tracking Number"],
				"Lead Shipment Number":
					r["Lead Shipment Number"] || r["Tracking Number"],
				Service: serviceName,
				"Charge Description": description,
				"Billed Amount USD": money(billed),
				"Expected Amount USD": money(expected),
				"Requested Credit USD": credit,
				"Claim Scope":
					"Current invoice only; historical invoices are evidence, never included in this credit.",
				"Dispute Reason": reason,
				"Transaction Date": r["Transaction Date"],
				Currency: currency(r),
			},
		});
	}
	function lineCheck(row, sv, rt, options) {
		return root.UPSContractDefaults.defaultsAudit(
			[
				{
					账号: row["Account Number"],
					账单号: row["Invoice Number"],
					运单号: row["Tracking Number"],
					"Transaction Date": root.UPSInvoiceFuel.fuelDate(row).date,
					发货日期: root.UPSInvoiceFuel.fuelDate(row).date,
					币种: currency(row),
					服务: sv,
					分区: n(row["Corrected Zone"] || row.Zone),
					计费重LB: n(row["Billed Weight"]),
					费用名称:
						row["Charge Classification Code"] === "FRT"
							? "Transportation"
							: row["Charge Description"],
					实收金额: n(row["Net Amount"]),
					退货类型: rt,
					付款方式: row["Bill Option Code"],
					记录类型: "SHP",
					包装类型: row["Container Type"],
					"Package Dimensions": row["Package Dimensions"],
					"Package Dimension Unit Of Measure":
						row["Package Dimension Unit Of Measure"],
					"Entered Weight": row["Entered Weight"],
					"Entered Weight Unit of Measure":
						row["Entered Weight Unit of Measure"],
				},
			],
			options,
			root.UPSAudit.audit,
			{ day: root.UPSAudit.day },
		).results[0];
	}
	function pending(report, r, name, reason) {
		report.pendingChecks.push({
			账单号: r["Invoice Number"],
			运单号: r["Tracking Number"],
			服务类型: name,
			状态: "待核实，不代表通过",
			待核类别: "缺少资料或适用依据",
			原因: reason,
			已核算申诉金额: 0,
		});
	}
	function reviewReturns(report, raw, options, tolerance) {
		const groups = new Map(),
			hwtTracks = new Set(
				raw
					.filter(
						(x) =>
							root.UPSContractDefaults.service(x["Charge Description"]) ===
							"HWT",
					)
					.map(key),
			);
		for (const r of raw) {
			const k = hwtTracks.has(key(r))
				? invoiceKey(r) + "|HWT|" + r["Lead Shipment Number"]
				: key(r);
			if (!groups.has(k)) groups.set(k, []);
			groups.get(k).push(r);
		}
		for (const rows of groups.values()) {
			const base = rows.filter(
					(r) =>
						r["Charge Classification Code"] === "FRT" &&
						n(r["Net Amount"]) !== 0,
				),
				rt = type(base[0] || rows[0]),
				r = base[0] || rows[0];
			const classification = service(r, options),
				sv = classification.value,
				known = [],
				unresolved = [];
			if (rt === "UNKNOWN")
				unresolved.push(
					"RTN返程类型未明确：需确认UP无法投递退回还是RS主动退货，不能仅凭RTN类别套折扣",
				);
			if (base.length !== 1 && sv !== "HWT")
				unresolved.push(
					"返程基础费缺失或存在多个收费事件，需核对补收/退款及是否重复收费",
				);
			let hwtExpected = null;
			const hwtBaseRows = new Set();
			if (sv === "HWT") {
				let why =
					rt === "UNKNOWN"
						? "HWT返程类型UP/RS未确认"
						: rt !== "UP"
							? "UPS Returns主动退货不适用HWT服务"
							: "";
				const quantity = new Set(base.map((x) => x["Tracking Number"])).size,
					zone = n(r.Zone),
					billed = base.reduce((a, x) => a + n(x["Billed Weight"]), 0),
					actual = base.reduce(
						(a, x) =>
							a +
							n(x["Entered Weight"]) *
								(/^(K|KG|KGS)$/i.test(x["Entered Weight Unit of Measure"])
									? 2.2046226218
									: 1),
						0,
					),
					same = (k) =>
						new Set(base.map((x) => clean(x[k]))).size === 1 &&
						clean(base[0]?.[k]);
				if (
					!why &&
					(!quantity ||
						quantity !== base.length ||
						base.some(
							(x) =>
								n(x["Original Shipment Package Quantity"]) !== quantity ||
								n(x["Entered Weight"]) <= 0 ||
								!/^(L|LB|LBS|K|KG|KGS)$/i.test(
									x["Entered Weight Unit of Measure"],
								) ||
								x["Bill Option Code"] !== "P/P",
						) ||
						![
							"Lead Shipment Number",
							"Sender Address Line 1",
							"Receiver Address Line 1",
							"Zone",
						].every(same) ||
						new Set(base.map((x) => root.UPSInvoiceFuel.fuelDate(x, rows).date))
							.size !== 1 ||
						actual < 200 ||
						zone < 2 ||
						zone > 8 ||
						!root.UPSContractDefaults.accounts2.includes(
							account(r["Account Number"]),
						) ||
						!/^2026-(09|10|11|12)-/.test(
							root.UPSInvoiceFuel.fuelDate(r, rows).date,
						) ||
						Math.max(billed, quantity * 20) > 2000)
				)
					why =
						"HWT返程资格待核：完整主子单、件数、同日同址、实重至少200LB、P/P及合同账号/日期必须均有依据；不沿用正向组单";
				if (!why) {
					const effective = Math.max(billed, quantity * 20),
						a = [13.69, 15.3, 16.99, 20.72, 26.08, 30.21, 35.19],
						b = [10.31, 13.16, 14.61, 18.04, 22.64, 26.1, 30.2];
					hwtExpected = money(
						Math.max(
							72,
							Math.min(
								(effective * a[zone - 2]) / 100,
								(Math.max(500, effective) * b[zone - 2]) / 100,
							),
						),
					);
					known.push({
						row: { "Charge Classification Code": "FRT" },
						expected: hwtExpected,
					});
					for (const x of base) hwtBaseRows.add(x);
					addClaim(
						report,
						base,
						sum(base),
						hwtExpected,
						"HWT return transportation",
						"第一份合约Addendum B p4 UP脚注明确延续相应服务优惠；第二份HWT段落未明确取消该UP条款；补充依据：" +
							(options.hwtUPEvidence || "无") +
							"；仅本期完整返程批次，Tier04合同表，最低20LB/件及每票$72；正向费用不计入。",
						"退件",
						"HWT",
					);
				} else unresolved.push(why);
			}
			for (const row of rows) {
				if (hwtBaseRows.has(row)) continue;
				if (
					row["Charge Classification Code"] === "INF" ||
					n(row["Net Amount"]) === 0 ||
					row["Charge Classification Code"] === "FSC"
				)
					continue;
				let expected = null,
					reason = "";
				if (currency(row) !== "USD") reason = "返程币种不是USD，未套用美元规则";
				else if (
					row["Charge Classification Code"] === "FRT" &&
					rt === "UNKNOWN"
				)
					reason = "返程类型UP/RS未确认";
				else if (
					row["Charge Classification Code"] === "FRT" &&
					base.length !== 1 &&
					sv !== "HWT"
				)
					reason = "基础费事件不唯一";
				else if (
					sv === "HWT" &&
					!(hwtExpected !== null && row["Charge Classification Code"] !== "FRT")
				) {
					reason =
						rt === "UNKNOWN"
							? "HWT返程类型UP/RS未确认"
							: rt !== "UP"
								? "UPS Returns主动退货不适用HWT服务"
								: "HWT返程须按完整返程主子单、同日同址、重量及最低费重核算；不能套正向HWT或单件Ground价";
				} else if (row["Charge Classification Code"] === "FRT" && !sv)
					reason = classification.evidence;
				else {
					const check = lineCheck(
						{
							...row,
							"Transaction Date": root.UPSInvoiceFuel.fuelDate(row, rows).date,
						},
						sv || "Ground",
						rt,
						options,
					);
					if (
						check["状态"] !== "待核实" &&
						typeof check["合约应收"] === "number"
					) {
						expected = check["合约应收"];
						reason = check["原因"];
					} else reason = check["原因"] || "退件费用规则缺失";
				}
				if (expected === null) {
					unresolved.push(row["Charge Description"] + "：" + reason);
					continue;
				}
				known.push({ row, expected });
				if (row["Charge Classification Code"] !== "FSC")
					addClaim(
						report,
						[row],
						n(row["Net Amount"]),
						expected,
						row["Charge Description"],
						"退件" + rt + "；" + classification.evidence + "；" + reason,
						"退件",
						sv || "Ground return",
					);
			}
			const fuel = rows.filter(
					(r) =>
						r["Charge Classification Code"] === "FSC" &&
						n(r["Net Amount"]) !== 0,
				),
				rates = fuel.map((r) =>
					root.UPSInvoiceFuel.lookup(
						root.UPSInvoiceFuel.fuelDate(r, rows).date,
						"Ground",
					),
				),
				fuelRate =
					rates.length && rates.every((x) => x && x.rate === rates[0].rate)
						? rates[0].rate
						: null;
			let expectedFuel = null;
			if (fuel.length) {
				if (
					fuelRate !== null &&
					sv &&
					(sv !== "HWT" || hwtExpected !== null) &&
					!unresolved.length
				) {
					const amount = money(
						known
							.filter((x) => root.UPSInvoiceFuel.eligible(x.row))
							.reduce((s, x) => s + x.expected, 0),
					);
					expectedFuel = money(amount * fuelRate * 0.6);
					addClaim(
						report,
						fuel,
						sum(fuel),
						expectedFuel,
						"Fuel Surcharge",
						"退件燃油按Transaction Date优先、缺失或无效时Pickup Date的官网周率×60%×已核实适用费用基数；未使用正向燃油金额",
						"退件",
						sv,
					);
				} else
					unresolved.push(
						"退件燃油合同差额：" +
							(fuelRate === null
								? root.UPSInvoiceFuel.fuelReason(fuel, rows)
								: "返程服务分类或适用费用基数未核实"),
					);
			}
			const amount = sum(rows),
				claimed = money(
					report.claims
						.filter(
							(c) =>
								c.ship["类别"] === "退件" &&
								c.data["Invoice Number"] === r["Invoice Number"] &&
								c.data["Account Number"] === r["Account Number"] &&
								c.data["Tracking Number"] === r["Tracking Number"],
						)
						.reduce((s, c) => s + c.data["Requested Credit USD"], 0),
				);
			report.returnReview.push({
				账单号: r["Invoice Number"],
				账号: r["Account Number"],
				运单号: r["Tracking Number"],
				主单号: r["Lead Shipment Number"],
				退货类型:
					rt === "UP"
						? "UP无法投递退回"
						: rt === "UNKNOWN"
							? "退件类型待确认"
							: rt + "主动退货",
				返程服务分类: sv || "待确认",
				分类依据: classification.evidence,
				基础费账单金额: sum(base),
				公布基础费参考: money(
					base.reduce(
						(s, x) => s + n(x["Net Amount"]) + n(x["Incentive Amount"]),
						0,
					),
				),
				重量LB: n(r["Billed Weight"]),
				分区: r.Zone,
				本期全部退件费用: amount,
				已核费用合同正确金额: money(
					known.reduce((s, x) => s + x.expected, 0) + (expectedFuel ?? 0),
				),
				燃油日期依据: fuel
					.map((x) => {
						const d = root.UPSInvoiceFuel.fuelDate(x, rows);
						return d.source + "=" + d.date;
					})
					.join(" / "),
				燃油合同正确金额: expectedFuel ?? "",
				本期申诉金额: claimed,
				状态: unresolved.length
					? "部分待核实"
					: claimed > tolerance
						? "多收异常"
						: "金额核对通过",
				待核原因: unresolved.join("；"),
				合约口径:
					rt === "UP"
						? "Ground商业UP按B/C及最低收费核对；住宅UP基础/档位/最低额待UPS确认；HWT UP按第一份脚注及本次返程资格核对"
						: "RS/RTP按明确的返程商业/住宅及合约范围核算；UPS Returns不套HWT",
			});
			for (const reason of unresolved)
				pending(report, r, sv || "Ground return", reason);
		}
	}
	function correctionReview(report, current, history, options, tolerance) {
		const hmap = new Map(),
			groups = new Map(),
			allCurrent = new Map();
		for (const r of history) {
			const k = trackKey(r);
			if (!hmap.has(k)) hmap.set(k, []);
			hmap.get(k).push(r);
		}
		for (const r of current) {
			const k = key(r);
			if (!allCurrent.has(k)) allCurrent.set(k, []);
			allCurrent.get(k).push(r);
			if (r["Charge Category Code"] === "ADJ" && r["Tracking Number"]) {
				if (!groups.has(k)) groups.set(k, []);
				groups.get(k).push(r);
			}
		}
		for (const [id, adjustments] of groups) {
			const r = adjustments[0],
				onInvoice = allCurrent.get(id),
				hist = (hmap.get(trackKey(r)) || []).filter((x) => !type(x)),
				sameBase = onInvoice.filter((x) => x["Charge Category Code"] === "SHP"),
				pastBase = hist.filter(
					(x) =>
						x["Charge Category Code"] === "SHP" &&
						x["Charge Classification Code"] === "FRT" &&
						n(x["Net Amount"]) !== 0,
				);
			const baseline = sameBase.some(
				(x) => x["Charge Classification Code"] === "FRT",
			)
				? sameBase
				: hist;
			const originals = baseline.filter(
					(x) =>
						x["Charge Category Code"] === "SHP" &&
						x["Charge Classification Code"] === "FRT" &&
						n(x["Net Amount"]) !== 0,
				),
				original = originals[0],
				scopeShip = report.shipments.find(
					(s) =>
						s["账单号"] === r["Invoice Number"] &&
						account(s["账号"]) === account(r["Account Number"]) &&
						s["运单号"] === r["Tracking Number"],
				);
			if (original && /Hundredweight/.test(original["Charge Description"])) {
				pending(
					report,
					r,
					"HWT调整",
					"HWT调整需完整历史整票子单及返程/更正分摊；不能用单件Ground公式",
				);
				continue;
			}
			const claimMatches = (c) =>
				c.data["Invoice Number"] === r["Invoice Number"] &&
				account(c.data["Account Number"]) === account(r["Account Number"]) &&
				c.data["Tracking Number"] === r["Tracking Number"] &&
				c.ship["类别"] === "Ground";
			report.claims = report.claims.filter((c) => !claimMatches(c));
			report.pendingChecks = report.pendingChecks.filter(
				(p) =>
					!(
						p["账单号"] === r["Invoice Number"] &&
						p["运单号"] === r["Tracking Number"]
					),
			);
			const missing =
				originals.length !== 1
					? "原基础费缺失或存在多个原收费事件；请上传正确历史账单后配对"
					: currency(r) !== "USD"
						? "本期币种不是USD"
						: !/^Ground (Commercial|Residential)$/.test(
									original["Charge Description"],
							  )
							? "原服务无法明确识别为Ground商业/住宅"
							: "";
			if (missing) {
				pending(report, r, "Ground调整", missing);
				report.correctionReview.push({
					账单号: r["Invoice Number"],
					运单号: r["Tracking Number"],
					本期调整净额: sum(adjustments),
					历史账单: hist
						.map((x) => x["Invoice Number"])
						.filter((v, i, a) => a.indexOf(v) === i)
						.join(" / "),
					状态: "待核实",
					原因: missing,
				});
				continue;
			}
			// Preserve the original-charge claim on THIS invoice, separately from later corrections.
			if (sameBase.some((x) => x["Charge Classification Code"] === "FRT")) {
				const net = root.UPSGroundNetAudit.reconcile(
					original,
					sameBase,
					options,
					tolerance,
				);
				for (const c of net.components)
					if (c.expected !== null)
						addClaim(
							report,
							c.rows,
							c.actual,
							c.expected,
							c.name,
							"本期原收费独立审核；不含本期后续调整或历史金额",
							"Ground",
							net.service,
						);
			}
			let cumulative = baseline.slice();
			const events = new Map();
			for (const row of adjustments) {
				const d = root.UPSAudit.day(row["Transaction Date"]);
				if (!events.has(d)) events.set(d, []);
				events.get(d).push(row);
			}
			for (const [day, rows] of [...events].sort(([a], [b]) =>
				a.localeCompare(b),
			)) {
				const before = root.UPSGroundNetAudit.reconcile(
						original,
						cumulative,
						options,
						tolerance,
					),
					after = root.UPSGroundNetAudit.reconcile(
						original,
						cumulative.concat(rows),
						options,
						tolerance,
					),
					eventPending = [],
					componentChanges = [];
				let eligibleDelta = 0,
					eligibleKnown = true;
				for (const c of after.components) {
					if (c.id === "fuel") continue;
					const selected = c.rows.filter((x) => rows.includes(x));
					if (!selected.length) continue;
					const prior = before.components.find((x) => x.id === c.id),
						priorExpected = prior ? prior.expected : 0;
					let expectedDelta = null;
					if (c.expected !== null && priorExpected !== null)
						expectedDelta = money(c.expected - priorExpected);
					const actual = sum(selected);
					if (expectedDelta === null) {
						eventPending.push(
							c.name + "：" + (c.reason || "更正前后合同费用未确定"),
						);
						if (c.eligible || c.id === "unknown" || c.id === "ahsUnknown")
							eligibleKnown = false;
					} else {
						if (c.eligible)
							eligibleDelta = money(eligibleDelta + expectedDelta);
						addClaim(
							report,
							selected,
							actual,
							expectedDelta,
							c.name + " adjustment",
							"仅申诉本期调整差额：本期净调整$" +
								actual.toFixed(2) +
								"－合同正确调整$" +
								expectedDelta.toFixed(2) +
								"；历史账单仅作更正前基准，不计入本期退款。",
							"Ground",
							after.service,
						);
					}
					componentChanges.push({
						费用项: c.name,
						调整账单净额: actual,
						更正前合同正确费用: priorExpected ?? "",
						更正后合同正确费用: c.expected ?? "",
						本期正确调整差额: expectedDelta ?? "",
						状态:
							expectedDelta === null
								? "待核实"
								: actual - expectedDelta > tolerance
									? "多收异常"
									: "金额核对通过",
					});
				}
				const fs = rows.filter(
					(x) =>
						x["Charge Classification Code"] === "FSC" &&
						n(x["Net Amount"]) !== 0,
				);
				let fuelExpected = null;
				if (fs.length) {
					const rates = fs.map((x) =>
							root.UPSInvoiceFuel.lookup(
								root.UPSInvoiceFuel.fuelDate(x, rows).date,
								after.service,
							),
						),
						rate =
							rates.length && rates.every((x) => x && x.rate === rates[0].rate)
								? rates[0].rate
								: null;
					if (rate !== null && eligibleKnown) {
						fuelExpected = money(eligibleDelta * rate * 0.6);
						addClaim(
							report,
							fs,
							sum(fs),
							fuelExpected,
							"Fuel adjustment",
							"仅本期燃油调整：本期适用费用的合同变动额×Transaction Date优先、缺失时Pickup Date官网周费率×60%；历史燃油收费不计入本期申诉。",
							"Ground",
							after.service,
						);
					} else
						eventPending.push(
							"燃油调整：适用费用变动额或Transaction Date/Pickup Date所选日期的官网周费率未覆盖",
						);
				}
				const eventClaims = report.claims.filter(
						(c) => claimMatches(c) && c.rows.some((x) => rows.includes(x)),
					),
					credit = money(
						eventClaims.reduce((s, c) => s + c.data["Requested Credit USD"], 0),
					);
				report.correctionReview.push({
					账单号: r["Invoice Number"],
					账号: r["Account Number"],
					运单号: r["Tracking Number"],
					交易日期: day,
					服务类型: after.service,
					历史账单: [
						...new Set(
							baseline
								.map((x) => x["Invoice Number"])
								.filter((x) => x !== r["Invoice Number"]),
						),
					].join(" / "),
					原基础费账单金额: n(original["Net Amount"]),
					本期调整净额: sum(rows),
					更正前重量LB: before.weight,
					更正后重量LB: after.weight,
					更正前分区: before.zone,
					更正后分区: after.zone,
					本期正确燃油调整: fuelExpected ?? "",
					本期申诉金额: credit,
					状态: eventPending.length
						? "部分待核实"
						: credit > tolerance
							? "多收异常"
							: "金额核对通过",
					费用差额明细: JSON.stringify(componentChanges),
					原因:
						eventPending.join("；") ||
						"仅核对本期调整差额；历史收费不计入本期费用或申诉",
				});
				for (const reason of eventPending)
					pending(report, r, after.service, reason);
				cumulative.push(...rows);
			}
			if (scopeShip) {
				scopeShip["申诉口径"] = "本期原收费与本期调整分别审核；历史金额不计入";
				scopeShip["待核项目"] = report.pendingChecks
					.filter(
						(p) =>
							p["账单号"] === r["Invoice Number"] &&
							p["运单号"] === r["Tracking Number"],
					)
					.map((p) => p["原因"])
					.join("；");
			}
			for (const a of report.adjustments)
				if (
					a["账单号"] === r["Invoice Number"] &&
					a["运单号"] === r["Tracking Number"]
				) {
					a["状态"] = report.pendingChecks.some(
						(p) =>
							p["账单号"] === r["Invoice Number"] &&
							p["运单号"] === r["Tracking Number"],
					)
						? "待核实"
						: "已核对本期调整";
					a["原因"] = "见本期调整核对；历史金额不计入本期申诉";
				}
		}
	}
	root.UPSContractDefaults.catalog.push(
		{
			项目: "退件分类",
			默认规则:
				"UP无法投递退回与RS/RTP主动退货分开；RTN单列退件明细；返程商业/住宅不明时不得沿用正向分类或按已收折扣自证",
			依据: "第二份Exhibit B/C及UP/RS/RTP代码说明",
		},
		{
			项目: "UP Ground档位优惠",
			默认规则:
				"商业额外28.1%明确含UP；住宅额外20%未列UP，不能叠加到UP住宅返程；最低额按对应适用范围审核",
			依据: "第二份Exhibit C运输费用档位表及最低额表",
		},
		{
			项目: "HWT退件",
			默认规则:
				"主动UPS Returns不套HWT；UP依据第一份Addendum B脚注核对优惠，不强制重复提供确认；仍须核对本期完整返程主子单、重量、同日同址与合同最低费",
			依据: "第一份Addendum B UP注释；第二份HWT段落；UPS 2026 CWT Service Restrictions",
		},
		{
			项目: "按发票独立申诉",
			默认规则:
				"历史只作核验；调整差额=本期调整净收费－更正前后合同费用之差；历史多收不并入本期，退款符号保留",
			依据: "用户确认的申诉范围",
		},
	);
	const originalAudit = root.UPSShipmentAudit.audit;
	function audit(raw, results, tolerance = 0.02, options = {}) {
		const invoices = new Set(raw.map((r) => clean(r["Invoice Number"])));
		if (invoices.size > 1)
			throw Error(
				"请每次审核一份发票；历史账单请放入历史核验附件，不与本期账单混合",
			);
		const returnKeys = new Map(
			raw
				.filter((r) => r["Charge Classification Code"] === "FRT" && type(r))
				.map((r) => [key(r), type(r)]),
		);
		const returns = raw.filter(
				(r) =>
					returnKeys.has(key(r)) &&
					(type(r) ||
						(returnKeys.get(key(r)) !== "UP" &&
							r["Charge Category Code"] === "SHP")),
			),
			returnSet = new Set(returns),
			regular = raw.filter((r) => !returnSet.has(r));
		const report = originalAudit(regular, results, tolerance, {
			...options,
			auditRaw: raw,
		});
		report._returnTolerance = tolerance;
		report.returnReview = [];
		report.correctionReview = [];
		const historical = filterHistory(raw, options.historyRaw || []);
		reviewReturns(report, returns, options, tolerance);
		correctionReview(report, regular, historical, options, tolerance);
		for (const a of report.accounts.filter((a) =>
			/Payment Processing/i.test(a["费用名称"]),
		)) {
			const base = money(
				raw
					.filter(
						(x) =>
							x["Invoice Number"] === a["账单号"] &&
							!/Payment Processing|Declared Value|InsureShield|Package Shield/i.test(
								x["Charge Description"],
							),
					)
					.reduce((t, x) => t + n(x["Net Amount"]), 0),
			);
			a["费用基数"] = base;
			a["合约应收"] = money(base * 0.01);
			a["差额"] = money(a["实收金额"] - a["合约应收"]);
			a["状态"] =
				Math.abs(a["差额"]) <= tolerance
					? "通过"
					: a["差额"] > 0
						? "多收异常"
						: "少收提示";
		}
		report.rawCount = raw.length;
		report.total = sum(raw);
		const returnSummary = {
			项目: "退件",
			票数: report.returnReview.length,
			基础运费: 0,
			燃油费: 0,
			DAS: 0,
			EDAS: 0,
			住宅费: 0,
			其他服务费: 0,
			调整金额: 0,
			账号金额: 0,
			总费用: sum(returns),
			已核算超收金额: 0,
		};
		for (const r of returns) {
			const col =
				r["Charge Classification Code"] === "FRT"
					? "基础运费"
					: r["Charge Classification Code"] === "FSC"
						? "燃油费"
						: /Delivery Area.*Extended/i.test(r["Charge Description"])
							? "EDAS"
							: /Delivery Area/i.test(r["Charge Description"])
								? "DAS"
								: /Residential Surcharge/i.test(r["Charge Description"])
									? "住宅费"
									: "其他服务费";
			returnSummary[col] = money(returnSummary[col] + n(r["Net Amount"]));
		}
		if (returns.length) {
			report.summary.splice(report.summary.length - 1, 0, returnSummary);
			for (const r of returns) {
				const d = r["Charge Description"],
					cat = r["Charge Category Code"];
				let f = report.feeTotals.find(
					(x) => x["费用类别"] === cat && x["费用名称"] === d,
				);
				if (!f) {
					f = { 费用类别: cat, 费用名称: d, 行数: 0, 实收金额: 0 };
					report.feeTotals.push(f);
				}
				f["行数"]++;
				f["实收金额"] = money(f["实收金额"] + n(r["Net Amount"]));
			}
		}
		report.claims.forEach(
			(c, i) => (c.data["Claim ID"] = "SG-" + String(i + 1).padStart(6, "0")),
		);
		report.confirmedOvercharge = money(
			report.claims.reduce((s, c) => s + c.data["Requested Credit USD"], 0),
		);
		report.overcharges = report.claims.map((c) => ({
			账单号: c.data["Invoice Number"],
			运单号: c.data["Tracking Number"],
			类别: c.ship["类别"],
			费用名称: c.data["Charge Description"],
			本期账单金额: c.data["Billed Amount USD"],
			本期合同正确金额: c.data["Expected Amount USD"],
			本期申诉金额: c.data["Requested Credit USD"],
			原因: c.zhReason || c.data["Dispute Reason"],
		}));
		for (const s of report.shipments) {
			s["已核算项目超收金额"] = money(
				report.claims
					.filter(
						(c) =>
							c.data["Invoice Number"] === s["账单号"] &&
							account(c.data["Account Number"]) === account(s["账号"]) &&
							c.data["Tracking Number"] === s["运单号"],
					)
					.reduce((a, c) => a + c.data["Requested Credit USD"], 0),
			);
		}
		for (const row of report.summary) {
			if (row["项目"] === "账单合计") {
				for (const k of [
					"基础运费",
					"燃油费",
					"DAS",
					"EDAS",
					"住宅费",
					"其他服务费",
					"调整金额",
					"账号金额",
					"总费用",
				])
					row[k] = money(
						report.summary
							.filter((x) => x !== row)
							.reduce((s, x) => s + n(x[k]), 0),
					);
				row["已核算超收金额"] = report.confirmedOvercharge;
			} else
				row["已核算超收金额"] = money(
					report.claims
						.filter((c) => (c.ship["类别"] || "账号费用") === row["项目"])
						.reduce((s, c) => s + c.data["Requested Credit USD"], 0),
				);
		}
		if (
			Math.abs(
				report.summary.find((x) => x["项目"] === "账单合计")["总费用"] -
					report.total,
			) > 0.01
		)
			throw Error("含退件账单总额未核平");
		report.displaySummary = root.UPSReviewReports.auditSummary(report);
		delete report._returnTolerance;
		return report;
	}
	const originalSheets = root.UPSReviewReports.auditSheets;
	root.UPSReviewReports.auditSheets = function (report, catalog = []) {
		const sheets = originalSheets(report, catalog);
		if (report.returnReview?.length)
			sheets.push(["退件审核", report.returnReview]);
		if (report.correctionReview?.length)
			sheets.push(["本期调整核对", report.correctionReview]);
		return sheets;
	};
	root.UPSShipmentAudit.audit = audit;
	root.UPSReturnsAudit = {
		type,
		service,
		audit,
		readHistory,
		filterHistory,
		compact,
		fields: fiscalFields,
	};
})(globalThis);
