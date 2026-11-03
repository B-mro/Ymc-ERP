import fs from 'node:fs';import path from 'node:path';import {stripTypeScriptTypes} from 'node:module';
const root=path.dirname(new URL(import.meta.url).pathname),out=path.join(root,'dist');fs.mkdirSync(path.join(out,'src'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'src')).filter(n=>n.endsWith('.ts'))){const input=fs.readFileSync(path.join(root,'src',name),'utf8');fs.writeFileSync(path.join(out,'src',name.replace(/\.ts$/,'.js')),stripTypeScriptTypes(input,{mode:'strip'}));}
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});fs.copyFileSync(path.join(root,'app.html'),path.join(out,'index.html'));

const audit=fs.readFileSync(path.join(out,'src/ups-ground-net-audit.js'),'utf8').replace(/export function installGroundNetAudit\(root\s*\)\s*\{/,'(function(root){').replace(/\}\s*$/,'})(globalThis);');
const policy=fs.readFileSync(path.join(out,'src/billing-weight-policy.js'),'utf8').replace(/export function installBillingWeightPolicy\(root\s*\)\s*\{/,'(function(root){').replace(/\}\s*$/,'})(globalThis);');
fs.writeFileSync(path.join(root,'assets/billing-weight-policy.js'),policy);fs.writeFileSync(path.join(out,'assets/billing-weight-policy.js'),policy);
const entries=JSON.parse(fs.readFileSync(path.join(root,'assets/scripts.json'),'utf8'));
const shell=fs.readFileSync(path.join(root,'assets/finance-shell.html'),'utf8');
let html=fs.readFileSync(path.join(root,'app.html'),'utf8').replace(/<script type="module"[^>]*><\/script>/,'');
html=html.replace(/<body[^>]*>[\s\S]*?<\/body>/,()=>'<body>'+shell+'<script>'+fs.readFileSync(path.join(root,'assets/vue.global.prod.js'),'utf8')+'</script>'+entries.map(e=>'<script>'+(e.engine?audit:fs.readFileSync(path.join(root,'assets',e.file),'utf8'))+'</script>').join('')+'</body>');
for(const name of ['index.html','base.html'])fs.writeFileSync(path.join(root,name),html);
console.log('Built V3.59: TypeScript modules, modular dist, and standalone HTML from the same assets.');
