/*SG-AUDIT:audit-memory.js*/// The same installer is compiled for the modular Vue app and standalone HTML.
(function(root){
'use strict';
function workerMain() {
 const ctx     =globalThis;let job     =null,drained     =null;const deliver=(message     )=>new Promise      (resolve=>{drained=resolve;ctx.postMessage(message);});
 // Long repeated evidence strings are sent once, instead of once per fee/claim.
 function pack(value     ){const strings          =[],index=new Map(),seen=new WeakSet();function walk(v     )     {if(typeof v==='string'&&v.length>80){let n=index.get(v);if(n===undefined){n=strings.length;strings.push(v);index.set(v,n);}return {__sgText:n};}if(!v||typeof v!=='object'||seen.has(v))return v;seen.add(v);for(const k of Object.keys(v))v[k]=walk(v[k]);return v;}return {payload:walk(value),strings};}
 async function process(){
  try {
   if(job.fuel)ctx.UPSOfficialFuel=job.fuel;
   let results       =[],report     =null,preview       =[],feeRowCount=0;
   if(job.raw.some(r=>r.__SG174)&&job.mode==='default'){ctx.postMessage({progress:'正在按174列汇总账单核对跨账单调整、HWT及抵扣…'});report=ctx.ShipGridUPS174.audit(job.raw,job.historyRaw||[],job.tolerance,job.options);preview=report.lineResults||[];results=preview;feeRowCount=report.feeRowCount;delete report.lineResults;}else if(job.raw.length&&job.mode==='default'){
    const groups=new Map              (),weeks=new Set        ();
    for(const r of job.raw){const k=JSON.stringify([String(r['Account Number']||'').replace(/^0+/,''),r['Invoice Number'],r['Tracking Number']||'']);if(!groups.has(k))groups.set(k,[]);groups.get(k) .push(r);}
    for(const rows of groups.values()){
     const dates=new Set(rows.map(r=>ctx.UPSAudit.day(r['Shipment Date'])).filter(Boolean));
     for(const r of rows)if(ctx.UPSContractDefaults.fee(r['Charge Description'])==='fuel'){const d=ctx.UPSInvoiceFuel.fuelDate(r,rows).date;if(d){const date=new Date(d+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));weeks.add(date.toISOString().slice(0,10));}}
    }
    let batch       =[];
    function flush(){if(!batch.length)return;const normalized=ctx.UPSInvoiceFuel.standardize(batch,{day:ctx.UPSAudit.day}),checked=ctx.UPSContractDefaults.defaultsAudit(normalized,{...job.options,tolerance:job.tolerance,lowMemory:true,retainRules:false,auditWeeks:[...weeks]},ctx.UPSAudit.audit,{day:ctx.UPSAudit.day});for(const row of checked.results){if(preview.length<200)preview.push(row);results.push({'来源行':row['来源行'],'状态':row['状态'],'合约应收':row['合约应收'],'差额':row['差额'],'原因':row['原因']});}feeRowCount+=checked.results.length;ctx.postMessage({progress:'费用行审核 '+feeRowCount+' / '+job.raw.length});batch=[];}
    for(const [key,rows] of groups){if(rows.length>20000)throw Error('同一运单费用行超过20000行，请检查重复数据或将无运单号的汇总明细单独提供。');if(batch.length&&batch.length+rows.length>1000)flush();for(const row of rows)batch.push(row);groups.delete(key);}flush();
    ctx.postMessage({progress:'正在核对整票、调整及申诉金额…'});
    report=ctx.UPSShipmentAudit.audit(job.raw,results,job.tolerance,{...job.options,historyRaw:job.historyRaw||[]});
    // Refresh preview statuses after the shipment engine marks fee rows as merged.
    const byRow=new Map(results.map(r=>[r['来源行'],r]));for(const r of preview){const c=byRow.get(r['来源行']);if(c)Object.assign(r,c);}
    results=preview;
   }else{
    const rows=job.raw.length?ctx.UPSInvoiceFuel.standardize(job.raw,{day:ctx.UPSAudit.day}):job.rows;
    results=job.mode==='default'?ctx.UPSContractDefaults.defaultsAudit(rows,{...job.options,tolerance:job.tolerance,lowMemory:true,retainRules:false},ctx.UPSAudit.audit,{day:ctx.UPSAudit.day}).results:ctx.UPSAudit.audit(rows,job.rules,job.tolerance);feeRowCount=results.length;
   }
   job=null;
   // Exports need the claim category, not another retained shipment object graph.
   if(report)for(const claim of report.claims){claim.ship=Object.fromEntries(['类别','申诉状态','分区核验','确切申诉原因'].map(k=>[k,claim.ship[k]]));}
   const meta     ={results:[],report:report?{}:null,feeRowCount};
   if(report)for(const [key,value]of Object.entries(report))meta.report[key]=Array.isArray(value)?[]:value;
   await deliver({part:'meta',...pack(meta)});
   const streams       =[['results',results]];if(report)for(const [key,value]of Object.entries(report))if(Array.isArray(value)){streams.push([key,value]);report[key]=null;}
   report=null;results=[];
   for(const [key,values]of streams){for(let i=0;i<values.length;i+=250){const end=Math.min(values.length,i+250),chunk=values.slice(i,end);await deliver({part:key,...pack(chunk)});for(let j=i;j<end;j++)values[j]=null;}}
   ctx.postMessage({done:true});
  }catch(error     ){job=null;ctx.postMessage({error:error?.message||String(error)});}
 }
 ctx.onmessage=(event              )=>{
  const m=event.data;
  if(m.op==='drain'){const done=drained;drained=null;done?.();}
  else if(m.op==='init'){job={...m.job,raw:[],rows:[],historyRaw:[]};ctx.postMessage({ack:true});}
  else if(m.op==='batch'){for(const row of m.rows)job[m.kind].push(row);ctx.postMessage({ack:true});}
  else if(m.op==='start')process();
 };
}
const ids=['finance-19.js','finance-20.js','finance-21.js','finance-22.js','correction-audit.js','dispute-reasons.js','finance-24.js','ground-net-engine','finance-26.js','returns-audit.js','finance-32.js','ups-174-audit.js','ups-371-install.js'];
function createSession(){
 let worker             =null,url             =null,rejectPending     =null,cancelled=false;
 const clean=()=>{worker?.terminate();worker=null;if(url)root.URL.revokeObjectURL(url);url=null;rejectPending=null;};
 const cancel=()=>{cancelled=true;const reject=rejectPending;clean();reject?.(Error('审核已取消；原始文件和已保存的历史账单保留。'));};
 async function run(job     ,onProgress                         ){
  if(cancelled)throw Error('审核已取消');
  if(!root.Worker)throw Error('后台审核需要Chrome或Edge浏览器');
  const scripts=Array.from(root.document.scripts)                       ;
  const sources=ids.map(id=>{const script=scripts.find(s=>s.textContent?.startsWith('/*SG-AUDIT:'+id+'*/'));if(!script)throw Error('后台审核组件缺失：'+id);return script.textContent;});
  url=root.URL.createObjectURL(new Blob([...sources,'\n('+workerMain.toString()+')();'],{type:'text/javascript'}));
  const raw=job.raw,rows=job.rows,historyRaw=job.historyRaw||[];
  return await new Promise     ((resolve,reject)=>{
   rejectPending=reject;let accept     =null,assembled     =null;
   const send=(message     )=>new Promise      ((yes,no)=>{accept=yes;try{worker .postMessage(message);}catch(e){no(e);}});
   function unpack(message     ){const {payload,strings}=message,seen=new WeakSet();function walk(v     )     {if(!v||typeof v!=='object')return v;if(Object.hasOwn(v,'__sgText'))return strings[v.__sgText];if(seen.has(v))return v;seen.add(v);for(const k of Object.keys(v))v[k]=walk(v[k]);return v;}return walk(payload);}
   try{
    worker=new root.Worker(url);
    worker .onmessage=e=>{if(e.data.ack){const done=accept;accept=null;done?.();return;}if(e.data.progress){onProgress(e.data.progress);return;}if(e.data.part){const value=unpack(e.data);if(e.data.part==='meta'){assembled=value;}else{const target=e.data.part==='results'?assembled.results:(assembled.report[e.data.part]||=([]));for(const row of value)target.push(row);}worker .postMessage({op:'drain'});return;}const message=e.data;clean();message.error?reject(Error(message.error)):resolve(assembled);};
    worker .onerror=e=>{clean();reject(Error('后台审核未完成：'+(e.message||'内存不足，请提供本次账单以继续定位')));};
    (async()=>{const meta={...job,raw:undefined,rows:undefined,historyRaw:undefined};await send({op:'init',job:meta});for(const [kind,data]of [['raw',raw],['rows',rows],['historyRaw',historyRaw]]       ){for(let i=0;i<data.length;i+=500){if(cancelled)return;const end=Math.min(data.length,i+500);await send({op:'batch',kind,rows:data.slice(i,end)});for(let j=i;j<end;j++)data[j]=null;onProgress('传入审核数据 '+end+' / '+data.length);}}if(cancelled)return;worker .postMessage({op:'start'});})().catch(e=>{clean();reject(e);});
   }catch(error){clean();reject(error);}
  });
 }
 return {run,cancel};
}
const fields=new Set        (['Zone',...(root.UPSReturnsAudit?.fields||[])]);
for(const script of Array.from(root.document?.scripts||[])                       ){if(!/^\/\*SG-AUDIT:(finance-(19|20|21|22|24|26|32)\.js|ground-net-engine)\*\//.test(script.textContent||''))continue;for(const m of (script.textContent||'').matchAll(/\[['"]([A-Za-z][A-Za-z0-9 /_().#-]*)['"]\]/g))fields.add(m[1]);}
for(const field of ['Charge Category Detail Code','Miscellaneous Line 1','Miscellaneous Line 2','Miscellaneous Line 3','Original Shipment Package Quantity','Transaction Currency Code','Invoice Currency Code','Detail Keyed Dim','Pickup Date','PUDate','PU Date'])fields.add(field);
root.ShipGridAuditMemory={createSession,fields};
})(globalThis);