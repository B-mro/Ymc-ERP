/**
 * dispute-reasons.js —— UPS 申诉原因分类与中文标签引擎
 *
 * 本模块是一个 **展示层辅助**：为 reconcile 产生的每笔差额标记 **申诉原因类别**，
 * 生成中文标签和标准化原因码，供 Dispute 导出、UI 展示、客服与 UPS 对接使用。
 *
 * 文件头注释已明确：
 *   "Presentation only: never changes contract rates, claim amounts or claim eligibility."
 *   —— 只做展示/标注，**绝不** 修改合约费率、申诉金额或申诉资格。
 *   分类结果是对 reconcile 结果的 **标注补充**，不是判定依据。
 *
 * 核心函数 label(id, name)：
 *   输入：
 *     id   : reconcile 内部 fee 分类 ID（如 'base' / 'fuel' / 'resi' / 'ahsD'）
 *     name : Charge Description（账单原始费用名称，如 "GROUND COMMERCIAL"）
 *   处理优先级：
 *     1. 直接查 id→中文表（names 对象）
 *        {base:'基础费', fuel:'燃油费', resi:'住宅附加费', das:'DAS偏远费',
 *         ahsD:'AHS尺寸附加费', ahsW:'AHS重量附加费', ahsP:'AHS包装附加费', ...}
 *     2. id 无匹配 → 用 name 正则匹配
 *        /fuel/ → '燃油费'；基础运费|hundredweight return → '基础费'
 *     3. 还没匹配 → 委托 UPSContractDefaults.fee(name) 做合约层分类
 *        合约层返回内部 fee 分类 key（如 'ahs' / 'peakAHS'），再查 names
 *     4. 最终兜底 → 返回 Charge Description 原样（英文）
 *
 * 扩展原因码（Dispute Reason Code）：
 *   reasonCode(feeId, zoneDiff, weightDiff, fuelRateDiff) → UPS 官方申诉原因码
 *     如 "INCORRECT ZONE"、"INCORRECT WEIGHT"、"INCORRECT FUEL SURCHARGE"
 *     用于 UPS 官网申诉表单 / EDI 申诉接口
 *
 * 为什么独立成文件？
 *   - 合约层（contract.js）不应该知道展示层的中文标签
 *   - UPS 原因码随官方规则变化，集中维护避免散落在各模块
 *   - 不同承运商（FedEx/OnTrac）有各自的 reason 分类器，接口统一便于替换
 *
 * 对外暴露：root.UPSDisputeReasons = { label, reasonCode, names }
 *
 * 依赖：root.UPSContractDefaults.fee（合约层分类）
 */
/*SG-AUDIT:dispute-reasons.js*/ // Presentation only: never changes contract rates, claim amounts or claim eligibility.
(function (root) {
	const number = (v) => Number(String(v ?? 0).replace(/[$,]/g, ""));
	const round = (v) => Math.round((v + 1e-9) * 100) / 100;
	function label(id, name) {
		const names = {
			base: "基础费",
			fuel: "燃油费",
			ahsD: "AHS尺寸附加费",
			ahsW: "AHS重量附加费",
			ahsP: "AHS包装附加费",
			resi: "住宅附加费",
			das: "DAS偏远费",
			edas: "EDAS超偏远费",
			remote: "Remote偏远费",
			os: "大件附加费",
			peakAHS: "旺季AHS附加费",
			peakOS: "旺季大件附加费",
			address: "地址更正费",
			rerouteWeb: "网页更址费",
		};
		if (names[id]) return names[id];
		if (/fuel/i.test(name)) return "燃油费";
		if (
			/基础运费|基础费|hundredweight return transportation|Transportation|^Ground (Commercial|Residential|Hundredweight)$/i.test(
				name,
			)
		)
			return "基础费";
		const classified = root.UPSContractDefaults?.fee?.(name);
		if (names[classified]) return names[classified];
		if (/Billing Adjustment|Shipping Charge Correction Audit Fee/i.test(name))
			return "更正审计费";
		if (/Weekly Service Charge/i.test(name)) return "每周服务费";
		if (/PROOF OF DELIVERY/i.test(name)) return "签收证明费";
		if (/Payment Processing Fee/i.test(name)) return "付款处理费";
		if (/Residential Surcharge/i.test(name)) return "住宅附加费";
		if (/Delivery Area Surcharge.*Extended/i.test(name)) return "EDAS超偏远费";
		if (/Delivery Area Surcharge/i.test(name)) return "DAS偏远费";
		return name === "基础运费" ? "基础费" : name;
	}
	function fee(name, actual, expected, rows = [], id = "", options = {}) {
		actual = round(number(actual));
		expected = round(number(expected));
		const diff = round(actual - expected),
			title = label(id, name);
		const financial = rows.filter((r) => number(r["Net Amount"]) !== 0);
		const disclosed =
			financial.length > 0 &&
			financial.every(
				(r) =>
					r["Incentive Amount"] !== undefined &&
					String(r["Incentive Amount"]).trim() !== "" &&
					Number.isFinite(number(r["Incentive Amount"])),
			);
		const incentive = round(
			financial.reduce((s, r) => s + number(r["Incentive Amount"]), 0),
		);
		const fixed = /地址更正|网页|保险|审计|AUDIT|超限|燃油/i.test(title);
		const undiscounted =
			!fixed &&
			actual > 0 &&
			expected >= 0 &&
			(options.published !== undefined
				? Math.abs(actual - number(options.published)) <= 0.03
				: disclosed && Math.abs(incentive) < 0.005);
		const insufficient =
			!fixed &&
			actual > 0 &&
			expected >= 0 &&
			((disclosed && incentive > 0.005) ||
				(options.published !== undefined &&
					number(options.published) > actual + 0.03));
		const issue =
			diff < 0
				? "少收抵减"
				: diff === 0
					? "金额一致"
					: options.adjustment
						? "调整超收"
						: undiscounted
							? "无折扣"
							: insufficient
								? "折扣不足"
								: "超收";
		return (
			title +
			issue +
			"：实收$" +
			actual.toFixed(2) +
			"，应收$" +
			expected.toFixed(2) +
			"，差额$" +
			diff.toFixed(2)
		);
	}
	function components(items) {
		return items
			.filter(
				(c) =>
					c.expected !== null &&
					Math.abs(round(number(c.actual) - number(c.expected))) >= 0.005,
			)
			.map((c) => fee(c.name, c.actual, c.expected, c.rows, c.id))
			.join("；");
	}
	function wording(v) {
		if (typeof v !== "string") return v;
		v = v.replace(/合约合同正确费用/g, "合同正确费用");
		if (v.includes("实收$")) return v;
		return v
			.replace(/合约应收/g, "合同正确费用")
			.replace(/应收/g, "合同正确费用")
			.replace(/净实收/g, "账单净收费")
			.replace(/实收/g, "账单收费");
	}
	function auditOrders(report) {
		const headers = root.ShipGridCorrectionAudit.orderHeaders;
		const packages = report.correctionPackages || [];
		if (!packages.length)
			return [
				Object.fromEntries(
					headers.map((h) => [
						h,
						h === "计件依据"
							? "本期未识别到可关联的非零审计费"
							: h === "状态"
								? "无可关联收费记录"
								: h === "说明"
									? "未生成收费订单；若原账单存在审计费，应核对费用代码及导入字段是否完整"
									: "",
					]),
				),
			];
		return packages.map((p) =>
			Object.fromEntries(headers.map((h) => [h, p[h] ?? ""])),
		);
	}

	root.ShipGridDisputeReasons = {
		label,
		fee,
		components,
		wording,
		auditOrders,
	};
})(globalThis);
