/**
 * fedex-customer-policy.js — FedEx 客户专属重量/分区/精度规则
 * ==============================================================
 * 职责：
 *   为每个 FedEx 客户配置独立的"分区来源 + 重量来源 + 实重精度"策略，
 *   覆盖 billing-weight-policy.js 的默认决策。
 *
 * 规则三项：
 *   1. fedexZone（分区来源）
 *      - spGtsOtherMax: SmartPost 用 GTS 分区（缺失回退原始），其他服务原始/GTS 取大
 *      - spGtsOtherRaw: SmartPost 用 GTS，其他用原始
 *      - raw: 全部按原始账单分区
 *      - gts: 全部按 GTS 分区
 *      - max: 全部原始/GTS 取大
 *   2. fedexWeight（重量来源）
 *      - maximum: 原始计费重、GTS 实重、GTS 体积重取大（默认）
 *      - raw: 直接用原始账单计费重
 *   3. fedexPrecision（GTS 实重精度）
 *      - ceil: 直接向上取整磅
 *      - two: 截取两位小数后向上取整磅（某些客户合同要求）
 *
 * 被谁依赖：fedex-billing.js（引擎决策时调用 selectZone/weight/prepare）
 *           quote-manager.js（保存/校验客户规则时调用 policy/resolve）
 *
 * 对外接口：ShipGridFedExCustomerPolicy = { policy, resolve, selectZone, prepare, weight, describe, defaults }
 */
(function (root) {
	("use strict");

	/** 三项规则的默认值（未配置客户时使用） */
	const defaults = {
		fedexZone: "spGtsOtherMax",
		fedexWeight: "maximum",
		fedexPrecision: "ceil",
	};

	/** 每项规则允许的取值集合 */
	const valid = {
		fedexZone: ["spGtsOtherMax", "spGtsOtherRaw", "raw", "gts", "max"],
		fedexWeight: ["maximum", "raw"],
		fedexPrecision: ["ceil", "two"],
	};

	/**
	 * policy — 校验并补全客户规则对象
	 * @param {object} r — 客户规则原始对象（可缺少字段）
	 * @returns {object} 补全后的规则（缺失字段用 defaults 填充，非法值抛错）
	 */
	function policy(r = {}) {
		const p = {};
		for (const k of Object.keys(defaults)) {
			p[k] = r[k] || defaults[k];
			if (!valid[k].includes(p[k])) throw Error("无效FedEx客户规则：" + k);
		}
		return p;
	}

	/** 标准化：去空格 + NFKC 归一 + 小写，用于客户ID/名称模糊匹配 */
	const norm = (v) =>
		String(v ?? "")
			.normalize("NFKC")
			.trim()
			.toLowerCase();

	/**
	 * resolve — 根据 GTS 行（含客户ID/名称）在 rules 数组中找到 FedEx 规则
	 * @param {Array} rules — 所有承运商的客户匹配规则数组
	 * @param {object} g    — GTS 订单行
	 * @returns {object} 该客户的 FedEx 规则（未匹配时返回默认规则）
	 * @throws 匹配到多条规则时抛错（避免冲突）
	 */
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

	/**
	 * selectZone — 根据客户规则 + 服务类型 + 原始/GTS 分区，选出最终分区
	 * @param {object} p   — policy() 结果
	 * @param {boolean} eco — 是否为 SmartPost/Economy 服务
	 * @param {number} raw — 原始账单分区（2-8 或 null）
	 * @param {number} gts — GTS 分区（2-8 或 null）
	 * @returns {number} 最终分区
	 * @throws 按规则需要某来源但该来源缺失/无效时抛错
	 */
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

	/**
	 * prepare — 应用 GTS 实重精度规则，修正 billing-weight-policy.prepare 的结果
	 * 仅当 fedexPrecision === "two" 且 gtsActual 不为 null 时生效
	 * 规则：下单实重(kg/lb) → 换算lb → 截取两位小数 → 向上取整
	 * @param {object} p  — policy() 结果
	 * @param {object} g  — GTS 订单行（含"下单实重""下单重量单位"字段）
	 * @param {object} wi — billing-weight-policy.prepare() 的返回值
	 * @returns {object} 修正后的 weight-info 对象（含更新后的 maximum/reference/actual）
	 */
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

	/**
	 * weight — 根据 fedexWeight 规则选出最终计费重
	 * @param {object} p      — policy() 结果
	 * @param {number} raw    — 原始账单计费重 LB
	 * @param {object} g      — GTS 订单行
	 * @param {object} wi     — 经 prepare() 处理后的 weight-info 对象
	 * @param {number} divisor — 尺寸重除数（保留参数，FedEx 固定 139）
	 * @returns {number} 最终计费重（向上取整后的整数）
	 */
	function weight(p, raw, g, wi, divisor) {
		if (p.fedexWeight === "raw") return Math.ceil(raw - 1e-10);
		return wi.maximum;
	}

	/** 规则取值的人类可读名称，用于 UI 展示 */
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

	/**
	 * describe — 把规则对象转为人类可读描述串（三项用"；"连接）
	 * @param {object} p — policy() 结果
	 * @returns {string} 如 "SmartPost按GTS…；原始计费重…；直接向上取整磅"
	 */
	const describe = (p) =>
		Object.keys(defaults)
			.map((k) => names[k][p[k]])
			.join("；");

	/** 对外暴露统一接口 */
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
