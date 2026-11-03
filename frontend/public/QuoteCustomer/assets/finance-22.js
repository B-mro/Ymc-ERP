(function(root){
'use strict';
const C1='第一份 Fully Executed Carrier Agreement - UPS.pdf';
const C2='第二份修订 U-ShipGrid- US Incentive Program Agreement 2026 10 06_Final(1).docx';
const TARIFF='https://assets.ups.com/adobe/assets/urn:aaid:aem:356d938a-4f0a-4c71-b50e-bdd890f50b47/original/as/daily-rates-us-en.pdf';
const DEMAND='https://assets.ups.com/adobe/assets/urn:aaid:aem:2c542692-de10-4fa3-b507-3b4f181e0953/original/as/demand-surcharges-us-en.pdf';
const clean=v=>String(v??'').trim();
const num=v=>clean(v)===''?null:Number(String(v).replace(/[$,]/g,''));
const money=v=>Math.round((v+Number.EPSILON)*100+1e-9)/100;
const acct=v=>clean(v).toUpperCase().replace(/^0+/,'');
const accounts2=['22K84A','22K84B','22K84C','22K84D','22K84E','22K84F','22K84G','22RJ29','22V6B7','22V83C','2K2166','2K28D8','2K28D9','2K28E0','2K28E1','2K28E2','2K28F2','2K28F3','2K28F4','2K28F5','2K28F6','2K28F7','2K28F8','2K28F9','2K28G0','2K28G2','2K28G3','2K28G5','2K28G7'];
const accounts1=accounts2.filter(x=>x.startsWith('2K'));
const catalog=[
 ['优先级','第二份覆盖同一费用/服务；第一份仅补充未覆盖条款；两份均无优惠时按UPS公布价','用户指定'],
 ['Ground Commercial基础运费','1–20LB减免42.5%；21LB起减免45%；达高档另加28.1个百分点',C2+' Exhibit B p7 / C p9'],
 ['Ground Residential基础运费','1–10LB减免45%；11–20LB 54.5%；21–30LB 57.5%；31LB起65%；高档另加20个百分点',C2+' Exhibit B p8 / C p9'],
 ['基础运费档位','所有合约档位固定按最优档位计算，不逐周测算营业额，不因未提供货量降档；High Volume旺季附加费单独排除',C2+' Exhibit C p9'],
 ['最低运输费','Commercial：Ground 2区1LB公布价×52.2%；Residential：×50%；住宅附加费另算。可输入经UPS确认的最低净额及依据覆盖',C2+' Minimum Net Charge p11'],
 ['Ground AHS / Large Package','均85% OFF；覆盖第一份AHS 75% OFF',C2+' Exhibit E p13'],
 ['Ground DAS / EDAS','单包裹75% OFF；Ground Saver 25% OFF；HWT按用户确认的整票公布价收费，不对整票再打折',C2+' Exhibit E p13'],
 ['Remote Ground Residential','15% OFF；Commercial未列优惠，按公布价',C2+' Exhibit E p13'],
 ['住宅附加费','Ground 70% OFF；Air 50% OFF',C2+' Exhibit E p13'],
 ['签名 / 成人签名','55% OFF',C2+' Exhibit E p13'],
 ['燃油','Ground支付60%，覆盖第一份50%；Ground Saver支付70%；Air未列优惠，支付100%。按原始Transaction Date匹配官网周费率及核实净基数计算',C2+' Exhibit E p13；第一份p4'],
 ['旺季Commercial/Residential/AHS/Large Package','Commercial/Residential为80% OFF；AHS/Large Package为90% OFF，截至2027-01-16；UA旺季未列折扣，按公布价',C2+' Exhibit E p13'],
 ['Payment Processing Fee','50% OFF；需发票计费基数',C2+' Exhibit E p13'],
 ['Air基础运费高档','NDA 81.2%、Saver 80.9%、2DA AM 74.8%、2DA 77.2%、3Day 76% OFF；低档为0',C2+' Exhibit C p9'],
 ['Air AHS / Large Package / DAS / EDAS','AHS及Large Package 40% OFF；DAS、EDAS 50% OFF',C2+' Exhibit E p13'],
 ['Ground Saver基础运费','1–3LB 37%；4–6LB 35.5%；7–9LB 34% OFF，高档另加17.5个百分点；最低价为2区1LB×74.1%',C2+' Exhibit D p12'],
 ['DIM','Ground 250；Air 225；Ground Saver ≤1728in³免DIM，超出139；本模块金额审核不替代尺寸核验',C2+' Exhibit E p14'],
 ['HWT第一份补充','200–499LB每100LB费率：13.69/15.30/16.99/20.72/26.08/30.21/35.19；500–2000LB：10.31/13.16/14.61/18.04/22.64/26.10/30.20；每票最低72；2001LB起82.8/82.5/81.6/80.9/80.8/81.3/81.2% OFF',C1+' Addendum B p4'],
 ['HWT适用条件','Tier04、整票重量、每100LB进位及整票最低收费口径、分摊、第一份延期与第二份已覆盖部分需核实；不把单包裹重量当整票重量',C1+' p1、p4；第二份p8图片部分遮挡'],
 ['High Volume旺季费用','不计算，不参与审核；保留原实收并单独列示，不计入通过和多收','用户设置'],
 ['未知费用','合约无优惠默认0% OFF；已收录官网价直接核对，官网版本/基数缺失列待核实，不把账单原价当官网价','UPS Daily Rates / 用户指定'],
 ['官网快照','美国48州，2026-09-07版Daily Rates；2026-12-31后或更早版本须更新；旺季使用2026-08-26公告',TARIFF],
 ['合约状态','用户确认两份均已生效，默认使用第二份优先、第一份补充，不要求填写生效日；保留第二份2027-02-27到期检查',C1+' p1；'+C2+' p3/5']
].map(([项目,默认规则,依据])=>({项目,默认规则,依据}));
function service(v){
 const s=clean(v).toLowerCase().replace(/[®™]/g,'');
 if(/hundred|hwt|百磅/.test(s))return 'HWT';
 if(/ground.*saver|surepost|ground saver/.test(s))return 'Ground Saver';
 if(/ground|陆运/.test(s)){if(/resi|住宅/.test(s))return 'Ground Residential';if(/comm|商业/.test(s))return 'Ground Commercial';return 'Ground';}
 if(/next day|nda/.test(s))return /early/.test(s)?'NDA Early':/saver/.test(s)?'NDA Saver':'NDA';
 if(/2nd|second|2day|2 day|2da/.test(s))return /a\.?m\.?/.test(s)?'2DA AM':'2DA';
 if(/3 day|3day|3da/.test(s))return '3Day';return '';
}
function fee(v){
 const s=clean(v).toLowerCase().replace(/addl\.?\s*handling/g,'additional handling');
 if(/fuel|燃油/.test(s))return 'fuel';
 if(/demand|peak|旺季/.test(s))return /unauth|maximum|超限/.test(s)?'peakUA':/handling|ahs|处理/.test(s)?'peakAHS':/large|oversize|os\b|超尺寸/.test(s)?'peakOS':/resi|住宅/.test(s)?'peakResi':/comm|商业/.test(s)?'peakComm':'peakUnknown';
 if(/additional handling|ahs|额外处理/.test(s))return /weight|重量|超重/.test(s)?'ahsW':/packag|corrugat|flat|包装/.test(s)?'ahsP':/dim|length|longest|width|girth|cubic|尺寸/.test(s)?'ahsD':'ahsUnknown';
 if(/large package|oversize|超大|超尺寸/.test(s))return 'os';
 if(/over maximum|unauthorized|超限/.test(s))return 'ua';
 if(/remote|超超偏远/.test(s))return 'remote';
 if(/extended|edas|dase|超偏远/.test(s))return 'edas';
 if(/delivery area|\bdas\b|偏远/.test(s))return 'das';
 if(/residential surcharge|residential delivery charge|住宅.*附加/.test(s)||/residential|住宅/.test(s)&&!service(v))return 'resi';
 if(/adult|成人/.test(s))return 'adult';if(/signature|签名/.test(s))return 'sig';
 if(/address correction|改地址|地址更正/.test(s))return 'address';
 if(/missing.*pld/.test(s))return 'pld';
 if(/shipping.*correction.*audit|audit fee|审计/.test(s))return 'audit';
 if(/payment processing/.test(s))return 'payment';
 if(/declared value|保险|申报价值/.test(s))return 'value';
 if(/transport|base rate|基础|运费/.test(s)||service(v))return 'base';
 if(/chargeback|refusal/.test(s))return 'refusal';
 return 'unknown';
}
function prepare(rows){
 const groups=new Map(),context=new Map();
 for(const r of rows){const k=[acct(r['账号']),r['账单号'],r['运单号']].join('|');const sv=service(r['服务'])||service(r['费用名称']);if(sv){if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(sv);}}
 for(const r of rows){const k=[acct(r['账号']),r['账单号'],r['运单号']].join('|');if(!context.has(k))context.set(k,{});for(const f of ['发货日期','分区','计费重LB','币种'])if(clean(r[f])){const c=context.get(k);if(!c[f])c[f]=new Set();c[f].add(r[f]);}}
 return rows.map(r=>{const b={...r},k=[acct(r['账号']),r['账单号'],r['运单号']].join('|');let sv=service(b['服务'])||service(b['费用名称']);const g=groups.get(k);if(!sv&&g?.size===1)sv=[...g][0];if(sv)b['服务']=sv;for(const [f,values]of Object.entries(context.get(k)||{}))if(!clean(b[f])&&values.size===1)b[f]=[...values][0];return b;});
}
function defaultsAudit(rows,options,baseAudit,util){
 const o={contractsActive:true,skipHighVolume:true,...options,tier:'high'},usedRules=[],data=prepare(rows),results=[];const start=util.day(o.effectiveDate),end='2027-02-27';
 const weeks=new Set(data.filter(b=>fee(b['费用名称'])==='fuel').map(b=>{const d=util.day(b['发货日期']);if(!d)return '';const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10);}));
 for(const [i,b]of data.entries()){
  let why='',official=null,off=0,min=0,expected=null,origin='',f=fee(b['费用名称']),sv=service(b['服务']),dt=util.day(f==='fuel'?b['Transaction Date']:b['发货日期']||b['Transaction Date']);
  const isGround=/Ground|HWT/.test(sv),isAir=!!sv&&!isGround,isResi=/Residential/.test(sv)||/resi|住宅/i.test(b['费用名称']),isSaver=sv==='Ground Saver',isHwt=sv==='HWT',z=num(b['分区']),weight=num(b['计费重LB']);
  const q=Object.fromEntries(root.UPSAudit.ruleKeys.map(k=>[k,'']));Object.assign(q,{'规则ID':'DEFAULT-'+(i+1),'账号':b['账号'],'服务':b['服务'],'费用名称':b['费用名称'],'开始日期':dt||'2026-01-01','结束日期':dt||'2026-01-01','方式':'固定净额','最低净额':0});
  let v2=o.contractsActive||!!start&&dt>=start;
  if(!o.contractsActive&&!start)why='第二份合约生效日未确认，请填写后审核';
  else if(!o.contractsActive&&(start<'2026-08-24'||start>end))why='第二份合约生效日不在可验证范围';
  else if(!dt)why=f==='fuel'?'缺少有效Transaction Date，燃油不使用发货日或发票日替代':'缺少有效审核日期（Shipment Date或Transaction Date）';
  else if(!accounts2.includes(acct(b['账号']))||(!v2&&!accounts1.includes(acct(b['账号']))))why='账号未列入该时期合约，需核实适用账号';
  else if(dt>end)why='第二份合约已到期，需更新合约';
  else if(!v2&&(dt<'2026-08-24'||dt>'2026-09-20'&&!o.firstExtended))why='第一份初期4周期限外，需确认延期或后续合约生效日';
  if(!sv)why=why||'无法识别服务；请填写Ground Commercial/Residential或Air服务';
  if(sv==='Ground'&&['base','os','das','edas','remote','peakResi'].includes(f))why=why||'该项需要区分Ground Commercial与Residential';
  const days=start&&dt?Math.floor((new Date(dt)-new Date(start))/86400000):null;
  let tier='high'; // 用户确认所有合约档位均按最优档位，不按货量降档。
  if(!['high','low'].includes(tier))tier='unknown';
  if(f!=='fuel'&&!/^peak/.test(f)&&(dt<'2026-09-07'||dt>'2026-12-31'))why=why||'未内置该发货日期的官网公布价版本（当前为2026-09-07版，限2026年度）';
  const zones=[2,3,4,5,6,7,8];const zi=z===2?0:z===3||z===4?1:z===5||z===6?2:z===7||z===8?3:-1;
  if(f==='base'){
   if(weight===null||!Number.isFinite(weight)||weight<=0)why=why||'缺少有效计费重量';
   if(isHwt){why=why||'HWT整票计费需要Tier04、整票重量及分摊口径；第一份费率已载入规则说明，当前单项明细不足以审核整票最低72美元';origin=C1+' Addendum B p4；第二份p8';}
   else if(!v2){off=0;origin=C1+'未列单包裹基础优惠，按公布价';}
   else {
    if(tier==='unknown')why=why||'第9周起周营业额档位未确认；请选择实际高/低档，门槛文字与表格不一致';
    const high=tier==='high';
    if(sv==='Ground Commercial'){off=(weight<=20?.425:.45)+(high?.281:0);min=(root.UPSOfficialBases['UPS Ground'].rates['1|2'])*.522;}
    else if(sv==='Ground Residential'){off=(weight<=10?.45:weight<=20?.545:weight<=30?.575:.65)+(high?.20:0);min=(root.UPSOfficialBases['UPS Ground'].rates['1|2'])*.5;}
    else if(isSaver){off=(weight<=3?.37:weight<=6?.355:weight<=9?.34:0)+(high?.175:0);why=why||'Ground Saver公布基础费与最低收费表未载入，请使用自定义核实规则';}
    else {const air={NDA:[.812,'UPS NDA',102,.698,.651],'NDA Saver':[.809,'UPS NDA Saver',132,.683,.651],'2DA AM':[.748,'UPS 2DA A.M.',242,.605,.587],'2DA':[.772,'UPS 2DA',202,.598,.597],'3Day':[.76,'UPS 3DA Select',302,.404,.404]};const def=air[sv];if(def){off=high?def[0]:0;const letter=/letter|信封/i.test(b['包装类型']);const table=root.UPSOfficialBases[def[1]];min=(letter?table.letter[String(def[2])]:table.rates['1|'+def[2]])*(1-(letter?def[4]:def[3]));}else if(sv==='NDA Early')off=0;else why=why||'未识别的基础服务';}
    origin=C2+' Exhibit B/C pp7–11；档位=最优档位（用户确认）；基础与档位优惠按百分点相加';
   }
   const name=isGround?'UPS Ground':({NDA:'UPS NDA','NDA Early':'UPS NDA Early','NDA Saver':'UPS NDA Saver','2DA AM':'UPS 2DA A.M.','2DA':'UPS 2DA','3Day':'UPS 3DA Select'})[sv];
   if(!isHwt&&!isSaver){const table=root.UPSOfficialBases[name];const letter=/letter|信封/i.test(b['包装类型']);official=letter?table?.letter[String(z)]:table?.rates[Math.ceil(weight)+'|'+z];}
   const override=isResi?num(o.minResi):num(o.minComm);if(v2&&/^Ground (Commercial|Residential)$/.test(sv)&&override!==null){if(!Number.isFinite(override)||override<0||!clean(o.minimumEvidence))why=why||'最低净额覆盖须填写有效金额和UPS确认依据';else{min=override;origin+='；最低净额覆盖依据：'+o.minimumEvidence;}}
  }else {
   const map={ahsW:[46.5,50.75,56.25,58.75],ahsD:[30,33.25,38.5,40.5],ahsP:[26.75,31,33.25,33.75]};
   if(map[f]){official=map[f][zi];off=v2?(isGround?.85:.40):(isGround?.75:0);}
   else if(f==='os'){official=(isResi?[254.5,274.5,320.5,331]:[219.5,239.5,273,286])[zi];off=v2?(isGround?.85:.4):0;}
   else if(f==='resi'){official=isGround?6.5:7;off=v2?(isGround?.7:.5):0;}
   else if(f==='das'||f==='edas'){official=f==='das'?(isResi?6.55:4.5):(isResi?8.85:5.7);off=v2?(isSaver?.25:isGround?.75:.50):(isHwt?.75:0);if(isHwt)why=why||'HWT DAS/EDAS需整票包裹数和官网整票封顶口径核对，不能按单件误判';}
   else if(f==='remote'){official=16.5;off=v2&&isGround&&isResi?.15:0;}
   else if(f==='sig'||f==='adult'){official=f==='sig'?7.7:9.35;off=v2?.55:0;}
   else if(f==='address')official=25.25;
   else if(f==='ua')official=1875;
   else if(f==='pld')official=4.70;
   else if(f==='refusal')official=24;
   else if(f==='audit'){const count=num(b['更正件数']),total=num(b['更正总金额']);if(count!==null&&total!==null&&count>=0&&total>=0){official=Math.max(count*1.65,total*.12);}else why=why||'官网审计费=max(更正件数×1.65，更正总金额×12%)；需要账号周更正件数及金额，不能仅以账单公布金额为依据';}
   else if(f==='value'){const value=num(b['申报价值']);if(value!==null&&value>=0)official=value<=100?0:value<=300?5.1:Math.ceil(value/100)*1.7;else why=why||'保险/申报价值费需申报货值，不能仅用账单公布金额核验';}
   else if(f==='payment'){const base=num(b['费用基数']);if(base!==null&&base>=0){official=base*.02;off=v2?.5:0;}else why=why||'Payment Processing Fee需该发票适用费用基数';}
   else if(f==='fuel'){
    const history=root.UPSInvoiceFuel?.lookup(dt,sv);const rate=history?history.rate:num(b['公布燃油费率']),manual=num(o.fuelRate),base=num(b['燃油基数']);const effective=rate!==null?rate:manual;
    if(!history&&rate===null&&manual!==null&&weeks.size>1)why=why||'账单包含多周燃油，不能统一使用一个费率';
    const source=history?history.source+'；'+history.start+'～'+history.end+'；'+history.series:clean(b['燃油费率依据'])||clean(o.fuelEvidence);
    const factor=v2?(isSaver?.7:isGround?.6:1):(isGround?.5:1);
    if(!history&&(effective===null||!Number.isFinite(effective)||effective<0||effective>1||!source))why=why||'Transaction Date未覆盖已核实UPS官网燃油历史，需刷新官网历史费率；不沿用最近一周';
    if(base===null||!Number.isFinite(base)||base<0)why=why||'缺少有效净燃油基数；原始Basis Value是公布价基数，不直接使用';
    if(!why){expected=money(base*effective*factor);official=base*effective;}
    off=1-factor;origin=(v2?C2+' Exhibit E p13':C1+' p4')+'；燃油支付比例='+factor+'；日期依据=Transaction Date '+dt+'；官网费率='+effective+'；来源='+source;
   }
   else if(/^peak/.test(f)){
    const peak=dt>='2026-09-27'&&dt<='2027-01-16',top=dt>='2026-11-22'&&dt<='2026-12-26';
    if(f==='peakAHS')official=peak?(top?11.9:8.75):0;
    else if(f==='peakOS')official=peak?(top?117.5:96.25):0;
    else if(f==='peakUA')official=peak?(top?590:530):0;
    else if(f==='peakResi'||f==='peakComm'){const active=dt>='2026-10-25'&&dt<='2027-01-16';official=!active?0:isGround?(f==='peakComm'&&!isSaver?0:top?.75:.5):sv==='NDA'?(top?2.5:1.35):(top?2.5:1.35);}else why=why||'旺季费用类型未识别，请核实普通旺季收费名称；High Volume费用不参与本次审核';
    off=v2&&f!=='peakUA'&&dt<='2027-01-16'?(['peakAHS','peakOS'].includes(f)?.9:.8):0;origin=(v2?C2+' Exhibit E p13；':'合约未列优惠；')+DEMAND;
   }
   else why=why||'未收录该费用的官网计费方式；默认无折扣，需补充该日期官网规则，不能以账单自证公布价';
   origin=origin||(v2?C2+' Exhibit E p13（未列优惠项目0% OFF）':C1+' Addendum B p4（未列优惠项目0% OFF）');
  }
  if((official===null||official===undefined||!Number.isFinite(official))&&expected===null)why=why||'未匹配到有效官网公布价（服务/分区/重量/版本）';
  off=Math.round(off*1000000)/1000000;
  if(expected===null&&Number.isFinite(official))expected=money(Math.max(official*(1-off),money(min)));
  q['固定净额']=expected??'';q['公布金额']=official??'';q['减免比例']=off;q['依据']=origin+'；官网版本2026-09-07；'+TARIFF;
  const excluded=o.skipHighVolume&&(/high[ \-]*volume|higher[ \-]*volume|peaking[ \-]*factor|高货量|高峰系数/i.test(clean(b['费用名称']))||/^(1|true|yes|是)$/i.test(clean(b['是否HighVolume'])));
  const r=baseAudit([{...b,'发货日期':dt}],why?[]:[q],o.tolerance??.02)[0];r['发货日期']=b['发货日期']||'';r['Transaction Date']=b['Transaction Date']||'';r['审核日期来源']=f==='fuel'?'Transaction Date':b['发货日期']?'Shipment Date':'Transaction Date（缺少Shipment Date）';if(f==='fuel'){const matched=root.UPSInvoiceFuel?.lookup(dt,sv);r['官网燃油费率']=matched?.rate??'';r['官网燃油适用周']=matched?matched.start+' ~ '+matched.end:'';r['净燃油基数']=b['燃油基数']??'';r['燃油基数依据']=b['燃油基数依据']||'';r['原始燃油Basis Value']=b['原始燃油Basis Value']??'';}
  r['官网公布金额']=official??'';r['默认减免比例']=off;r['最低净额依据']=min?money(min):0;r['规则来源']=v2?'第二份优先，第一份补充':'第一份';
  if(excluded){r['状态']='不参与审核';r['合约应收']='';r['差额']='';r['原因']='按用户设置，不计算High Volume高货量旺季费用；原实收保留，不计入通过或多收';r['依据']='用户设置：合约已生效，跳过High Volume';}else if(why){r['状态']='待核实';r['差额']='';r['原因']=why;r['依据']=q['依据'];}else usedRules.push(q);
  results.push(r);
 }
 const seen=new Map();data.forEach((b,i)=>{const k=JSON.stringify(root.UPSAudit.keys.map(k=>clean(b[k])));if(!seen.has(k))seen.set(k,[]);seen.get(k).push(i);});for(const ids of seen.values())if(ids.length>1)for(const i of ids){results[i]['状态']='待核实';results[i]['差额']='';results[i]['原因']+='；完全相同费用行重复，需核实';}
 return {results,rules:usedRules,rows:data};
}
root.UPSContractDefaults={catalog,accounts2,defaultsAudit,prepare,service,fee,metadata:{firstEffective:'2026-08-24',secondEffective:'',secondEnd:'2027-02-27',tariffStart:'2026-09-07',tariffEnd:'2026-12-31',officialURL:TARIFF,demandURL:DEMAND}};
})(typeof window==='undefined'?globalThis:window);
