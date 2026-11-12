/**
 * ups-dispute-export.js —— UPS 申诉数据导出桥接层
 *
 * 本模块是一个 **薄桥接层（thin bridge）**，将 ups-audit 对账引擎产出的
 * report 对象（含 shipments/reconcile/claims）转换为可导出到 Excel 的
 * Dispute 表格数据。
 *
 * 它自己不做任何审核计算——所有核算逻辑都在 ground-net、shipment-review、
 * contract、correction-audit、returns、adjustments 等模块中完成。
 * 本模块只做 **格式转换 + 桥接**。
 *
 * 唯一函数 build(report)：
 *   委托给 root.UPSReviewReports.disputeData(report)
 *     → UPSReviewReports（通常由 ui/ups-audit.js 或宿主 runtime 注入）提供
 *       实际的 dispute 表格导出逻辑，包括：
 *       - 将 claim.claim 数组展开为 Excel 行（一行一运单）
 *       - 列映射：Tracking Number → "运单号"、Dispute Amount → "建议申诉金额"
 *       - 附加列：Account / Invoice / Date / Zone / Weight / Service / 差额原因 /
 *                 合约条款引用 / 证据链行号
 *   返回结构化数组，供 XLSX 直接 sheet_add_aoa 写入 Excel
 *
 * 为什么独立成文件？
 *   - 保持 engine 层职责单一：审核引擎不关心 UI 导出格式
 *   - 方便替换导出策略（UPS 版 vs FedEx 版 vs OnTrac 版）时不改 engine
 *   - 便于后续扩展：不同申诉渠道（UPS 官网表单 / EDI / 邮件模板）
 *     在同一 bridge 层内路由
 *
 * 对外暴露：root.UPSDisputeExport = { build }
 *
 * 依赖：root.UPSReviewReports.disputeData（导出逻辑实际实现，由宿主注入）
 */
/*SG-AUDIT:finance-28.js*/ (function (root) {
	"use strict";
	// Audit and Dispute exports share the same reconciled claim records.
	function build(report) {
		return root.UPSReviewReports.disputeData(report);
	}
	root.UPSDisputeExport = { build };
})(typeof window === "undefined" ? globalThis : window);
