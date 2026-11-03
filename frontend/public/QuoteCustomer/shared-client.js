(function(root){'use strict';
const names=['OnTrac2026D.xlsx','ONTRAC_RATE_D.xlsx','Fedex_2026C_CD.xlsx','FEDEX_2026A.xlsx','ONTRAC_RATE_C.xlsx','FEDEX_2026B_SD.xlsx','ONTRAC_RATE_A.xlsx','Fedex_2026D.xlsx','OnTrac_2026B.xlsx','ONTRAC_RATE_B.xlsx','FEDEX_2026B.xlsx','Fedex_2026C.xlsx'];
// IDs match server.seed_quotes; injected by build.py.
const fixed=__FIXED_QUOTES__;
const settingsKey='ShipGridSharedSettingsV1';
let saved={};try{saved=JSON.parse(localStorage.getItem(settingsKey)||'{}');}catch{}
const state=Vue.reactive({mode:saved.mode||(saved.enabled?'shared':'local'),enabled:!!saved.enabled,fileApi:saved.fileApi||'http://121.43.236.24/api/excel/files',base:saved.base||((location.protocol==='http:'||location.protocol==='https:')?location.origin:'http://121.43.236.24'),token:sessionStorage.getItem('ShipGridSharedToken')||'',revision:null,connected:false,busy:false,message:'',error:'',statuses:{},listLoaded:false});
const applied={mode:state.mode,enabled:state.mode==='shared',fileApi:state.fileApi,base:state.base,token:state.token};
let snapshot=null;
const to64=data=>{let s='';const b=new Uint8Array(data);for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);};
const wire=q=>{if(q.source==='fixed-link'&&q.url){const {data,hasData,...meta}=q;return meta;}return q.data instanceof ArrayBuffer||ArrayBuffer.isView(q.data)?{...q,data:to64(q.data)}:{...q};};
function url(path){return applied.base.replace(/\/$/,'')+'/api/shared'+path;}
async function request(path,options={}){
 if(location.protocol==='https:'&&applied.base.startsWith('http:'))throw Error('当前为HTTPS页面，请使用HTTPS共享接口，或从公司同源页面打开');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000);
 try{
  const response=await fetch(url(path),{...options,headers:{Authorization:'Bearer '+applied.token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.method&&options.method!=='GET'?{'If-Match':String(state.revision)}:{}),...options.headers},cache:'no-store',signal:ctrl.signal});
  if(!response.ok){let data={};try{data=await response.json();}catch{}throw Error(data.error||('接口返回HTTP '+response.status));}
  return options.binary?await response.arrayBuffer():await response.json();
 }catch(e){if(e.name==='AbortError')throw Error('共享接口响应超时，未自动改用本地数据');if(e instanceof TypeError)throw Error('无法连接共享接口，请检查服务地址、网络和跨域配置');throw e;}finally{clearTimeout(timer);}
}
function accept(d){snapshot=d;state.revision=d.revision;state.connected=true;state.error='';return d;}
async function refresh(){return accept(await request('/catalog'));}
async function loadFileList(){
 if(applied.mode!=='files')return;
 const api=new URL(applied.fileApi);
 if(!['http:','https:'].includes(api.protocol))throw Error('文件列表接口必须为HTTP/HTTPS');
 if(location.protocol==='https:'&&api.protocol==='http:')throw Error('HTTPS页面不能读取HTTP文件接口，请使用同源页面或HTTPS接口');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
 try{
  const r=await fetch(api.href,{headers:{Authorization:'Bearer '+applied.token,Accept:'application/json'},cache:'no-store',signal:ctrl.signal});
  if(!r.ok)throw Error('文件列表接口返回HTTP '+r.status);
  const result=await r.json();if(result.code!==200||!Array.isArray(result.data))throw Error(result.msg||'文件接口返回结构不正确，应为{code:200,data:[文件URL]}');
  const seen=new Set(),next=[];
  for(const item of result.data){
   if(typeof item!=='string')throw Error('文件列表含非URL条目');
   const u=new URL(item,api.origin);if(u.origin!==api.origin||!u.pathname.startsWith('/excel_files/')||!u.pathname.toLowerCase().endsWith('.xlsx'))throw Error('返回文件地址不属于本服务器Excel目录');
   if(seen.has(u.href))continue;seen.add(u.href);
   const filename=decodeURIComponent(u.pathname.split('/').pop()),carrier=/ontrac/i.test(filename)?'ontrac':/fedex/i.test(filename)?'fedex':/ups/i.test(filename)?'ups':null;
   if(!carrier)continue;
   const existing=fixed.find(q=>q.url===u.href);let hash=2166136261;for(const c of u.href)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
   next.push({id:existing?.id||'api-file-'+hash.toString(16),carrier,name:filename.replace(/\.xlsx$/i,''),fileName:filename,url:u.href,source:'fixed-link'});
  }
  fixed.splice(0,fixed.length,...next);state.connected=true;state.listLoaded=true;state.error='';return next;
 }catch(e){state.connected=false;state.listLoaded=false;throw Error(e instanceof TypeError?'文件接口连接失败，请检查登录令牌、网络及跨域配置':e.name==='AbortError'?'文件列表接口超时':e.message);}finally{clearTimeout(timer);}
}
async function remoteRead(name,key){
 if(!snapshot)await refresh();
 const list=snapshot[name]||[];
 if(key===undefined)return list.map(x=>({...x}));
 const item=list.find(x=>x.id===key);if(!item)return undefined;
 if(name!=='quotes')return {...item};
 try{const data=await request('/quotes/'+encodeURIComponent(key)+'/file',{binary:true});state.statuses[key]='已读取';return {...item,data};}
 catch(e){state.statuses[key]='读取失败：'+e.message;throw Error(item.fileName+'：'+e.message);}
}
async function remoteWrite(name,value,remove=false){
 if(state.revision===null)await refresh();
 let result;
 if(name==='quotes'){
  const exists=snapshot.quotes.some(q=>q.id===(remove?value:value.id));
  const path='/quotes'+(exists||remove?'/'+encodeURIComponent(remove?value:value.id):'');
  result=await request(path,{method:remove?'DELETE':exists?'PUT':'POST',...(remove?{}:{body:JSON.stringify(wire(value))})});
 }else{
  const rows=snapshot[name].filter(x=>x.id!==(remove?value:value.id));if(!remove)rows.push(value);
  result=await request('/datasets',{method:'PUT',body:JSON.stringify({[name]:rows})});
 }
 accept(result);
}
async function remoteReplace(values){
 if(state.revision===null)await refresh();
 const data={...values};if(data.quotes)data.quotes=data.quotes.map(wire);
 accept(await request('/datasets',{method:'PUT',body:JSON.stringify(data)}));
}
async function fixedRead(q){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
 try{const r=await fetch(q.url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.arrayBuffer();if(data.byteLength>20*1024*1024)throw Error('文件超过20MB');state.statuses[q.id]='已读取';return {...q,data};}
 catch(e){const message='固定文件读取失败。请连接共享服务器，或由服务器为文件目录配置跨域访问。';state.statuses[q.id]=message;throw Error(q.fileName+'：'+message);}finally{clearTimeout(timer);}
}
async function guarded(fn){if(state.busy)return;state.busy=true;state.error='';state.message='';try{await fn();}catch(e){state.error=e.message;}finally{state.busy=false;}}
async function apply(){return guarded(async()=>{
 if(!/^https?:\/\//i.test(state.base))throw Error('服务器地址必须以http://或https://开头');
 const old={...applied};Object.assign(applied,{mode:state.mode,enabled:state.mode==='shared',fileApi:state.fileApi,base:state.base.replace(/\/$/,''),token:state.token});snapshot=null;state.connected=false;
 try{if(applied.enabled)await refresh();else if(applied.mode==='files')await loadFileList();}catch(e){Object.assign(applied,old);snapshot=null;state.mode=old.mode;state.enabled=old.enabled;throw e;}
 state.enabled=applied.enabled;localStorage.setItem(settingsKey,JSON.stringify({mode:applied.mode,fileApi:applied.fileApi,enabled:applied.enabled,base:applied.base}));sessionStorage.setItem('ShipGridSharedToken',applied.token);
 await root.ShipGridQuoteManager.refresh();state.message=applied.enabled?'已连接共享服务器。报价和客户匹配的修改会保存到服务器。':applied.mode==='files'?'已接入现有文件接口。价表从服务器读取；客户与匹配仍保存在本机，需部署共享写入服务后才能多人同步。':'已切换为本地模式。共享服务器数据不会被删除。';
 });}
async function reload(){return guarded(async()=>{await root.ShipGridQuoteManager.refresh();state.message='列表已刷新；生成账单时也会重新读取共享配置及价表。';});}
async function downloadOriginal(q){return guarded(async()=>{
 const full=await root.ShipGridQuoteManager.readQuote(q.id);if(!full?.data)throw Error('没有可下载的文件');
 const link=document.createElement('a'),u=URL.createObjectURL(new Blob([full.data]));link.href=u;link.download=q.fileName||q.name+'.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 });}
async function migrate(){return guarded(async()=>{
 if(!applied.enabled)throw Error('请先连接共享服务器');
 const local=await root.ShipGridQuoteManager.localSnapshot();await refresh();
 const next={};for(const name of ['quotes','customers','rules']){
  const existing=snapshot[name];const ids=new Set(existing.map(x=>x.id));
  if(local[name].some(x=>ids.has(x.id)))throw Error('本地与服务器存在相同记录ID。为避免覆盖，请先导出备份，由管理员核对。');
  // Server retains existing binary data when a metadata-only record has the same ID.
  next[name]=existing;
  next[name]=next[name].concat(local[name]);
 }
 await remoteReplace(next);await root.ShipGridQuoteManager.refresh();state.message='本地报价、客户及匹配关系已上传共享服务器；本地副本仍保留。';
 });}
root.ShipGridShared={state,fixed,isRemote:()=>applied.enabled,isFiles:()=>applied.mode==='files',loadFileList,refresh,read:remoteRead,write:remoteWrite,replace:remoteReplace,fixedRead,wire};
const mount=document.createElement('div');mount.id='shipgrid-shared';document.body.appendChild(mount);
mount.innerHTML=`<div class="shared-toggle"><button @click="opened=!opened">公司共享资料 · {{cfg.connected&&cfg.enabled?'已连接':'设置 / 固定价表'}}</button></div><div v-if="opened" class="quote-overlay"><section class="quote-window"><div class="section-heading"><h2>公司共享资料与固定价表</h2><button @click="opened=false">关闭</button></div><p>共享报价、客户ID／名称及客户匹配。账单原始文件仍在本机处理。</p><div class="select-grid"><label>资料来源<select v-model="cfg.mode"><option value="local">本地浏览器（含固定链接）</option><option value="files">现有文件接口（服务器价表）</option><option value="shared">完整共享接口（报价＋客户匹配）</option></select></label><label v-if="cfg.mode==='files'">文件列表接口<input v-model="cfg.fileApi"></label><label>共享服务器地址<input v-model="cfg.base" placeholder="http://121.43.236.24"></label><label>共享访问凭证<input type="password" autocomplete="off" v-model="cfg.token" placeholder="由管理员提供，仅本次浏览器会话保存"></label></div><div class="action-row"><button class="primary" @click="apply" :disabled="cfg.busy">连接 / 保存设置</button><button @click="reload" :disabled="cfg.busy">刷新共享列表</button><button @click="migrate" :disabled="cfg.busy||!cfg.connected">将本地资料合并上传服务器</button></div><p v-if="cfg.message" class="notice">{{cfg.message}}</p><p v-if="cfg.error" class="error">{{cfg.error}}</p><p><span v-if="cfg.mode==='files'">现有文件接口只读取报价；客户资料和匹配关系仍为本机保存。</span><span v-else>共享版本：{{cfg.revision??'尚未连接'}}。只读凭证可读取；管理凭证可上传、修改及导入。</span></p><h3>固定文件清单</h3><p>默认登记你提供的12份文件。未读取不代表已校验；生成账单时会下载并按承运商检查价表。客户匹配须在“固定报价与客户匹配管理”中配置。</p><div class="table-scroll"><table><thead><tr><th>承运商</th><th>文件</th><th>读取状态</th><th>操作</th></tr></thead><tbody><tr v-for="q in catalog" :key="q.id"><td>{{q.carrier}}</td><td>{{q.fileName}}</td><td>{{cfg.statuses[q.id]||'尚未读取'}}</td><td><button @click="downloadOriginal(q)" :disabled="cfg.busy">下载原始文件</button></td></tr></tbody></table></div><button @click="manager" :disabled="cfg.busy">打开固定报价与客户匹配管理</button></section></div>`;
Vue.createApp({setup(){const opened=Vue.ref(false),catalog=Vue.computed(()=>root.ShipGridQuoteManager?.state.quotes||fixed);return{opened,cfg:state,catalog,apply,reload,migrate,downloadOriginal,manager:()=>{opened.value=false;root.openQuoteManager('ontrac');}};}}).mount(mount);
})(globalThis);
