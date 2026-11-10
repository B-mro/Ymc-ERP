/*SG-AUDIT:finance-32.js*/ /* UPS audit: explicit contract evidence, line-level reconciliation, no inferred contract rates. */
(function (root) {
	"use strict";
	const blank = (v) => v === null || v === undefined || String(v).trim() === "";
	const n = (v) => {
		if (blank(v)) return null;
		if (typeof v === "number") return Number.isFinite(v) ? v : null;
		let s = String(v)
			.trim()
			.replace(/[$,\s]/g, "");
		if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
		return /^[-+]?\d*\.?\d+$/.test(s) ? Number(s) : null;
	};
	const round = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
	const day = (v) => {
		if (blank(v)) return "";
		if (typeof v === "number") {
			const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
			return d.toISOString().slice(0, 10);
		}
		let s = String(v).trim();
		if (/^\d{8}$/.test(s))
			s = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6);
		const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
		if (us) s = us[3] + "-" + us[1] + "-" + us[2];
		const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
		if (!m) return "";
		const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
		return d.getUTCFullYear() === +m[1] &&
			d.getUTCMonth() === +m[2] - 1 &&
			d.getUTCDate() === +m[3]
			? d.toISOString().slice(0, 10)
			: "";
	};
	const norm = (v) =>
		String(v ?? "")
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
	const keys = [
		"账号",
		"账单号",
		"运单号",
		"发货日期",
		"币种",
		"服务",
		"分区",
		"计费重LB",
		"费用名称",
		"公布金额",
		"折扣金额",
		"实收金额",
		"燃油基数",
		"记录类型",
	];
	const aliases = [
		["Account Number", "Bill To Account Number"],
		["Invoice Number"],
		["Tracking Number", "Tracking ID"],
		["Shipment Date", "Ship Date", "Pickup Date"],
		["Currency", "Currency Code", "Transaction Currency Code"],
		["Service", "Service Type", "Service Description"],
		["Zone", "Zone Code"],
		["Billed Weight", "Billed Weight Amount", "Billing Weight"],
		["Charge Description", "Charge Name"],
		["Gross Charge", "Gross Charge Amount", "Published Amount", "List Charge"],
		["Incentive Amount", "Discount Amount"],
		["Net Amount", "Net Charge", "Net Charge Amount"],
		["Fuel Base"],
		["Record Type", "Transaction Type"],
	];
	const extraFields = [
		"Transaction Date",
		"燃油基数依据",
		"原始燃油Basis Value",
		"费用分类码",
		"费用类别码",
		"Lead Shipment Number",
		"是否HighVolume",
		"包装类型",
		"付款方式",
		"申报价值",
		"费用基数",
		"更正件数",
		"更正总金额",
		"公布燃油费率",
		"燃油费率依据",
	];
	keys.push(...extraFields);
	aliases.push(
		["交易日期", "TransactionDate", "Tracation Date"],
		["Fuel Base Evidence"],
		["Original Fuel Basis Value"],
		["Charge Classification Code"],
		["Charge Category Code"],
		["Lead Shipment"],
		["High Volume", "Is High Volume"],
		["Package Type", "Package Type Code"],
		["Bill Option Code"],
		["Declared Value"],
		["Fee Base"],
		["Correction Count"],
		["Correction Total"],
		["Published Fuel Rate"],
		["Fuel Rate Evidence"],
	);
	const ruleKeys = [
		"规则ID",
		"账号",
		"服务",
		"费用名称",
		"开始日期",
		"结束日期",
		"分区",
		"最低重量LB",
		"最高重量LB",
		"方式",
		"减免比例",
		"固定净额",
		"公布金额",
		"最低净额",
		"燃油费率",
		"燃油支付比例",
		"依据",
	];
	function audit(rows, rules, tolerance = 0.02) {
		const out = [],
			seen = new Map();
		rows.forEach((b, i) => {
			const r = {
				来源行: b.__row ?? i + 2,
				...Object.fromEntries(keys.map((k) => [k, b[k] ?? ""])),
				状态: "待核实",
				合约应收: "",
				差额: "",
				实际减免比例: "",
				规则ID: "",
				依据: "",
				原因: "",
			};
			let issues = [];
			const amount = n(b["实收金额"]),
				gross = n(b["公布金额"]),
				incentive = n(b["折扣金额"]);
			const track = String(b["运单号"] ?? "").trim();
			const date = day(b["发货日期"]);
			if (!track) issues.push("缺少运单号，可能为账单级收费或汇总，请人工核实");
			if (amount === null) issues.push("实收金额缺失或无效");
			if (String(b["币种"]).trim().toUpperCase() !== "USD")
				issues.push("仅审核明确标注USD的金额");
			if (!date) issues.push("发货日期缺失或无效（请用YYYY-MM-DD）");
			if (blank(b["服务"]) || blank(b["费用名称"]))
				issues.push("缺少服务或费用名称");
			if (
				(amount !== null && amount < 0) ||
				/credit|refund|adjust|退款|调整/i.test(b["记录类型"] || "")
			)
				issues.push("退款/调整记录需与原收费核对，不直接判为多收");
			const identity = JSON.stringify(keys.map((k) => String(b[k] ?? "")));
			if (!seen.has(identity)) seen.set(identity, []);
			seen.get(identity).push(out.length);
			let matches = rules.filter((q) => {
				if (
					blank(q["规则ID"]) ||
					blank(q["依据"]) ||
					blank(q["服务"]) ||
					blank(q["费用名称"])
				)
					return false;
				if (
					!blank(q["账号"]) &&
					String(q["账号"]).trim() !== String(b["账号"]).trim()
				)
					return false;
				if (
					norm(q["服务"]) !== norm(b["服务"]) ||
					norm(q["费用名称"]) !== norm(b["费用名称"])
				)
					return false;
				const start = day(q["开始日期"]),
					end = day(q["结束日期"]);
				if (!start || !end || !date || date < start || date > end) return false;
				if (
					!blank(q["分区"]) &&
					String(q["分区"]).trim() !== String(b["分区"]).trim()
				)
					return false;
				const lo = n(q["最低重量LB"]),
					hi = n(q["最高重量LB"]),
					w = n(b["计费重LB"]);
				if (
					(!blank(q["最低重量LB"]) && lo === null) ||
					(!blank(q["最高重量LB"]) && hi === null)
				)
					return false;
				if (
					(lo !== null || hi !== null) &&
					(w === null || (lo !== null && w < lo) || (hi !== null && w > hi))
				)
					return false;
				return true;
			});
			if (matches.length !== 1)
				issues.push(
					matches.length
						? "多条合约规则重叠，无法唯一匹配"
						: "未找到完整有效的合约规则",
				);
			let expected = null;
			if (matches.length === 1) {
				const q = matches[0];
				r["规则ID"] = q["规则ID"];
				r["依据"] = q["依据"];
				const method = String(q["方式"]).trim(),
					off = n(q["减免比例"]),
					fixed = n(q["固定净额"]),
					minimum = n(q["最低净额"]),
					published = n(q["公布金额"]);
				const list = published === null ? gross : published;
				if (method === "折扣") {
					if (off === null || off < 0 || off > 1)
						issues.push("减免比例须为0至1：75% off填写0.75");
					if (list === null || list < 0) issues.push("缺少有效公布金额");
					if (
						off !== null &&
						off >= 0 &&
						off <= 1 &&
						list !== null &&
						list >= 0
					)
						expected = round(list * (1 - off));
					if (minimum === null || minimum < 0)
						issues.push("需明确最低净额；无最低限制填写0");
					else if (expected !== null) expected = Math.max(expected, minimum);
				} else if (method === "固定净额") {
					if (fixed === null || fixed < 0) issues.push("固定净额无效");
					else expected = round(fixed);
				} else if (method === "燃油") {
					const rate = n(q["燃油费率"]),
						factor = n(q["燃油支付比例"]),
						base = n(b["燃油基数"]);
					if (
						rate === null ||
						rate < 0 ||
						factor === null ||
						factor < 0 ||
						factor > 1 ||
						base === null ||
						base < 0
					)
						issues.push("燃油须提供合约适用费率、支付比例及核实后的基数");
					else expected = round(base * rate * factor);
				} else issues.push("方式仅支持折扣、固定净额、燃油");
				if (gross !== null && gross > 0 && amount !== null)
					r["实际减免比例"] = round((1 - amount / gross) * 100) + "%";
				if (
					gross !== null &&
					incentive !== null &&
					amount !== null &&
					Math.abs(round(gross - Math.abs(incentive)) - amount) > tolerance
				)
					issues.push("公布金额减折扣金额不等于实收，需检查费用列映射或调整");
				if (expected !== null) r["合约应收"] = round(expected);
			}
			if (!issues.length && expected !== null && amount !== null) {
				const diff = round(amount - expected);
				r["差额"] = diff;
				r["状态"] =
					diff > tolerance
						? "多收异常"
						: diff < -tolerance
							? "少收提示"
							: "通过";
				r["原因"] =
					diff > tolerance
						? "实收超过合约应收" +
							(gross !== null && Math.abs(gross - amount) <= tolerance
								? "；未应用合约折扣"
								: "")
						: diff < -tolerance
							? "实收低于合约应收，请核对额外优惠或调整"
							: "在审核容差内";
			} else r["原因"] = issues.join("；");
			out.push(r);
		});
		for (const ids of seen.values())
			if (ids.length > 1)
				for (const i of ids) {
					out[i]["状态"] = "待核实";
					out[i]["差额"] = "";
					out[i]["原因"] += "；完全相同费用行重复，需核对是否重复收费";
				}
		return out;
	}
	root.UPSAudit = { audit, day, n, keys, ruleKeys };
	if (typeof document === "undefined") return;
	root.UPS_AUDIT_STANDALONE = true;
	const { createApp, ref, shallowRef, computed } = Vue;
	const el = document.createElement("div");
	el.id = "ups-audit-app";
	el.style.display = "none";
	el.innerHTML = `<main><section class="hero"><div><div class="eyebrow">UPS INVOICE AUDIT</div><h1>按整票审核HWT、Ground及账单调整</h1><p>上传原始账单，自动区分整票运费、特殊服务、账号费用和资料不全的调整。</p></div></section><section class="panel"><h2>01　导入账单与合约规则</h2><div class="notice">默认使用低内存审核：仅提取审核字段，费用行分批计算；完整整票报告及Dispute仍包含全部已审核订单。<label><input type="checkbox" v-model="historyEnabled" :disabled="busy">本次同时保存完整历史明细并关联历史（大账单会增加内存占用）</label><p>此选项仅控制保存本次账单，已有历史可独立配对。请保留原始账单文件。</p></div><p>支持UPS 174列汇总CSV（可多选联合审核）、标准270列带表头或无表头Excel / CSV，以及标准化费用明细。174列和270列均校验主子单关系；GROUND HUNDREDWEIGHT按HWT服务核价，普通Ground只有主单和完整子单关联明确后才比较HWT。账单缺关联信息列待核，可由UPS官网或原始发货资料补证；同日同址仅作线索。174列无单号纯燃油续行会校验相邻原单后归回核价，原始空单号及来源行保留；不能可靠关联则单列待核。无需手工补表头；自动保留首条费用并校验账单结构及金额。已内置两份UPS合约：第二份优先、第一份补充；未列优惠的费用按官网公布价审核。每行一项费用。单个文件最大500MB。</p><div class="select-grid"><label>审核规则<select v-model="ruleMode" @change="result=[]"><option value="default">内置：第二份优先＋第一份补充＋UPS官网价</option><option value="custom">上传自定义规则</option></select></label></div><div v-if="ruleMode==='default'"><div class="notice">燃油优先按Transaction Date匹配UPS官网周费率，缺失时按Pickup Date（UPS原始Shipment Date）；CSV自动按同运单、同交易日、同费用类别汇总净燃油基数。Basis Value单独保留，不当作净基数。<button class="text-button" @click="refreshUPSFuel" :disabled="busy||fuelRefreshing">{{fuelRefreshing?'更新中…':'更新UPS官网燃油历史'}}</button><p v-if="fuelMessage">{{fuelMessage}}</p></div><div class="notice">默认合约状态：两份均已生效。第二份优先、第一份补充；High Volume高货量旺季费用不计算，原收费单独列为“不参与审核”。普通旺季住宅、AHS及OS仍按合约审核。所有合约按最优档位计算，不按周货量降档。旺季AHS/OS按10月6日修订版90% OFF，普通旺季商业/住宅80% OFF。</div><details><summary>最低净额覆盖及燃油依据（可选）</summary><p>合约p11字面最低价：Commercial=官网Ground 2区1LB×52.2%，Residential=×50%，住宅费另算。此前价表Residential 6.32与该条款不一致，若采用6.32或其他UPS确认最低额，请填金额及依据；不会自动把销售价作为最低净额。</p><div class="select-grid"><label>Commercial最低净运输费覆盖<input type="number" min="0" step="0.01" v-model="defaultSettings.minComm" @change="result=[]"></label><label>Residential最低净运输费覆盖<input type="number" min="0" step="0.01" v-model="defaultSettings.minResi" @change="result=[]"></label><label>最低净额确认依据<input v-model="defaultSettings.minimumEvidence" @change="result=[]" placeholder="UPS确认邮件/Custom Rate Chart及日期"></label><label>官网历史未覆盖时的单周费率覆盖（0.26=26%）<input type="number" min="0" max="1" step="0.0025" v-model="defaultSettings.fuelRate" @change="result=[]"></label><label>燃油适用周及官网来源<input v-model="defaultSettings.fuelEvidence" @change="result=[]" placeholder="仅单周账单可统一填；多周请逐行提供"></label></div></details><details><summary>查看内置合约规则及官网版本（{{defaultCatalog.length}}项）</summary><div class="table-scroll"><table><thead><tr><th>项目</th><th>默认规则</th><th>依据</th></tr></thead><tbody><tr v-for="r in defaultCatalog"><td>{{r.项目}}</td><td style="white-space:normal;min-width:400px">{{r.默认规则}}</td><td style="white-space:normal">{{r.依据}}</td></tr></tbody></table></div><button class="text-button" @click="downloadDefaults">↓ 导出内置规则说明</button></details></div><p v-if="schemaMessage" class="notice" role="status">{{schemaMessage}}</p><div class="billing-upload-grid"><label class="upload-card"><strong>UPS原始账单</strong><input type="file" accept=".xlsx,.xls,.csv" multiple :disabled="busy||exporting" @change="load($event,'bill')"><span>{{billName||'选择文件'}}</span></label><label v-if="ruleMode==='custom'" class="upload-card"><strong>自定义合约审核规则</strong><input type="file" accept=".xlsx,.xls,.csv" :disabled="busy||exporting" @change="load($event,'rule')"><span>{{ruleName||'选择文件'}}</span></label></div><div class="notice"><strong>退件及本期调整审核</strong><p>UP无法投递退回与RS主动退货分别核对；历史账单仅作调整前基准，本期发票单独申诉。正向Residential及实际折扣不能自证返程服务。</p><label>历史核验附件（可选，多份UPS原始CSV，仅本次匹配）<input type="file" accept=".csv" multiple :disabled="busy||exporting" @change="chooseHistory"></label><p>{{historyNames}}</p><div class="select-grid"><label>UPS确认的UP返程Ground分类<select v-model="defaultSettings.returnGroundService" @change="result=[]"><option value="">未确认，按费用逐项审核</option><option>Ground Commercial</option><option>Ground Residential</option></select></label><label>返程分类确认依据<input v-model="defaultSettings.returnServiceEvidence" @change="result=[]" placeholder="UPS邮件/协议及适用账号、日期；填写后仅用于本次退件"></label><label>HWT UP补充确认依据（可选）<input v-model="defaultSettings.hwtUPEvidence" @change="result=[]" placeholder="第一份UP条款已内置；补充邮件可填，返程资格逐票核对"></label></div></div><button class="text-button" @click="template">↓ 下载填写模板（账单+合约规则+说明）</button><div class="notice">默认规则直接来自两份合约原文及UPS官方2026-09-07版公布价，不使用客户加价报价。两份合约按已生效执行，不要求填写生效日；不计算High Volume高货量旺季费用。未知费用/未覆盖官网版本仍按公布价原则，资料不足列待核实，不拿账单原价自证。</div><p v-if="importNotice" class="notice">{{importNotice}}</p><div v-if="books.bill" class="select-grid"><label>账单工作表<select v-model="billSheet" @change="readBill"><option v-for="s in books.bill.SheetNames">{{s}}</option></select></label><label v-if="!schemaMessage">表头行<input type="number" min="1" v-model.number="headerRow" @change="readBill"></label></div><details v-if="headers.length"><summary>确认账单列映射（{{billRows.length}} 行）</summary><p class="muted">净额必须是该费用行的实收，不能选择整票合计。只有公布金额和折扣时，可勾选推算。分区及重量需与规则口径一致。</p><div class="select-grid"><label v-for="(k,i) in keys">{{formatAuditText(k)}}<select v-model="mapping[i]" @change="result=[]"><option :value="-1">未映射</option><option v-for="(h,j) in headers" :value="j">{{j+1}} · {{h}}</option></select></label></div><label><input type="checkbox" v-model="derive" @change="result=[]">无实收列时，用公布金额 − 折扣绝对值推算实收</label></details><div v-if="books.rule" class="select-grid"><label>规则工作表<select v-model="ruleSheet" @change="result=[]"><option v-for="s in books.rule.SheetNames">{{s}}</option></select></label></div><label>金额容差 USD <input type="number" min="0" step="0.01" v-model.number="tolerance" @change="result=[]"></label><div class="notice">合同正确费用 = max(公布金额 × (1−减免比例), 最低净额)。最低净额只用于所属费用项，住宅等附加费单列；燃油按核实后的适用基数计算。相同运单的不同费用行不会被当作重复订单。退款、重复费用行、未知费用与规则缺失均列入待核实，不计入确认多收。</div><div class="action-row"><p>规则按账号、服务、费用、日期、分区及重量唯一匹配。</p><button class="primary" :disabled="busy||exporting||!books.bill||(ruleMode==='custom'&&!books.rule)" @click="run">{{busy?'审核中…':'开始审核 →'}}</button></div><p v-if="auditProgress" class="notice" role="status">{{auditProgress}} <button v-if="busy" @click="cancelAudit">取消审核</button></p><p v-if="error" class="error" role="alert">{{error}}</p></section><template v-if="result.length"><template v-if="shipmentReport"><section class="panel"><h2>HWT／Ground全部费用汇总</h2><p>原始 {{shipmentReport.rawCount}} 行 · 账单实收 USD {{shipmentReport.total.toFixed(2)}}。燃油、DAS、EDAS、住宅及其他服务费计入所属HWT/Ground总费用；调整按可追溯原单归属，无法归属单列。账号费用也计入账单合计。零金额更正不计收费金额，但参与审核费计件。HWT基础费按第一份合约，最低均重20LB、最低每票$72；HWT DAS/EDAS整票按公布价，Shipment Residential Surcharge按公布价100%核对，不套单件住宅70%优惠。已核算申诉 USD {{shipmentReport.confirmedOvercharge.toFixed(2)}}，与Dispute合计一致。</p><div class="table-scroll"><table><thead><tr><th v-for="k in Object.keys(shipmentReport.displaySummary[0]||{})">{{formatAuditText(k)}}</th></tr></thead><tbody><tr v-for="r in shipmentReport.displaySummary"><td v-for="v in r">{{typeof v==='string'?v.replace(/应收/g,'合同正确费用'):v}}</td></tr></tbody></table></div><p class="notice">整票完成 {{shipmentReport.shipments.filter(s=>s['整票核算完整']==='是').length}} 票；未完成 {{shipmentReport.shipments.filter(s=>s['整票核算完整']!=='是').length}} 票。待核原因逐项列在下方及导出的「待核清单」，无申诉金额不代表审核通过。</p><p>调整 {{shipmentReport.adjustments.length}} 票，其中 {{shipmentReport.missingOriginal}} 票本账单缺少原基础费，需历史账单配对。{{shipmentReport.info.length}} 行零金额/信息记录单独保留。</p><details v-for="section in [{title:'Ground Commercial / Residential分类汇总',data:shipmentReport.serviceSummary},{title:'退件审核',data:shipmentReport.returnReview||[]},{title:'本期调整核对',data:shipmentReport.correctionReview||[]},{title:'待核清单（未完成不代表通过）',data:shipmentReport.pendingChecks||[]},{title:'已出账超收明细',data:shipmentReport.overcharges},{title:'HWT整票明细',data:shipmentReport.shipments.filter(r=>r['类别']==='HWT')},{title:'Ground整票明细',data:shipmentReport.shipments.filter(r=>r['类别']==='Ground')},{title:'HWT附加费',data:shipmentReport.hwtComponents},{title:'Additional Handling明细',data:shipmentReport.additionalHandlingDetails},{title:'Billing Adjustment收费条件核对',data:shipmentReport.billingAudit},{title:'审计费关联订单（逐单/账号级汇总）',data:shipmentReport.correctionPackages},{title:'账号及账单级费用',data:shipmentReport.accounts},{title:'无单号燃油续行关联核查',data:shipmentReport.continuationReview||[]},{title:'每单抵扣后费用',data:shipmentReport.netOrders||[]},{title:'HWT组单比较（必须有主单及子单关联）',data:shipmentReport.__legacy174?shipmentReport.info:[]},{title:'同址关联待核线索（需补主子单证据）',data:shipmentReport.noMasterHints||[]},{title:'调整及缺原单记录',data:shipmentReport.adjustments}]"><summary>{{section.title}}（{{section.data.length}}）</summary><div class="table-scroll"><table><thead><tr><th v-for="k in Object.keys(section.data[0]||{})">{{formatAuditText(k)}}</th></tr></thead><tbody><tr v-for="r in section.data.slice(0,100)"><td v-for="v in r">{{typeof v==='string'?v.replace(/应收/g,'合同正确费用'):v}}</td></tr></tbody></table></div><p>页面显示前100条，导出包含全部。</p></details></section></template><section v-if="!shipmentReport" class="stats"><div class="stat"><span>费用行辅助核对</span><strong>{{result.length}}</strong><div>通过 {{counts['通过']||0}} 行</div></div><div class="stat warning"><span>多收异常</span><strong>{{counts['多收异常']||0}}</strong><div>超收金额 USD {{total.toFixed(2)}}</div></div><div class="stat warning"><span>费用行待核实</span><strong>{{counts['待核实']||0}}</strong><div>资料缺失、调整或重复</div></div><div class="stat"><span>少收提示</span><strong>{{counts['少收提示']||0}}</strong><div>High Volume不参与审核 {{counts['不参与审核']||0}} 行；少收不抵减多收</div></div></section><section class="panel"><div class="section-heading"><h2>02　审查报告</h2><p v-if="shipmentReport" class="notice">费用行辅助预览最多200行（本期全部费用 {{feeRowCount}} 行）；上方整票审核统计及导出报告覆盖全部订单。</p><button v-if="shipmentReport" class="download" @click="downloadDispute" :disabled="exporting||busy">↓ 导出Dispute表</button><button class="primary" :disabled="exporting||busy" @click="downloadCSV">↓ 导出审核报告CSV</button><button class="download" :disabled="exporting||busy" @click="download">{{exporting?'正在导出…':'↓ 导出审核报告Excel'}}</button></div><p v-if="exportMessage" class="notice" role="status">{{exportMessage}} <button v-if="exporting" class="text-button" @click="cancelExport">取消导出</button></p><p v-for="f in exportFiles" :key="f.name"><a v-if="f.url" :href="f.url" :download="f.name">↓ {{f.name}}</a><span v-else>已保存：{{f.name}}</span></p><p>金额为已核算项目的出账超收金额；以UPS已出账金额为实收依据，合并更正及退款后重算UPS按合同应收取的正确费用。Dispute表包含已完整核算的超收订单及可独立核算的超收附加费；账号费用另页列示；{{shipmentReport?.__legacy174?'174列账单的PPF按合同50% OFF核价，基数不足时列待核。':'Payment Processing Fee暂不纳入Dispute，审核报告仍保留。'}}未核算项目不纳入申诉。默认报告包含汇总、逐票费用、附加费和调整费核对；Dispute包含申诉项目及对应原始收费记录。账单尺寸/重量按UPS已出账更正结果核算。</p><div class="toolbar"><select v-model="filter"><option>全部</option><option>多收异常</option><option>待核实</option><option>少收提示</option><option>不参与审核</option><option>通过</option><option>已并入整票</option></select><input class="search" v-model="search" placeholder="搜索运单 / 账单 / 原因" @input="page=1"></div><div class="table-scroll"><table><thead><tr><th v-for="k in displayKeys">{{formatAuditText(k)}}</th></tr></thead><tbody><tr v-for="r in visible"><td v-for="k in displayKeys" :class="k==='状态'&&r[k]!=='通过'?'warning-text':''">{{formatAuditText(r[k])}}</td></tr></tbody></table></div><div class="pagination"><span>筛选 {{filtered.length}} 行 · 导出包含全部结果</span><button :disabled="page<=1" @click="page--">上一页</button><span>{{page}} / {{pages}}</span><button :disabled="page>=pages" @click="page++">下一页</button></div></section></template></main>`;
	document.body.appendChild(el);
	let btn = document.getElementById("ups-mode");
	if (!btn) {
		btn = document.createElement("button");
		btn.id = "ups-mode";
		btn.textContent = "UPS账单审核";
		document.querySelector(".module-switch").appendChild(btn);
	}
	const oldF = root.switchFedEx,
		oldM = root.switchModule;
	root.switchFedEx = function () {
		el.style.display = "none";
		btn.classList.remove("selected");
		if (oldF) oldF();
	};
	root.switchModule = function (v) {
		el.style.display = "none";
		btn.classList.remove("selected");
		if (oldM) oldM(v);
	};
	root.switchUPS = btn.onclick = () => {
		for (const id of ["app", "billing-app", "fedex-app"]) {
			const panel = document.getElementById(id);
			if (panel) panel.style.display = "none";
		}
		for (const b of document.querySelectorAll(".module-switch button"))
			b.classList.toggle("selected", b === btn);
		el.style.display = "";
	};
	ShipGridModule.createApp({
		setup() {
			const exporting = ref(false),
				exportMessage = ref(""),
				exportFiles = ref([]);
			let exportSession = null;
			function clearExportFiles() {
				for (const f of exportFiles.value) URL.revokeObjectURL(f.url);
				exportFiles.value = [];
			}
			function cancelExport() {
				exportSession?.cancel();
			}
			const importNotice = ref("");
			const shipmentReport = shallowRef(null);
			let rawOriginal = [],
				archiveBytes = null,
				historyLinks = [],
				sourceFile = null;
			const historyFiles = shallowRef([]),
				historyNames = ref("");
			function chooseHistory(event) {
				historyFiles.value = Array.from(event.target.files || []);
				historyNames.value = historyFiles.value.map((f) => f.name).join(" / ");
				invalidate();
			}
			const historyPairing = ref(true),
				historyEnabled = ref(false),
				feeRowCount = ref(0);
			const auditProgress = ref("");
			let auditSession = null,
				cancelRequested = false;
			function cancelAudit() {
				cancelRequested = true;
				auditProgress.value = "正在停止审核…";
				auditSession?.cancel();
			}
			const fuelMessage = ref(""),
				fuelRefreshing = ref(false);
			const ruleMode = ref("default"),
				defaultSettings = ref({
					contractsActive: true,
					skipHighVolume: true,
					effectiveDate: "",
					tier: "high",
					firstExtended: true,
					minComm: "",
					minResi: 6.32,
					minimumEvidence: "用户确认UPS最低住宅基础费6.32",
					fuelRate: "",
					fuelEvidence: "",
					returnGroundService: "",
					returnServiceEvidence: "",
					hwtUPEvidence: "",
				}),
				defaultCatalog = UPSContractDefaults.catalog;
			const books = ref({}),
				billName = ref(""),
				ruleName = ref(""),
				billSheet = ref(""),
				ruleSheet = ref(""),
				headerRow = ref(1),
				headers = ref([]),
				billRows = shallowRef([]),
				mapping = ref(keys.map(() => -1)),
				result = shallowRef([]),
				error = ref(""),
				busy = ref(false),
				derive = ref(false),
				tolerance = ref(0.03),
				search = ref(""),
				filter = ref("全部"),
				page = ref(1);
			let usedRules = [],
				usedRows = [],
				sourceValidation = null,
				loadedHistoryMode = null;
			const schemaMessage = ref("");
			const formatAuditText = (v) =>
				root.ShipGridDisputeReasons
					? root.ShipGridDisputeReasons.wording(v)
					: v;
			const invalidate = () => {
				clearExportFiles();
				exportMessage.value = "";
				shipmentReport.value = null;
				rawOriginal = [];
				historyLinks = [];
				result.value = [];
				error.value = "";
			};
			const canonicalHeader = (v) => {
				const t = String(v ?? "")
					.replace(/^\uFEFF/, "")
					.trim();
				const raw = [
					"Account Number",
					"Invoice Number",
					"Transaction Date",
					"Tracking Number",
					"Lead Shipment Number",
					"Charge Description",
					"Net Amount",
					"Incentive Amount",
					"Charge Category Code",
					"Charge Classification Code",
				];
				return raw.find((h) => norm(h) === norm(t)) || t;
			};
			function bestHeader(wb, sheet) {
				const sh = wb.Sheets[sheet];
				if (!sh?.["!ref"]) return { score: 0, row: 0 };
				const range = XLSX.utils.decode_range(sh["!ref"]);
				range.e.r = Math.min(range.e.r, range.s.r + 99);
				const a = XLSX.utils.sheet_to_json(sh, {
					header: 1,
					defval: "",
					raw: true,
					range,
				});
				let best = { score: 0, row: range.s.r };
				a.forEach((r, i) => {
					const h = r.map(canonicalHeader),
						has = (k) => h.some((v) => norm(v) === norm(k));
					const score =
						(has("Net Amount") || has("实收金额") ? 4 : 0) +
						(has("Tracking Number") || has("运单号") ? 3 : 0) +
						(has("Charge Description") || has("费用名称") ? 3 : 0) +
						(has("Transaction Date") ? 1 : 0) +
						(has("Invoice Number") ? 1 : 0);
					if (score > best.score) best = { score, row: i + range.s.r };
				});
				return best;
			}
			async function readBill() {
				invalidate();
				if (sourceFile && /\.csv$/i.test(sourceFile.name)) {
					const parsed = await root.ShipGridUPSImport.readCSV(sourceFile, {
						retainAll: historyEnabled.value,
						fields: root.ShipGridAuditMemory.fields,
						progress: (msg) => (auditProgress.value = msg),
						cancel: () => cancelRequested,
					});
					if (parsed) {
						headers.value = parsed.headers;
						billRows.value = parsed.rows;
						sourceValidation = parsed.validation;
						loadedHistoryMode = historyEnabled.value;
						schemaMessage.value = root.ShipGridUPSImport.describe(
							parsed.validation,
							parsed.headerless,
						);
						books.value.bill = Vue.markRaw({
							SheetNames: ["UPS原始CSV"],
							Sheets: {},
						});
						billSheet.value = "UPS原始CSV";
						headerRow.value = parsed.headerless ? 0 : 1;
						mapping.value = keys.map((k, i) => {
							const names = [k, ...aliases[i]].map(norm);
							return headers.value.findIndex((h) => names.includes(norm(h)));
						});
						auditProgress.value = "";
						return;
					}
				}
				if (!books.value.bill?.Sheets?.[billSheet.value]) {
					if (!sourceFile) return;
					books.value.bill = Vue.markRaw(
						XLSX.read(await sourceFile.arrayBuffer(), {
							type: "array",
							cellDates: false,
							dense: true,
							raw: true,
						}),
					);
				}
				const wb = books.value.bill,
					detected = bestHeader(wb, billSheet.value);
				const a = XLSX.utils.sheet_to_json(wb.Sheets[billSheet.value], {
					header: 1,
					raw: true,
					range: 0,
				});
				if (
					a[0]?.length === 174 &&
					a[0][20] === "Pkgs" &&
					a[0].includes("InvoiceNum")
				) {
					const blob = new Blob(
						[XLSX.utils.sheet_to_csv(wb.Sheets[billSheet.value])],
						{ type: "text/csv" },
					);
					Object.defineProperty(blob, "name", {
						value: sourceFile.name.replace(/\.[^.]+$/, ".csv"),
					});
					const parsed = await root.ShipGridUPS174.parse174(blob, {
						progress: (msg) => (auditProgress.value = msg),
						cancel: () => cancelRequested,
					});
					headers.value = parsed.headers;
					billRows.value = parsed.rows;
					sourceValidation = parsed.validation;
					loadedHistoryMode = historyEnabled.value;
					schemaMessage.value = root.ShipGridUPSImport.describe(
						parsed.validation,
						false,
					);
					return;
				}
				let h = Number(headerRow.value) - 1;
				const first = a.findIndex((r) => r.some((v) => !blank(v)));
				if (
					first >= 0 &&
					detected.score < 8 &&
					root.ShipGridUPSImport.candidate(a[first])
				) {
					sourceValidation = await root.ShipGridUPSImport.inspectArrays(
						a,
						first,
						{ progress: (msg) => (auditProgress.value = msg), excel: true },
					);
					schemaMessage.value = root.ShipGridUPSImport.describe(
						sourceValidation,
						true,
					);
					loadedHistoryMode = null;
					headers.value = UPSInvoiceFuel.headerlessSchema.slice();
					billRows.value = a
						.slice(first)
						.map((r, i) => ({ r, line: first + i + 1 }))
						.filter((x) => x.r.some((v) => !blank(v)));
					mapping.value = keys.map((k, i) => {
						const names = [k, ...aliases[i]].map(norm);
						return headers.value.findIndex((h) => names.includes(norm(h)));
					});
					importNotice.value =
						"已识别UPS CSV 2.1无表头格式（270列）；按标准列序自动读取，第一行作为账单数据保留，共" +
						billRows.value.length +
						"行。";
					return;
				}
				importNotice.value = "已识别带表头账单；自动读取费用净额列。";
				if (detected.score >= 8) {
					h = detected.row;
					headerRow.value = h + 1;
				}
				if (!Number.isInteger(h) || h < 0 || h >= a.length) {
					error.value = "表头行超出范围";
					headers.value = [];
					billRows.value = [];
					return;
				}
				headers.value = a[h].map(canonicalHeader);
				billRows.value = a
					.slice(h + 1)
					.map((r, i) => ({ r, line: h + i + 2 }))
					.filter((x) => x.r.some((v) => !blank(v)));
				mapping.value = keys.map((k, i) => {
					const names = [k, ...aliases[i]].map(norm);
					return headers.value.findIndex((h) => names.includes(norm(h)));
				});
			}
			async function load(e, type) {
				if (exporting.value || busy.value) return;
				busy.value = true;
				try {
					invalidate();
					const selectedFiles = Array.from(e.target.files || []);
					let file = selectedFiles[0];
					if (!file) return;
					if (type === "bill" && selectedFiles.length > 1) {
						if (selectedFiles.some((f) => !/\.csv$/i.test(f.name)))
							throw Error("批量请选择174列CSV；Excel和270列标准账单请单份导入");
						file = {
							name: "UPS_批量_" + selectedFiles.length + "份.csv",
							size: 0,
							__sgFiles: selectedFiles,
						};
					}
					if (type === "bill") {
						sourceValidation = null;
						loadedHistoryMode = null;
						schemaMessage.value = "";
						headers.value = [];
						billRows.value = [];
						cancelRequested = false;
					}
					if (file.size > 500 * 1024 * 1024)
						throw Error("单个文件不可超过500MB");
					if (type === "bill" && /\.csv$/i.test(file.name)) {
						sourceFile = file;
						billName.value = file.name;
						books.value.bill = Vue.markRaw({
							SheetNames: ["UPS原始CSV"],
							Sheets: {},
						});
						billSheet.value = "UPS原始CSV";
						await readBill();
						return;
					}
					const bytes = await file.arrayBuffer();
					if (type === "bill") {
						sourceFile = file;
						archiveBytes = null;
					}
					const wb = Vue.markRaw(
						XLSX.read(bytes, {
							type: "array",
							cellDates: false,
							dense: true,
							raw: true,
						}),
					);
					books.value = { ...books.value, [type]: wb };
					if (type === "bill") {
						billName.value = file.name;
						billSheet.value = wb.SheetNames.reduce(
							(best, name) =>
								bestHeader(wb, name).score > bestHeader(wb, best).score
									? name
									: best,
							wb.SheetNames[0],
						);
						headerRow.value = 1;
						await readBill();
					} else {
						ruleName.value = file.name;
						ruleSheet.value = wb.SheetNames.includes("合约规则")
							? "合约规则"
							: wb.SheetNames[0];
					}
				} catch (e) {
					delete books.value[type];
					if (type === "bill") {
						headers.value = [];
						billRows.value = [];
						sourceFile = null;
						schemaMessage.value = "";
						sourceValidation = null;
					}
					error.value = "读取失败：" + e.message;
				} finally {
					busy.value = false;
					auditProgress.value = "";
				}
			}
			async function run() {
				if (exporting.value || busy.value) return;
				invalidate();
				cancelRequested = false;
				busy.value = true;
				auditProgress.value = "正在整理账单…";
				await new Promise((r) => setTimeout(r, 20));
				try {
					if (
						sourceFile &&
						(!billRows.value.length ||
							(loadedHistoryMode !== null &&
								loadedHistoryMode !== historyEnabled.value))
					)
						await readBill();
					if (!Number.isFinite(tolerance.value) || tolerance.value < 0)
						throw Error("容差须为非负金额");
					if (!headers.value.length || !billRows.value.length)
						throw Error("没有可审核账单行");
					if (
						!UPSInvoiceFuel.isRaw(headers.value) &&
						mapping.value[11] < 0 &&
						!(derive.value && mapping.value[9] >= 0 && mapping.value[10] >= 0)
					)
						throw Error(
							"未识别费用净额列。当前工作表：" +
								billSheet.value +
								"，表头行：" +
								headerRow.value +
								"。UPS原始账单应包含Net Amount、Tracking Number和Charge Description；请确认上传的是费用明细表。",
						);
					if (ruleMode.value === "custom") {
						usedRules = XLSX.utils.sheet_to_json(
							books.value.rule.Sheets[ruleSheet.value],
							{ defval: "" },
						);
						if (
							!usedRules.length ||
							!ruleKeys.every((k) => Object.hasOwn(usedRules[0], k))
						)
							throw Error("合约规则表头不完整，请按下载模板填写");
					}
					usedRows = UPSInvoiceFuel.isRaw(headers.value)
						? []
						: billRows.value.map((x) => {
								const o = Object.fromEntries(
									keys.map((k, i) => [
										k,
										mapping.value[i] >= 0 ? x.r[mapping.value[i]] : "",
									]),
								);
								o.__row = x.line;
								if (blank(o["实收金额"]) && derive.value) {
									const a = n(o["公布金额"]),
										d = n(o["折扣金额"]);
									if (a !== null && d !== null)
										o["实收金额"] = round(a - Math.abs(d));
								}
								return o;
							});
					if (UPSInvoiceFuel.isRaw(headers.value)) {
						books.value.bill = Vue.markRaw({
							SheetNames: books.value.bill.SheetNames,
							Sheets: {},
						});
						const original = [],
							selected = headers.value
								.map((h, i) => ({ h, i }))
								.filter(
									(c) =>
										historyEnabled.value ||
										root.ShipGridAuditMemory.fields.has(c.h),
								);
						for (let i = 0; i < billRows.value.length; i++) {
							const x = billRows.value[i],
								r = { __row: x.line };
							for (const c of selected) {
								const v = x.r[c.i];
								if (!blank(v)) r[c.h] = v;
							}
							original.push(r);
							x.r = null;
							if (i % 500 === 499) {
								auditProgress.value =
									"整理审核字段 " + (i + 1) + " / " + billRows.value.length;
								await new Promise((r) => setTimeout(r, 0));
								if (cancelRequested) throw Error("审核已取消");
							}
						}
						rawOriginal = original;
						billRows.value = [];
						archiveBytes = null;
						await new Promise((r) => setTimeout(r, 0));
						if (historyEnabled.value && original.some((r) => r.__SG174)) {
							historyLinks = [];
							importNotice.value =
								"174列使用本次原始CSV和历史附件匹配；不写入270列专用历史库，原文件请保留。";
						} else if (historyEnabled.value) {
							auditProgress.value = "正在校验及留存账单…";
							try {
								if (sourceValidation && !sourceValidation.complete)
									throw Error("费用合计未与发票金额核平，不存入完整历史账单库");
								const saved = await root.ShipGridUPSHistory.ingest(original, {
									name: billName.value,
									blob: sourceFile,
								});
								auditProgress.value = "正在逐份关联历史账单…";
								historyLinks = await root.ShipGridUPSHistory.link(original);
								importNotice.value =
									"账单已留存：新增" +
									saved.added +
									"份，重复跳过" +
									saved.skipped +
									"份；关联历史运单" +
									historyLinks.length +
									"单。历史累计不计入本期费用。";
							} catch (historyError) {
								importNotice.value =
									"历史留存/关联未完成：" +
									historyError.message +
									"；本次仅审核当前账单，请保留原始文件。";
								historyLinks = [];
							}
						} else {
							historyLinks = [];
							importNotice.value =
								"本次低内存审核：未新增历史；历史库配对按独立选项执行。";
						}
					}
					if (cancelRequested)
						throw Error("审核已取消；原始文件和已保存的历史账单保留。");
					if (ruleMode.value === "custom" && rawOriginal.some((r) => r.__SG174))
						throw Error(
							"174列汇总账单请使用内置合约审核；自定义逐费用规则请使用270列或标准费用明细。",
						);
					auditProgress.value = "正在后台审核…";
					auditSession = root.ShipGridAuditMemory.createSession();
					let historyRaw = [];
					if (rawOriginal.length) {
						historyRaw = await root.UPSReturnsAudit.readHistory(
							historyFiles.value,
							rawOriginal,
							(msg) => (auditProgress.value = msg),
							() => cancelRequested,
						);
						if (historyPairing.value && root.ShipGridUPSHistory?.evidence) {
							const fromArchive =
								await root.ShipGridUPSHistory.evidence(rawOriginal);
							const uploadedInvoices = new Set(
								historyRaw.map((r) =>
									JSON.stringify([
										String(r["Account Number"]).replace(/^0+/, ""),
										r["Invoice Number"],
										r["Transaction Currency Code"] ||
											r["Invoice Currency Code"],
									]),
								),
							);
							historyRaw.push(
								...fromArchive.filter(
									(r) =>
										!uploadedInvoices.has(
											JSON.stringify([
												String(r["Account Number"]).replace(/^0+/, ""),
												r["Invoice Number"],
												r["Transaction Currency Code"] ||
													r["Invoice Currency Code"],
											]),
										),
								),
							);
						}
						importNotice.value +=
							" 已匹配历史核验费用" +
							historyRaw.length +
							"行，历史金额不并入本期。";
					}
					const job = {
						historyRaw,
						raw: rawOriginal,
						rows: usedRows,
						rules: usedRules,
						mode: ruleMode.value,
						tolerance: tolerance.value,
						options: { ...defaultSettings.value },
						fuel: root.UPSOfficialFuel,
					};
					const pending = auditSession.run(
						job,
						(msg) => (auditProgress.value = msg),
					);
					rawOriginal = [
						...new Set(rawOriginal.map((r) => r["Invoice Number"])),
					].map((n) => ({ "Invoice Number": n }));
					usedRows = [];
					job.raw = null;
					job.rows = null;
					const out = await pending;
					result.value = out.results;
					feeRowCount.value = out.feeRowCount || out.results.length;
					shipmentReport.value = out.report;
					usedRules = [];
					page.value = 1;
				} catch (e) {
					if (billRows.value.some((x) => !x.r)) billRows.value = [];
					error.value = e.message;
				} finally {
					busy.value = false;
					auditProgress.value = "";
					auditSession = null;
				}
			}
			async function refreshUPSFuel() {
				fuelRefreshing.value = true;
				try {
					const data = await UPSInvoiceFuel.refresh();
					result.value = [];
					fuelMessage.value =
						"UPS官网历史已更新，共" + data.rates.length + "周；请重新审核";
				} catch (e) {
					fuelMessage.value = e.message;
				} finally {
					fuelRefreshing.value = false;
				}
			}
			const counts = computed(() =>
				result.value.reduce(
					(a, r) => ((a[r["状态"]] = (a[r["状态"]] || 0) + 1), a),
					{},
				),
			);
			const total = computed(() =>
				shipmentReport.value
					? shipmentReport.value.confirmedOvercharge
					: round(
							result.value
								.filter((r) => r["状态"] === "多收异常")
								.reduce((a, r) => a + Number(r["差额"]), 0),
						),
			);
			const filtered = computed(() =>
				result.value.filter(
					(r) =>
						(filter.value === "全部" || r["状态"] === filter.value) &&
						Object.values(r)
							.join(" ")
							.toLowerCase()
							.includes(search.value.toLowerCase()),
				),
			);
			const pages = computed(() =>
				Math.max(1, Math.ceil(filtered.value.length / 50)),
			);
			const visible = computed(() =>
				filtered.value.slice(
					(Math.min(page.value, pages.value) - 1) * 50,
					Math.min(page.value, pages.value) * 50,
				),
			);
			async function save(sheets, name) {
				if (exporting.value) return;
				exporting.value = true;
				error.value = "";
				clearExportFiles();
				exportMessage.value = "正在后台生成Excel…";
				exportSession = ShipGridAuditExport.createSession();
				try {
					const count = await exportSession.run(
						sheets,
						(msg) => (exportMessage.value = msg),
						async (bytes, part, total) => {
							const filename =
									total === 1
										? name
										: name.replace(/\.xlsx$/i, "") +
											"_第" +
											part +
											"卷_共" +
											total +
											"卷.xlsx",
								url = URL.createObjectURL(
									new Blob([bytes], {
										type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
									}),
								);
							exportFiles.value.push({ name: filename, url });
							if (total === 1) {
								const a = document.createElement("a");
								a.href = url;
								a.download = filename;
								document.body.appendChild(a);
								a.click();
								a.remove();
							}
						},
					);
					exportMessage.value =
						count === 1
							? "完整Excel报告已生成（单个文件），可点击下方链接再次下载。"
							: "完整审核报告已生成。";
				} catch (e) {
					error.value = e.message;
					exportMessage.value = "导出未完成，审核结果仍保留，可重试。";
					clearExportFiles();
				} finally {
					exporting.value = false;
					exportSession = null;
				}
			}
			const instructions = [
				{
					说明: "模板记录为虚构示例，审核前删除；每行一项费用，金额USD。账单日期用YYYY-MM-DD。燃油必须有Transaction Date，按该日期匹配官网周费率，不以发票日或Shipment Date替代。",
				},
				{
					说明: "合约规则必须有依据，例如合约名称、页码及条款。账号空白适用所有账号；服务和费用名称须与账单一致。",
				},
				{
					说明: "规则开始/结束日期必填，分区及重量范围空白为不限；范围端点含边界，重叠规则进入待核实。",
				},
				{
					说明: "方式为折扣时：75% off填0.75，最低净额必填；无最低收费限制填0。公布金额空白取账单公布金额；可填核实后的单项公布费率。",
				},
				{
					说明: "方式为固定净额时填固定净额；最低收费只属于单项基础运费，不包含另列住宅等附加费。",
				},
				{
					说明: "方式为燃油时填当期公布燃油费率（26%填0.26）、合约支付比例（七折填0.7）；账单燃油行填核实后的燃油基数。",
				},
				{
					说明: "实收为每项费用净额。折扣可填正减免或负优惠，但退款/调整须在记录类型明确标记。",
				},
				{
					说明: "不从多行实收自动拼出燃油基数；原始CSV的HWT基础运费自动按整票核对；未内置的封顶/条件优惠保留待核实。",
				},
				{
					说明: "同一运单多项不同费用正常；完全相同的行提示重复记录待核实，不自动认定多收。少收金额不抵减多收。",
				},
				{
					说明: "没有收费行无法识别应退未退或漏项。本模块核对已发生收费的合约金额，不能代替重量尺寸、地址或服务适用性审核。",
				},
			];
			function downloadDefaults() {
				save(
					[
						["内置规则说明", defaultCatalog],
						[
							"配置",
							[
								{
									...defaultSettings.value,
									优先级: "第二份优先；第一份补充；未涉及费用官网价",
									官网价格来源: UPSContractDefaults.metadata.officialURL,
								},
							],
						],
					],
					"UPS默认合约规则说明.xlsx",
				);
			}
			function template() {
				save(
					[
						[
							"账单明细",
							[
								Object.fromEntries(
									keys.map((k) => [
										k,
										{
											账号: "DEMO",
											账单号: "DEMO-INVOICE",
											运单号: "DEMO-1",
											发货日期: "2026-10-01",
											币种: "USD",
											服务: "Ground Commercial",
											分区: "2",
											计费重LB: 5,
											费用名称: "Transportation",
											公布金额: 20,
											折扣金额: 0,
											实收金额: 20,
											记录类型: "Charge",
										}[k] ?? "",
									]),
								),
							],
						],
						[
							"合约规则",
							[
								Object.fromEntries(
									ruleKeys.map((k) => [
										k,
										{
											规则ID: "DEMO-ONLY",
											账号: "DEMO",
											服务: "Ground Commercial",
											费用名称: "Transportation",
											开始日期: "2026-01-01",
											结束日期: "2026-12-31",
											方式: "折扣",
											减免比例: 0.75,
											最低净额: 0,
											依据: "虚构示例，请删除后录入真实合约",
										}[k] ?? "",
									]),
								),
							],
						],
						["填写说明", instructions],
					],
					"UPS审核填写模板.xlsx",
				);
			}
			async function downloadDispute() {
				error.value = "";
				try {
					const x = UPSDisputeExport.build(shipmentReport.value),
						invoice = [
							...new Set(
								rawOriginal.map((r) => r["Invoice Number"]).filter(Boolean),
							),
						].join("_");
					await save(x.sheets, "UPS_Dispute_" + invoice + ".xlsx");
				} catch (e) {
					error.value = e.message;
				}
			}
			function reportSheets() {
				if (shipmentReport.value) {
					const sheets = UPSReviewReports.auditSheets(
						shipmentReport.value,
						defaultCatalog,
					);
					if (historyLinks.length) {
						sheets.push(
							["跨账单关联汇总", historyLinks.map(({ 明细, ...r }) => r)],
							["跨账单费用明细", historyLinks.flatMap((r) => r.明细)],
						);
					}
					return sheets;
				}
				return [
					[
						"审核汇总",
						[
							{
								费用行数: result.value.length,
								已核算超收USD: total.value,
								金额容差USD: tolerance.value,
							},
						],
					],
					[
						"异常明细",
						result.value.filter(
							(r) =>
								!["通过", "不参与审核", "已并入整票", "记录留存"].includes(
									r["状态"],
								),
						),
					],
					["审核明细", result.value],
					["使用合约规则", usedRules],
				];
			}
			function download() {
				const invoice = shipmentReport.value?.shipments[0]?.["账单号"] || "";
				save(reportSheets(), "UPS_" + invoice + "_审核报告.xlsx");
			}
			async function downloadCSV() {
				if (exporting.value) return;
				if (!root.showDirectoryPicker) {
					error.value =
						"低内存CSV导出需要Chrome或Edge直接打开本地HTML文件，请勿在预览窗口内使用。";
					return;
				}
				exporting.value = true;
				error.value = "";
				exportMessage.value = "请选择保存文件夹…";
				let folder;
				try {
					const selected = await root.showDirectoryPicker({
						mode: "readwrite",
					});
					folder = await selected.getDirectoryHandle(
						"UPS审核_" + new Date().toISOString().replace(/[:.]/g, "-"),
						{ create: true },
					);
					clearExportFiles();
					const session = ShipGridAuditCSV.createSession();
					exportSession = session;
					const count = await session.run(
						reportSheets(),
						folder,
						(msg) => (exportMessage.value = msg),
					);
					exportMessage.value =
						"已将" +
						count +
						"份CSV完整写入所选文件夹内的 " +
						folder.name +
						"；每份对应原报告的一张工作表，可用Excel打开。";
				} catch (e) {
					error.value =
						e.name === "AbortError" ? "已取消选择保存位置" : e.message;
					exportMessage.value =
						"导出未完成，审核结果仍保留；已写入的文件不代表完整报告。";
				} finally {
					exporting.value = false;
					exportSession = null;
				}
			}
			return {
				historyPairing,
				formatAuditText,
				schemaMessage,
				historyFiles,
				historyNames,
				chooseHistory,
				historyEnabled,
				feeRowCount,
				auditProgress,
				cancelAudit,
				exporting,
				exportMessage,
				exportFiles,
				cancelExport,
				downloadCSV,
				importNotice,
				shipmentReport,
				fuelMessage,
				fuelRefreshing,
				refreshUPSFuel,
				ruleMode,
				defaultSettings,
				defaultCatalog,
				downloadDefaults,
				books,
				billName,
				ruleName,
				billSheet,
				ruleSheet,
				headerRow,
				headers,
				billRows,
				mapping,
				keys,
				result,
				error,
				busy,
				derive,
				tolerance,
				search,
				filter,
				page,
				readBill,
				load,
				run,
				counts,
				total,
				filtered,
				pages,
				visible,
				template,
				downloadDispute,
				download,
				displayKeys: [
					"来源行",
					"账单号",
					"运单号",
					"服务",
					"费用名称",
					"实收金额",
					"合约应收",
					"差额",
					"状态",
					"实际减免比例",
					"Transaction Date",
					"官网燃油费率",
					"净燃油基数",
					"官网公布金额",
					"默认减免比例",
					"最低净额依据",
					"规则ID",
					"原因",
				],
			};
		},
	}).mount(el);
	if (root.location?.hash === "#ups-audit" || root.UPS_AUDIT_STANDALONE)
		root.switchUPS();
})(typeof window === "undefined" ? globalThis : window);
