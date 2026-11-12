/**
 * fedex-overrides.js — FedEx 逐单覆盖表解析与匹配
 * ================================================
 * 职责：
 *   解析用户上传的"逐单覆盖表"Excel，按 客户ID + 运单号 唯一键精确匹配，
 *   覆盖引擎自动计算出的计费重和分区。
 *
 * 使用场景：
 *   当某票 GTS 订单的自动计费结果与实际合同不一致时，通过覆盖表手工指定
 *   该票的重量或分区，引擎在常规计算后优先应用覆盖值。
 *
 * 覆盖表 Excel 列：客户ID、运单号、承运商、计费重量、重量单位(LB/KG)、分区、备注
 *
 * 被谁依赖：fedex-billing.js（引擎在选完 zone/weight 后调用 match 检查覆盖）
 *
 * 对外接口：ShipGridFedExOverrides = { parse, match }
 */
(function (root) {
	("use strict");

	/** 字符串化（去首尾空格） */
	const text = (v) => String(v ?? "").trim(),
		/** 判断值是否为空（null/undefined/空串） */
		blank = (v) => v === null || v === undefined || text(v) === "";

	/**
	 * parse — 解析覆盖表 Excel 为 Map<key, override>
	 * @param {object} wb — XLSX workbook（取第一个工作表）
	 * @returns {Map<string, object>} key 为 JSON.stringify([customerId, tracking])
	 *   value 含 { weight(LB), zone(2-8), line(Excel行号), note, rawWeight, unit, customer, track, used }
	 *
	 * 校验规则（任何一项不满足直接抛错，整张表不生效）：
	 *   - 客户ID + 运单号 必填且唯一
	 *   - 运单号必须为文本类型（防止 Excel 长数字精度丢失）
	 *   - 承运商如填写只能是 FedEx
	 *   - 重量 > 0，单位 LB/KG，换算后 0-150 LB
	 *   - 分区为 2-8 整数
	 *   - 重量和分区至少填一项
	 */
	function parse(wb) {
		const map = new Map();
		if (!wb) return map;
		const rows = root.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
			defval: "",
			raw: true,
		});
		if (!rows.length) throw Error("覆盖表为空");
		for (const [i, r] of rows.entries()) {
			const line = i + 2;
			if (!Object.values(r).some((v) => !blank(v))) continue;
			const customer = text(r["客户ID"]),
				track = text(r["运单号"]);
			if (!customer || !track)
				throw Error(
					"覆盖表第" + line + "行缺少客户ID或运单号；运单号请按文本保存",
				);
			if (typeof r["运单号"] !== "string")
				throw Error(
					"覆盖表运单号必须为文本，避免长数字精度丢失（第" + line + "行）",
				);
			const carrier = text(r["承运商"]);
			if (carrier && carrier.toLowerCase() !== "fedex")
				throw Error("覆盖表只允许FedEx（第" + line + "行）");
			let weight = null,
				zone = null;
			const rawWeight = r["计费重量"];
			if (!blank(rawWeight)) {
				const value = Number(rawWeight),
					unit = text(r["重量单位"]).toUpperCase();
				if (
					!Number.isFinite(value) ||
					value <= 0 ||
					!["LB", "KG"].includes(unit)
				)
					throw Error("覆盖表重量须大于0，单位填LB或KG（第" + line + "行）");
				weight =
					Math.round(value * (unit === "KG" ? 2.2046226218487757 : 1) * 100) /
					100;
				if (weight <= 0 || weight > 150)
					throw Error("覆盖表重量须在0–150LB内（第" + line + "行）");
			}
			if (!blank(r["分区"])) {
				zone = Number(r["分区"]);
				if (!Number.isInteger(zone) || zone < 2 || zone > 8)
					throw Error("覆盖表分区须为2–8整数（第" + line + "行）");
			}
			if (weight === null && zone === null)
				throw Error("覆盖表须至少填写重量或分区（第" + line + "行）");
			const key = JSON.stringify([customer, track]);
			if (map.has(key))
				throw Error(
					"覆盖表客户ID＋运单号重复（第" + line + "行），请去重后上传",
				);
			map.set(key, {
				weight,
				zone,
				line,
				note: text(r["备注"]),
				rawWeight,
				unit: text(r["重量单位"]),
				customer,
				track,
				used: false,
			});
		}
		return map;
	}

	/**
	 * match — 在覆盖表 Map 中查找指定 客户ID+运单号 的覆盖记录
	 * 命中时标记 used=true（引擎最终会报告哪些覆盖行未被使用）
	 * @param {Map} map      — parse() 返回的 Map
	 * @param {string} customerId — GTS 行的客户ID
	 * @param {string} track      — GTS 行的运单号
	 * @returns {object|undefined} 覆盖记录（含 weight/zone），未命中返回 undefined
	 */
	function match(map, customer, track) {
		const v = map.get(JSON.stringify([text(customer), text(track)]));
		if (v) v.used = true;
		return v;
	}

	/** 对外暴露统一接口 */
	root.ShipGridFedExOverrides = { parse, match };
})(globalThis);
