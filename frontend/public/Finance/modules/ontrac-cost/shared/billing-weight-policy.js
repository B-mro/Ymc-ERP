// ============================================================================
// shared/billing-weight-policy.js —— 重量政策核心算法（跨模块共享）
// ----------------------------------------------------------------------------
// V3.53: carrier-rated weight + independently measured GTS inputs.
// 被 ontrac-cost、ontrac-billing、fedex-billing、ups-billing 等多个模块复用。
//
// 本模块只做一件事：根据「原始账单重量数据」和「GTS 系统实测数据」，
// 算出最终应该用哪个重量作为计费重、哪个尺寸作为整套尺寸。
//
// 对外暴露三个东西：
//   prepare(g, o)   —— 主函数，返回重量/尺寸决策对象
//   price(table, zone, weight, prior, preferred) —— 查价表 + 价格保护逻辑
//   ceil            —— 向上取整工具函数
//
// prepare() 的核心决策流程：
//   1. 读取 g（GTS 行对象）里的 下单实重 / 下单长宽高 / 单位信息
//      如果 g.__weightPolicyMissingGts === true 表示 GTS 整条缺失
//   2. 重量单位 kg → lb 乘 2.2046226218487757
//      尺寸单位 cm → inch 除 2.54
//   3. GTS 实重向上取整 → ga
//      GTS 尺寸换算后向上取整、降序排列 → gd
//   4. GTS 体积重 = volume(gd) / divisor（Ontrac 固定 275）
//      体积 ≤ exemptVolume 时体积重按 0 处理
//   5. 生成 warnings 数组（GTS 实重缺失、GTS 尺寸不完整等）
//   6. 返回决策结果：
//        actual      —— 最终采用的实重（ga ?? rawActual）
//        dims        —— 最终采用的整套尺寸（gd ?? fallback 原始尺寸）
//        reference   —— GTS 侧三项取大 = max(ga, gtsDim)，只用来比较
//        maximum     —— 最终计费重 = min(rawBilled, max(ga, gtsDim))
//        warnings    —— 异常/提示列表
//        reason      —— 人可读的取重说明
//
// price() 处理「价格保护」场景：
//   如果客户有一个已确认的 prior 价格，而新算出的 listed 价格更低，
//   不直接用新价，而是去价表里找一个不低于 weight 的重量档，
//   其价格恰好等于 prior 的那条记录，保持客户既有合约价不变。
// ============================================================================
/*SG-AUDIT:billing-weight-policy.js*/ /** V3.53: carrier-rated weight + independently measured GTS inputs. */
(function (root) {
	const up = (n) => Math.ceil(n - 1e-10);
	const kg = 2.2046226218487757;
	const empty = (v) => v === null || v === undefined || String(v).trim() === "";
	function positive(v, label) {
		if (empty(v)) return null;
		const n = Number(v);
		if (!Number.isFinite(n) || n <= 0)
			throw Error(label + "必须为正数，不能用无效值参与取重");
		return n;
	}
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
	function prepare(g, o) {
		console.log(g, o);
		const raw = positive(o.rawBilled, "原始最终计费重");
		if (raw === null) throw Error("缺少原始最终计费重，不自动用GTS替代");
		const divisor = positive(o.divisor, "体积重系数");
		if (divisor === null) throw Error("缺少体积重系数");
		const warnings = [];
		const wu = g["下单重量单位"] || g["重量单位"] || o.weightUnit || "kg";
		const du = g["尺寸单位"] || g["长宽高单位"] || o.dimUnit || "cm";
		const absent = g.__weightPolicyMissingGts === true;
		const a = absent ? null : positive(g["下单实重"], "GTS实重");
		const ga = a === null ? null : up(a * factor(wu, "weight"));
		const inputs = absent
			? [null, null, null]
			: ["下单长", "下单宽", "下单高"].map((k) => positive(g[k], "GTS" + k));
		const complete = inputs.every((v) => v !== null);

		const gd = complete
			? inputs.map((v) => up(v * factor(du, "dim"))).sort((a, b) => b - a)
			: null;
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
		const fallback = o.rawDims?.map((v) => up(v)).sort((a, b) => b - a);
		if (
			!gd &&
			(!fallback ||
				fallback.length !== 3 ||
				fallback.some((v) => !Number.isFinite(v) || v <= 0))
		)
			throw Error("GTS尺寸和原始尺寸均不完整，不能判断尺寸收费");
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
			maximum: Math.min(up(raw), Math.max(ga ?? 0, dim ?? 0)),
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
	function price(table, zone, weight, prior, preferredWeight = null) {
		const cents = (v) => Math.round((v + Number.EPSILON) * 100),
			listed = table[weight + "|" + zone];
		if (typeof listed !== "number" || !Number.isFinite(listed) || listed <= 0)
			throw Error(
				"客户报价未覆盖最终重量/分区：" + weight + "LB / " + zone + "区",
			);
		if (
			!(
				typeof prior === "number" &&
				Number.isFinite(prior) &&
				cents(prior) > cents(listed)
			)
		)
			return {
				value: listed,
				weight,
				zone,
				originalWeight: weight,
				reason: "按最终计费重对应价表出账",
			};
		const matches = Object.entries(table)
			.filter(
				([k, v]) =>
					k.split("|")[1] === String(zone) &&
					Number.isFinite(v) &&
					cents(v) === cents(prior) &&
					Number(k.split("|")[0]) >= weight,
			)
			.map(([k]) => Number(k.split("|")[0]));
		let matched = matches.includes(preferredWeight)
			? preferredWeight
			: matches.length === 1
				? matches[0]
				: null;
		if (matched === null)
			throw Error(
				"价格保护待核：$" +
					prior.toFixed(2) +
					"在已确认" +
					zone +
					"区、重量不低于" +
					weight +
					"LB的价表中" +
					(matches.length
						? "匹配多个重量（" + matches.join("/") + "LB）"
						: "没有匹配重量") +
					"；未改写实际重量或分区",
			);
		return {
			value: table[matched + "|" + zone],
			weight: matched,
			zone,
			originalWeight: weight,
			reason:
				"价格保护：保留$" +
				prior.toFixed(2) +
				"，计价重量由" +
				weight +
				"LB匹配为" +
				matched +
				"LB，分区固定" +
				zone +
				"区；原始测量保留",
		};
	}
	root.ShipGridWeightPolicy = { prepare, price, ceil: up };
})(globalThis);
