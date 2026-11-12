/**
 * customer-data.js — 客户资料校验与 Excel 批量导入
 * ================================================
 * 职责：
 *   1. customer() — 校验单个客户对象（ID + 名称必填、不重复）
 *   2. legacy() — 从旧版 rules 数组自动迁移生成 customers 数组（历史兼容）
 *   3. carrier() — 承运商名称标准化（OnTrac/FedEx/UPS → 小写英文标识）
 *   4. parse() — 解析"客户报价匹配"Excel 的四个必填列
 *   5. stage() — 批量导入校验（客户唯一性、报价存在性、ID/名称冲突检测）
 *   6. template() — 生成带填写说明的 Excel 匹配模板
 *
 * 被谁依赖：quote-manager.js（UI 导入流程的全部校验）
 *
 * 对外接口：ShipGridCustomerData = { customer, legacy, parse, stage, template, norm }
 */
(function (root) {
	("use strict");

	/** 标准化：NFKC 归一 + 去空格 + 小写，用于客户ID/名称模糊去重 */
	const norm = (v) =>
		String(v ?? "")
			.normalize("NFKC")
			.trim()
			.toLowerCase();

	/**
	 * customer — 校验单个客户对象并去重
	 * @param {object} value — { id?, customerId, customerName }
	 * @param {Array} others — 已存在的 customers 数组（用于冲突检测）
	 * @returns {object} 规范化后的客户对象
	 * @throws ID/名称缺失或与 others 中已有记录重复时抛错
	 */
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

	/**
	 * legacy — 从旧版 rules 数组中提取独立的 customers 数组
	 * 早期版本只有规则（含 customerId/customerName），后来拆分出独立的客户资料表。
	 * 此函数在首次启动时自动迁移，避免用户手动重录。
	 * @param {Array} rules — 旧版规则数组
	 * @param {Function} id  — 生成唯一ID的函数（如 crypto.randomUUID）
	 * @returns {Array} 去重后的 customers 数组
	 */
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

	/**
	 * carrier — 把 Excel 中填写的承运商名称标准化为英文标识
	 * 接受：OnTrac / Ontrac / on-trac / fedex / FedEx / ups / UPS 等
	 * @param {string} value — Excel 中的承运商单元格值
	 * @returns {"ontrac"|"fedex"|"ups"} 小写英文标识
	 * @throws 非三大承运商时抛错
	 */
	function carrier(value) {
		const c = norm(value).replace(/[\s_-]/g, "");
		if (c === "ontrac") return "ontrac";
		if (c === "fedex") return "fedex";
		if (c === "ups") return "ups";
		throw Error("承运商仅支持OnTrac、FedEx或UPS");
	}
	/**
	 * parse — 解析客户报价匹配 Excel 的第一个工作表
	 * 要求四个必填列：承运商、客户ID、客户名称、报价名称
	 * 支持工作表名为"客户报价匹配"或任意第一个工作表
	 * @param {object} wb — XLSX workbook
	 * @returns {Array<{row, carrier, customerId, customerName, quoteName}>} 待导入行
	 * @throws 表头缺失/重复、Excel 为空、无有效数据时抛错
	 */
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

	/**
	 * stage — 批量导入事务性校验与合并
	 * 逐行校验，累积错误。有任何一行出错则整张表不写入，原设置保留。
	 *
	 * @param {Array} rows   — parse() 返回的待导入行
	 * @param {object} current — { customers, rules, quotes } 当前已保存数据
	 * @param {Function} id  — 生成唯一ID函数
	 * @param {Function} validateRule — 对每条规则额外校验（FedEx 时调用 policy）
	 * @returns {{ customers, rules, created, updated }} 合并后的数组
	 * @throws 任何校验失败时抛错（携带前 10 条错误消息）
	 *
	 * 校验项：
	 *   - 报价名称在本承运商内唯一且已上传
	 *   - 客户ID ↔ 名称一致性（与已保存客户资料比对）
	 *   - 同一 Excel 内 客户+承运商 不重复
	 *   - 同一 客户+承运商 在 rules 中不重复（否则更新已有规则）
	 */
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
	/**
	 * template — 生成客户报价匹配 Excel 导入模板（三个工作表）
	 *   Sheet1 "客户报价匹配": 四列表头，B 列预设为文本格式防止客户ID精度丢失，预留 10000 行
	 *   Sheet2 "填写说明": 中文填写指引，含承运商/客户ID/报价名称的详细说明
	 *   Sheet3 "已上传报价": 当前系统中已上传的报价清单，供用户复制报价名称
	 * @param {Array} quotes — 当前已上传的报价数组（用于填充"已上传报价"工作表）
	 * @returns {object} XLSX workbook（可直接 XLSX.writeFile 下载）
	 */
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

	/** 对外暴露统一接口 */
	root.ShipGridCustomerData = {
		customer,
		legacy,
		parse,
		stage,
		template,
		norm,
	};
})(globalThis);
