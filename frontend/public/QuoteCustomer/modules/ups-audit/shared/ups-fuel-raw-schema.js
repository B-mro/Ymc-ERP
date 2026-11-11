/*SG-AUDIT:finance-21.js*/(function(root){
'use strict';
const SOURCE='https://www.ups.com/us/en/support/shipping-support/shipping-costs-rates/fuel-surcharges';
const FSC_SOURCE='https://assets.ups.com/adobe/assets/urn:aaid:aem:7ddafaf6-0ce6-4428-b169-4b27311a1797/original/as/fsc-applicable-charges-us-en.pdf';
const clean=v=>String(v??'').trim();
const number=v=>clean(v)===''?null:Number(clean(v).replace(/[$,]/g,''));
function lookup(date,sv){
 const r=(root.UPSOfficialFuel?.rates||[]).find(r=>date>=r.start&&date<=r.end);if(!r)return null;
 const ground=/Ground|HWT/.test(sv),air=/^(NDA|2DA|3Day)/.test(sv);if(!ground&&!air)return null;
 return {rate:ground?r.ground:r.air,start:r.start,end:r.end,source:root.UPSOfficialFuel.source,fetchedAt:root.UPSOfficialFuel.fetchedAt,series:ground?'Domestic Ground':'Domestic Air'};
}
const headerlessSchema=["Version", "Recipient Number", "Account Number", "Account Country/Territory", "Invoice Date", "Invoice Number", "Invoice Type Code", "Invoice Type Detail Code", "Account Tax ID", "Invoice Currency Code", "Invoice Amount", "Transaction Date", "Pickup Record Number", "Lead Shipment Number", "World Ease Number", "Shipment Reference Number 1", "Shipment Reference Number 2", "Bill Option Code", "Package Quantity", "Oversize Quantity", "Tracking Number", "Package Reference Number 1", "Package Reference Number 2", "Package Reference Number 3", "Package Reference Number 4", "Package Reference Number 5", "Entered Weight", "Entered Weight Unit of Measure", "Billed Weight", "Billed Weight Unit of Measure", "Container Type", "Billed Weight Type", "Package Dimensions", "Zone", "Charge Category Code", "Charge Category Detail Code", "Charge Source", "Type Code 1", "Type Detail Code 1", "Type Detail Value 1", "Type Code 2", "Type Detail Code 2", "Type Detail Value 2", "Charge Classification Code", "Charge Description Code", "Charge Description", "Charged Unit Quantity", "Basis Currency Code", "Basis Value", "Tax Indicator", "Transaction Currency Code", "Incentive Amount", "Net Amount", "Miscellaneous Currency Code", "Miscellaneous Incentive Amount", "Miscellaneous Net Amount", "Alternate Invoicing Currency Code", "Alternate Invoice Amount", "Invoice Exchange Rate", "Tax Variance Amount", "Currency Variance Amount", "Invoice Level Charge", "Invoice Due Date", "Alternate Invoice Number", "Store Number", "Customer Reference Number", "Sender Name", "Sender Company Name", "Sender Address Line 1", "Sender Address Line 2", "Sender City", "Sender State", "Sender Postal", "Sender Country/Territory", "Receiver Name", "Receiver Company Name", "Receiver Address Line 1", "Receiver Address Line 2", "Receiver City", "Receiver State", "Receiver Postal", "Receiver Country/Territory", "Third Party Name", "Third Party Company Name", "Third Party Address Line 1", "Third Party Address Line 2", "Third Party City", "Third Party State", "Third Party Postal", "Third party Country/Territory", "Sold To Name", "Sold To Company Name", "Sold To Address Line 1", "Sold To Address Line 2", "Sold To City", "Sold To State", "Sold To Postal", "Sold to Country/Territory", "Miscellaneous Address Qual 1", "Miscellaneous Address 1 Name", "Miscellaneous Address 1 Company Name", "Miscellaneous Address 1 Address Line 1", "Miscellaneous Address 1 Address Line 2", "Miscellaneous Address 1 City", "Miscellaneous Address 1 State", "Miscellaneous Address 1 Postal", "Miscellaneous address 1 Country/Territory", "Miscellaneous Address Qual 2", "Miscellaneous Address 2 Name", "Miscellaneous Address 2 Company Name", "Miscellaneous Address 2 Address Line 1", "Miscellaneous Address 2 Address Line 2", "Miscellaneous Address 2 City", "Miscellaneous Address 2 State", "Miscellaneous Address 2 Postal", "Miscellaneous address 2 Country/Territory", "Shipment Date", "Shipment Export Date", "Shipment Import Date", "Entry Date", "Direct Shipment Date", "Shipment Delivery Date", "Shipment Release Date", "Cycle Date", "EFT Date", "Validation Date", "Entry Port", "Entry Number", "Export Place", "Shipment Value Amount", "Shipment Description", "Entered Currency Code", "Customs Number", "Exchange Rate", "Master Air Waybill Number", "EPU", "Entry Type", "CPC Code", "Line Item Number", "Goods Description", "Entered Value", "Duty Amount", "Weight", "Unit of Measure", "Item Quantity", "Item Quantity Unit of Measure", "Import Tax ID", "Declaration Number", "Carrier Name/Clinical Trial Identification Number/SDS ID ", "CCCD Number", "Cycle Number", "Foreign Trade Reference Number", "Job Number", "Transport Mode", "Tax Type", "Tariff Code", "Tariff Rate", "Tariff Treatment Number", "Contact Name", "Class Number", "Document Type", "Office Number", "Document Number", "Duty Value", "Total Value for Duty", "Excise Tax Amount", "Excise Tax Rate", "GST Amount", "GST Rate", "Order In Council", "Origin Country/Territory", "SIMA Access", "Tax Value", "Total Customs Amount", "Miscellaneous Line 1", "Miscellaneous Line 2", "Miscellaneous Line 3", "Miscellaneous Line 4", "Miscellaneous Line 5", "Payor Role Code", "Miscellaneous Line 7", "Miscellaneous Line 8", "Miscellaneous Line 9", "Miscellaneous Line 10", "Miscellaneous Line 11", "Duty Rate", "VAT Basis Amount", "VAT Amount", "VAT Rate", "Other Basis Amount", "Other Amount", "Other Rate", "Other Customs Number Indicator", "Other Customs Number", "Customs Office Name", "Package Dimension Unit Of Measure", "Original Shipment Package Quantity", "Corrected Zone", "Tax Law Article Number", "Tax Law Article Basis Amount", "Original tracking number", "Scale weight quantity", "Scale Weight Unit of Measure", "Raw dimension unit of measure", "Raw dimension length", "BOL # 1", "BOL # 2", "BOL # 3", "BOL # 4", "BOL # 5", "PO # 1", "PO # 2", "PO # 3", "PO # 4", "PO # 5", "PO # 6", "PO # 7", "PO # 8", "PO # 9", "PO # 10", "NMFC", "Detail Class", "Freight Sequence Number", "Declared Freight Class", "EORI Number", "Detail Keyed Dim", "Detail Keyed Unit of Measure", "Detail Keyed Billed Dimension", "Detail Keyed Billed Unit of Measure", "Original Service Description", "Promo Discount Applied Indicator", "Promo Discount Alias", "SDS Match Level Cd", "SDS RDR Date", "SDS Delivery Date", "SDS Error Code", "Place Holder 46", "Place Holder 47", "Place Holder 48", "SCC Scale Weight", "Senders State Decode", " Receivers State Decode", "Scheduled Delivery Date", "Tax Rounding Amount", "Account Tax Message Indicator", " Third party State Decode", "Sold to Address State Decode", "Miscellaneous State 1 Decode", "Miscellaneous State 2 Decode", "Tax Type 1", "Tax ID 1", "Tax Type 2", "Tax ID 2", "Tax Type 3", "Tax ID 3", "Placeholder field 1", "Placeholder field 2", "Placeholder field 3", "Placeholder field 4", "Placeholder field 5", "Placeholder field 6", "Placeholder field 7", "Placeholder field 8", "Placeholder field 9", "Placeholder field 10", "Placeholder field 11", "Placeholder field 12", "Placeholder field 13", "Placeholder field 14", "Placeholder field 15"];
function isHeaderless(r){return r&&r.length===headerlessSchema.length&&String(r[0])==='2.1'&&/^[A-Z]{2}$/.test(String(r[3]))&&/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(String(r[4]))&&/^[A-Z]{3}$/.test(String(r[9]))&&/^[A-Z]{3}$/.test(String(r[34]))&&Number.isFinite(Number(r[52]))&&String(r[5]).length>=10;}
function fuelDate(row,related=[],util=root.UPSAudit){
 const parse=v=>{if(v===null||v===undefined||clean(v)==='')return '';let x=v;if(typeof x==='string')x=x.trim().replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/,'$1-$2-$3');try{return util?.day?util.day(x)||'':'';}catch{return '';}};
 const trans=parse(row['Transaction Date']);if(trans)return {date:trans,source:'Transaction Date'};
 const pick=r=>{for(const key of ['Pickup Date','PUDate','PU Date','Shipment Date','发货日期']){const date=parse(r[key]);if(date)return {date,source:'Pickup Date'+(key==='Shipment Date'?'（Shipment Date）':'')};}return null;};
 const own=pick(row);if(own)return own;
 const sameEvent=related.filter(r=>!clean(row['Charge Category Code'])||r['Charge Category Code']===row['Charge Category Code']);
 const dates=[...new Set(sameEvent.map(r=>parse(r['Transaction Date'])).filter(Boolean))];
 if(dates.length===1)return {date:dates[0],source:'Transaction Date（同运单同费用类别）'};
 const candidates=sameEvent.map(pick).filter(Boolean),picks=[...new Set(candidates.map(v=>v.date))];
 return picks.length===1?{date:picks[0],source:'Pickup Date（同运单同费用类别）'}:{date:'',source:picks.length>1||dates.length>1?'同运单日期冲突，无法唯一确定':'Transaction Date及Pickup Date均缺失或无效'};
}
function fuelReason(rows,related=[],sv='Ground'){
 if(!rows.length)return '账单未列燃油收费行';
 const dates=rows.map(r=>fuelDate(r,related));if(dates.some(d=>!d.date))return [...new Set(dates.filter(d=>!d.date).map(d=>d.source))].join('；');
 const rates=dates.map(d=>lookup(d.date,sv));if(rates.some(r=>!r))return '官网燃油历史未覆盖所选日期：'+dates.filter((d,i)=>!rates[i]).map(d=>d.source+'='+d.date).join(' / ');
 if(rates.some(r=>r.rate!==rates[0].rate))return '同收费组跨周且费率不同，需分事件核对';return '';
}
function isRaw(headers){return ['Transaction Date','Tracking Number','Charge Description','Net Amount'].every(x=>headers.includes(x));}
function key(r){return [clean(r['Account Number']),clean(r['Invoice Number']),clean(r['Tracking Number']),clean(r['Transaction Date']),clean(r['Charge Category Code'])].join('|');}
function eligible(r){
 const name=clean(r['Charge Description']).replace(/addl\.?\s*handling/ig,'Additional Handling'),code=clean(r['Charge Classification Code']);
 if(code==='FSC'||/fuel/i.test(name))return false;
 if(code==='FRT')return true;
 return /additional handling|address correction|chargeback|collect on delivery|dangerous goods|hazardous|declared value|delivery area|signature|demand|peak|direct delivery|extended area|large package|oversize|over maximum|remote area|residential surcharge|saturday|surge fee|on.call pickup|scheduled pickup|returns.*pickup|weekend residential/i.test(name);
}
function standardize(raw,util){
 const groups=new Map();for(const r of raw){const k=key(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 const normalized=[];
 for(const [i,r]of raw.entries()){
  const group=groups.get(key(r)),desc=clean(r['Charge Description']),cat=clean(r['Charge Category Code']),track=clean(r['Tracking Number']),dateInfo=fuelDate(r,group,util),date=dateInfo.date;
  const mains=group.filter(x=>x['Charge Classification Code']==='FRT'&&!/correction|adjust/i.test(x['Charge Description']));
  const svs=[...new Set(mains.map(x=>root.UPSContractDefaults.service(x['Charge Description'])).filter(Boolean))];
  let sv=svs.length===1?svs[0]:root.UPSContractDefaults.service(r['Original Service Description'])||root.UPSContractDefaults.service(desc);
  const net=number(r['Net Amount']),discount=number(r['Incentive Amount']),adjust=cat!=='SHP'||/correction|adjustment|not previously|refund|credit/i.test(desc);
  const out={'账号':clean(r['Account Number']),'账单号':clean(r['Invoice Number']),'运单号':track,'发货日期':util.day(r['Shipment Date']),'Transaction Date':date,'币种':clean(r['Transaction Currency Code']||r['Invoice Currency Code']),'服务':sv,'分区':number(r.Zone),'计费重LB':number(r['Billed Weight']),'费用名称':desc,'公布金额':net!==null&&discount!==null?net+Math.abs(discount):'','折扣金额':discount,'实收金额':net,'燃油基数':'','记录类型':adjust?'Adjustment: '+cat:cat,'包装类型':r['Container Type']||'','付款方式':r['Bill Option Code']||'','原始燃油Basis Value':number(r['Basis Value']),'费用分类码':r['Charge Classification Code']||'','费用类别码':cat,'Lead Shipment Number':r['Lead Shipment Number']||'','原始文件行':r.__row??i+2,__row:r.__row??i+2};
  out['燃油日期来源']=dateInfo.source;out['原始Transaction Date']=clean(r['Transaction Date']);out['退货类型']=root.UPSReturnsAudit?.type(r)||'';
  const evidence=group.filter(x=>x['Package Dimensions']||x['Entered Weight']).sort((a,b)=>util.day(b['Transaction Date']).localeCompare(util.day(a['Transaction Date']))||Number(b.__row||0)-Number(a.__row||0));
  for(const key of ['Package Dimensions','Package Dimension Unit Of Measure','Entered Weight','Entered Weight Unit of Measure']){const source=evidence.find(x=>x[key]);if(source)out[key]=source[key];}
  if(/fuel/i.test(desc)){
   const fuels=group.filter(x=>x['Charge Classification Code']==='FSC'||/fuel/i.test(x['Charge Description']));
   const unknown=group.filter(x=>number(x['Net Amount'])!==0&&x['Charge Classification Code']!=='FSC'&&!/fuel/i.test(x['Charge Description'])&&!eligible(x));
   if(!adjust&&track&&mains.length===1&&fuels.length===1&&!unknown.length&&group.every(x=>number(x['Net Amount'])!==null&&number(x['Net Amount'])>=0)){
    const base=group.filter(eligible).reduce((sum,x)=>sum+Math.round(number(x['Net Amount'])*100),0)/100;
    out['燃油基数']=base;out['燃油基数依据']='同账号/账单/运单/Transaction Date/SHP费用组，净运输费＋官网列明适用附加费；'+FSC_SOURCE;
   }else out['燃油基数依据']='未自动生成：'+(adjust?'调整/退款费用分开审核':!track?'缺少运单号':mains.length!==1?'基础运输费未唯一匹配':fuels.length!==1?'同费用组燃油行不唯一':unknown.length?'存在未识别的基数费用':'费用金额无效或负数');
   const pub=lookup(date,sv);if(pub){out['公布燃油费率']=pub.rate;out['燃油费率依据']=dateInfo.source+'='+date+'；'+pub.start+'～'+pub.end+'；'+pub.series+'；'+pub.source;out['官网燃油适用周']=pub.start+' ~ '+pub.end;}
  }
  normalized.push(out);
 }
 return normalized;
}
async function refresh(){
 if(root.location?.protocol==='file:')throw Error('离线网页使用内置官网历史费率；在线刷新请运行源码包fuel_server.py。未覆盖的日期不会沿用旧费率。');
 const response=await fetch('/api/ups-fuel-refresh',{method:'POST'});const data=await response.json();if(!response.ok)throw Error(data.error||'官网刷新失败');
 if(data.source!==SOURCE||!Array.isArray(data.rates)||!data.rates.length||data.rates.some(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.start)||!/^\d{4}-\d{2}-\d{2}$/.test(r.end)||r.start>r.end||!Number.isFinite(r.ground)||!Number.isFinite(r.air)||r.ground<=0||r.ground>=1||r.air<=0||r.air>=1))throw Error('UPS官网费率数据验证失败');
 root.UPSOfficialFuel=data;return data;
}
root.UPSInvoiceFuel={fuelDate,fuelReason,lookup,isRaw,isHeaderless,headerlessSchema,standardize,refresh,eligible,source:SOURCE};
})(typeof window==='undefined'?globalThis:window);
