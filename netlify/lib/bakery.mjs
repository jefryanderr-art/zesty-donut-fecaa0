import {randomUUID} from 'node:crypto';
export const BAKERY_OPS=['bakeryLabel','bakeryCounter'];
export const bakeryCounterRecord=r=>r.module==='produccion'&&r.kind==='bakery-counter';
const text=(v,n)=>String(v||'').trim().slice(0,n);
export function bakeryOperation(data,access,session,b,ctx){
 const {check,permit}=ctx;permit(access,'produccion',true);permit(access,'inventario',true);check(access.branchId&&b.operationId&&b.confirmed===true,'Selecciona sucursal y confirma.');
 const rows=data.businessRecords||=[];
 if(b.operation==='bakeryLabel'){
  const r=rows.find(r=>r.id===b.id&&r.module==='produccion'&&r.kind!=='bakery-counter');check(r,'Receta inexistente.');
  r.labelIngredients=text(b.ingredients,2000);r.allergens=text(b.allergens,1000);r.events.push({date:new Date().toISOString(),action:'Etiqueta actualizada',actor:session.email});return r.id;
 }
 check(['apertura','cierre'].includes(b.phase),'Selecciona apertura o cierre.');const date=ctx.date(b.date),zone=text(b.zone,80);check(zone,'Indica zona del mostrador.');
 check(!rows.some(r=>bakeryCounterRecord(r)&&r.date===date&&r.zone.toLowerCase()===zone.toLowerCase()&&r.phase===b.phase),'El conteo de esta zona y fase ya está registrado.');
 check(Array.isArray(b.counts)&&b.counts.length>0&&b.counts.length<=200,'Agrega de 1 a 200 productos.');
 const seen=new Set(),counts=b.counts.map(i=>{const p=data.products.find(p=>p.id===i.productId);check(p&&p.kind!=='service'&&!seen.has(p.id),'Producto inexistente o repetido.');seen.add(p.id);const q=Number(i.q);check(Number.isFinite(q)&&q>=0&&q<=1e6,'Conteo inválido.');return {productId:p.id,q,expectedQ:p.stock};});
 const r={id:randomUUID(),module:'produccion',kind:'bakery-counter',name:'Mostrador · '+zone+' · '+b.phase,status:'Activa',branchId:access.branchId,date,zone,phase:b.phase,counts,note:text(b.note,1000),events:[{date:new Date().toISOString(),action:'Conteo registrado',actor:session.email}]};rows.push(r);return r.id;
}
