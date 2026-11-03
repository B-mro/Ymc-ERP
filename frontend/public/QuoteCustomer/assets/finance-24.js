(function(root){
'use strict';
const n=v=>Number(v||0),money=v=>Math.round((n(v)+1e-9)*100)/100;
const key=r=>[r['Account Number']||r['账号'],r['Invoice Number']||r['账单号'],r['Tracking Number']||r['运单号']].join('|');
const shipKey=s=>[s['账号'],s['账单号'],s['运单号']].join('|');
const sum=(rs,f)=>money(rs.reduce((a,r)=>a+n(r[f]),0));
const isBase=r=>r['Charge Category Code']==='SHP'&&r['Charge Classification Code']==='FRT'&&/^Ground (Commercial|Residential|Hundredweight)$/.test(r['Charge Description']);
function enrich(report,raw,results,tolerance=.02){
 const byRow=new Map(results.map(r=>[r['来源行'],r])),baseByTrack=new Map(),baseByLead=new Map(),buckets=new Map(),claims=[],feeTotals=new Map(),hwtFees=[],ahs=[];
 for(const s of report.shipments)buckets.set(shipKey(s),{s,rows:[]});
 for(const r of raw)if(isBase(r)){const lead=r['Charge Description']==='Ground Hundredweight'?r['Lead Shipment Number']:r['Tracking Number'],b=buckets.get([r['Account Number'],r['Invoice Number'],lead].join('|'));if(b){baseByTrack.set(key(r),b);baseByLead.set([r['Account Number'],r['Invoice Number'],lead].join('|'),b);b.original=r;}}
 for(const r of raw){const desc=r['Charge Description']||(r['Charge Category Detail Code']==='FPOD'?'REQUESTS FOR PROOF OF DELIVERY':'未命名调整'),fk=r['Charge Category Code']+'|'+desc;let f=feeTotals.get(fk);if(!f){f={'费用类别':r['Charge Category Code'],'费用名称':desc,'行数':0,'实收金额':0};feeTotals.set(fk,f);}f['行数']++;f['实收金额']+=n(r['Net Amount']);
  if(!r['Tracking Number']||r['Charge Category Code']==='MIS')continue;
  const b=baseByTrack.get(key(r))||baseByLead.get([r['Account Number'],r['Invoice Number'],r['Lead Shipment Number']].join('|'));if(b)b.rows.push(r);
 }
 const fields={HWT:new Set(),Ground:new Set()};
 function claim(b,description,selected,billed,expected,scope,reason,group){
  billed=money(billed);expected=money(expected);const credit=money(billed-expected);if(credit<=tolerance)return;
  const r=b.original,s=b.s;
  if(Math.abs(sum(selected,'Net Amount')-billed)>.02)throw Error('申诉收费范围未核平：'+s['运单号']+' '+description);
  const c={'Claim ID':'','Tracking Number':s['运单号'],'Lead Shipment Number':r['Lead Shipment Number']||s['运单号'],'Service':s['服务类型'],'Charge Description':description,'Billed Amount USD':billed,'Expected Amount USD':expected,'Requested Credit USD':credit,'Dispute Reason':reason,'Invoice Number':s['账单号'],'Account Number':s['账号'],'Invoice Date':r['Invoice Date'],'Transaction Date':s['交易日期'],'Billed Weight LB':s['最终计费重LB']??s['有效总重LB'],'Zone':n(s['最终分区']??s['分区']),'Claim Scope':scope,'Currency':r['Transaction Currency Code']||'USD'};
  claims.push({data:c,rows:selected,ship:s,group});return c;
 }
 const issue=(name,actual,expected,gross)=>{const missing=Math.abs(actual-gross)<=.03;return {zh:(name==='Transportation'?'基础费':name)+(missing?'无折扣':'折扣不足')+'：实收$'+actual.toFixed(2)+'，应收$'+expected.toFixed(2)+'，差额$'+money(actual-expected).toFixed(2),en:name+' incentive '+(missing?'not applied':'insufficient')+': billed USD'+actual.toFixed(2)+', contractual net USD'+expected.toFixed(2)+'.'};};
 for(const b of buckets.values()){
  const s=b.s,rs=b.rows.filter(r=>n(r['Net Amount'])!==0),r=b.original;if(!r)continue;
  const feeGroups=new Map();s['分区核验']='按账单分区计价；未取得分区表及起讫邮编证据，不判分区错误';s['待核项目']='';s['确切申诉原因']='';
  for(const row of b.rows){const desc=row['Charge Description']||'未命名调整',name=isBase(row)?'基础运费':(row['Charge Category Code']==='ADJ'?'ADJ ':'')+desc;s['费用 '+name]=money(n(s['费用 '+name])+n(row['Net Amount']));if(name!=='基础运费')fields[s['类别']].add(name);if(!feeGroups.has(name))feeGroups.set(name,[]);feeGroups.get(name).push(row);}
  s['费用合计核验差额']=money(sum(b.rows,'Net Amount')-s['总费用']);if(Math.abs(s['费用合计核验差额'])>tolerance)throw Error('整票费用未核平：'+s['运单号']);
  const reasons=[],english=[],pending=[];
  const baseAct=s['调整后基础费实收']??s['原始基础费实收'],baseExp=s['调整后基础费应收']??s['原始基础费应收'];
  if(typeof baseExp==='number'&&baseAct-baseExp>tolerance){const gross=s['调整后公布基础费']??sum(feeGroups.get('基础运费')||[],'Net Amount')+sum(feeGroups.get('基础运费')||[],'Incentive Amount'),i=issue('Transportation',baseAct,baseExp,gross);s['基础费问题']=i.zh.split('：')[0];reasons.push(i.zh);english.push(i.en);}else s['基础费问题']=s['基础费审核状态']==='通过'?'通过':'待核实';
  if(s['类别']==='Ground'&&s._netAudit){
   const net=s._netAudit,known=net.components.filter(c=>c.expected!==null),selected=net.full?b.rows:known.flatMap(c=>c.rows),act=net.full?net.actual:money(known.reduce((a,c)=>a+c.actual,0)),exp=net.full?net.expected:money(known.reduce((a,c)=>a+c.expected,0));
   s['基础费问题']=net.baseExpected===null?'待核实':net.baseActual-net.baseExpected>tolerance?'调整后基础费超收':'通过';
   s['待核项目']=net.pending.join('；');s['整票审核依据']=net.reason;
   s['燃油审核']=net.fuelExpected===null?'待核实：'+net.components.find(c=>c.id==='fuel').reason:'实收$'+net.fuelActual.toFixed(2)+'，应收$'+net.fuelExpected.toFixed(2)+'，差额$'+money(net.fuelActual-net.fuelExpected).toFixed(2);
   const differences=known.filter(c=>Math.abs(c.actual-c.expected)>tolerance);
   const zh=differences.map(c=>c.name+'：净实收$'+c.actual.toFixed(2)+'，合约应收$'+c.expected.toFixed(2)+'，差额$'+money(c.actual-c.expected).toFixed(2)).join('；');
   const en='Net shipment reconciliation after corrections and refunds; zero-value INF records excluded. Final service '+net.service+', weight '+net.weight+' LB, zone '+net.zone+'. '+differences.map(c=>c.name+': net billed USD'+c.actual.toFixed(2)+', expected USD'+c.expected.toFixed(2)+'.').join(' ')+' All known lower charges are netted against overcharges. '+(net.full?'Fuel is included using Transaction Date weekly rate x 60% on eligible contractual net charges.':'Unresolved charges and fuel are excluded; see Pending Review.');
   const c=claim(b,net.full?'Ground net shipment including corrections and fuel':'Verified net components after corrections',selected,act,exp,net.full?'Complete shipment, including billed corrections and fuel.':'Known net components only; unresolved items excluded and separately listed.',en,net.service);
   if(c)claims[claims.length-1].zhReason=zh;s['确切申诉原因']=zh||(net.full?'整票净额无可申诉超收':'已核算部分无净超收；仍有待核项目');
   continue;
  }
  if(s['类别']==='HWT'){
   for(const [name,group]of feeGroups){
    if(!['Delivery Area Surcharge','Delivery Area Surcharge - Extended','Shipment Residential Surcharge'].includes(name))continue;
    const actual=sum(group,'Net Amount'),resi=feeGroups.has('Shipment Residential Surcharge'),published=name==='Shipment Residential Surcharge'?61.75:name.endsWith('Extended')?(resi?44:28.25):(resi?32.5:22.5),factor=name==='Shipment Residential Surcharge'?.3:1;
    const valid=s['基础费审核状态']!=='待核实'&&s['交易日期']>='2026-09-07'&&s['交易日期']<='2026-12-31'&&!rs.some(x=>x['Charge Category Code']==='ADJ'&&root.UPSContractDefaults.fee(x['Charge Description'])===root.UPSContractDefaults.fee(name));
    const expected=valid?money(published*factor):null,credit=expected===null?'':money(actual-expected);
    hwtFees.push({'运单号':s['运单号'],'账单号':s['账单号'],'交易日期':s['交易日期'],'费用名称':name,'实收金额':actual,'公布金额':published,'合约支付比例':factor,'合约应收':expected??'','超收金额':expected===null?'':Math.max(0,credit),'状态':!valid?'待核实':credit>tolerance?'超收':credit < -tolerance?'少收提示':'通过','依据':name==='Shipment Residential Surcharge'?'按用户确认保留申诉：Ground Residential Surcharge 70% OFF':'按用户确认：HWT单件DAS/EDAS优惠不对整票重复打折，整票按公布价','来源行':group.map(x=>x.__row).join(',')});
    for(const row of group){const line=byRow.get(row.__row);if(line){line['状态']='已并入整票';line['合约应收']='';line['差额']='';line['原因']='HWT按整票费用核对，见HWT附加费明细';}}
    if(!valid){pending.push(name);continue;}
    if(credit>tolerance){const i=issue(name,actual,expected,published);reasons.push(i.zh);english.push(i.en);const hc=claim(b,name,group,actual,expected,'Shipment-level accessorial only; no additional fuel credit requested.',name==='Shipment Residential Surcharge'?'Shipment Residential Surcharge was billed without the 70% Ground residential surcharge incentive. Please apply the incentive to this Hundredweight shipment and issue the requested credit.':i.en+' Please review this shipment-level published charge.','HWT - '+name);if(hc)claims[claims.length-1].zhReason=i.zh;}
   }
  }
  const selected=[],selectedNames=[],selectedReasons=[],selectedZh=[];let selectedAct=0,selectedExp=0;
  const hasBaseAdj=rs.some(x=>x['Charge Category Code']==='ADJ'&&x['Charge Classification Code']==='FRT');
  if(s['类别']==='Ground'&&s['整票核算完整']!=='是'&&!hasBaseAdj&&typeof baseExp==='number'&&baseAct-baseExp>tolerance){selected.push(...(feeGroups.get('基础运费')||[]));selectedNames.push('Transportation');selectedAct+=baseAct;selectedExp+=baseExp;selectedReasons.push(english[0]);selectedZh.push(reasons[0]);}
  for(const [name,group]of feeGroups){
   if(name==='基础运费'||name.startsWith('ADJ ')||group[0]['Charge Classification Code']==='FSC'||s['类别']==='HWT'&&['Delivery Area Surcharge','Delivery Area Surcharge - Extended','Shipment Residential Surcharge'].includes(name))continue;
   const active=group.filter(x=>n(x['Net Amount'])!==0&&x['Charge Classification Code']!=='INF');if(!active.length)continue;const check=active.map(x=>byRow.get(x.__row));if(check.some(x=>!x||typeof x['合约应收']!=='number'||x['状态']==='待核实'||x['状态']==='不参与审核')){pending.push(name);continue;}
   const act=sum(active,'Net Amount'),exp=money(check.reduce((a,x)=>a+x['合约应收'],0));if(act-exp<=tolerance)continue;
   const adjusted=rs.some(x=>x['Charge Category Code']==='ADJ'&&root.UPSContractDefaults.fee(x['Charge Description'])===root.UPSContractDefaults.fee(name));if(adjusted){pending.push(name+'（含更正）');continue;}
   const i=issue(name,act,exp,act+sum(active,'Incentive Amount'));reasons.push(i.zh);english.push(i.en);
   if(s['整票核算完整']!=='是'){selected.push(...active);selectedNames.push(name);selectedAct+=act;selectedExp+=exp;selectedReasons.push(i.en);selectedZh.push(i.zh);}
  }
  if(s['类别']==='Ground'&&s['整票核算完整']==='是'){
   const fa=s['调整后燃油实收'],fe=s['燃油应收'],fd=money(fa-fe);s['燃油审核']='实收$'+fa.toFixed(2)+'，应收$'+fe.toFixed(2)+'，差额$'+fd.toFixed(2);if(fd>tolerance)reasons.push('燃油费超收：'+s['燃油审核']);else if(fd < -tolerance)reasons.push('燃油低于合约应收$'+(-fd).toFixed(2)+'，已抵减整票差额');
   const why=english.join(' ')+' Fuel billed USD'+fa.toFixed(2)+', contractual net USD'+fe.toFixed(2)+', using the transaction-date weekly UPS Ground rate of '+(s['燃油费率']*100).toFixed(2)+'% x 60% on eligible net charges. Corrections and any lower fuel amount are netted in this claim.';
   const gc=claim(b,s['服务类型']+' and related accessorial / fuel charges',b.rows,s['账单已收'],s['整票合约应收'],'Complete shipment, including billed corrections and fuel.',why,s['服务类型']);if(gc)claims[claims.length-1].zhReason=reasons.join('；');
  }else{
   s['燃油审核']='未完成最终净基数核算，未追加燃油申诉';
   if(selected.length){const c=claim(b,selectedNames.join(' / '),selected,selectedAct,selectedExp,'Specified audited charges only; other charges, adjustments and additional fuel credit excluded.',selectedReasons.join(' ')+' Please apply the contractual incentives to these specified charges.',s['类别']==='HWT'?'HWT - Additional Handling':s['服务类型']);
    if(c)claims[claims.length-1].zhReason=selectedZh.join('；');if(c&&s['类别']==='HWT')for(const row of selected){const line=byRow.get(row.__row),actual=n(row['Net Amount']),expected=line['合约应收'];if(actual-expected>tolerance)ahs.push({'Lead Shipment Number':s['运单号'],'Tracking Number':row['Tracking Number'],'Transaction Date':row['Transaction Date'],'Charge Description':row['Charge Description'],'Zone':n(row.Zone),'Published Amount USD':money(actual+n(row['Incentive Amount'])),'Incentive Amount USD':n(row['Incentive Amount']),'Net Amount USD':actual,'Contract Discount':.85,'Expected Amount USD':expected,'Disputed Amount USD':money(actual-expected),'Source Row':row.__row});}
   }
  }
  s['确切申诉原因']=(s['类别']==='Ground'&&s['整票核算完整']!=='是'?selectedZh:reasons).join('；');s['待核项目']=pending.join('；');
 }
 // Invoice-level claims remain separate. Payment Processing Fee is never added to Dispute.
 const rawByRow=new Map(raw.map(r=>[r.__row,r]));
 for(const a of report.accounts)if(a['状态']==='多收异常'&&a['差额']>tolerance&&!/payment[ -]*processing/i.test(a['费用名称'])){const r=rawByRow.get(a['来源行']);if(r){const s={'账号':r['Account Number'],'账单号':r['Invoice Number'],'运单号':'','服务类型':'Account charges','交易日期':r['Transaction Date'],'有效总重LB':'','分区':''};claim({s,original:r},a['费用名称'],[r],a['实收金额'],a['合约应收'],'Invoice-level charge only.','Please review the invoice-level charge and issue the calculated contractual credit.','Account charges');}}
 const creditByShip=new Map();let id=0;
 claims.sort((a,b)=>[a.data.Service,a.data['Tracking Number'],a.data['Charge Description']].join('|').localeCompare([b.data.Service,b.data['Tracking Number'],b.data['Charge Description']].join('|')));
 for(const c of claims){c.data['Claim ID']='SG-'+String(++id).padStart(6,'0');const sk=shipKey(c.ship);creditByShip.set(sk,money(n(creditByShip.get(sk))+c.data['Requested Credit USD']));}
 for(const s of report.shipments){s['已核算项目超收金额']=n(creditByShip.get(shipKey(s)));s['申诉状态']=s['已核算项目超收金额']>tolerance?(s['整票核算完整']==='是'?'列入Dispute（整票核算）':'列入Dispute（仅列明项目）'):s['整票核算完整']==='是'?(s['状态']==='通过'?'金额核对通过':'少收提示'):'待核实（本次无申诉金额）';if(!s['已核算项目超收金额'])s['确切申诉原因']=s['整票核算完整']==='是'?'整票净额无可申诉超收':'已核算部分无净超收；未完成项目见待核清单';}
 report.pendingChecks=report.shipments.filter(s=>s['整票核算完整']!=='是').flatMap(s=>(s._netAudit?.pending?.length?s._netAudit.pending:[s['待核项目']||s['整票审核依据']||'整票核算未完成，需补充依据']).map(reason=>({'账单号':s['账单号'],'运单号':s['运单号'],'服务类型':s['服务类型'],'状态':'待核实，不代表通过','原因':reason,'已核算申诉金额':s['已核算项目超收金额']||0})));
 report.claims=claims;report.confirmedOvercharge=money(claims.reduce((a,c)=>a+c.data['Requested Credit USD'],0));
 report.overcharges=claims.map(c=>({'申诉编号':c.data['Claim ID'],'类别':c.ship['类别']||'账号费用','服务类型':c.data.Service,'账单号':c.data['Invoice Number'],'运单号':c.data['Tracking Number'],'费用名称':c.data['Charge Description'],'账单已收':c.data['Billed Amount USD'],'合约应收':c.data['Expected Amount USD'],'超收金额':c.data['Requested Credit USD'],'申诉状态':c.ship['申诉状态']||'列入Dispute','确切申诉原因':c.zhReason||c.ship['确切申诉原因']||c.data['Dispute Reason'],'核算范围':c.data['Claim Scope']}));
 for(const row of report.summary){const scope=report.shipments.filter(s=>s['类别']===row['项目']);row['已核算超收金额']=row['项目']==='账单合计'?report.confirmedOvercharge:row['项目']==='账号费用'?money(claims.filter(c=>c.group==='Account charges').reduce((a,c)=>a+c.data['Requested Credit USD'],0)):money(scope.reduce((a,s)=>a+s['已核算项目超收金额'],0));row['含待核实票数']=scope.filter(s=>s['整票核算完整']!=='是').length;}
 report.serviceSummary=['Ground Commercial','Ground Residential'].map(type=>{const scope=report.shipments.filter(s=>s['服务类型']===type);return {'服务类型':type,'总票数':scope.length,'原基础费超收票数':scope.filter(s=>s['基础费审核状态']==='多收异常').length,'本次申诉票数':scope.filter(s=>s['已核算项目超收金额']>tolerance).length,'已核算申诉金额':money(scope.reduce((a,s)=>a+s['已核算项目超收金额'],0))};});
 report.hwtComponents=hwtFees;report.additionalHandlingDetails=ahs;report.feeColumns=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,[...v].sort()]));report.feeTotals=[...feeTotals.values()].map(r=>({...r,'实收金额':money(r['实收金额'])}));
 const total=report.summary.find(r=>r['项目']==='账单合计');if(Math.abs(total['总费用']-report.total)>tolerance)throw Error('账单汇总未核平');report.displaySummary=auditSummary(report);return report;
}
const shipFields=['服务类型','运单号','交易日期','分区','件数','计费总重LB','有效总重LB','基础费问题','申诉状态','确切申诉原因','已核算项目超收金额','总费用','原始基础费实收','原始基础费应收','原始基础费差额','整票合约应收','燃油审核','待核项目','分区核验','费用合计核验差额','原始服务类型','最终计费重LB','最终分区','调整后基础费实收','调整后基础费应收','调整后燃油实收','燃油应收','整票审核依据','整票核算完整'];
function auditSummary(r){return r.summary.map(x=>Object.fromEntries(['项目','票数','基础运费','燃油费','DAS','EDAS','住宅费','其他服务费','调整金额','账号费用','总费用USD','本次列入申诉USD'].map(k=>[k,x[({'账号费用':'账号金额','总费用USD':'总费用','本次列入申诉USD':'已核算超收金额'})[k]||k]??''])));}
function auditSheets(r,catalog=[]){
 const template=root.UPSAuditReportTemplate;if(!template)throw Error('审核报告模板未加载，请重新打开完整新版网页');
 const invoice=[...new Set(r.shipments.map(s=>s['账单号']))].join(', '),number=v=>Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2}),usd=v=>Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const ships=type=>r.shipments.filter(s=>s['类别']===type).map(s=>Object.fromEntries([...shipFields,...r.feeColumns[type].map(f=>'费用 '+f)].map(k=>[k,s[k]??(k.startsWith('费用 ')?0:'')])));
 const main=auditSummary(r),hw=r.shipments.filter(s=>s['类别']==='HWT'),gr=r.shipments.filter(s=>s['类别']==='Ground'),total=r.summary.find(x=>x['项目']==='账单合计'),ba=r.billingAudit,claims=r.claims;
 const hwFeeNames=[...new Set(claims.filter(c=>c.ship['类别']==='HWT').flatMap(c=>c.rows.map(x=>x['Charge Description'])))];
 const hwFeeText=hwFeeNames.map(name=>name+' '+usd(claims.filter(c=>c.ship['类别']==='HWT').reduce((sum,c)=>sum+c.rows.filter(x=>x['Charge Description']===name).reduce((q,x)=>{const item=r.additionalHandlingDetails.find(a=>a['Source Row']===x.__row);return q+(item?item['Disputed Amount USD']:c.data['Charge Description']===name?c.data['Requested Credit USD']/c.rows.length:0);},0),0))).join('；');
 const billText=ba.map(x=>number(x['明细重建件数'])+'件×1.65='+usd(x['按件计算'])+'；更正金额'+usd(x['明细更正金额'])+'×12%='+usd(x['按12%计算'])+'；实收'+usd(x['实收金额'])+'，核算'+usd(x['核算金额'])+'；'+x['状态']).join(' / ');
 const notes=[['账单日期',[...new Set(claims.map(c=>c.data['Invoice Date']))].join(', ')],['原始费用行数',r.feeTotals.reduce((a,x)=>a+x['行数'],0)],['HWT票数 / 子单数',number(hw.length)+' / '+number(hw.reduce((a,x)=>a+n(x['件数']),0))],['Ground总票数',number(gr.length)+'票='+r.serviceSummary.map(x=>x['服务类型'].replace('Ground ','')+' '+number(x['总票数'])+'票').join('＋')],['HWT基础费',number(hw.filter(x=>x['基础费审核状态']==='通过').length)+'票通过；基础费实收USD'+usd(main.find(x=>x['项目']==='HWT')?.['基础运费'])+'；待核实'+number(hw.filter(x=>x['基础费审核状态']==='待核实').length)+'票'],['Ground基础费',r.serviceSummary.map(x=>x['服务类型'].replace('Ground ','')+'超收'+number(x['原基础费超收票数'])+'票').join('＋')+'＝'+number(r.serviceSummary.reduce((a,x)=>a+x['原基础费超收票数'],0))+'票'],['HWT附加费差额',hwFeeText||'无已核算申诉金额'],['Billing Adjustment',billText||'本期无该费用'],['申诉金额口径','USD'+usd(r.confirmedOvercharge)+'为已核算项目差额，未核算项目未视作通过；不等同于UPS已批准credit'],['本期缺原单调整',number(r.adjustments.filter(x=>x['原收费记录']==='本账单无原基础费').length)+'组；须配对历史账单才能完成整票审核'],['PPF / POD','PPF暂不申诉；POD合计USD'+usd(r.feeTotals.filter(x=>/PROOF OF DELIVERY|POD/i.test(x['费用名称'])).reduce((a,x)=>a+x['实收金额'],0))+'，保留英文名称'],['金额核对','明细净额=费用分组总额=发票金额USD'+usd(r.total)]];
 const rows=[[],['UPS账单审核 '+invoice],[],Object.keys(main[0]),...main.map(Object.values)];while(rows.length<12)rows.push([]);rows.push(...notes);while(rows.length<26)rows.push([]);rows.push(Object.keys(r.serviceSummary[0]),...r.serviceSummary.map(Object.values));
 function layout(name,data,headers){const t=template.sheets[name],heads=headers||t.headers,extra=[...new Set(data.flatMap(Object.keys))].filter(k=>k.startsWith('费用 ')&&!heads.includes(k)&&data.some(x=>n(x[k])!==0));return [name,[[],[t.title],[],[...heads,...extra],...data.map(x=>[...heads,...extra].map(h=>x[h]??''))],{aoa:true,audit:true,template:name,headers:[...heads,...extra]}];}
 const ahs=r.additionalHandlingDetails.map(x=>({...x,'Actual Discount':n(x['Published Amount USD'])?n(x['Incentive Amount USD'])/n(x['Published Amount USD']):'','状态':'超收：折扣不足','原因':'Ground Additional Handling All '+(n(x['Contract Discount'])*100)+'% OFF；账单实际折扣'+((n(x['Published Amount USD'])?n(x['Incentive Amount USD'])/n(x['Published Amount USD']):0)*100).toFixed(2)+'% OFF'}));
 const details=claims.map(c=>({'Invoice Number':c.data['Invoice Number'],'Tracking Number':c.data['Tracking Number'],'Service':c.data.Service,'Billed Amount USD':c.data['Billed Amount USD'],'Expected Amount USD':c.data['Expected Amount USD'],'Disputed Amount USD':c.data['Requested Credit USD'],'Audit Scope':c.data['Claim Scope'],'申诉状态':c.ship['申诉状态'],'确切申诉原因':c.zhReason||c.data['Dispute Reason'],'分区核验':c.ship['分区核验'],'Request':'Please verify the contract pricing and issue the applicable credit.','Calculation Basis':c.data['Dispute Reason']}));
 const fees=r.hwtComponents.map(x=>({...x,'待确认应收':'','待确认差额':'','状态':x['状态']==='通过'&&/Delivery Area/.test(x['费用名称'])?'通过（整票公布价）':x['状态']}));
 const result=[['审核汇总',rows,{aoa:true,audit:true,template:'审核汇总',headers:Object.keys(main[0])}],layout('HWT明细',ships('HWT')),layout('Ground明细',ships('Ground'),[...shipFields,...r.feeColumns.Ground.map(f=>'费用 '+f)]),layout('HWT附加费',fees),layout('Additional Handling明细',ahs),layout('Dispute',details),layout('账号费用',r.accounts),layout('Billing Adjustment',r.billingAudit),layout('更正计件依据',r.correctionPackages),layout('缺原单调整',r.adjustments.filter(x=>x['原收费记录']==='本账单无原基础费'))];
 if(r.pendingChecks?.length)result.push(['待核清单',r.pendingChecks]);
 const feeSheet=layout('费用及审核口径',r.feeTotals);feeSheet[1].push([],[],[],...catalog.map(x=>[Object.entries(x).map(([k,v])=>k+'：'+v).join('；')]));feeSheet[2].notesStart=5+r.feeTotals.length+3;result.push(feeSheet);return result;
}
function disputeData(report){
 if(!report?.claims?.length)throw Error('没有可生成Dispute的已核算申诉项目');
 const details=report.claims.map(c=>c.data),lines=[];for(const c of report.claims)for(const r of c.rows)lines.push({'Claim ID':c.data['Claim ID'],'Tracking Number':r['Tracking Number']||'','Lead Shipment Number':r['Lead Shipment Number']||'','Charge Description':r['Charge Description']||c.data['Charge Description'],'Net Amount USD':n(r['Net Amount']),'Incentive Amount USD':n(r['Incentive Amount']),'Charge Category Code':r['Charge Category Code'],'Charge Classification Code':r['Charge Classification Code'],'Transaction Date':r['Transaction Date'],'Billed Weight LB':n(r['Billed Weight']),'Zone':r.Zone||'','Invoice Number':r['Invoice Number'],'Account Number':r['Account Number'],'Currency':r['Transaction Currency Code']||'USD','Original Invoice Row':r.__row});
 const unique=k=>[...new Set(details.map(c=>c[k]).filter(Boolean))].join(', '),packages=new Set(details.map(c=>[c['Account Number'],c['Invoice Number'],c['Tracking Number']].join('|'))).size;
 const groups=[...new Set(report.claims.map(c=>c.group))].map(g=>{const cs=report.claims.filter(c=>c.group===g);return {'Claim Category':g,'Claim Records':cs.length,'Shipments':new Set(cs.map(c=>c.data['Tracking Number'])).size,'Billed Amount USD':money(cs.reduce((s,c)=>s+c.data['Billed Amount USD'],0)),'Expected Amount USD':money(cs.reduce((s,c)=>s+c.data['Expected Amount USD'],0)),'Requested Credit USD':money(cs.reduce((s,c)=>s+c.data['Requested Credit USD'],0))};});
 const summary=[['UPS Invoice Dispute','','','','',''],[],['Customer','ShipGrid Operations, LLC'],['Account Number',unique('Account Number')],['Invoice Number',unique('Invoice Number')],['Invoice Date',unique('Invoice Date')],['Currency',unique('Currency')],['Original Invoice Total',report.total],['Total Requested Credit',report.confirmedOvercharge],['Claim Records',details.length],['Unique Shipments',packages],[],Object.keys(groups[0]),...groups.map(g=>Object.values(g)),['Total',details.length,packages,sum(details,'Billed Amount USD'),sum(details,'Expected Amount USD'),report.confirmedOvercharge]];
 const credit=sum(details,'Requested Credit USD');if(Math.abs(credit-report.confirmedOvercharge)>.005)throw Error('审核报告与Dispute金额不一致，已停止导出');
 return {sheets:[['Claim Summary',summary,{aoa:true}],['Dispute Details',details],['Invoice Lines',lines]],details,lines,totalCredit:credit,packages};
}
root.UPSReviewReports={enrich,auditSummary,auditSheets,disputeData};
})(typeof window==='undefined'?globalThis:window);
