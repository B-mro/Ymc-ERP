/*SG-AUDIT:correction-audit.js*/
// Reconstruction and presentation only: never allocate an account-level audit fee to packages.
(function(root){
'use strict';
const text=v=>String(v??'').trim(),upper=v=>text(v).toUpperCase();
const account=v=>upper(v).replace(/^0+/,'');
const cents=v=>{const s=text(v).replace(/[$,]/g,'');if(!s)return 0;const n=Number(s);return Number.isFinite(n)?Math.round((n+Number.EPSILON)*100):null;};
const dollars=v=>v/100, groupKey=r=>JSON.stringify([account(r['Account Number']),text(r['Invoice Number']),upper(r['Transaction Currency Code']||r['Invoice Currency Code']||'USD')]);
const isSCC=r=>upper(r['Charge Category Code'])==='ADJ'&&upper(r['Charge Category Detail Code'])==='SCC';
const memo=r=>[r['Charge Description'],r['Miscellaneous Line 1'],r['Miscellaneous Line 2'],r['Miscellaneous Line 3']].map(text).join(' ');
const isAudit=r=>upper(r['Charge Category Detail Code'])==='CADJ'||/shipping charge correction audit fee|shipping correction fee|billing adjustment/i.test(memo(r));
const roundPercent=c=>Math.round(c*12/100);
function rebuild(raw,accounts=[],tolerance=.02){
 const buckets=new Map(),billingAudit=[],correctionPackages=[],excludedSummaries=[],feeLines=[];
 const tol=Math.max(.005,Number(tolerance)||0)*100;
 const bucket=r=>{const k=groupKey(r);if(!buckets.has(k))buckets.set(k,{key:k,raw:[],fees:[],original:new Set()});return buckets.get(k);};
 for(const r of raw){if(isSCC(r))bucket(r).raw.push(r);if(isAudit(r))bucket(r).fees.push(r);if(upper(r['Charge Category Code'])==='SHP'&&upper(r['Charge Classification Code'])==='FRT')bucket(r).original.add(upper(r['Tracking Number']));}
 for(const b of buckets.values()){
  if(!b.fees.some(r=>(cents(r['Net Amount'])??0)!==0))continue;
  const scope=b.raw,details=scope.filter(r=>/^Shipping Charge Correction$/i.test(text(r['Charge Description']))&&text(r['Tracking Number']));
  const detailTracks=new Set(details.map(r=>upper(r['Tracking Number']))),detailLeads=new Set(details.map(r=>upper(r['Lead Shipment Number'])).filter(Boolean));
  const candidates=new Map(),aggregates=new Set(),netByTrack=new Map(),rowsByTrack=new Map();let amountC=0,bad=0;
  for(const r of details){const t=upper(r['Tracking Number']);if(!candidates.has(t))candidates.set(t,{r,kind:'包裹更正明细（含零金额）'});}
  for(const r of scope){const t=upper(r['Tracking Number']),v=cents(r['Net Amount']);if(v===null){bad++;continue;}amountC+=v;
   if(t){netByTrack.set(t,(netByTrack.get(t)||0)+v);if(!rowsByTrack.has(t))rowsByTrack.set(t,[]);rowsByTrack.get(t).push(r);}
   if(!t||detailTracks.has(t))continue;if(detailLeads.has(t)){aggregates.add(t);continue;}if(v!==0&&!candidates.has(t))candidates.set(t,{r,kind:'无独立更正信息行的收费运单'});
  }
  const direct=new Map(),accountRows=b.fees.filter(r=>!text(r['Tracking Number']));
  for(const r of b.fees.filter(r=>text(r['Tracking Number']))){const t=upper(r['Tracking Number']);if(!direct.has(t))direct.set(t,[]);direct.get(t).push(r);if(!candidates.has(t))candidates.set(t,{r,kind:'逐单审计费直接记录（更正明细未完整关联）'});}
  const note=accountRows.map(memo).join(' '),countMatches=[...note.matchAll(/BASED ON\s+([\d,]+)\s+PACKAGES/gi)].map(m=>Number(m[1].replace(/,/g,''))),amountMatches=[...note.matchAll(/\$([\d,.]+)\s+CORRECTION AMOUNT/gi)].map(m=>cents(m[1]));
  const declaredCount=countMatches.length===1?countMatches[0]:null,declaredAmount=amountMatches.length===1?amountMatches[0]:null;
  const feeC=b.fees.reduce((n,r)=>n+(cents(r['Net Amount'])||0),0),accountC=accountRows.reduce((n,r)=>n+(cents(r['Net Amount'])||0),0),count=candidates.size;
  const perC=count*165,percentC=roundPercent(amountC),qualified=count>0&&amountC>count*100;
  const imports=scope.some(r=>text(r['Sender Country/Territory'])&&upper(r['Sender Country/Territory'])!=='US'&&upper(r['Receiver Country/Territory'])==='US');
  const weeks=[...new Set(accountRows.map(r=>memo(r).match(/W\/E\s*([\d/.-]+)/i)?.[1]).filter(Boolean))];
  const ambiguous=weeks.length>1;
  const method=accountRows.length?(ambiguous?'账号级汇总（多周待核）':Math.abs(accountC-percentC)<=tol?'账号级12%':count>0&&Math.abs(accountC-perC)<=tol?'按件汇总（1.65金额匹配）':'账号级汇总（12%金额待核）'):'逐单审计费';
  const matched=declaredCount!==null&&declaredAmount!==null&&declaredCount===count&&Math.abs(declaredAmount-amountC)<=tol;
  const expectedC=qualified?Math.max(perC,percentC):0;
  const formulaMatches=accountRows.length?Math.abs(accountC-(method==='按件汇总（1.65金额匹配）'?perC:percentC))<=tol:true;
  const branchConflict=accountRows.length&&method==='账号级12%'&&Math.abs(expectedC-accountC)>tol;
  const pending=bad>0||imports||ambiguous||accountRows.length&&(!matched||!formulaMatches||branchConflict)||!qualified;
  const why=[method+'；订单只关联账号汇总费用，不按12%虚构逐单实收',!matched&&accountRows.length?'UPS备注件数/金额缺失或与重建不一致':'',branchConflict?'实收与12%分支吻合，但与公开取大分支不同，须确认账号约定；不得据此调高应付':'',imports?'含进口记录，适用范围待核':'',ambiguous?'同一账号发票含多个周末，不能擅自分摊到各周':'',bad?'存在无效金额行':'',!qualified?'重建平均未超过1美元，收费触发条件待核':''].filter(Boolean).join('；');
  const first=b.fees[0],check={'账单号':first['Invoice Number'],'账号':first['Account Number'],'币种':JSON.parse(b.key)[2],'收费周期':weeks.join(' / ')||'本期发票','UPS备注件数':declaredCount??'未提供','明细重建件数':count,'包裹更正明细数':detailTracks.size,'额外更正运单数':count-detailTracks.size,'排除整票汇总数':aggregates.size,'UPS备注更正金额':declaredAmount===null?'未提供':dollars(declaredAmount),'明细更正金额':dollars(amountC),'平均更正金额每件':count?dollars(amountC)/count:0,'是否满足大于1美元门槛':qualified?'是':'否','按件计算':dollars(perC),'按12%计算':dollars(percentC),'实收金额':dollars(feeC),'账号级实收金额':dollars(accountC),'实际计费方式':method,'12%算式差额':dollars(accountC-percentC),'核算金额':imports||ambiguous?'':dollars(expectedC),'差额':imports||ambiguous?'':dollars(feeC-expectedC),'状态':pending?'待核实':Math.abs(feeC-expectedC)<=tol?'通过':feeC>expectedC?'多收异常':'少收提示','说明':why,'原始备注':note,'关联组':b.key};
  billingAudit.push(check);
  for(const a of accounts){const source=b.fees.find(r=>r.__row===a['来源行']);if(!source)continue;a['合约应收']=pending?'':check['核算金额'];a['差额']=pending?'':check['差额'];a['状态']=check['状态'];a['原因']=why;}
  for(const[t,v]of candidates){if(!accountRows.length&&!direct.has(t))continue;const r=v.r,dr=direct.get(t)||[],directC=dr.reduce((s,x)=>s+(cents(x['Net Amount'])||0),0);
   correctionPackages.push({'账单号':first['Invoice Number'],'账号':first['Account Number'],'币种':check['币种'],'运单号':t,'Lead Shipment':r['Lead Shipment Number']||'','来源行':r.__row??'','计件依据':v.kind,'实际计费方式':dr.length?'逐单审计费'+(accountRows.length?'＋账号汇总关联（注意重复收费）':''):method,'审计费_USD':dr.length?dollars(directC):method==='按件汇总（1.65金额匹配）'&&!pending?1.65:'','关联SCC净额_USD':dollars(netByTrack.get(t)||0),'原基础费':b.original.has(t)?'本账单有':'本账单无，需历史账单','输入重量':r['Entered Weight']||'','更正重量':r['Billed Weight']||'','原输入尺寸':r['Detail Keyed Dim']||'','更正尺寸':r['Package Dimensions']||'','状态':check['状态'],'说明':dr.length?'审计费金额来自明确逐单收费行；同一运单的多行已合并':method==='按件汇总（1.65金额匹配）'&&!pending?'账号级金额与件数×1.65匹配；按件金额推断，非逐单账单行':'与账号级审计费关联的更正包裹；账号实收只在Billing Adjustment计一次；未分摊逐单费用','关联组':b.key});
  }
  if(!candidates.size)correctionPackages.push({'账单号':first['Invoice Number'],'账号':first['Account Number'],'币种':check['币种'],'运单号':'','计件依据':'收费存在，未找到可关联SCC运单','实际计费方式':method,'审计费_USD':'','关联SCC净额_USD':0,'状态':'待核实','说明':'账号审计费实收'+dollars(feeC).toFixed(2)+'；缺少更正订单明细，不得视作无收费或审核通过','关联组':b.key});
  for(const t of aggregates)excludedSummaries.push({'账单号':first['Invoice Number'],'账号':first['Account Number'],'主单号':t,'SCC净额_USD':dollars(netByTrack.get(t)||0),'说明':'包裹更正明细已覆盖该主单；只剔除重复件数，不剔除SCC费用金额'});
  for(const r of scope)if((cents(r['Net Amount'])||0)!==0)feeLines.push({'账单号':r['Invoice Number'],'账号':r['Account Number'],'运单号':r['Tracking Number']||'','主单号':r['Lead Shipment Number']||'','来源行':r.__row??'','费用名称':r['Charge Description'],'SCC净额_USD':dollars(cents(r['Net Amount'])),'计件说明':aggregates.has(upper(r['Tracking Number']))?'主单汇总，金额保留、件数剔重':'包裹或补充运单'});
 }
 return {billingAudit,correctionPackages,correctionExcludedSummaries:excludedSummaries,correctionFeeLines:feeLines};
}
const orderHeaders=['账单号','账号','币种','运单号','Lead Shipment','来源行','计件依据','实际计费方式','审计费_USD','关联SCC净额_USD','原基础费','输入重量','更正重量','原输入尺寸','更正尺寸','状态','说明'];
root.ShipGridCorrectionAudit={rebuild,isSCC,isAudit,orderHeaders};
})(globalThis);
