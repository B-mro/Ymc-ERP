export type Carrier = "FEDEX" | "UPS" | "ONTRAC";
export type Module = "trace" | "package" | "billing";
export type CaseStatus =
	| "draft"
	| "submitted"
	| "reviewing"
	| "needs_info"
	| "carrier_submitted"
	| "resolved"
	| "rejected";
export type DocumentKind =
	| "label"
	| "value"
	| "damage"
	| "statement"
	| "invoice"
	| "calculation"
	| "tracking"
	| "other";

export interface ClaimForm {
	carrier: Carrier;
	module: Module;
	tracking_number: string;
	customer_id: string;
	customer_name: string;
	contact_email: string;
	reason: string;
	ship_date: string;
	service: string;
	description: string;
	amount_usd: string;
	invoice_number: string;
	invoice_date: string;
	charge_type: string;
	billed_amount_usd: string;
	expected_amount_usd: string;
	sender_address: string;
	recipient_address: string;
	last_update_date: string;
}
export interface ClaimRecord {
	id: string;
	carrier: Carrier;
	module: Module;
	tracking: string;
	reason: string;
	status: CaseStatus;
	payload: string;
	request_key: string;
	created: string;
	updated: string;
}
export interface Attachment {
	id: string;
	case_id: string;
	tracking: string;
	kind: DocumentKind;
	name: string;
	mime: string;
	size: number;
	created: string;
	blob?: Blob;
	request_key?: string;
}
export interface ClaimDetail {
	case: ClaimRecord;
	attachments: Attachment[];
}
export interface ServerSettings {
	mode: "local" | "server";
	baseUrl: string;
	token: string;
}

export const statuses: Record<CaseStatus, string> = {
	draft: "草稿 / 待补材料",
	submitted: "已提交内部审核",
	reviewing: "审核中",
	needs_info: "待补充资料",
	carrier_submitted: "已交承运商",
	resolved: "已结案",
	rejected: "未通过",
};
export const moduleNames: Record<Module, string> = {
	trace: "异动查询",
	package: "丢损件索赔",
	billing: "账单索赔",
};
export const carriers: Carrier[] = ["FEDEX", "UPS", "ONTRAC"];

export const modules: Record<
	Module,
	{ name: string; en: string; reasons: string[] }
> = {
	trace: {
		name: "异动查询",
		en: "Shipment inquiry",
		reasons: ["物流长时间不更新", "不明原因退回", "派送异常", "其他物流异常"],
	},
	package: {
		name: "包裹索赔",
		en: "Package claim",
		reasons: ["丢件", "损坏件", "送达未收到", "内件短少", "其他包裹问题"],
	},
	billing: {
		name: "账单索赔",
		en: "Billing dispute",
		reasons: [
			"重量差异",
			"尺寸差异",
			"AHS / OS 附加费",
			"分区差异",
			"更址费",
			"住宅 / DAS / EDAS",
			"重复收费",
			"合同折扣 / 燃油差异",
			"其他账单问题",
		],
	},
};

export const documentKinds: Record<DocumentKind, string> = {
	label: "面单 / 交接凭证",
	value: "商品发票 / 价值证明",
	damage: "破损与包装照片",
	statement: "收件人未收到声明",
	invoice: "承运商账单",
	calculation: "核算依据 / 测量证据",
	tracking: "轨迹 / 退回记录",
	other: "其他补充材料",
};

export interface CarrierRule {
	color: string;
	package: string;
	billing: string;
	trace: string;
	claimUrl: string;
	billingUrl: string;
	formUrl: string | null;
	formLabel: string;
	extraUrl?: string;
	extraLabel?: string;
	claimEmail?: string;
	deadline: string;
}
export const rules: Record<Carrier, CarrierRule> = {
	FEDEX: {
		color: "#562294",
		package:
			"官方列明可提交面单或交接记录、价值证明；破损照片、商品序列号及检验报告按情况补充。破损或内件短少需保留包装和内件。",
		billing:
			"FedEx Billing Online 可按发票或单票争议，需选择原因并填写争议金额。重量、尺寸、折扣等证据按争议类型补充。",
		trace:
			"提供运单号、最后更新记录和异常说明；这是平台受理资料，不代表已向 FedEx 建立调查。",
		claimUrl: "https://www.fedex.com/en-us/customer-support/claims.html",
		billingUrl:
			"https://www.fedex.com/en-us/billing-online/parcel-airfreight.html",
		formUrl:
			"https://www.fedex.com/content/dam/fedex/us-united-states/documents/claim-form.pdf",
		formLabel: "FedEx 官方 Claim Form（PDF）",
		extraUrl:
			"https://www.fedex.com/content/dam/fedex/us-united-states/services/Claims_Form_APR_2021.pdf",
		extraLabel: "Ground Economy 官方专用表（PDF）",
		deadline:
			"美国境内破损/短少：发货后60日；国际件21日；丢失/未送达9个月。服务及合同适用性以官方确认。",
	},
	UPS: {
		color: "#78532c",
		package:
			"官方要求支持性材料，例如证明货值的发票；商品描述应包含品牌、型号、数量等细节。破损索赔需要照片，可能要求实物检验。",
		billing:
			"官方指引通过 UPS Billing Center 发起账单争议。平台收集发票号、收费项目、争议金额及证据，供后续审核提交。",
		trace: "提供运单号及轨迹异常说明。退回问题请附退回扫描或承运商通知。",
		claimUrl: "https://www.ups.com/us/en/support/file-a-claim",
		billingUrl: "https://www.ups.com/us/en/business-solutions/ups-billing",
		formUrl:
			"https://www.ups.com/us/en/support/file-a-claim/supporting-documents",
		formLabel: "UPS 官方资料要求 / 在线索赔",
		deadline: "时限及申请资格请核对 UPS 当前条款、服务类型及你们的合同。",
	},
	ONTRAC: {
		color: "#d94542",
		package:
			"官方条款要求填写 Shipment Claim Form 并附支持材料，包含商品实际重置成本发票；丢损或错投需证明。官方表格请向账户经理/索赔部门索取最新版本。",
		billing:
			"官方条款要求书面账单异议发送 invoicedisputes@ontrac.com；请提供对应账单、单号、收费项目及争议说明。",
		trace: "提供单号、轨迹记录和退回原因说明。异常查询与赔偿申请分开处理。",
		claimUrl: "https://www.ontrac.com/terms-conditions/",
		billingUrl: "https://www.ontrac.com/terms-conditions/",
		formUrl: null,
		formLabel: "索取 OnTrac 官方 Shipment Claim Form",
		claimEmail: "cargoclaims@ontrac.com",
		deadline:
			"条款列明包裹索赔在预计到达日起15个日历日内；一般账单争议15日内。另有超额收费6个月条款，具体适用需人工核对，合同优先核验。",
	},
};

export function newForm(carrier: Carrier, module: Module): ClaimForm {
	return {
		carrier,
		module,
		tracking_number: "",
		customer_id: "",
		customer_name: "",
		contact_email: "",
		reason:
			module === "trace"
				? "物流长时间不更新"
				: module === "package"
					? "丢件"
					: "重量差异",
		ship_date: "",
		service: "",
		description: "",
		amount_usd: "",
		invoice_number: "",
		invoice_date: "",
		charge_type: "",
		billed_amount_usd: "",
		expected_amount_usd: "",
		sender_address: "",
		recipient_address: "",
		last_update_date: "",
	};
}