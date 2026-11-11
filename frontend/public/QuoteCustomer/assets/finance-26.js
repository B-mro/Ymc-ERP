(function(root){
'use strict';
const num=v=>Number(String(v||0).replace(/[$,]/g,'')),round=v=>Math.round((v+1e-9)*100)/100;
function audit(raw,lineResults,tolerance=.02,options={}){
 const groups=new Map(),special=new Map(),adjust=new Map(),accounts=[],info=[];
 const rows=raw.map((r,i)=>({...r,'Charge Description':r['Charge Description']|| (r['Charge Category Detail Code']==='FPOD'?(r['Miscellaneous Line 1']||'REQUESTS FOR PROOF OF DELIVERY'):''),__row:r.__row||i+2}));
 const key=r=>[r['Account Number'],r['Invoice Number'],r['Transaction Date']].join('|');
 const hwtTracks=new Set(rows.filter(x=>x['Charge Category Code']==='SHP'&&x['Charge Description']==='Ground Hundredweight').map(x=>x['Tracking Number']));const original=new Set(rows.filter(r=>r['Charge Category Code']==='SHP'&&r['Charge Classification Code']==='FRT').map(r=>r['Tracking Number']));
 const byRow=new Map(lineResults.map(r=>[r['来源行'],r]));
 const status=(a,e)=>e===null?'待核实':a-e>tolerance?'多收异常':e-a>tolerance?'少收提示':'通过';
 for(const r of rows){const cat=r['Charge Category Code'],cls=r['Charge Classification Code'],desc=r['Charge Description']||'未命名调整',actual=num(r['Net Amount']),track=r['Tracking Number'];
 if(cat==='SHP'&&cls==='FRT'&&/Ground Hundredweight|Ground Commercial|Ground Residential/.test(desc)){
 const h=/Hundredweight/.test(desc),id=key(r)+'|'+(h?r['Lead Shipment Number']:track)+'|'+desc;
 if(!groups.has(id))groups.set(id,{h,rows:[]});groups.get(id).rows.push(r);
 }else if(cls==='INF'||actual===0){info.push({'来源行':r.__row,'费用名称':desc,'实收金额':actual,'状态':'信息记录','原因':'零金额或INF记录保留，不作为重复收费或多收'});}
 else if(cat==='MIS'||!track){accounts.push({'来源行':r.__row,'账单号':r['Invoice Number'],'费用名称':desc,'实收金额':actual,'合约应收':'','差额':'','状态':'待核实','原因':/Payment Processing/i.test(desc)?'默认公布费率2%，合约50% OFF；按发票全部其他费用核对基数':'账单级收费；需账单周明细/服务协议，不能以原金额自证应收'});}
 else if(cat==='ADJ'){
 const id=key(r)+'|'+track;if(!adjust.has(id))adjust.set(id,[]);adjust.get(id).push(r);
 }else{if(!special.has(desc))special.set(desc,[]);special.get(desc).push(r);}
 }
 const shipmentBuckets=new Map(),serviceByTrack=new Map(),serviceByLead=new Map();
 const shipments=[];
 for(const g of groups.values()){
 const r=g.rows[0],actual=round(g.rows.reduce((s,x)=>s+num(x['Net Amount']),0));let expected=null,reason='',weight=g.rows.reduce((s,x)=>s+num(x['Billed Weight']),0),effective=weight;
 const tracks=new Set(g.rows.map(x=>x['Tracking Number']));
 if(g.h){const z=num(r['Zone'])-2,a=[13.69,15.30,16.99,20.72,26.08,30.21,35.19],b=[10.31,13.16,14.61,18.04,22.64,26.10,30.20];effective=Math.max(weight,tracks.size*20);
 if(g.rows.some(x=>x['Transaction Currency Code']!=='USD'||num(x['Original Shipment Package Quantity'])!==tracks.size||x['Bill Option Code']!=='P/P')||!/^2026[/-]/.test(r['Transaction Date'])||!r['Lead Shipment Number']||tracks.size!==g.rows.length||!Number.isInteger(z)||z<0||z>6||effective<200||effective>2000||g.rows.some(x=>x['Zone']!==r['Zone']||num(x['Billed Weight'])<=0)||!root.UPSContractDefaults.accounts2.includes(String(r['Account Number']).replace(/^0+/,''))){reason='整票资料不完整、账号/分区不适用或重量超出内置200–2000LB档位，需核实';}
 else{expected=round(Math.max(72,Math.min(effective*a[z]/100,Math.max(500,effective)*b[z]/100)));reason='第一份补充Tier04：整票均重最低20LB，比较实际档与500LB档，取低后最低$72；第二份未明确替换的条款沿用';}
 }else{const rr=g.rows.map(x=>byRow.get(x.__row));if(rr.every(x=>x&&typeof x['合约应收']==='number'&&x['状态']!=='待核实')){expected=round(rr.reduce((s,x)=>s+x['合约应收'],0));reason=rr.map(x=>x['原因']).join('；');}else reason='单包裹基础费缺少适用规则或资料；见费用行依据';}
 const ship={'账号':r['Account Number'],'服务类型':r['Charge Description'],'类别':g.h?'HWT':'Ground','账单号':r['Invoice Number'],'运单号':g.h?r['Lead Shipment Number']:r['Tracking Number'],'交易日期':r['Transaction Date'],'分区':r['Zone'],'件数':tracks.size,'计费总重LB':weight,'有效总重LB':effective,'原始基础费实收':actual,'原始基础费应收':expected??'','原始基础费差额':expected===null?'':round(actual-expected),'状态':status(actual,expected),'原因':reason};shipments.push(ship);const bucket={ship,raw:r,fees:[]};shipmentBuckets.set(key(r)+'|'+ship['运单号'],bucket);for(const x of g.rows)serviceByTrack.set([x['Account Number'],x['Invoice Number'],x['Tracking Number']].join('|'),bucket);serviceByLead.set([r['Account Number'],r['Invoice Number'],ship['运单号']].join('|'),bucket);
 }
 for(const [desc,rs] of special)if(/Residential/.test(desc))for(const rr of rs){if(hwtTracks.has(rr['Tracking Number'])){const line=byRow.get(rr.__row);if(line){line['状态']='待核实';line['合约应收']='';line['差额']='';line['原因']='HWT住宅费需按整票规则、包裹数及封顶核验，不套单包裹住宅费';}}}
  const services=[...special].map(([desc,rs])=>{const checked=rs.map(r=>byRow.get(r.__row)),valid=checked.filter(r=>r&&r['状态']!=='待核实'&&typeof r['合约应收']==='number');return {'费用名称':desc,'费用行数':rs.length,'涉及运单数':new Set(rs.map(r=>r['Tracking Number'])).size,'实收金额':round(rs.reduce((s,r)=>s+num(r['Net Amount']),0)),'已核实行数':valid.length,'待核实行数':rs.length-valid.length,'已核实应收':round(valid.reduce((s,r)=>s+r['合约应收'],0)),'超收金额':round(valid.filter(r=>r['状态']==='多收异常').reduce((s,r)=>s+num(r['差额']),0)),'说明':/Delivery Area|Residential/.test(desc)?'HWT费用须核对整票封顶/适用条件；未验证的行保留待核实':'逐项合约/官网规则核对；费用行详见完整明细'};});
 const adjustments=[...adjust.values()].map(rs=>{const r=rs[0],found=original.has(r['Tracking Number']);return {'账单号':r['Invoice Number'],'运单号':r['Tracking Number'],'交易日期':r['Transaction Date'],'费用名称':[...new Set(rs.map(x=>x['Charge Description']||'未命名调整'))].join(' / '),'收费行数':rs.length,'实收金额':round(rs.reduce((s,x)=>s+num(x['Net Amount']),0)),'原收费记录':found?'本账单存在原基础费':'本账单无原基础费','状态':'待核实','原因':found?'需核对更正前后重量/尺寸/分区及原金额，只审差额，不重复审整票':'缺少原收费记录，需历史账单配对；单独列资料不全，不判为已通过或确认多收'};});
 for(const a of accounts)if(/REQUESTS FOR PROOF OF DELIVERY/i.test(a['费用名称'])){a['状态']='记录留存';a['原因']='POD下载费，按原始英文名称留存（用户确认）';const line=byRow.get(a['来源行']);if(line){line['费用名称']=a['费用名称'];line['状态']='记录留存';line['原因']=a['原因'];}}
 const total=round(rows.reduce((s,r)=>s+num(r['Net Amount']),0));
 for(const a of accounts)if(/Payment Processing/i.test(a['费用名称'])){const base=round(rows.filter(r=>r['Invoice Number']===a['账单号']&&!/Payment Processing|Declared Value|InsureShield|Package Shield/i.test(r['Charge Description'])).reduce((s,r)=>s+num(r['Net Amount']),0));a['费用基数']=base;a['合约应收']=round(base*.01);a['差额']=round(a['实收金额']-a['合约应收']);a['状态']=status(a['实收金额'],a['合约应收']);a['原因']='默认：同发票其他全部费用×官网2%×合约支付50%；实际支付方式适用性另需确认';}

 const findBucket=r=>serviceByTrack.get([r['Account Number'],r['Invoice Number'],r['Tracking Number']].join('|'))||serviceByLead.get([r['Account Number'],r['Invoice Number'],r['Lead Shipment Number']].join('|'));
 const columns=['基础运费','燃油费','DAS','EDAS','住宅费','其他服务费','调整金额'];
 const feeColumn=r=>r['Charge Category Code']==='ADJ'?'调整金额':r['Charge Classification Code']==='FSC'?'燃油费':/Delivery Area Surcharge.*Extended/i.test(r['Charge Description'])?'EDAS':/Delivery Area Surcharge/i.test(r['Charge Description'])?'DAS':/Residential/i.test(r['Charge Description'])&&r['Charge Classification Code']!=='FRT'?'住宅费':r['Charge Classification Code']==='FRT'&&/Ground Hundredweight|Ground Commercial|Ground Residential/.test(r['Charge Description'])?'基础运费':'其他服务费';
 const costs=['HWT','Ground','未归属订单费用','账号费用'].map(k=>Object.assign({'项目':k,'票数':k==='HWT'||k==='Ground'?shipments.filter(r=>r['类别']===k).length:''},Object.fromEntries(columns.map(c=>[c,0])),{'账号金额':0,'总费用':0}));
 for(const bucket of shipmentBuckets.values()){for(const c of columns)bucket.ship[c]=0;bucket.ship['总费用']=0;bucket.ship['基础费审核状态']=bucket.ship['状态'];}
 for(const r of rows){const amount=num(r['Net Amount']);if(!amount)continue;const b=findBucket(r),account=r['Charge Category Code']==='MIS'||!r['Tracking Number'];const c=account?costs[3]:b?costs[b.ship['类别']==='HWT'?0:1]:costs[2],col=feeColumn(r);c[account?'账号金额':col]+=amount;c['总费用']+=amount;if(b&&!account){b.ship[col]+=amount;b.ship['总费用']+=amount;b.fees.push(r);}}
 for(const b of shipmentBuckets.values()){for(const c of [...columns,'总费用'])b.ship[c]=round(b.ship[c]);b.ship['状态']=b.fees.some(r=>r['Charge Category Code']==='ADJ'||feeColumn(r)!=='基础运费'&&byRow.get(r.__row)?.['状态']==='待核实')?'含待核实费用':b.ship['基础费审核状态'];}

 const finalAudits=[];
 for(const b of shipmentBuckets.values()){
  const ship=b.ship,all=b.fees,baseRows=all.filter(r=>r['Charge Classification Code']==='FRT'&&(/Ground Commercial|Ground Residential/.test(r['Charge Description'])||/^(Shipping Charge Correction|ZONE ADJUSTMENT) Ground$/i.test(r['Charge Description'])));
  let full=false,expected=null,reason='';
  ship['账单已收']=ship['总费用'];ship['整票合约应收']='';ship['超收金额']=0;ship['已核算项目超收金额']=0;
  if(ship['类别']==='Ground'){
   const net=root.UPSGroundNetAudit.reconcile(b.raw,all,options,tolerance);Object.defineProperty(ship,'_netAudit',{value:net,enumerable:false,configurable:true});full=net.full;expected=net.expected;reason=net.reason;
   Object.assign(ship,{'原始服务类型':ship['服务类型'],'服务类型':net.service,'最终计费重LB':net.weight,'最终分区':net.zone,'调整后基础费实收':net.baseActual,'调整后基础费应收':net.baseExpected??'','调整后燃油实收':net.fuelActual,'燃油应收':net.fuelExpected??'','燃油费率':net.fuelRate??'','燃油支付比例':.6,'整票合约应收':expected??'','整票差额':full?round(ship['账单已收']-expected):'','超收金额':full?Math.max(0,round(ship['账单已收']-expected)):0});
   if(full){ship['状态']=status(ship['账单已收'],expected);for(const r of all){const line=byRow.get(r.__row);if(line){line['状态']='已并入整票';line['原因']='已按净额并入整票，原收费/退款/更正不重复申诉';}}for(const a of adjustments)if(a['账单号']===ship['账单号']&&a['运单号']===ship['运单号']){a['状态']='已并入整票';a['原因']=reason;}}
  }
  if(!full){ship['状态']='已出账·部分待核算';ship['已核算项目超收金额']=all.some(r=>r['Charge Category Code']==='ADJ'&&r['Charge Classification Code']==='FRT')?0:Math.max(0,num(ship['原始基础费差额']));for(const r of all){if(r['Charge Category Code']==='ADJ'||r['Charge Classification Code']==='FRT'||r['Charge Classification Code']==='FSC')continue;const line=byRow.get(r.__row);if(line&&line['状态']==='多收异常'&&!all.some(a=>a['Charge Category Code']==='ADJ'&&root.UPSContractDefaults.fee(a['Charge Description'])===root.UPSContractDefaults.fee(r['Charge Description'])))ship['已核算项目超收金额']+=num(line['差额']);}ship['已核算项目超收金额']=round(ship['已核算项目超收金额']);}
  else ship['已核算项目超收金额']=ship['超收金额'];
  ship['整票核算完整']=full?'是':'否';ship['整票审核依据']=reason||'账单已收费用保留；尚未核算的项目单列，已核算部分超收不代表全部应收已确定';finalAudits.push(ship);
 }
 for(const c of costs)for(const k of [...columns,'账号金额','总费用'])c[k]=round(c[k]);
 const summary=costs.filter(c=>c['总费用']!==0||c['票数']).map(c=>{const a=shipments.filter(r=>r['类别']===c['项目']);return {...c,'基础费通过票数':a.filter(r=>r['基础费审核状态']==='通过').length,'基础费多收票数':a.filter(r=>r['基础费审核状态']==='多收异常').length,'含待核实票数':a.filter(r=>r['状态']==='含待核实费用'||r['基础费审核状态']==='待核实').length,'原始基础费超收':round(a.filter(r=>r['基础费审核状态']==='多收异常').reduce((t,r)=>t+r['原始基础费差额'],0))};});
 summary.push(Object.assign({'项目':'账单合计','票数':''},Object.fromEntries([...columns,'账号金额','总费用'].map(c=>[c,round(costs.reduce((t,r)=>t+r[c],0))]))));
 const billingAudit=[],correctionPackages=[];
 for(const a of accounts.filter(a=>/Billing Adjustment/i.test(a['费用名称']))){
  const source=rows.find(r=>r.__row===a['来源行']),scope=rows.filter(r=>r['Account Number']===source['Account Number']&&r['Invoice Number']===source['Invoice Number']&&r['Charge Category Code']==='ADJ'&&r['Charge Category Detail Code']==='SCC');
  const memo=[source['Miscellaneous Line 1'],source['Miscellaneous Line 2'],source['Miscellaneous Line 3']].join(' '),countMatch=memo.match(/BASED ON\s+([\d,]+)\s+PACKAGES/i),amountMatch=memo.match(/\$([\d,.]+)\s+CORRECTION AMOUNT/i);
  const declaredCount=countMatch?num(countMatch[1]):null,declaredAmount=amountMatch?num(amountMatch[1]):null;
  const detail=scope.filter(r=>/^Shipping Charge Correction$/i.test(r['Charge Description'])),detailTracks=new Set(detail.map(r=>r['Tracking Number'])),detailLeads=new Set(detail.map(r=>r['Lead Shipment Number']));
  const candidates=new Map();for(const r of detail)candidates.set(r['Tracking Number'],{r,kind:'包裹更正明细（含零金额）'});
  const aggregates=new Set();for(const r of scope){const t=r['Tracking Number'];if(!t||detailTracks.has(t))continue;if(detailLeads.has(t)){aggregates.add(t);continue;}if(num(r['Net Amount'])!==0)candidates.set(t,{r,kind:'无包裹更正明细的额外更正运单'});}
  const amount=round(scope.reduce((t,r)=>t+num(r['Net Amount']),0)),count=candidates.size,average=count?amount/count:0,expected=count&&average>1?round(Math.max(count*1.65,amount*.12)):0;
  const matched=declaredCount!==null&&declaredAmount!==null&&declaredCount===count&&Math.abs(declaredAmount-amount)<=tolerance;
  const qualified=average>1,imports=scope.some(r=>r['Sender Country/Territory']&&r['Receiver Country/Territory']&&r['Sender Country/Territory']!=='US'&&r['Receiver Country/Territory']==='US');
  const check={'账单号':a['账单号'],'账号':source['Account Number'],'UPS备注件数':declaredCount??'未提供','明细重建件数':count,'包裹更正明细数':detailTracks.size,'额外更正运单数':count-detailTracks.size,'排除整票汇总数':aggregates.size,'UPS备注更正金额':declaredAmount??'未提供','明细更正金额':amount,'平均更正金额每件':round(average),'是否满足大于1美元门槛':qualified?'是':'否','按件计算':round(count*1.65),'按12%计算':round(amount*.12),'实收金额':a['实收金额'],'核算金额':imports?'':expected,'差额':imports?'':round(a['实收金额']-expected),'状态':!matched||imports?'待核实':status(a['实收金额'],expected),'说明':!matched?'UPS备注与重建数量或金额不一致，需补明细':imports?'含进口记录，需排除后重算':'数量、金额、平均门槛及取高公式核对一致；零金额更正仍计件，HWT整票汇总不重复计件。该结论不证明原尺寸/重量更正合理。','原始备注':memo};billingAudit.push(check);
  a['合约应收']=imports?'':expected;a['差额']=check['差额'];a['状态']=check['状态'];a['原因']=check['说明'];
  for(const [tracking,v] of candidates){const rr=v.r;correctionPackages.push({'账单号':a['账单号'],'运单号':tracking,'Lead Shipment':rr['Lead Shipment Number'],'来源行':rr.__row,'计件依据':v.kind,'原基础费':original.has(tracking)?'本账单有':'本账单无，需历史账单','输入重量':rr['Entered Weight'],'更正重量':rr['Billed Weight'],'原输入尺寸':rr['Detail Keyed Dim']||'','更正尺寸':rr['Package Dimensions']||'','说明':'计入账号周更正件数；收费门槛按账号周平均判断，不要求每个包裹单独超过1美元'});}
 }

 for(const row of summary){const scope=shipments.filter(r=>r['类别']===row['项目']);row['完整核算部分应收']=scope.some(r=>r['整票核算完整']==='是')?round(scope.filter(r=>r['整票核算完整']==='是').reduce((t,r)=>t+r['整票合约应收'],0)):'';row['整票完整核算票数']=scope.filter(r=>r['整票核算完整']==='是').length;row['整票超收票数']=scope.filter(r=>r['超收金额']>tolerance).length;row['已核算超收金额']=round(scope.reduce((t,r)=>t+r['已核算项目超收金额'],0));row['完整应收待核算票数']=scope.filter(r=>r['整票核算完整']==='否').length;}
 const accountOvercharge=round(accounts.filter(r=>r['状态']==='多收异常').reduce((t,r)=>t+num(r['差额']),0)),accountSummary=summary.find(r=>r['项目']==='账号费用');if(accountSummary)accountSummary['已核算超收金额']=accountOvercharge;
 const confirmedOvercharge=round(shipments.reduce((t,r)=>t+r['已核算项目超收金额'],0)+accountOvercharge);summary[summary.length-1]['已核算超收金额']=confirmedOvercharge;
 const overcharges=[...shipments.filter(r=>r['已核算项目超收金额']>tolerance).map(r=>({'类别':r['类别'],'账单号':r['账单号'],'运单号':r['运单号'],'账单已收':r['账单已收'],'合约应收':r['整票合约应收'],'超收金额':r['已核算项目超收金额'],'核算范围':r['整票核算完整']==='是'?'整票（含调整及燃油）':'部分已核算项目','依据':r['整票审核依据']})),...accounts.filter(r=>r['状态']==='多收异常').map(r=>({'类别':'账号费用','账单号':r['账单号'],'运单号':'','账单已收':r['实收金额'],'合约应收':r['合约应收'],'超收金额':r['差额'],'核算范围':r['费用名称'],'依据':r['原因']}))];
 return {overcharges,confirmedOvercharge,summary,shipments,services:[],accounts,adjustments,info,total,rawCount:rows.length,missingOriginal:adjustments.filter(r=>r['原收费记录']==='本账单无原基础费').length,billingAudit,correctionPackages,hwtDefaults:{minimumAverageLB:20,minimumShipmentUSD:72,source:'第一份合约＋附件基础费率；附件25LB旧标注按用户指示覆盖为20LB'}};
}
root.UPSShipmentAudit={audit(raw,results,tolerance=.02,options={}){return root.UPSReviewReports.enrich(audit(raw,results,tolerance,options),raw,results,tolerance,options);}};
})(typeof window==='undefined'?globalThis:window);
