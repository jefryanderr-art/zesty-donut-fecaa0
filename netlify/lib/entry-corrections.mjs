import {statement} from './reporting.mjs';
import {guardCash} from './cash-guard.mjs';
import {guardPeriods} from './period-controls.mjs';
import {invoiceTotals,normalizeItemQuantity} from '../../public/accounting-math.mjs';
import {supervisor} from './policies.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{publicMessage:message,status})};
const check=(ok,message)=>{if(!ok)fail(message)};
const opening=e=>['apertura','apertura-importada'].includes(e.type);
const active=(data,e)=>!e.reversalOf&&!data.entries.some(r=>r.reversalOf===e.id);
const money=n=>{check(typeof n==='number'&&Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))&&Math.abs(n*100-Math.round(n*100))<0.00001,'Importe inválido; usa centavos enteros.');return Math.round(n*100)};
function validate(data,lines){
 check(Array.isArray(lines)&&lines.length>=2&&lines.length<=200,'Revisa las líneas del asiento.');
 let d=0,c=0;
 for(const l of lines){check(data.accounts.some(a=>a.code===l.a),'La cuenta no pertenece a esta empresa.');d+=money(l.d);c+=money(l.c);check(!(l.d&&l.c),'Cada línea debe ir al Debe o al Haber.');}
 check(Number.isSafeInteger(d)&&d===c&&d>0,'Debe y Haber deben ser iguales y mayores que cero.');return d/100;
}
function stockEffect(data,effects){
 const changes=new Map();
 for(const [original,sign]of effects)for(const m of original.stock||[]){const p=data.products.find(p=>p.id===m.pid);check(p,'Un producto del asiento ya no existe.');const unit=m.unitCost??original.items?.find(i=>i.p===p.id)?.u??(original.type==='invini'&&original.stock.length===1?original.total/m.q:undefined);check(Number.isFinite(unit)&&unit>=0&&Number.isFinite(m.q),'Falta el costo histórico del inventario; requiere revisión documentada.');const v=changes.get(p.id)||{q:0,v:0};v.q+=sign*m.q;v.v+=sign*(m.costCents!==undefined?Math.sign(m.q)*m.costCents/100:m.q*unit);changes.set(p.id,v);}
 for(const [id,m]of changes){const p=data.products.find(p=>p.id===id),q=Math.round((p.stock+m.q)*1e6)/1e6,v=p.stock*p.cost+m.v;check(q>=0&&v>=-0.001&&(q!==0||Math.abs(v)<0.011),'La corrección deja existencias o valoración negativas o valor sin existencias.');p.stock=q;if(!m.q&&!m.v)continue;p.cost=q?Math.round(v/q*100)/100:0;}
}
export function correctEntry(data,access,session,body,{append,date,registerAgain=false}){
 if(!supervisor(access))fail('Necesitas el permiso especial Correcciones.',403);
 check(access.branchId,'Selecciona una sucursal activa; el consolidado es de consulta.');
 const previous=structuredClone(data);
 const original=data.entries.find(e=>e.id===body.id&&(e.branchId||'principal')===access.branchId);
 check(original&&(registerAgain?!original.reversalOf&&data.entries.some(r=>r.reversalOf===original.id)&&!data.entries.some(r=>r.correctionOf===original.id):active(data,original)),'El asiento no existe en esta sucursal o ya está anulado.');
 if(registerAgain)check(['gasto','compra','manual','abono'].includes(original.type)&&body.replacement,'Este tipo requiere su flujo específico de corrección.');
 check(!['venta','nota-credito'].includes(original.type),'Las ventas se anulan mediante nota de crédito.');
 check(!original.allocationJournal&&!original.treasuryId&&!original.shiftId&&!original.costId,'Esta operación tiene su propio flujo de anulación.');
 const personal=original.type==='capital-socio'&&(data.partners||[]).some(p=>p.movements?.some(m=>m.entryId===original.id&&m.kind==='gasto_personal'));
 if(personal)check(access.owner&&!body.replacement&&!registerAgain,'Solo el dueño puede anular el gasto personal; anula y registra de nuevo.');
 check(personal||!original.managed||original.correctionOf||original.type==='apertura-importada','Esta operación tiene su propio flujo de anulación.');
 check(personal||['apertura','apertura-importada','manual','gasto','compra','abono','fiscal-pago','invini'].includes(original.type),'Este tipo requiere su flujo específico de corrección.');
 check(!original.lines.some(l=>l.a==='1104'||l.a.startsWith('1103-')),'Los turnos y la caja chica se corrigen desde sus módulos.');
 check(!data.entries.some(e=>e.id!==original.id&&active(data,e)&&(e.invoiceId===original.id||e.lines?.some(l=>l.invoiceId===original.id))),'El documento tiene abonos vinculados; corrige primero los abonos.');
 check(!(data.businessRecords||[]).some(r=>r.module==='bancos'&&(r.kind==='statement'&&r.rows?.some(row=>row.entryId===original.id)||r.kind==='movement'&&r.entryId===original.id)),'Des-concilia primero el movimiento; los movimientos en moneda original requieren su operación bancaria.');
 check(!(data.fiscalWorkflows||[]).some(r=>JSON.stringify(r).includes(original.id)||original.taxId&&JSON.stringify(r).includes(original.taxId)),'Las declaraciones presentadas usan una rectificativa; este pago pertenece al flujo de declaraciones.');
 check(typeof body.reason==='string'&&typeof body.reference==='string','Indica motivo y comprobante o referencia.');
 const reason=body.reason.trim(),reference=body.reference.trim();
 check(reason.length>=3&&reason.length<=500&&reference.length>0&&reference.length<=200,'Indica motivo (3–500 caracteres) y comprobante o referencia (hasta 200).');
 const dt=date(body.date||original.date);
 for(const when of [original.date,dt])check(!(data.cfg?.periodLocks?.[access.branchId+':'+when.slice(0,7)]||data.cfg?.periodLocks?.[when.slice(0,7)])?.closed,'El período está cerrado. Solo el dueño puede reabrirlo.');check(dt>=original.date,'La anulación no puede preceder al original.');
 if(opening(original)&&!access.owner)check(dt===original.date,'Solo el dueño puede cambiar la fecha de apertura.');
 check(!body.replacement||!['fiscal-pago','invini'].includes(original.type),'Anula y registra de nuevo desde el módulo de origen.');
 if(original.stock?.length)check(data.cfg?.costing?.method!=='fifo','El inventario PEPS requiere revisión de sus capas antes de corregir.');
 if(original.type==='fiscal-pago')check(data.taxes?.some(t=>t.id===original.taxId),'La obligación fiscal vinculada no existe.');
 validate(data,original.lines);
 let replacement;
 if(body.replacement){
  const r=body.replacement;
  replacement={...structuredClone(original),date:dt,reference,correctionReference:reference,correctionOf:original.id};delete replacement.id;delete replacement.actor;delete replacement.reversalOf;
  if(['compra','gasto'].includes(original.type)){
   check(['1101','1102','2101'].includes(r.pay),'Selecciona Caja general, Bancos o crédito.');
   check(typeof r.reference==='string'&&r.reference.trim().length>0&&r.reference.length<=200,'Indica la referencia del documento corregido.');replacement.reference=r.reference.trim();
   const due=date(r.due||dt);check(r.pay!=='2101'||due>=dt,'Revisa el vencimiento.');
   let totals,items,lines,stock=[];
   if(original.type==='compra'){
    check(Array.isArray(r.items)&&r.items.length>0&&r.items.length<=200,'Agrega entre 1 y 200 productos.');
    const used=new Set();items=r.items.map(i=>{const p=data.products.find(p=>p.id===i.p),q=normalizeItemQuantity(i.q);money(i.u);check(p&&p.kind!=='service'&&!used.has(i.p)&&q>0&&q<=1e6,'Producto o cantidad inválidos.');used.add(i.p);return {p:p.id,name:p.name,q,u:i.u,cost:i.u,unit:p.unit||'unidad',vatRate:i.vatRate||0};});
    totals=invoiceTotals(items);stock=items.map(i=>({pid:i.p,q:i.q,unitCost:i.u,unit:i.unit}));lines=[{a:'1301',d:totals.subtotal,c:0},{a:r.pay,d:0,c:totals.total}];
    const supplier=data.suppliers?.find(p=>p.id===r.supplierId);check(!r.supplierId||supplier&&supplier.active!==false,'Proveedor inválido.');replacement.supplierId=supplier?.id||'';replacement.supplier=supplier?{id:supplier.id,name:supplier.name}:null;
   }else{
    check(data.accounts.some(a=>a.code===r.expenseAccount&&a.tipo==='gasto'),'Selecciona una cuenta de gasto.');
    money(r.subtotal);totals=invoiceTotals([{q:1,u:r.subtotal,vatRate:r.vatRate||0}]);lines=[{a:r.expenseAccount,d:totals.subtotal,c:0},{a:r.pay,d:0,c:totals.total}];replacement.expenseAccount=r.expenseAccount;replacement.vatRate=r.vatRate||0;
   }
   if(totals.vat)lines.push({a:'1202',d:totals.vat,c:0});validate(data,lines);
   check(typeof r.party==='string'&&r.party.trim()&&r.party.length<=200,'Indica el nombre del documento.');
   Object.assign(replacement,totals,{lines,stock,pay:r.pay,due,party:r.party.trim(),desc:(original.type==='compra'?'Compra - ':'Gasto - ')+r.party.trim(),...(items?{items}:{})});
  }else{
   const total=validate(data,r.lines);check(typeof r.desc==='string'&&r.desc.trim()&&r.desc.length<=200,'Indica la descripción corregida.');
   check(!r.lines.some(l=>l.a==='1104'||l.a.startsWith('1103-')),'Usa los módulos de turnos y caja chica.');
   Object.assign(replacement,{total,desc:r.desc.trim(),lines:r.lines.map(l=>({a:l.a,d:l.d,c:l.c}))});
   if(registerAgain&&original.type==='abono'&&!original.invoiceId)check(r.lines.every(l=>original.lines.some(o=>o.a===l.a)),'El abono debe conservar su factura y contrapartida de dinero.');
   if(original.type==='abono'&&(!registerAgain||original.invoiceId)){
    const invoice=data.entries.find(e=>e.id===original.invoiceId&&active(data,e));check(invoice&&['1201','2101'].includes(invoice.pay)&&dt>=invoice.date,'La factura vinculada no está vigente.');
    const receivable=invoice.pay==='1201',debit=r.lines.find(l=>receivable?['1101','1102'].includes(l.a)&&l.d===total&&!l.c:l.a==='2101'&&l.d===total&&!l.c),credit=r.lines.find(l=>receivable?l.a==='1201'&&l.c===total&&!l.d:['1101','1102'].includes(l.a)&&l.c===total&&!l.d);
    check(r.lines.length===2&&debit&&credit,'El abono debe conservar su factura y contrapartida de dinero.');
    const balance=data.entries.filter(e=>e.id===invoice.id||e.invoiceId===invoice.id||e.reversalOf===invoice.id).flatMap(e=>e.lines).filter(l=>l.a===invoice.pay).reduce((n,l)=>n+(receivable?l.d-l.c:l.c-l.d),0)+(registerAgain?0:original.total)-total;
    check(data.cfg?.allowNegativeValues===true||balance>=-0.001,'El abono supera la deuda de la factura.');
   }
  }
 }
 if(replacement?.stock?.length)check(data.cfg?.costing?.method!=='fifo','PEPS requiere su flujo de capas.');
 stockEffect(data,[...(registerAgain?[]:[[original,-1]]),...(replacement?[[replacement,1]]:[])]);

 const reversal=registerAgain?null:append(data,session,{date:dt,branchId:access.branchId,type:opening(original)?'anula-apertura':'correccion-anulacion',reversalOf:original.id,invoiceId:original.invoiceId||null,taxId:original.taxId||null,reason,reference,party:original.party||'',supplierId:original.supplierId||'',originalType:original.type,subtotal:original.subtotal??original.total,vat:original.vat||0,desc:'Anulación · '+reason,total:original.total,stock:(original.stock||[]).map(m=>({...m,...(m.unitCost===undefined&&original.type==='invini'&&original.stock.length===1?{costCents:Math.round(original.total*100)}:{}),q:-m.q})),lines:original.lines.map(l=>({...l,d:l.c,c:l.d}))});
 let corrected=null;if(replacement){corrected=append(data,session,{...replacement,managed:true,reason,branchId:access.branchId});}
 if(opening(original))check(data.entries.filter(e=>opening(e)&&active(data,e)).length<=1,'Solo puede existir una apertura vigente por sucursal.');
 guardPeriods(previous,data,'Operación: correctEntry');
 check(statement(data,'0000','9999').inventory>=0,'La corrección deja la valoración contable del inventario en negativo.');
 guardCash(previous,data,{strict:true});
 if(personal)for(const p of data.partners)for(const m of p.movements||[])if(m.entryId===original.id)m.reversalId=reversal.id;
 return {originalId:original.id,reversalId:reversal?.id||null,correctedId:corrected?.id||null,reason,reference};
}
