/**
 * OnTrac 官方燃油费率历史数据缓存。
 *
 * 数据来源： https://www.ontrac.com/surchargesandrates/
 * 抓取脚本： SG-AUDIT:finance-04（见文件开头注释标记）
 *
 * 结构说明：
 *   globalThis.ShipGridFuelRates = {
 *     source,        // 官网地址
 *     series,        // 一般为 "National U.S. Average"
 *     fetchedAt,     // 抓取时间
 *     rates: [       // 按周分段的燃油费率
 *       { start, end, rate },   // rate 为 0~1 小数，如 0.2225 = 22.25%
 *       ...
 *     ]
 *   }
 *
 * 引擎和 UI 层使用方式：
 *   - ui/ontrac-billing.js 中 applyDefaultFuel() 从 Ground 服务取默认燃油率
 *   - engine/ontrac-billing.js 中 matchFuel() 按 service 匹配燃油率区间
 *
 * 注意：本文件为自动生成，不要手动修改。重新抓取会整体替换。
 */
/*SG-AUDIT:finance-04.js*/ globalThis.ShipGridFuelRates = {
	source: "https://www.ontrac.com/surchargesandrates/",
	series: "National U.S. Average",
	fetchedAt: "2026-10-13T09:32:54.044632+00:00",
	rates: [
		{ start: "2026-07-06", end: "2026-07-12", rate: 0.2225 },
		{ start: "2026-07-13", end: "2026-07-19", rate: 0.22 },
		{ start: "2026-07-20", end: "2026-07-26", rate: 0.225 },
		{ start: "2026-07-27", end: "2026-08-02", rate: 0.235 },
		{ start: "2026-08-03", end: "2026-08-09", rate: 0.24 },
		{ start: "2026-08-10", end: "2026-08-16", rate: 0.24 },
		{ start: "2026-08-17", end: "2026-08-23", rate: 0.2375 },
		{ start: "2026-08-24", end: "2026-08-30", rate: 0.245 },
		{ start: "2026-08-31", end: "2026-09-06", rate: 0.25 },
		{ start: "2026-09-07", end: "2026-09-13", rate: 0.2475 },
		{ start: "2026-09-14", end: "2026-09-20", rate: 0.2575 },
		{ start: "2026-09-21", end: "2026-09-27", rate: 0.2675 },
		{ start: "2026-09-28", end: "2026-10-04", rate: 0.275 },
		{ start: "2026-10-05", end: "2026-10-11", rate: 0.27 },
		{ start: "2026-10-12", end: "2026-10-18", rate: 0.265 },
	],
};
