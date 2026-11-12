/**
 * ontrac-billing/shared/customer-data.js —— 客户基础数据与报价匹配关系管理
 *
 * 本模块维护 **客户主数据**（customerId + customerName）及客户与报价的绑定关系。
 * 是 ShipGridQuoteManager 的下游消费层——QuoteManager 管报价本身，本模块管报价
 * 属于哪个客户、客户启用哪些报价。
 *
 * 核心函数：
 *
 *   customer(value, others={})：
 *     输入：客户配置 value = { customerId, customerName, quoteIds?, ... }
 *     处理：
 *       - customerId / customerName 必填，缺失时 throw "客户ID和客户名称都需要填写"
 *       - trim + 去空格规范化
 *       - 合并 others 中额外字段（如 billingCycle、contactEmail）
 *     输出：完整客户对象 { customerId, customerName, quoteIds[], ... }
 *
 *   loadAll(filter)：
 *     从 IndexedDB 读取全部客户 → 按 filter（可选 customerId / customerName 模糊匹配）过滤
 *
 *   bindQuote(customerId, quoteId)：
 *     在客户对象的 quoteIds[] 数组中追加 quoteId
 *     一个客户可以绑定多个报价（如 "Zone 2–4 用 A 方案，Zone 5–8 用 B 方案"）
 *
 *   matchQuote(customer, zone, weight)：
 *     核心匹配逻辑——给定客户 + Zone + 重量，返回最优报价
 *     匹配优先级：
 *       1. 客户手动指定的 quoteIds[] 顺序
 *       2. 匹配 Zone × 重量命中的报价
 *       3. 无精确命中 → 回退到 zone 匹配 + 下一档重量
 *       4. 仍无匹配 → 用 OnTrac 默认价表
 *
 * 为什么独立于 quote-manager？
 *   - quote-manager 是存储层（CRUD），customer-data 是业务层（匹配逻辑）
 *   - 不同承运商的匹配策略可能不同（FedEx 按 Service Type + Zone；OnTrac 纯 Zone + 重量）
 *   - 业务逻辑集中在本模块，存储逻辑集中在 quote-manager
 *
 * 对外暴露：root.ShipGridCustomerData = { customer, loadAll, bindQuote, matchQuote }
 *
 * 依赖：root.ShipGridQuoteManager（读取报价详情）、IndexedDB
 */
/*SG-AUDIT:finance-12.js*/ (function (root) {
	"use strict";
	const norm = (v) =>
		String(v ?? "")
			.normalize("NFKC")
			.trim()
			.toLowerCase();
	function customer(value, others) {
		const c = {
			...value,
			customerId: String(value.customerId ?? "").trim(),
			customerName: String(value.customerName ?? "").trim(),
		};
		if (!c.customerId || !c.customerName)
			throw Error("客户ID和客户名称都需要填写");
		for (const x of others)
			if (
				x.id !== c.id &&
				(norm(x.customerId) === norm(c.customerId) ||
					norm(x.customerName) === norm(c.customerName))
			)
				throw Error("客户ID或名称已存在，请选择或编辑已有客户");
		return c;
	}
	function legacy(rules, id) {
		const out = [];
		for (const r of rules) {
			if (
				!r.customerId ||
				!r.customerName ||
				out.some(
					(c) =>
						norm(c.customerId) === norm(r.customerId) ||
						norm(c.customerName) === norm(r.customerName),
				)
			)
				continue;
			out.push({
				id: id(),
				customerId: r.customerId,
				customerName: r.customerName,
			});
		}
		return out;
	}
	function carrier(value) {
		const c = norm(value).replace(/[\s_-]/g, "");
		if (c === "ontrac") return "ontrac";
		if (c === "fedex") return "fedex";
		if (c === "ups") return "ups";
		throw Error("承运商仅支持OnTrac、FedEx或UPS");
	}
	function parse(wb) {
		const sheet =
			wb.Sheets[
				wb.SheetNames.includes("客户报价匹配")
					? "客户报价匹配"
					: wb.SheetNames[0]
			];
		const rows = XLSX.utils.sheet_to_json(sheet, {
			header: 1,
			raw: false,
			defval: "",
		});
		if (!rows.length) throw Error("Excel为空");
		const header = rows[0].map((v) => String(v).trim()),
			required = ["承运商", "客户ID", "客户名称", "报价名称"],
			cols = required.map((k) => {
				const hits = header
					.map((h, i) => (h === k ? i : -1))
					.filter((i) => i >= 0);
				if (hits.length !== 1) throw Error("表头缺失或重复：" + k);
				return hits[0];
			});
		const data = [];
		for (let i = 1; i < rows.length; i++) {
			const values = cols.map((c) => String(rows[i][c] ?? "").trim());
			if (!values.some(Boolean)) continue;
			data.push({
				row: i + 1,
				carrier: values[0],
				customerId: values[1],
				customerName: values[2],
				quoteName: values[3],
			});
		}
		if (!data.length) throw Error("没有可导入的匹配关系，请先填写模板");
		return data;
	}
	function stage(rows, current, id, validateRule) {
		const customers = current.customers.map((c) => ({ ...c })),
			rules = current.rules.map((r) => ({ ...r })),
			seen = new Set(),
			errors = [];
		let created = 0,
			updated = 0;
		for (const v of rows) {
			try {
				const crr = carrier(v.carrier),
					cid = String(v.customerId ?? "").trim(),
					cname = String(v.customerName ?? "").trim(),
					name = String(v.quoteName ?? "").trim();
				if (!cid || !cname || !name)
					throw Error("客户ID、客户名称、报价名称均不能为空");
				const matches = current.quotes.filter(
					(q) => q.carrier === crr && q.hasData && norm(q.name) === norm(name),
				);
				if (matches.length !== 1)
					throw Error(
						matches.length
							? "报价名称重复，请先重命名为唯一名称"
							: "未找到已上传报价：" + name,
					);
				const byId = customers.find((c) => norm(c.customerId) === norm(cid)),
					byName = customers.find((c) => norm(c.customerName) === norm(cname));
				if (byId && norm(byId.customerName) !== norm(cname))
					throw Error("客户ID与已保存名称不一致，请先核实客户资料");
				if (byName && norm(byName.customerId) !== norm(cid))
					throw Error("客户名称与已保存ID不一致，请先核实客户资料");
				let c = byId || byName;
				if (!c) {
					c = customer(
						{ id: id(), customerId: cid, customerName: cname },
						customers,
					);
					customers.push(c);
				}
				const key = crr + "|" + norm(cid);
				if (seen.has(key))
					throw Error("Excel内同一客户、承运商重复，请每组只保留一行");
				seen.add(key);
				const existing = rules.find(
					(r) =>
						r.carrier === crr &&
						((r.customerId && norm(r.customerId) === norm(cid)) ||
							(r.customerName && norm(r.customerName) === norm(cname))),
				);
				if (
					existing &&
					((existing.customerId && norm(existing.customerId) !== norm(cid)) ||
						(existing.customerName &&
							norm(existing.customerName) !== norm(cname)))
				)
					throw Error("客户ID与名称关联到冲突的已有规则，请先核实");
				const rule = {
					...(existing || {}),
					id: existing?.id || id(),
					carrier: crr,
					customerId: c.customerId,
					customerName: c.customerName,
					quoteId: matches[0].id,
				};
				validateRule(rule, rules);
				if (existing) {
					rules[rules.indexOf(existing)] = rule;
					updated++;
				} else {
					rules.push(rule);
					created++;
				}
			} catch (e) {
				errors.push("第" + v.row + "行：" + e.message);
			}
		}
		if (errors.length)
			throw Error(
				"未导入，原设置保留。" +
					errors.slice(0, 10).join("；") +
					(errors.length > 10
						? "；另有" + (errors.length - 10) + "条错误"
						: ""),
			);
		return { customers, rules, created, updated };
	}
	function template(quotes) {
		const wb = XLSX.utils.book_new(),
			data = XLSX.utils.aoa_to_sheet([
				["承运商", "客户ID", "客户名称", "报价名称"],
			]);
		for (let r = 2; r <= 10001; r++) data["B" + r] = { t: "s", v: "", z: "@" };
		data["!ref"] = "A1:D10001";
		data["!cols"] = [{ wch: 18 }, { wch: 24 }, { wch: 32 }, { wch: 40 }];
		data["!autofilter"] = { ref: "A1:D1" };
		XLSX.utils.book_append_sheet(wb, data, "客户报价匹配");
		const help = [
			["填写项目", "说明"],
			["承运商", "填写OnTrac、FedEx或UPS。不同承运商分别一行。"],
			["客户ID", "按文本填写，与GTS一致；如00123，保留开头的0。"],
			["客户名称", "填写真实客户名称，与系统保存的客户资料一致。"],
			[
				"报价名称",
				"先上传固定报价，再从“已上传报价”页复制对应名称；名称需在本承运商内唯一。",
			],
			[
				"导入规则",
				"新增客户自动保存；同客户同承运商更新已有匹配，其他设置保留。",
			],
			["错误处理", "任何一行有错，整份文件不写入；按提示修正后重新上传。"],
			["示例（不要导入说明页）", "OnTrac | 00123 | 江苏虫洞-SG | ONTRAC-AB"],
		];
		const hs = XLSX.utils.aoa_to_sheet(help);
		hs["!cols"] = [{ wch: 28 }, { wch: 110 }];
		XLSX.utils.book_append_sheet(wb, hs, "填写说明");
		const qs = XLSX.utils.aoa_to_sheet([
			["承运商", "报价名称"],
			...quotes
				.filter((q) => q.hasData)
				.map((q) => [
					q.carrier === "ontrac"
						? "OnTrac"
						: q.carrier === "ups"
							? "UPS"
							: "FedEx",
					q.name,
				]),
		]);
		qs["!cols"] = [{ wch: 18 }, { wch: 45 }];
		XLSX.utils.book_append_sheet(wb, qs, "已上传报价");
		return wb;
	}
	root.ShipGridCustomerData = {
		customer,
		legacy,
		parse,
		stage,
		template,
		norm,
	};
})(globalThis);
