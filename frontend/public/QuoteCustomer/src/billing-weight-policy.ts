/** V3.53: carrier-rated weight + independently measured GTS inputs. */
export function installBillingWeightPolicy(root: any): void {
 const up=(n: number): number=>Math.ceil(n-1e-10);
 const kg=2.2046226218487757;
 const empty=(v: any): boolean=>v===null||v===undefined||String(v).trim()==='';
 function positive(v: any,label: string): number|null {
  if(empty(v))return null;const n=Number(v);
  if(!Number.isFinite(n)||n<=0)throw Error(label+'必须为正数，不能用无效值参与取重');return n;
 }
 function factor(v: any,kind: string): number {
  const u=String(v).trim().toLowerCase();
  if(kind==='weight'){if(['kg','kgs','千克','公斤'].includes(u))return kg;if(['lb','lbs','磅'].includes(u))return 1;}
  else {if(['cm','厘米'].includes(u))return 1/2.54;if(['in','inch','inches','英寸','i'].includes(u))return 1;}
  throw Error('未识别GTS'+(kind==='weight'?'重量':'尺寸')+'单位：'+v);
 }
 function prepare(g: any,o: any): any {
  const raw=positive(o.rawBilled,'原始最终计费重');if(raw===null)throw Error('缺少原始最终计费重，不自动用GTS替代');
  const divisor=positive(o.divisor,'体积重系数');if(divisor===null)throw Error('缺少体积重系数');
  const warnings: string[]=[];
  const wu=g['下单重量单位']||g['重量单位']||o.weightUnit||'kg';
  const du=g['尺寸单位']||g['长宽高单位']||o.dimUnit||'cm';
  const absent=g.__weightPolicyMissingGts===true;
  const a=absent?null:positive(g['下单实重'],'GTS实重');
  const ga=a===null?null:up(a*factor(wu,'weight'));
  const inputs=absent?[null,null,null]:['下单长','下单宽','下单高'].map(k=>positive(g[k],'GTS'+k));
  const complete=inputs.every(v=>v!==null);
  const gd=complete?inputs.map(v=>up(v!*factor(du,'dim'))).sort((a,b)=>b-a):null;
  const volume=gd?gd.reduce((a,b)=>a*b,1):null;
  const dim=volume===null?null:volume<=Number(o.exemptVolume||0)?0:up(volume/divisor);
  if(ga===null)warnings.push('GTS实重缺失：该项不参与取大，实重判定回退原始数据');
  if(gd===null)warnings.push('GTS尺寸不完整：不拼接两套尺寸，GTS体积重不参与取大，尺寸判定回退原始整套');
  const fallback=o.rawDims?.map((v: number)=>up(v)).sort((a: number,b: number)=>b-a);
  if(!gd&&(!fallback||fallback.length!==3||fallback.some((v: number)=>!Number.isFinite(v)||v<=0)))throw Error('GTS尺寸和原始尺寸均不完整，不能判断尺寸收费');
  const actual=ga??positive(o.rawActual,'回退原始实重');
  if(actual===null)throw Error('GTS及原始实重均缺失，不能判断实重附加费');
  return {rawBilled:up(raw),gtsActual:ga,gtsDims:gd,gtsVolume:volume,gtsDim:dim,
   actual,dims:gd??fallback,reference:Math.max(ga??0,dim??0),maximum:Math.max(up(raw),ga??0,dim??0),warnings,
   reason:'取重=max(原始最终计费重'+up(raw)+'LB，GTS实重'+(ga===null?'缺失':ga+'LB')+'，GTS尺寸重'+(dim===null?'缺失':dim+'LB')+')；GTS计费重原字段不参与计算'};
 }
 function price(table: any,zone: number,weight: number,prior: number|null): any {
  const listed=table[weight+'|'+zone];if(typeof listed!=='number'||!Number.isFinite(listed)||listed<=0)throw Error('客户报价未覆盖最终重量/分区：'+weight+'LB / '+zone+'区');
  const protectedPrice=typeof prior==='number'&&Number.isFinite(prior)&&prior>listed?prior:listed;
  return {value:protectedPrice,reason:protectedPrice>listed?'价格保护：最终重量档价'+listed+'低于原尺寸方案价'+prior+'，按较高基础费出账':'按最终计费重对应价表出账'};
 }
 root.ShipGridWeightPolicy={prepare,price,ceil:up};
}
