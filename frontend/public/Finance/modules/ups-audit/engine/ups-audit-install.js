/*SG-AUDIT:ups-371-install.js*/(function(root){'use strict';
const legacy=root.ShipGridUPS174,originalCSV=root.ShipGridUPSImport?.readCSV,describe=root.ShipGridUPSImport?.describe;
if(root.ShipGridUPSImport)root.ShipGridUPSImport.readCSV=async(file,options={})=>await legacy.parse174(file,options)||await originalCSV(file,options);
if(root.ShipGridUPSImport)root.ShipGridUPSImport.describe=(v,h)=>v.legacy174?'已识别UPS 174列汇总账单：'+v.invoices.length+'份、原始'+v.rowCount+'行；金额/重量记录保留，零金额子单压缩为主子单关联。Tot_net为账单总额依据，附加费不重复相加。':describe(v,h);
const oldHistory=root.UPSReturnsAudit.readHistory;
root.UPSReturnsAudit.readHistory=async(files,raw,progress=()=>{},cancel=()=>false)=>{
 if(!raw.some(r=>r.__SG174))return oldHistory(files,raw,progress,cancel);const wanted=new Set(raw.map(r=>String(r['Account Number']).replace(/^0+/,'')+'|'+r['Tracking Number'])),out=[],seen=new Set();
 for(const file of files){const p=await legacy.parse174(file,{progress,cancel,retainAll:true});if(!p)throw Error('174列账单的历史附件请选择同类174列CSV；270列请在标准审核路径使用');const objs=p.rows.map(x=>({...Object.fromEntries(p.headers.map((h,i)=>[h,x.r[i]])),__row:x.line}));for(const r of objs){const q=JSON.parse(r.__SG174),k=q._account+'|'+q.Track_Num;const related=wanted.has(k)||(q._children||'').split(',').some(t=>wanted.has(q._account+'|'+t));if(!related)continue;const id=q._account+'|'+q.InvoiceNum+'|'+q._line;if(!seen.has(id)){seen.add(id);out.push(r);}}}return out;
};
const oldSheets=root.UPSReviewReports.auditSheets;
root.UPSReviewReports.auditSheets=(r,catalog=[])=>r.__legacy174?[
 ['Invoice汇总',r.invoiceRows],['费用申诉明细',r.overcharges],['Ground明细',r.shipments.filter(x=>x['类别']==='Ground')],['HWT明细',r.shipments.filter(x=>x['类别']==='HWT')],['待核清单',r.pendingChecks],['账号费用',r.accounts],['审计费取大',r.billingAudit],['更正计件依据',r.correctionPackages],['跨账单关联',r.adjustments],['费用净额台账',r.feeLedger],['HWT组单复核',r.info],['订单抵扣复核',r.netOrders],['SOV触发核对',r.sovReview],['同址缺主单线索',r.noMasterHints||[]],['无单号燃油续行核查',r.continuationReview||[]],['审核规则',catalog]
 ]:oldSheets(r,catalog);
root.UPSContractDefaults.catalog.push(
 {'项目':'174列无单号燃油续行','默认规则':'仅相邻原订单有效、同账号/Invoice/发货日/分区/目的邮编/服务及付款类型、前行燃油为0且本行仅含燃油时自动关联；原始空单号和来源行保留。关键地址/参考号有冲突不关联。合并费用后核算燃油，仅申诉差额；条件不齐单列无单号包裹收费待核。','依据':'155份原始账单147条燃油续行逐行核对'},
 {'项目':'174列汇总账单','默认规则':'原始列序识别，兼容前20列表头为SHIPgRID_；逐行校验174列，不静默错列。Tot_net原总额保留；零金额子单压缩保存主子单对应；支持多份CSV联合审核。','依据':'UPS 174列汇总格式 / 2026-11-08'},
 {'项目':'超过150LB','默认规则':'单件体积计费重>150LB按2–8区公布每磅0.80/0.84/0.88/0.91/1.00/1.08/1.21美元；商业73.1%OFF、住宅85%OFF；不将多件总重套单件。','依据':'2026官方Daily费率 / 第二份B、C'},
 {'项目':'OTH/SOV/OPU/REP','默认规则':'OTH按账号+运单跨invoice正负相抵，净负值抵减尚未抵扣的同单计价争议；Tot_net不重复扣。SOV为旺季超限费；OPU/REP归入预约取件订单。','依据':'2026-11-08用户确认及官方费率'},
 {'项目':'HWT多件Ground比较','默认规则':'必须有明确主单号及完整子单关系，主单唯一、一票多件、同日同址、合约账号及计费重≥200LB；账单缺主单关联的记录先待核，可由UPS官网或原始发货资料补证；仅同日同址不合并；最低均重20LB、每票72美元；整票基础费连同住宅/偏远/燃油比较，HWT更贵不调增。缺触发件数时潜在差额单列。','依据':'合约＋用户确认成本表'},
 {'项目':'跨账单调整/退款','默认规则':'按账号+运单匹配原单，子单可匹配所属主单；原费/全额冲销/净调整/部分退款分别核算；本期金额与历史证据分离，跨账单同项信用先抵扣。','依据':'2026-11-08全量复核规则'});
const oldDefaults=root.UPSContractDefaults.defaultsAudit;
root.UPSContractDefaults.defaultsAudit=function(rows,options,...args){const out=oldDefaults(rows,options,...args);for(let i=0;i<out.results.length;i++){const r=out.results[i],b=rows[i],name=String(b?.['费用名称']||'');if(/on.?call pickup|residential pickup surcharge|pickup residential surcharge/i.test(name)){r['合约应收']=Number(b['实收金额']);r['差额']=0;r['状态']='通过';r['原因']='OPU/REP预约取件相关费按用户确认挂订单，原实收保留，不重复加收';}}return out;};
const rates=root.UPSOfficialBases['UPS Ground'].rates;
root.UPSOfficialBases['UPS Ground'].rates=new Proxy(rates,{get(t,k){if(k in t)return t[k];const m=String(k).match(/^(\d+)\|([2-8])$/);return m&&Number(m[1])>150?Number(m[1])*[.8,.84,.88,.91,1,1.08,1.21][Number(m[2])-2]:undefined;}});
root.ShipGridAuditMemory?.fields.add('__SG174');root.ShipGridAuditMemory?.fields.add('__Source File');
})(globalThis);
