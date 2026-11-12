/**
 * billing-weight-policy.js — 跨承运商共享的重量政策核心算法
 * ==============================================================
 * 职责：
 *   1. 统一 GTS 实重/尺寸/体积重三项取大逻辑（FedEx/UPS/OnTrac 通用）
 *   2. 处理单位换算（kg→lb、cm→inch）
 *   3. 对缺失值给 warning 而不中断计算，仅在关键字段全缺时抛错
 *   4. 内置价格保护逻辑（price 函数）
 *
 * 被谁依赖：fedex-billing.js、ontrac-billing.js、ups-billing.js 的核心引擎
 *
 * 对外接口：ShipGridWeightPolicy = { prepare, price, ceil }
 *   - prepare(g, o): 从 GTS 行 g 和原始账单字段 o 计算三项取重结果
 *   - price(table, zone, weight, prior): 客户报价价格匹配 + 价格保护
 *   - ceil(n):     统一的向上取整工具（处理浮点误差）
 */
(function (root) {
	/** 统一向上取整，用 1e-10 缓冲处理浮点误差（避免 Math.ceil(3.0000000000001)=4） */
	const up = (n) => Math.ceil(n - 1e-10);

	/** 千克到磅的换算系数 */
	const kg = 2.2046226218487757;

	/** 判断值是否为空 */
	const empty = (v) => v === null || v === undefined || String(v).trim() === "";

	/**
	 * positive — 校验并转换为正数
	 * @param {*} v — 原始值
	 * @param {string} label — 错误信息中用的字段名
	 * @returns {number|null} — 正数，空值返回 null，无效值抛错
	 */
	function positive(v, label) {
		if (empty(v)) return null;
		const n = Number(v);
		if (!Number.isFinite(n) || n <= 0)
			throw Error(label + "必须为正数，不能用无效值参与取重");
		return n;
	}

	/**
	 * factor — 根据单位返回换算系数
	 * @param {string} v — 单位字符串（如 "kg"/"cm"）
	 * @param {"weight"|"dim"} kind — 换算类型：重量 或 尺寸
	 * @returns {number} — 乘以该系数即得到目标单位值
	 */
	function factor(v, kind) {
		const u = String(v).trim().toLowerCase();
		if (kind === "weight") {
			if (["kg", "kgs", "千克", "公斤"].includes(u)) return kg;
			if (["lb", "lbs", "磅"].includes(u)) return 1;
		} else {
			if (["cm", "厘米"].includes(u)) return 1 / 2.54;
			if (["in", "inch", "inches", "英寸", "i"].includes(u)) return 1;
		}
		throw Error(
			"未识别GTS" + (kind === "weight" ? "重量" : "尺寸") + "单位：" + v,
		);
	}

	/**
	 * prepare — 重量政策主函数：计算 GTS 实重、体积重、最终取重
	 * @param {object} g — GTS 行数据（包含 下单实重/下单长/宽/高/重量单位/尺寸单位 等字段）
	 * @param {object} o — 原始账单相关数据
	 *   - o.rawBilled: 原始最终计费重（必填，缺失直接抛错）
	 *   - o.divisor:   体积重除数（DIM，必填）
	 *   - o.rawActual: 原始实重（GTS缺失时的回退）
	 *   - o.rawDims:   原始尺寸数组（GTS缺失时的回退）
	 *   - o.exemptVolume: 体积豁免阈值（≤此值不计体积重）
	 *   - o.weightUnit/o.dimUnit: 回退单位
	 * @returns {object} 重量决策结果：
	 *   - rawBilled:    原始计费重（向上取整 LB）
	 *   - gtsActual:    GTS 实重（向上取整 LB，null 表示缺失）
	 *   - gtsDims:      GTS 三边（从大到小排序，单位 inch，null 表示缺失）
	 *   - gtsVolume:    GTS 体积（立方 inch）
	 *   - gtsDim:       GTS 体积重（向上取整 LB，0 表示豁免）
	 *   - actual:       用于附加费判定的实重（GTS 优先，回退原始）
	 *   - dims:         用于尺寸附加费判定的三边（GTS 优先，回退原始）
	 *   - reference:    max(GTS实重, GTS体积重)，SmartPost 参考重量
	 *   - maximum:      max(原始计费重, GTS实重, GTS体积重)，最终计费重
	 *   - warnings:     非阻断警告数组
	 *   - reason:       人类可读的决策说明
	 *
	 * 决策逻辑：
	 *   1. 原始计费重缺失 → 直接报错（不允许用 GTS 替代原始）
	 *   2. GTS 实重缺失 → 不参与取大，回退原始实重
	 *   3. GTS 尺寸不完整 → 不参与取大，回退原始尺寸
	 *   4. GTS 和原始尺寸都缺失 → 报错（无法判断尺寸附加费）
	 *   5. 体积重 = max(0, 体积 - 豁免阈值) / DIM，再向上取整
	 *   6. 最终计费重 = max(原始计费重, GTS实重, GTS体积重)
	 */
	function prepare(g, o) {
		const raw = positive(o.rawBilled, "原始最终计费重");
		if (raw === null) throw Error("缺少原始最终计费重，不自动用GTS替代");
		const divisor = positive(o.divisor, "体积重系数");
		if (divisor === null) throw Error("缺少体积重系数");
		const warnings = [];
		const wu = g["下单重量单位"] || g["重量单位"] || o.weightUnit || "kg";
		const du = g["尺寸单位"] || g["长宽高单位"] || o.dimUnit || "cm";

		// 如果 GTS 数据源标记为缺失（__weightPolicyMissingGts=true），则跳过 GTS 字段读取
		const absent = g.__weightPolicyMissingGts === true;
		const a = absent ? null : positive(g["下单实重"], "GTS实重");
		const ga = a === null ? null : up(a * factor(wu, "weight"));

		// 读取 GTS 三边
		const inputs = absent
			? [null, null, null]
			: ["下单长", "下单宽", "下单高"].map((k) => positive(g[k], "GTS" + k));
		const complete = inputs.every((v) => v !== null);

		// 将三边转换为 inch 并向上取整，按从大到小排序
		const gd = complete
			? inputs.map((v) => up(v * factor(du, "dim"))).sort((a, b) => b - a)
			: null;

		// 计算体积（立方 inch）和体积重
		const volume = gd ? gd.reduce((a, b) => a * b, 1) : null;
		const dim =
			volume === null
				? null
				: volume <= Number(o.exemptVolume || 0)
					? 0
					: up(volume / divisor);

		if (ga === null)
			warnings.push("GTS实重缺失：该项不参与取大，实重判定回退原始数据");
		if (gd === null)
			warnings.push(
				"GTS尺寸不完整：不拼接两套尺寸，GTS体积重不参与取大，尺寸判定回退原始整套",
			);

		// 回退：如果 GTS 尺寸缺失，尝试用原始账单的尺寸
		const fallback = o.rawDims?.map((v) => up(v)).sort((a, b) => b - a);
		if (
			!gd &&
			(!fallback ||
				fallback.length !== 3 ||
				fallback.some((v) => !Number.isFinite(v) || v <= 0))
		)
			throw Error("GTS尺寸和原始尺寸均不完整，不能判断尺寸收费");

		// 实重回退链：GTS → 原始
		const actual = ga ?? positive(o.rawActual, "回退原始实重");
		if (actual === null) throw Error("GTS及原始实重均缺失，不能判断实重附加费");

		return {
			rawBilled: up(raw),
			gtsActual: ga,
			gtsDims: gd,
			gtsVolume: volume,
			gtsDim: dim,
			actual,
			dims: gd ?? fallback,
			reference: Math.max(ga ?? 0, dim ?? 0),
			maximum: Math.max(up(raw), ga ?? 0, dim ?? 0),
			warnings,
			reason:
				"取重=max(原始最终计费重" +
				up(raw) +
				"LB，GTS实重" +
				(ga === null ? "缺失" : ga + "LB") +
				"，GTS尺寸重" +
				(dim === null ? "缺失" : dim + "LB") +
				")；GTS计费重原字段不参与计算",
		};
	}
	// function price(table, zone, weight, prior, preferredWeight = null) {
	// 	const cents = (v) => Math.round((v + Number.EPSILON) * 100),
	// 		listed = table[weight + "|" + zone];
	// 	if (typeof listed !== "number" || !Number.isFinite(listed) || listed <= 0)
	// 		throw Error(
	// 			"客户报价未覆盖最终重量/分区：" + weight + "LB / " + zone + "区",
	// 		);
	// 	if (
	// 		!(
	// 			typeof prior === "number" &&
	// 			Number.isFinite(prior) &&
	// 			cents(prior) > cents(listed)
	// 		)
	// 	)
	// 		return {
	// 			value: listed,
	// 			weight,
	// 			zone,
	// 			originalWeight: weight,
	// 			reason: "按最终计费重对应价表出账",
	// 		};
	// 	const matches = Object.entries(table)
	// 		.filter(
	// 			([k, v]) =>
	// 				k.split("|")[1] === String(zone) &&
	// 				Number.isFinite(v) &&
	// 				cents(v) === cents(prior) &&
	// 				Number(k.split("|")[0]) >= weight,
	// 		)
	// 		.map(([k]) => Number(k.split("|")[0]));
	// 	let matched = matches.includes(preferredWeight)
	// 		? preferredWeight
	// 		: matches.length === 1
	// 			? matches[0]
	// 			: null;
	// 	if (matched === null)
	// 		throw Error(
	// 			"价格保护待核：$" +
	// 				prior.toFixed(2) +
	// 				"在已确认" +
	// 				zone +
	// 				"区、重量不低于" +
	// 				weight +
	// 				"LB的价表中" +
	// 				(matches.length
	// 					? "匹配多个重量（" + matches.join("/") + "LB）"
	// 					: "没有匹配重量") +
	// 				"；未改写实际重量或分区",
	// 		);
	// 	return {
	// 		value: table[matched + "|" + zone],
	// 		weight: matched,
	// 		zone,
	// 		originalWeight: weight,
	// 		reason:
	// 			"价格保护：保留$" +
	// 			prior.toFixed(2) +
	// 			"，计价重量由" +
	// 			weight +
	// 			"LB匹配为" +
	// 			matched +
	// 			"LB，分区固定" +
	// 			zone +
	// 			"区；原始测量保留",
	// 	};
	// }

	/**
	 * price — 在客户报价表中查找基价，并与客户原始基价取低
	 * @param {object} table — 客户基础价表，key 格式为 "重量|分区"，value 为基价 USD
	 * @param {number} zone  — 分区（2-8）
	 * @param {number} weight — 计费重 LB（向上取整后）
	 * @param {number|null} prior — 客户原始基价（从 GTS 获取，可为 null 或 0）
	 * @param {number|null} preferredWeight — 价格保护场景下的优先匹配重量（已废弃，保留签名）
	 * @returns {object} 定价决策：
	 *   - value:   最终基价 USD
	 *   - weight:  使用的计费重
	 *   - zone:    使用的分区
	 *   - originalWeight: 传入的原始重量（用于追溯）
	 *   - reason:  人类可读的定价说明
	 *
	 * 决策逻辑：
	 *   1. 价表中找不到 weight|zone → 报错
	 *   2. 客户原始基价存在且 < 价表价 → 取客户原始基价（价格保护）
	 *   3. 其他情况 → 取价表价（高于价表时按价表取低）
	 */
	function price(table, zone, weight, prior, preferredWeight = null) {
		const cents = (v) => Math.round((v + Number.EPSILON) * 100),
			listed = table[weight + "|" + zone];
		if (typeof listed !== "number" || !Number.isFinite(listed) || listed <= 0)
			throw Error(
				"客户报价未覆盖最终重量/分区：" + weight + "LB / " + zone + "区",
			);

		if (
			typeof prior === "number" &&
			Number.isFinite(prior) &&
			prior > 0 &&
			cents(prior) < cents(listed)
		) {
			return {
				value: prior,
				weight,
				zone,
				originalWeight: weight,
				reason:
					"客户原始基价$" +
					prior.toFixed(2) +
					"低于价表$" +
					listed.toFixed(2) +
					"，取低",
			};
		}

		return {
			value: listed,
			weight,
			zone,
			originalWeight: weight,
			reason:
				prior > 0 && cents(prior) > cents(listed)
					? "客户原始基价$" +
						prior.toFixed(2) +
						"高于价表$" +
						listed.toFixed(2) +
						"，按价表取低"
					: "按客户价表对应重量/分区出账",
		};
	}

	/** 对外暴露统一接口，挂载到 globalThis.ShipGridWeightPolicy */
	root.ShipGridWeightPolicy = { prepare, price, ceil: up };
})(globalThis);
