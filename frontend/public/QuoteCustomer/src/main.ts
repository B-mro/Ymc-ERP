import { installGroundNetAudit } from './ups-ground-net-audit.js';
declare global { interface Window { UPSAudit: any; UPSContractDefaults: any; UPSInvoiceFuel: any; UPSGroundNetAudit?: any; } }
type ScriptEntry = { file?: string; engine?: boolean };
async function text(url: string): Promise<string> { const response=await fetch(url); if(!response.ok)throw new Error('加载失败：'+url); return response.text(); }
async function start(): Promise<void> {
 document.body.innerHTML=await text('./assets/finance-shell.html');
 const entries: ScriptEntry[]=JSON.parse(await text('./assets/scripts.json'));
 for(const entry of entries){if(entry.engine){installGroundNetAudit(window);continue;}const script=document.createElement('script');script.textContent=await text('./assets/'+entry.file);document.body.appendChild(script);}
}
start().catch((error: Error)=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='财务模块加载失败：'+error.message;document.body.appendChild(p);});
