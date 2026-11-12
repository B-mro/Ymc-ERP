/*
 * UPS 原始账单 CSV/Excel 流式导入器
 * 文件: shared/ups-raw-import.js
 * ----------------------------------------------------------------------------
 * 职责：解析 UPS Billing Data 2.1 格式账单（270列无表头 CSV 或带表头 Excel），
 *       逐行校验结构、统计账单汇总、检测账单金额与明细净额是否一致。
 *
 * 核心函数：
 *   issue(row)          — 单行结构校验，返回错误信息或空字符串
 *   isHeaderless(row)   — 判断是否为 2.1 无表头账单格式
 *   collector(headers)  — 账单级汇总收集器（按 Account|Invoice 聚合）
 *   readCSV(file)       — 流式读取 CSV（支持 UTF-8/Windows-1252 自动降级）
 *
 * 暴露对象：root.UPSInvoiceFuel 扩展（同模块 ups-fuel-raw-schema.js 定义 schema）
 * ----------------------------------------------------------------------------
 */
/*SG-AUDIT:ups-raw-import.js*/ // UPS CSV 2.1 schema: supplied UPS Billing Data_Header.xlsx / English / columns 1–270.
(function (root) {
	const headers = root.UPSInvoiceFuel.headerlessSchema.slice();
	const clean = (v) =>
		String(v ?? "")
			.replace(/^\uFEFF/, "")
			.trim();
	const index = Object.fromEntries(headers.map((h, i) => [h, i]));
	const canonicalHeaders = Object.fromEntries(
		headers.map((h) => [clean(h), h]),
	);
	const money = (v) => {
		const s = clean(v).replace(/[$,]/g, "");
		return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) &&
			Number.isFinite(Number(s))
			? Number(s)
			: null;
	};
	const day = (v) => {
		const s = clean(v);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
		const d = new Date(s + "T00:00:00Z");
		return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
	};
	function issue(row) {
		if (row.length !== 270)
			return (
				"应为270列，实际" + row.length + "列；可能缺列、多列或分隔符不正确"
			);
		const get = (h) => clean(row[index[h]]);
		if (get("Version") !== "2.1") return "第1列不是UPS数据版本2.1";
		if (!/^[A-Z0-9]{6,20}$/i.test(get("Account Number")))
			return "第3列账号格式无效";
		if (!/^[A-Z]{2}$/.test(get("Account Country/Territory")))
			return "第4列国家代码无效";
		if (!day(get("Invoice Date"))) return "第5列账单日期无效";
		if (!/^[A-Z0-9-]{6,40}$/i.test(get("Invoice Number")))
			return "第6列账单号格式无效";
		if (!/^[A-Z]{3}$/.test(get("Invoice Currency Code")))
			return "第10列账单币种无效";
		if (money(get("Invoice Amount")) === null)
			return "第11列账单金额不是有效金额";
		if (get("Transaction Date") && !day(get("Transaction Date")))
			return "第12列交易日期无效";
		if (!/^[A-Z0-9]{3}$/.test(get("Charge Category Code")))
			return "第35列费用类别代码无效";
		if (!/^[A-Z0-9]{3}$/.test(get("Charge Classification Code")))
			return "第44列费用分类代码无效";
		if (!/^[A-Z]{3}$/.test(get("Transaction Currency Code")))
			return "第51列交易币种无效";
		if (money(get("Incentive Amount")) === null) return "第52列折扣金额无效";
		const net = money(get("Net Amount"));
		if (net === null) return "第53列净收费金额无效";
		const wt = get("Billed Weight");
		if (wt && (money(wt) === null || Number(money(wt)) < 0))
			return "第29列计费重无效";
		return "";
	}
	const isHeaderless = (row) => Array.isArray(row) && !issue(row);
	const candidate = (row) =>
		row &&
		(row.length >= 250 || row.slice(0, 5).some((v) => clean(v) === "2.1"));
	function collector(h) {
		const ii = Object.fromEntries(h.map((v, i) => [clean(v), i])),
			invoices = new Map();
		let rowCount = 0,
			trackCount = 0,
			accountRows = 0,
			missingDescriptions = 0,
			missingTransactionDates = 0;
		function add(row, line) {
			rowCount++;
			const get = (k) => clean(row[ii[k]]);
			if (/^1Z[A-Z0-9]{16}$/i.test(get("Tracking Number"))) trackCount++;
			if (!get("Tracking Number")) accountRows++;
			if (!get("Charge Description")) missingDescriptions++;
			if (!get("Transaction Date")) missingTransactionDates++;
			if (
				!get("Invoice Number") ||
				ii["Invoice Amount"] === undefined ||
				ii["Account Number"] === undefined
			)
				return;
			const key = JSON.stringify([
					get("Account Number").replace(/^0+/, ""),
					get("Invoice Number"),
					get("Invoice Date"),
					get("Invoice Currency Code"),
				]),
				amount = money(get("Invoice Amount")),
				net = money(get("Net Amount"));
			if (!invoices.has(key))
				invoices.set(key, {
					account: get("Account Number"),
					invoice: get("Invoice Number"),
					date: get("Invoice Date"),
					currency: get("Invoice Currency Code"),
					amount,
					netCents: 0,
					rows: 0,
					conflict: false,
				});
			const a = invoices.get(key);
			if (amount === null || net === null || a.amount !== amount)
				a.conflict = true;
			if (net !== null) a.netCents += Math.round(net * 100);
			a.rows++;
		}
		function finish() {
			const list = Array.from(invoices.values()).map((a) => ({
				...a,
				net: a.netCents / 100,
				difference:
					a.amount === null
						? null
						: Math.round(a.netCents - a.amount * 100) / 100,
			}));
			const mismatches = list.filter(
				(a) =>
					a.conflict || a.difference === null || Math.abs(a.difference) > 0.02,
			);
			return {
				rowCount,
				trackCount,
				accountRows,
				missingDescriptions,
				missingTransactionDates,
				invoices: list,
				mismatches,
				complete: list.length > 0 && !mismatches.length,
			};
		}
		return { add, finish };
	}
	async function readCSV(file, options = {}) {
		const pauses = () => new Promise((r) => setTimeout(r, 0));
		let fallback = false;
		while (true) {
			let h = null,
				headerless = false,
				unsupported = false,
				record = 0,
				row = [],
				field = "",
				quoted = false,
				afterQuote = false,
				items = [],
				collect = null;
			const decoder = new TextDecoder(fallback ? "windows-1252" : "utf-8", {
				fatal: !fallback,
			});
			function emit() {
				row.push(field);
				field = "";
				const values = row;
				row = [];
				record++;
				if (values.every((v) => !clean(v))) return;
				if (!h) {
					const first = values.map(clean);
					if (root.UPSInvoiceFuel.isRaw(first)) {
						h = first.map((k) => canonicalHeaders[k] || k);
						collect = collector(h);
						return;
					}
					if (!candidate(first)) {
						unsupported = true;
						return;
					}
					const error = issue(first);
					if (error)
						throw Error(
							"无法按UPS原始账单识别：第" + record + "条记录，" + error,
						);
					headerless = true;
					h = headers.slice();
					collect = collector(h);
				}
				if (headerless) {
					const error = issue(values);
					if (error)
						throw Error(
							"UPS无表头账单校验失败：第" + record + "条记录，" + error,
						);
				} else if (
					values.length > h.length &&
					values.slice(h.length).some((v) => clean(v))
				)
					throw Error("第" + record + "条记录超过表头列数，可能字段错位");
				collect.add(values, record);
				const projected = new Array(h.length);
				for (let i = 0; i < h.length; i++)
					if (
						values[i] !== undefined &&
						values[i] !== "" &&
						(options.retainAll || !options.fields || options.fields.has(h[i]))
					)
						projected[i] = values[i];
				items.push({ r: projected, line: record });
			}
			function feed(text) {
				for (let i = 0; i < text.length && !unsupported; i++) {
					const c = text[i];
					if (quoted) {
						if (afterQuote) {
							if (c === '"') {
								field += '"';
								afterQuote = false;
								continue;
							}
							quoted = false;
							afterQuote = false;
							if (c === ",") {
								row.push(field);
								field = "";
								continue;
							}
							if (c === "\n") {
								emit();
								continue;
							}
							if (c === "\r") continue;
							if (c === " " || c === "\t") continue;
							throw Error(
								"CSV引号后出现异常字符，第" + (record + 1) + "条记录",
							);
						}
						if (c === '"') afterQuote = true;
						else field += c;
					} else if (c === '"') {
						if (field)
							throw Error("CSV引号位置无效，第" + (record + 1) + "条记录");
						quoted = true;
					} else if (c === ",") {
						row.push(field);
						field = "";
					} else if (c === "\n") emit();
					else if (c !== "\r") field += c;
				}
			}
			try {
				for (let at = 0; at < file.size; at += 1024 * 1024) {
					if (options.cancel?.()) throw Error("审核已取消");
					let chunk;
					try {
						chunk = decoder.decode(
							await file.slice(at, at + 1024 * 1024).arrayBuffer(),
							{ stream: true },
						);
					} catch (e) {
						if (!fallback) {
							fallback = true;
							throw { restart: true };
						}
						throw e;
					}
					feed(chunk);
					if (unsupported) return null;
					options.progress?.(
						"识别UPS账单 " +
							Math.min(
								100,
								Math.round(((at + 1024 * 1024) / file.size) * 100),
							) +
							"% · 已校验" +
							items.length +
							"行",
					);
					await pauses();
				}
				try {
					feed(decoder.decode());
				} catch (e) {
					if (e instanceof TypeError && !fallback) {
						fallback = true;
						throw { restart: true };
					}
					throw e;
				}
				if (quoted && !afterQuote)
					throw Error("CSV引号未闭合，第" + (record + 1) + "条记录");
				if (row.length || field || afterQuote) emit();
				if (unsupported) return null;
				if (!h || !items.length) throw Error("账单没有可读取的费用行");
				return {
					headers: h,
					rows: items,
					headerless,
					encoding: fallback ? "windows-1252" : "utf-8",
					validation: collect.finish(),
				};
			} catch (e) {
				if (e?.restart) {
					items = [];
					continue;
				}
				throw e;
			}
		}
	}
	async function inspectArrays(rows, first, options = {}) {
		const c = collector(headers);
		let count = 0;
		for (let i = first; i < rows.length; i++) {
			let row = rows[i];
			if (!row.some((v) => clean(v))) continue;
			if (options.excel && row.length >= 53 && row.length < 270) {
				row = row.slice();
				row.length = 270;
				rows[i] = row;
			}
			const e = issue(row);
			if (e) throw Error("UPS无表头账单校验失败：第" + (i + 1) + "行，" + e);
			c.add(row, i + 1);
			count++;
			if (count % 2000 === 0) {
				options.progress?.("校验UPS明细 " + count + "行");
				await new Promise((r) => setTimeout(r, 0));
			}
		}
		return c.finish();
	}
	function describe(v, headerless) {
		let text =
			(headerless
				? "已按内置UPS标准270列表头识别无表头账单，首行保留。"
				: "已识别UPS原始账单表头。") +
			"已校验" +
			v.rowCount +
			"条费用、" +
			v.invoices.length +
			"份账单。";
		if (v.complete) text += "净收费与发票金额核对一致。";
		else
			text +=
				"有" +
				v.mismatches.length +
				"份账单金额不一致或缺少完整金额依据；可审核当前费用，但不作为完整历史账单入库。";
		if (v.missingDescriptions)
			text +=
				"其中" +
				v.missingDescriptions +
				"条未提供费用名称，无法凭费用代码识别的项目将列为待核。";
		if (v.missingTransactionDates)
			text +=
				"其中" +
				v.missingTransactionDates +
				"条缺少交易日期，相关日期项目另行待核。";
		return text;
	}
	root.ShipGridUPSImport = {
		headers,
		index,
		money,
		issue,
		isHeaderless,
		candidate,
		collector,
		readCSV,
		inspectArrays,
		describe,
	};
	root.UPSInvoiceFuel.isHeaderless = isHeaderless;
})(globalThis);
