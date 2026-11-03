import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const dir=new URL('../assets/',import.meta.url),ctx=vm.createContext({console,TextEncoder,TextDecoder,Date,Map,Set,Number,Math,JSON,setTimeout,clearTimeout,Uint8Array,ArrayBuffer});
for(const name of ['finance-02.js','finance-03.js','finance-04.js','finance-05.js','finance-10.js','finance-11.js','finance-15.js','fedex-customer-policy.js','fedex-overrides.js','finance-16.js','finance-20.js','finance-21.js','finance-33.js','billing-weight-policy.js'])vm.runInContext(fs.readFileSync(new URL(name,dir),'utf8'),ctx,{filename:name});
const X=ctx.XLSX;
const wb=(sheets,tariff)=>{const w=X.utils.book_new();for(const[name,rows]of Object.entries(sheets))X.utils.book_append_sheet(w,X.utils.json_to_sheet(rows),name);w.tariff=tariff;return w;};
const rates={};for(let w=1;w<=150;w++)for(let z=2;z<=8;z++)rates[w+'|'+z]=w;
const A=Array(4).fill(1);
const tariff={base:rates,dim:275,factor:.7,resi:1,sig:1,ahs:A,os:A,das:1,edas:1,address:1,demand:{start:'2026-09-26',end:'2027-01-15',ahs:1,os:1,unauthorized:1},resiDemand:{start:'2026-10-24',end:'2027-01-15',fee:1}};
const fed={factor:.7,ngbase:rates,spbase:rates,dim:250,resi:1,ahsD:A,ahsW:A,ahsP:A,os:A,dasR:1,dasC:1,edasR:1,edasC:1,remoteR:1,remoteC:1,indirect:1,direct:1,adult:1,address:1,declaredMin:1,declaredPer100:1,demand:[],resiDemand:[],sp:{fuel:.7,dim:139,delivery:1,nonMach:1,das:1,edas:1,relabel:1,demand:[]}};
const ups={...fed,base:rates,dim:250,resi:A,dasR:A,dasC:A,edasR:A,edasC:A,remoteR:A,remoteC:A,indirect:A,direct:A,adult:A,address:A,os:A,unauthorized:A};
ctx.ShipGridStandardQuotes={is:()=>true,parse:w=>w.tariff};
const g0={'订单ID':'ORDER','客户ID':'C1','订单号':'O1','转单号':'TEST','件数':1,'下单实重':1,'下单长':2.54,'下单宽':2.54,'下单高':2.54,'分区':2,'计费重':'not-a-number'};
const r0={'Waybill#/tracking#':'TEST','Cust Lbs':10,Weight:10,DIML:1,DIMW:1,DIMH:1,Zone:2,ServiceCharge:10,'Fuel Surcharge':2,TotalCharge:12,'Ship date':'2026-10-10'};
function ontrac(g={},r={},t=tariff){const result=ctx.OnTracBilling.calculate(wb({'原始':[{...r0,...r}],'GTS':[{...g0,...g}]}),wb({},t));assert.equal(result.errors.length,0,JSON.stringify(result.errors));return result.rows[0];}
let checks=0;function ok(fn){fn();checks++;}
ok(()=>assert.equal(ontrac().billed,10));
ok(()=>assert.equal(ontrac({'下单实重':11,'重量单位':'lb'}).billed,11));
ok(()=>assert.equal(ontrac({'计费重':999999}).billed,ontrac({'计费重':null}).billed));
ok(()=>assert.equal(ontrac({'下单长':25.400001,'下单宽':25.400001,'下单高':25.400001},{Weight:1,'Cust Lbs':1}).billed,5));
ok(()=>assert.equal(ontrac({'下单长':125,'下单宽':10,'下单高':10},{Weight:1,'Cust Lbs':1}).billed,40));
ok(()=>assert.equal(ontrac({}, {DIML:80}).billed,90));
ok(()=>{const t={...tariff,base:{...rates,'10|2':50,'11|2':20}};const row=ontrac({'下单实重':11,'重量单位':'lb'},{},t);assert.equal(row.billed,11);assert.equal(row.base,50);assert.ok(row.data.some(v=>String(v).includes('价格保护')));});
ok(()=>{const row=ontrac({'下单实重':null});assert.equal(row.billed,10);assert.match(row.warnings,/GTS实重缺失/);});
ok(()=>{const row=ontrac({'下单长':null});assert.equal(row.billed,10);assert.match(row.warnings,/尺寸不完整/);});
const f0={'Express or Ground Tracking ID':'TEST','Service Type':'Ground','Number of Pieces':1,'Transportation Charge Amount':10,'Net Charge Amount':12,'Actual Weight Amount':10,'Actual Weight Units':'lbs','Rated Weight Amount':10,'Rated Weight Units':'lbs','Dim Length':1,'Dim Width':1,'Dim Height':1,'Dim Unit':'I','Zone Code':2,'Tendered Date':'2026-10-10','Shipment Date':'2026-10-10'};
function fedex(g={},r={},t=fed,expectError=false,overrides=null,customerRules=[]){const obj={...f0,...r},cp=obj.__charges||[['Fuel Surcharge',2]];delete obj.__charges;const keys=Object.keys(obj),header=[...keys],row=keys.map(k=>obj[k]);for(let i=0;i<40;i++){header.push('Tracking ID Charge Description','Tracking ID Charge Amount');row.push(cp[i]?.[0]??null,cp[i]?.[1]??null);}
 const w=X.utils.book_new();X.utils.book_append_sheet(w,X.utils.aoa_to_sheet([header,row]),'原始');const result=ctx.FedExBilling.calculate(w,wb({'GTS':[{...g0,...g}]}),wb({},t),{originalFuelFactor:.7,overrideWb:overrides?wb({'覆盖':overrides}):null,customerRules});if(expectError)return result;assert.equal(result.errors.length,0,JSON.stringify(result.errors));return result.rows[0];}
ok(()=>assert.equal(fedex().billed,10));
ok(()=>assert.equal(fedex({'下单实重':11,'重量单位':'lb'}).billed,11));
ok(()=>assert.equal(fedex({'计费重':999999}).billed,fedex({'计费重':null}).billed));
ok(()=>assert.equal(fedex({'下单长':25.400001,'下单宽':25.400001,'下单高':25.400001},{'Rated Weight Amount':1,'Actual Weight Amount':1}).billed,6));
ok(()=>assert.equal(fedex({'下单长':125,'下单宽':10,'下单高':10},{'Rated Weight Amount':1,'Actual Weight Amount':1}).billed,40));
ok(()=>assert.equal(fedex({'下单实重':null}).billed,10));
ok(()=>assert.equal(fedex({'下单长':null}).billed,10));
ok(()=>assert.equal(fedex({'计费重':999999},{'Service Type':'Ground Economy'}).billed,10));
ok(()=>assert.equal(fedex({'件数':2},{},fed,true).rows.length,0));
ok(()=>assert.equal(fedex({'重量单位':'stone'},{},fed,true).rows.length,0));
const u0={'Tracking Number':'TEST','Account Number':'2K28F3','Invoice Number':'INV','Charge Category Code':'SHP','Charge Classification Code':'FRT','Charge Description':'Ground Commercial','Transaction Date':'2026-10-10','Transaction Currency Code':'USD','Net Amount':10,'Incentive Amount':0,'Entered Weight':10,'Entered Weight Unit of Measure':'L','Billed Weight':10,'Billed Weight Unit of Measure':'L','Package Dimensions':'1 x 1 x 1','Package Dimension Unit Of Measure':'I',Zone:2,'Lead Shipment Number':'TEST'};
function upsb(g={},raw=[u0],expectError=false){const result=ctx.UPSBilling.calculate(wb({'原始':raw}),g===null?null:wb({'GTS':[{...g0,...g}]}),wb({},{comm:ups,resi:ups}));if(expectError)return result;assert.equal(result.errors.length,0,JSON.stringify(result.errors));return result.rows[0];}
ok(()=>assert.equal(upsb().billed,10));
ok(()=>assert.equal(upsb({'下单实重':11,'重量单位':'lb'}).billed,11));
ok(()=>assert.equal(upsb({'计费重':999999}).billed,upsb({'计费重':null}).billed));
ok(()=>assert.equal(upsb({'下单长':25.400001,'下单宽':25.400001,'下单高':25.400001},[{...u0,'Billed Weight':1,'Entered Weight':1}]).billed,6));
ok(()=>{const change={...u0,'Charge Category Code':'ADJ','Charge Description':'Shipping Charge Correction Ground','Package Dimensions':'','Billed Weight':15,'Transaction Date':'2026-10-11','Net Amount':2};assert.equal(upsb({},[u0,change]).billed,15);});
ok(()=>{const c={...u0,'Charge Category Code':'ADJ','Charge Description':'Shipping Charge Correction Ground','Package Dimensions':'','Billed Weight':15,'Transaction Date':'2026-10-11','Net Amount':2};assert.equal(upsb({},[u0,c,{...c,'Billed Weight':16}],true).rows.length,0);});
ok(()=>assert.equal(upsb(null).billed,10));
ok(()=>assert.equal(upsb({'下单长':null}).billed,10));
ok(()=>assert.equal(upsb({'件数':2},[u0],true).rows.length,0));
ok(()=>assert.equal(upsb({},[{...u0,'Charge Description':'Ground Hundredweight'}]).billed,10));
const settings={weightUnit:'kg',dimUnit:'cm'};
ok(()=>assert.equal(ctx.OnTracEngine.selected(r0,g0,settings).bw,10));
ok(()=>assert.equal(ctx.OnTracEngine.selected(r0,{...g0,'下单实重':11,'重量单位':'lb'},settings).bw,11));
ok(()=>assert.equal(ctx.OnTracEngine.selected(r0,{...g0,'计费重':999999},settings).bw,ctx.OnTracEngine.selected(r0,{...g0,'计费重':null},settings).bw));
ok(()=>assert.equal(ctx.OnTracEngine.selected({...r0,Weight:1},{...g0,'下单长':25.400001,'下单宽':25.400001,'下单高':25.400001},settings).bw,5));
// Direct policy boundaries: no truncation, per-service coefficients and whole-set fallback.
ok(()=>assert.throws(()=>ctx.ShipGridWeightPolicy.prepare(g0,{rawBilled:null,rawActual:1,rawDims:[1,1,1],divisor:250}),/原始最终计费重/));
ok(()=>assert.throws(()=>ctx.ShipGridWeightPolicy.prepare({...g0,'下单长':-1},{rawBilled:1,rawActual:1,rawDims:[1,1,1],divisor:250}),/正数/));
ok(()=>{const x=ctx.ShipGridWeightPolicy.prepare({...g0,'下单长':1,'下单宽':1,'下单高':1,'尺寸单位':'in','下单实重':1,'重量单位':'lb'},{rawBilled:1,rawActual:1,rawDims:[10,10,10],divisor:250});assert.equal(x.gtsDim,1);assert.equal(x.maximum,1);});
ok(()=>{
 const gts=wb({'GTS':[g0]}),ot=ctx.OnTracBilling.calculate(wb({'原始':[r0],'GTS':[g0]}),wb({},tariff));
 assert.equal(ot.rows[0].data.length,ot.headers.length);
 const otBytes=ctx.OnTracBilling.bytes(ot);assert.ok(X.read(otBytes,{type:'array'}).SheetNames.length>1);
 const ur=ctx.UPSBilling.calculate(wb({'原始':[u0]}),gts,wb({},{comm:ups,resi:ups}));
 assert.equal(ur.rows[0].data.length,ur.headers.length);
 assert.equal(ur.rows[0].data[ur.headers.indexOf('原始最终计费重LB')],10);
 const ub=ctx.UPSBilling.bytes(ur);assert.ok(X.read(ub,{type:'array'}).SheetNames.includes('UPS客户账单'));
});
ok(()=>{
 const input=wb({'原始':[{...r0,DIML:20,DIMW:20,DIMH:20}],'GTS':[]});
 const result=ctx.OnTracEngine.calculate(input,ctx.ShipGridDefaultRates.A.wb,ctx.ShipGridDefaultRates.B.wb,{...ctx.OnTracEngine.defaultSettings});
 assert.equal(result.rows.length,1,JSON.stringify(result.errors));assert.equal(result.rows[0].billed,10);
 assert.ok(result.rows[0].warnings);assert.ok(ctx.OnTracEngine.workbook(result).SheetNames.includes('订单成本明细'));
});
ok(()=>{
 const result=ctx.OnTracEngine.calculate(wb({'原始':[{...r0,Weight:200,'Unauthorized Package':5}],'GTS':[g0]}),ctx.ShipGridDefaultRates.A.wb,ctx.ShipGridDefaultRates.B.wb,{...ctx.OnTracEngine.defaultSettings});
 assert.equal(result.rows.length,1,JSON.stringify(result.errors));assert.equal(result.rows[0].billed,3);assert.equal(result.rows[0].provisional,true);
});
ok(()=>{
 const vctx=vm.createContext({console});vm.runInContext(fs.readFileSync(new URL('vue.global.prod.js',dir),'utf8'),vctx);
 const shell=fs.readFileSync(new URL('finance-shell.html',dir),'utf8');
 assert.equal(typeof vctx.Vue.compile('<div>'+shell+'</div>',{decodeEntities:s=>s}),'function');
});
ok(()=>{
 const fr=fedex({}, {},fed,true);assert.equal(fr.errors.length,0,JSON.stringify(fr.errors));
 assert.equal(fr.rows[0].data.length,fr.headers.length);
 const bytes=ctx.FedExBilling.bytes(fr);const exported=X.read(bytes,{type:'array'});
 assert.ok(exported.SheetNames.length>=3);
});
ok(()=>assert.equal(fedex({}, {'Actual Weight Amount':151},fed,true).rows.length,0));
ok(()=>assert.equal(ctx.OnTracEngine.selected({...r0,'Cust Lbs':151},g0,settings).bw,10));
ok(()=>{
 const result=ctx.OnTracBilling.calculate(wb({'原始':[{...r0,'Cust Lbs':151}],'GTS':[g0]}),wb({},tariff));
 assert.equal(result.rows.length,0);assert.match(result.errors[0].reason,/超限/);
});
// V3.54: slash service and Net Charge as authoritative original total.
ok(()=>{const a=fedex(),b=fedex({}, {'Service Type':'/'});assert.equal(a.total,b.total);assert.equal(b.service,'/');assert.match(b.warnings,/同价表/);});
ok(()=>{const a=fedex(),b=fedex({}, {'Transportation Charge Amount':0});assert.equal(a.total,b.total);assert.equal(b.originalNet,12);assert.equal(b.originalBase,10);});
ok(()=>assert.equal(fedex({}, {'Transportation Charge Amount':null}).billed,10));
ok(()=>assert.equal(fedex({}, {'Transportation Charge Amount':''}).base,10));
ok(()=>assert.equal(fedex({}, {'Transportation Charge Amount':'invalid'}).base,10));
ok(()=>{const x=fedex({}, {'Service Type':' / ','Transportation Charge Amount':0});assert.equal(x.base,10);assert.equal(x.originalBase,10);});
ok(()=>{const x=fedex({}, {'Transportation Charge Amount':99});assert.equal(x.originalNet,12);assert.equal(x.base,10);assert.match(x.warnings,/Net Charge Amount为准/);});
ok(()=>assert.equal(fedex({}, {'Net Charge Amount':0},fed,true).rows.length,0));
ok(()=>assert.equal(fedex({}, {'Net Charge Amount':-12},fed,true).rows.length,0));
ok(()=>assert.equal(fedex({}, {'Transportation Charge Amount':0,'Net Charge Amount':1},fed,true).rows.length,0));
ok(()=>assert.equal(fedex({}, {'Service Type':'Priority Overnight'},fed,true).rows.length,0));
ok(()=>{const x=fedex({}, {'Service Type':'/','Transportation Charge Amount':0,'Net Charge Amount':13,__charges:[['Fuel Surcharge',2],['Residential Delivery',1]]});assert.equal(x.fees['Residential Delivery'],1);assert.equal(x.originalBase,10);});
ok(()=>{const x=fedex({}, {'Transportation Charge Amount':15,__charges:[['Fuel Surcharge',2],['Grace Discount',-5]]});assert.equal(x.originalBase,10);assert.equal(x.originalNet,12);assert.equal(x.base,10);});
ok(()=>{const fr=fedex({}, {'Service Type':'/','Transportation Charge Amount':0},fed,true);assert.equal(fr.errors.length,0);assert.equal(fr.rows[0].data[fr.headers.indexOf('Transportation Charge Amount')],fr.rows[0].base);assert.ok(X.read(ctx.FedExBilling.bytes(fr),{type:'array'}).SheetNames.length>1);});
console.log(checks+' billing integration/policy regression scenarios passed (OnTrac/FedEx/UPS/A-B, missing/invalid GTS billed weight, unit/ceil, corrected weights, minima, price protection and multi-piece guards).');
// UPS AHS minimum: effective date boundary and original shipment dating.
const savedLookup=ctx.UPSInvoiceFuel.lookup;ctx.UPSInvoiceFuel.lookup=()=>({rate:.2925});
const dimensionRow=(day,extra={})=>({...u0,'Shipment Date':day,'Transaction Date':day,'Package Dimensions':'49 x 2 x 2',...extra});
ok(()=>assert.equal(upsb(null,[dimensionRow('2026-12-20')]).billed,40));
ok(()=>assert.equal(upsb(null,[dimensionRow('2026-12-21')]).billed,50));
ok(()=>assert.equal(upsb(null,[dimensionRow('2026-12-22')]).billed,50));
ok(()=>assert.equal(upsb(null,[dimensionRow('2026-12-20',{'Transaction Date':'2027-01-10'})]).billed,40));
ok(()=>assert.equal(upsb(null,[dimensionRow('2026-12-21',{'Billed Weight':60})]).billed,60));
ok(()=>assert.equal(upsb(null,[dimensionRow('2026-12-21',{'Package Dimensions':'97 x 2 x 2'})]).billed,90));
ok(()=>assert.equal(upsb(null,[{...u0,'Shipment Date':'2026-12-21','Transaction Date':'2026-12-21'}]).billed,10));
ok(()=>{const r=upsb(null,[dimensionRow('2026-12-21',{'Shipment Date':''})]);assert.equal(r.billed,50);assert.match(r.warnings,/Shipment Date缺失/);});
ok(()=>assert.equal(upsb(null,[dimensionRow('invalid')],true).rows.length,0));
ok(()=>{const r=upsb(null,[dimensionRow('2026-12-21')]);assert.match(r.provenance,/AHS尺寸最低计费重50LB/);assert.equal(r.base,50);});
ctx.UPSInvoiceFuel.lookup=savedLookup;
console.log('10 UPS AHS effective-date boundary, late billing, higher weight, OS and audit-trace scenarios passed');

const ov=(extra={})=>({'承运商':'FedEx','客户ID':'C1','运单号':'TEST','计费重量':'','重量单位':'','分区':'',...extra});
ok(()=>assert.equal(fedex({}, {},fed,false,[ov({'计费重量':5,'重量单位':'LB'})]).billed,5));
ok(()=>{const r=fedex({}, {},fed,false,[ov({'分区':3})]);assert.equal(r.zone,3);assert.equal(r.billed,10);});
ok(()=>{const r=fedex({}, {},fed,false,[ov({'计费重量':7,'重量单位':'LB','分区':4})]);assert.equal(r.zone,4);assert.equal(r.base,7);assert.match(r.provenance,/覆盖表第2行/);});
ok(()=>assert.equal(fedex({}, {'Service Type':'Ground Economy'},fed,false,[ov({'分区':5})]).zone,5));
ok(()=>{const t={...fed,ngbase:{...rates,'5.25|2':8}};assert.equal(fedex({}, {},t,false,[ov({'计费重量':5.25,'重量单位':'LB'})]).billed,5.25);});
ok(()=>assert.equal(fedex({}, {},fed,true,[ov({'计费重量':5.25,'重量单位':'LB'})]).errors.length,1));
ok(()=>assert.equal(fedex({}, {},fed,true,[ov({'计费重量':5,'重量单位':'KG'})]).errors.length,1));
ok(()=>assert.equal(fedex({}, {},fed,true,[ov({'分区':3,'运单号':'OTHER'})]).errors.length,1));
ok(()=>assert.equal(fedex({}, {},fed,true,[ov({'分区':3,'客户ID':'OTHER'})]).rows[0].zone,2));
ok(()=>assert.equal(fedex({}, {'Dim Length':49},fed,true,[ov({'计费重量':5,'重量单位':'LB'})]).rows.length,0));
assert.throws(()=>fedex({}, {},fed,false,[ov({'分区':3}),ov({'分区':4})]),/重复/);
assert.throws(()=>fedex({}, {},fed,false,[ov({'分区':9})]),/2–8/);
assert.throws(()=>fedex({}, {},fed,false,[ov({'计费重量':5})]),/LB或KG/);
assert.throws(()=>fedex({}, {},fed,false,[ov({'运单号':123,'分区':3})]),/文本/);
console.log('14 FedEx override scenarios passed: independent fields, authority, decimals, customer isolation, duplicates, invalid values, unmatched rows and minimum guards');

const cp=(extra={})=>({id:'RULE',carrier:'fedex',customerId:'C1',customerName:'',quoteId:'Q',...extra});
ok(()=>{const r=fedex({'分区':7},{'Zone Code':3},fed,false,null,[cp({fedexZone:'spGtsOtherRaw',fedexWeight:'raw'})]);assert.equal(r.zone,3);assert.equal(r.billed,10);});
ok(()=>assert.equal(fedex({'分区':7},{'Zone Code':3,'Service Type':'Ground Economy'},fed,false,null,[cp({fedexZone:'spGtsOtherRaw'})]).zone,7));
ok(()=>assert.equal(fedex({'分区':7},{'Zone Code':3},fed,false,null,[cp()]).zone,7));
ok(()=>assert.equal(fedex({'下单实重':50,'重量单位':'lb'}, {},fed,false,null,[cp({fedexWeight:'raw'})]).billed,10));
ok(()=>{const t={...fed,ngbase:{...rates,'10.25|2':12}};const r=fedex({}, {'Rated Weight Amount':10.254},t,false,null,[cp({fedexWeight:'raw',fedexPrecision:'two'})]);assert.equal(r.billed,11);assert.equal(r.base,11);});
ok(()=>assert.equal(fedex({}, {'Rated Weight Amount':10.254},fed,false,null,[cp({fedexWeight:'raw'})]).billed,11));
ok(()=>assert.equal(fedex({'分区':7}, {'Zone Code':3},fed,false,null,[cp({fedexZone:'gts'})]).zone,7));
ok(()=>assert.equal(fedex({'分区':''}, {},fed,true,null,[cp({fedexZone:'gts'})]).rows.length,0));
ok(()=>assert.equal(fedex({}, {'Dim Length':49},fed,false,null,[cp({fedexWeight:'raw'})]).billed,40));
ok(()=>assert.equal(fedex({'下单实重':50,'重量单位':'lb'}, {},fed,false,[ov({'计费重量':5,'重量单位':'LB'})],[cp({fedexWeight:'raw'})]).billed,5));
ok(()=>assert.equal(fedex({}, {},fed,false,null,[cp({customerId:'OTHER',fedexZone:'raw'})]).billed,10));
ok(()=>assert.equal(fedex({'分区':7}, {},fed,true,null,[cp({fedexZone:'invalid'})]).rows.length,0));
console.log('12 FedEx per-customer dropdown policy tests passed: easyprint, SmartPost, decimal weight, precision, missing source, minima, override precedence and customer isolation');

const twoPolicy=[cp({fedexPrecision:'two'})];
for(const [converted,expected] of [[10.003,10],[10.009,10],[10.01,11],[10.999,11],[10,10]]){
 const r=fedex({'下单实重':converted/2.2046226218487757,'重量单位':'kg'}, {},fed,false,null,twoPolicy);assert.equal(r.billed,expected);
}
assert.equal(fedex({'下单实重':10.003/2.2046226218487757,'重量单位':'kg'}).billed,11);
assert.equal(fedex({'下单实重':10.003/2.2046226218487757,'重量单位':'kg'},{'Rated Weight Amount':12},fed,false,null,twoPolicy).billed,12);
assert.equal(fedex({'下单实重':50.003/2.2046226218487757,'重量单位':'kg'}, {},fed,false,null,twoPolicy).ahsType,'');
assert.equal(fedex({'下单实重':50.01/2.2046226218487757,'重量单位':'kg'}, {},fed,false,null,twoPolicy).ahsType,'W');
console.log('9 GTS KG-to-LB truncate-then-ceil checks passed, including 0.003/0.009/0.01 tails, raw weight priority and AHS weight boundary');
