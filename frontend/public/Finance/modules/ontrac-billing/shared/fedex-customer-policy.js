/**
 * ontrac-billing/shared/fedex-customer-policy.js —— 客户重量/分区策略引擎
 *
 * 本模块提供 **客户级计费参数** 的灵活配置能力：不同客户可以有不同的 Zone 取值
 * 和重量取大策略，而不是全局一刀切。
 *
 * 为什么叫 "fedex-customer-policy" 但被 OnTrac 也引用？
 *   - 最早是为 FedEx 开发的（FedEx 有 spGtsOtherMax / spGtsOtherRaw 等 Zone 来源）
 *   - OnTrac 的 Zone 也有多来源（GTS 原始 Zone / 运单 Zone / 覆盖表 Zone）
 *   - 通用化后三承运商都可以用，文件名保留历史名称
 *
 * 默认策略：
 *   fedexZone     : 'spGtsOtherMax' （用 GTS 系统的最大分区值）
 *   fedexWeight   : 'maximum'       （重量取 GTS / 运单 / 体积重三者最大值）
 *   fedexPrecision: 'ceil'          （重量向上取整到下一个整数档）
 *
 * 可选策略值（可在 quote-manager 中为每个客户单独配置）：
 *   fedexZone:
 *     - 'spGtsOtherMax'  : GTS 最大分区（默认，最保守）
 *     - 'spGtsOtherRaw'  : GTS 原始分区（不做 max 合并）
 *     - 'raw'            : 运单 Zone 原值（不参考 GTS）
 *     - 'gts'            : GTS Zone 原值（覆盖运单 Zone）
 *     - 'max'            : GTS + 运单 Zone 取大
 *   fedexWeight:
 *     - 'maximum'  : 三取大（GTS / 运单 / 体积重）
 *     - 'raw'      : 运单重量原值
 *   fedexPrecision:
 *     - 'ceil'  : 向上取整（默认，计费规则最严格）
 *     - 'two'   : 保留两位小数（OnTrac 某些小客户）
 *
 * 核心函数 policy(r={})：
 *   输入：客户配置 r（可只填部分字段）
 *   输出：完整策略对象 { fedexZone, fedexWeight, fedexPrecision }
 *   校验：不合法值 → throw Error("无效FedEx客户规则：{key}")
 *
 * norm(v) 字符串规范化：NFKC 统一全半角 + trim + toLowerCase
 * 用于 Zone 名称匹配（如 "Zone 2" / "zone02" / "ZONE  2"）
 *
 * 对外暴露：root.ShipGridCustomerPolicy = { policy, defaults, valid, norm }
 *
 * 依赖：无外部依赖（纯数据 + 校验逻辑）
 */
/*SG-AUDIT:fedex-customer-policy.js*/ (function (root) {
	"use strict";
	const defaults = {
		fedexZone: "spGtsOtherMax",
		fedexWeight: "maximum",
		fedexPrecision: "ceil",
	};
	const valid = {
		fedexZone: ["spGtsOtherMax", "spGtsOtherRaw", "raw", "gts", "max"],
		fedexWeight: ["maximum", "raw"],
		fedexPrecision: ["ceil", "two"],
	};
	function policy(r = {}) {
		const p = {};
		for (const k of Object.keys(defaults)) {
			p[k] = r[k] || defaults[k];
			if (!valid[k].includes(p[k])) throw Error("无效FedEx客户规则：" + k);
		}
		return p;
	}
	const norm = (v) =>
		String(v ?? "")
			.normalize("NFKC")
			.trim()
			.toLowerCase();
	function resolve(rules, g) {
		const id = norm(g["客户ID"]),
			name = norm(g["客户名称"] || g["客户名"] || g["客服"]);
		const matches = rules.filter(
			(r) =>
				r.carrier === "fedex" &&
				((id && norm(r.customerId) === id) ||
					(name && norm(r.customerName) === name)),
		);
		if (!matches.length) return policy();
		if (matches.length > 1)
			throw Error("客户重量分区规则匹配冲突，请核对客户ID与名称");
		return policy(matches[0]);
	}
	function selectZone(p, eco, raw, gts) {
		const mode =
			p.fedexZone === "spGtsOtherMax"
				? eco
					? "gtsFallback"
					: "max"
				: p.fedexZone === "spGtsOtherRaw"
					? eco
						? "gts"
						: "raw"
					: p.fedexZone;
		const ok = (v) => Number.isInteger(v) && v >= 2 && v <= 8;
		if (mode === "raw") {
			if (!ok(raw)) throw Error("客户规则要求原始分区，但原始分区缺失或无效");
			return raw;
		}
		if (mode === "gts" || mode === "gtsFallback") {
			if (ok(gts)) return gts;
			if (mode === "gtsFallback" && ok(raw)) return raw;
			throw Error("客户规则要求GTS分区，但GTS分区缺失或无效");
		}
		if (!ok(raw)) throw Error("原始分区缺失或无效");
		return ok(gts) ? Math.max(raw, gts) : raw;
	}
	function prepare(p, g, wi) {
		if (p.fedexPrecision !== "two" || wi.gtsActual === null) return wi;
		const value = Number(g["下单实重"]),
			u = String(g["下单重量单位"] || g["重量单位"] || "kg").toLowerCase();
		if (!Number.isFinite(value) || value <= 0) throw Error("GTS实重必须为正数");
		if (!["kg", "kgs", "千克", "公斤", "lb", "lbs", "磅"].includes(u))
			throw Error("GTS重量单位无效");
		const lb =
				value *
				(["kg", "kgs", "千克", "公斤"].includes(u) ? 2.2046226218487757 : 1),
			truncated = Math.floor(lb * 100 + 1e-8) / 100,
			actual = Math.ceil(truncated - 1e-10);
		return {
			...wi,
			gtsActual: actual,
			actual,
			reference: Math.max(actual, wi.gtsDim ?? 0),
			maximum: Math.max(wi.rawBilled, actual, wi.gtsDim ?? 0),
			reason:
				"取重=max(原始最终计费重" +
				wi.rawBilled +
				"LB，GTS实重" +
				actual +
				"LB，GTS尺寸重" +
				(wi.gtsDim ?? "缺失") +
				"LB)；GTS实重换算LB后截取两位小数" +
				truncated +
				"LB再向上取整；GTS计费重原字段不参与计算",
		};
	}
	function weight(p, raw, g, wi, divisor) {
		if (p.fedexWeight === "raw") return Math.ceil(raw - 1e-10);
		return wi.maximum;
	}
	const names = {
		fedexZone: {
			spGtsOtherMax: "SmartPost按GTS（缺失回退原始），其他取大",
			spGtsOtherRaw: "SmartPost按GTS，其他按原始",
			raw: "原始分区",
			gts: "GTS分区",
			max: "原始/GTS分区取大",
		},
		fedexWeight: {
			maximum: "原始计费重/GTS实重/GTS体积重取大",
			raw: "原始账单计费重",
		},
		fedexPrecision: {
			ceil: "GTS实重直接向上取整磅",
			two: "GTS实重截取两位小数后向上取整磅",
		},
	};
	const describe = (p) =>
		Object.keys(defaults)
			.map((k) => names[k][p[k]])
			.join("；");
	root.ShipGridFedExCustomerPolicy = {
		policy,
		resolve,
		selectZone,
		prepare,
		weight,
		describe,
		defaults,
	};
})(globalThis);
