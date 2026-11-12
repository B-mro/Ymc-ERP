/**
 * 文件：fedex-fuel.js
 * 路径：fedex-billing/data/
 * 职责：缓存 FedEx 美国国内官方燃油附加费历史费率，供 fedex-billing / ups-billing 等模块按 Ship Date / Transaction Date 匹配当期费率。
 *
 * 对外暴露：globalThis.FedExFuel = { source, fetchedAt, rates: [{ start, end, rate }] }
 *  - source      : 官网页面 URL，便于对账时跳回
 *  - fetchedAt   : 本地最后一次抓取日期（YYYY-MM-DD）
 *  - rates       : 按周区间排列的费率数组，rate 为小数（例如 0.2675 = 26.75%）
 *
 * 使用方式：
 *   调用方按 shipmentDate（ISO 字符串）遍历 rates，找到 start <= shipmentDate <= end 的那一条，
 *   用它的 rate 乘以基础费和对应燃油比例（quote.factor 或客户在 quote-validators 解析出的值）。
 *   若找不到任何区间，调用方应抛错并提示用户更新本文件。
 *
 * 注意：这里存的是"公布价"。客户实际支付比例由报价文件中的 Fuel Surcharge 行解析得到（quote.factor），
 *       两者相乘 = 客户账单上看到的燃油附加费。
 *
 * 与其他模块的关系：
 *   - ups-billing/data/ups-fuel.js   : 同结构的 UPS 燃油公布价缓存
 *   - ontrac-billing/data/ontrac-fuel.js : 同结构的 OnTrac 燃油公布价缓存
 *   - billing-weight-policy.js       : 调用方之一，负责把燃油费率乘进最终 price
 */
/*SG-AUDIT:finance-15.js*/ globalThis.FedExFuel = {
	source: "https://www.fedex.com/en-us/shipping/historical-fuel-surcharge.html",
	fetchedAt: "2026-10-14",
	rates: [
		["2026-08-24", "2026-08-30", 0.2675],
		["2026-08-31", "2026-09-06", 0.2725],
		["2026-09-07", "2026-09-13", 0.27],
		["2026-09-14", "2026-09-20", 0.28],
		["2026-09-21", "2026-09-27", 0.29],
		["2026-09-28", "2026-10-04", 0.2975],
		["2026-10-05", "2026-10-11", 0.2925],
		["2026-10-12", "2026-10-18", 0.2875],
	].map(([start, end, rate]) => ({ start, end, rate })),
};
