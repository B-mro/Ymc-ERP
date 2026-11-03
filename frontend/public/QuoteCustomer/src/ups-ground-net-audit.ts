export interface UPSAuditRuntime { UPSAudit: any; UPSContractDefaults: any; UPSInvoiceFuel: any; UPSGroundNetAudit?: {reconcile: (...args: any[]) => any}; }
export interface PendingReview { 账单号: string; 运单号: string; 服务类型: string; 状态: string; 原因: string; 已核算申诉金额: number; }
/* UPS V3.52: monetary reconciliation; INF records never establish a charge. */
export function installGroundNetAudit(root: UPSAuditRuntime): void {
'use strict';
const num=v=>Number(String(v??0).replace(/[$,]/g,'')),money=v=>Math.round((v+1e-9)*100)/100;
const sum=(rows,f)=>money(rows.reduce((s,r)=>s+num(r[f]),0));
const title={base:'基础运费',ahsD:'尺寸附加费',ahsW:'重量附加费',ahsP:'包装附加费',resi:'住宅费',das:'DAS',edas:'EDAS',os:'Large Package',peakAHS:'旺季AHS',peakOS:'旺季Large Package',address:'地址更正费'};
function reconcile(original,all,options={},tolerance=.02){
 const monetary=all.filter(r=>r['Charge Classification Code']!=='INF'||num(r['Net Amount'])!==0),pending=[],components=[];
 if(monetary.some(r=>!Number.isFinite(num(r['Net Amount']))||!Number.isFinite(num(r['Incentive Amount']))))throw Error('原始费用金额无效：'+original['Tracking Number']);
 const date=root.UPSAudit.day(original['Transaction Date']);
 let sv=root.UPSContractDefaults.service(original['Charge Description']),weight=num(original['Billed Weight']),zone=num(original.Zone);
 const baseRows=monetary.filter(r=>r['Charge Classification Code']==='FRT'&&(/^(Ground (Commercial|Residential)|Shipping Charge Correction Ground|ZONE ADJUSTMENT Ground|Commercial Adjustment|Residential Adjustment)$/i.test(r['Charge Description'])));
 const dated=baseRows.slice().sort((a,b)=>root.UPSAudit.day(a['Transaction Date']).localeCompare(root.UPSAudit.day(b['Transaction Date']))||num(a.__row)-num(b.__row));
 for(const r of dated){if(r['Charge Category Code']!=='ADJ')continue;if(/^Commercial Adjustment$/i.test(r['Charge Description']))sv='Ground Commercial';if(/^Residential Adjustment$/i.test(r['Charge Description']))sv='Ground Residential';if(num(r['Billed Weight'])>0)weight=num(r['Billed Weight']);if(num(r['Corrected Zone'])>=2)zone=num(r['Corrected Zone']);else if(/ZONE ADJUSTMENT/i.test(r['Charge Description'])&&num(r.Zone)>=2)zone=num(r.Zone);}
 const common={'账号':original['Account Number'],'账单号':original['Invoice Number'],'运单号':original['Tracking Number'],'Transaction Date':date,'发货日期':date,'币种':original['Transaction Currency Code'],'服务':sv,'分区':zone,'计费重LB':weight,'记录类型':'SHP','包装类型':original['Container Type']};
 const check=(name,actual,day=date)=>root.UPSContractDefaults.defaultsAudit([{...common,'Transaction Date':day,'发货日期':day,'费用名称':name,'实收金额':Math.max(0,actual)}],options,root.UPSAudit.audit,{day:root.UPSAudit.day}).results[0];
 const add=(id,name,rows,expected,why)=>{const actual=sum(rows,'Net Amount'),signatures=new Set();let duplicate=false;for(const r of rows.filter(r=>num(r['Net Amount'])!==0)){const signature=JSON.stringify(['Account Number','Invoice Number','Tracking Number','Transaction Date','Charge Category Code','Charge Classification Code','Charge Description','Net Amount','Incentive Amount','Zone','Billed Weight'].map(k=>String(r[k]??'')));if(signatures.has(signature))duplicate=true;signatures.add(signature);}if(duplicate){expected=null;why='相同收费记录重复，需确认是否重复导入或实际重复收费';}if(rows.some(r=>num(r['Net Amount'])!==0&&r['Transaction Currency Code']!=='USD')){expected=null;why='收费行币种缺失或不是USD，不能合并申诉';}if(rows.some(r=>r['Charge Classification Code']==='INF'&&num(r['Net Amount'])!==0)){expected=null;why='INF信息行金额非零，需核对原始收费分类';}const ok=typeof expected==='number'&&Number.isFinite(expected);const c={id,name,rows,actual,expected:ok?money(expected):null,reason:why||'',eligible:rows.some(root.UPSInvoiceFuel.eligible)};components.push(c);if(!ok)pending.push(name+'：'+(why||'缺少核算依据'));return c;};
 const base=check('Transportation',sum(baseRows,'Net Amount'));const baseExpected=base['状态']!=='待核实'&&typeof base['合约应收']==='number'?base['合约应收']:null;
 add('base','基础运费',baseRows,baseExpected,base['原因']);
 const groups=new Map();
 for(const r of monetary){if(baseRows.includes(r)||r['Charge Classification Code']==='FSC'||num(r['Net Amount'])===0&&num(r['Incentive Amount'])===0)continue;const id=root.UPSContractDefaults.fee(r['Charge Description']);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 for(const [id,rows]of groups){
  const actual=sum(rows,'Net Amount'),gross=sum(rows,'Net Amount')+sum(rows,'Incentive Amount');
  const representative=rows.find(r=>num(r['Net Amount'])>0)||rows[0];const name=representative['Charge Description'].replace(/^Shipping Charge Correction\s+/i,'').replace(/\s+Adjustment$/i,'');
  if(Math.abs(actual)<=tolerance&&Math.abs(gross)<=.03){add(id,title[id]||name,rows,0,'原收费与退款已抵消');continue;}
  if(id==='unknown'||id==='base'||id==='ahsUnknown'||id==='peakUnknown'){add(id,name,rows,null,'未识别收费类型，需核对原始记录及规则');continue;}
  if(rows.some(r=>/high[ -]*volume|higher[ -]*volume|peaking[ -]*factor/i.test(r['Charge Description']))){add(id,name,rows,null,'按设置排除High Volume，不作为通过');continue;}
  const day=root.UPSAudit.day(representative['Transaction Date'])||date;
  const result=check(name,actual,day);let expected=result['状态']!=='待核实'&&typeof result['合约应收']==='number'?result['合约应收']:null;
  // A refund without its original charge cannot establish the final fee.
  let why=result['原因'];if(!rows.some(r=>num(r['Net Amount'])>0)&&actual< -tolerance){expected=null;why='只有退款、缺少原收费，需配对历史账单';}
  if(expected!==null&&gross>0&&num(result['官网公布金额'])>0&&gross>num(result['官网公布金额'])*1.5){expected=null;why='同类费用存在多个收费事件，需确认是否重复收费，不能自动按多次应收';}
  add(id,title[id]||name,rows,expected,why);
 }
 if(components.some(c=>c.id==='os'&&c.actual>tolerance)&&components.some(c=>/^ahs/.test(c.id)&&c.actual>tolerance))pending.push('同票Large Package与AHS同时收费：需核实收费互斥和更正关系');
 const fuelRows=monetary.filter(r=>r['Charge Classification Code']==='FSC');
 const rates=fuelRows.map(r=>root.UPSInvoiceFuel.lookup(root.UPSAudit.day(r['Transaction Date']),sv));
 const known=components.every(c=>c.expected!==null),fuelRate=rates.length&&rates.every(r=>r&&Math.abs(r.rate-rates[0].rate)<1e-10)?rates[0]:null;
 let fuelExpected=null,fuelReason='';
 if(!fuelRows.length)fuelReason='缺少燃油收费行';else if(!fuelRate)fuelReason='燃油日期缺失、官网适用周未覆盖，或跨周更正费率不同，需分周核算';else if(!known)fuelReason='部分净附加费应收未确定，无法确定完整净燃油基数';
 else{const eligible=money(components.filter(c=>c.eligible).reduce((s,c)=>s+c.expected,0));if(eligible<0)fuelReason='净燃油基数为负，需核对退款范围';else fuelExpected=money(eligible*fuelRate.rate*.6);}
 const fuel=add('fuel','燃油费',fuelRows,fuelExpected,fuelReason);fuel.eligible=false;
 const actual=sum(monetary,'Net Amount'),componentActual=money(components.reduce((s,c)=>s+c.actual,0));if(Math.abs(actual-componentActual)>tolerance)throw Error('整票净费用分组未核平：'+original['Tracking Number']);
 const full=pending.length===0&&components.every(c=>c.expected!==null);const expected=full?money(components.reduce((s,c)=>s+c.expected,0)):null;
 return {full,expected,actual,components,pending,weight,zone,service:sv,baseActual:components[0].actual,baseExpected:components[0].expected,fuelActual:fuel.actual,fuelExpected:fuel.expected,fuelRate:fuelRate?.rate??null,reason:full?'合并原收费、退款及更正；排除INF信息行；按最终服务/重量/分区及Transaction Date官网燃油核算':'尚未完成：'+pending.join('；')};
}
root.UPSGroundNetAudit={reconcile};
}
