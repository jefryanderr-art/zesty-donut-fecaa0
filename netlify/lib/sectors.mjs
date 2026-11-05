import {randomUUID} from 'node:crypto';
import {operationalType} from './business-profile.mjs';
import {moneyCents,invoiceTotals} from './accounting-engine.mjs';
import {sectorBom,sectorMaterialCost} from '../../public/sector-math.mjs';
export const SECTOR_OPS=['sectorCreate','sectorWorkPlan','sectorChange','sectorProgress','sectorBill','sectorRetention','sectorSubcontract','sectorCost','sectorPurchase','sectorLog','sectorHarvest','sectorSale','sectorRoute','sectorStart','sectorOverhead','sectorStep','sectorFinish','sectorInspection'];
export const sectorRecord=r=>String(r?.kind||'').startsWith('sector-');
const text=(v,n=500)=>String(v??'').trim().slice(0,n);
export async function sectorOperation(data,access,session,b,ctx,delegate){
 const check=ctx.check,rows=data.businessRecords||=[],profile=operationalType(access.company),day=ctx.date(b.date),permit=m=>ctx.permit(access,m,true),read=m=>ctx.readPermit(access,m);
 check(['construccion','agro','manufactura'].includes(profile)&&access.branchId&&b.confirmed===true,'Selecciona una sucursal y confirma la operación.');
 const r=rows.find(r=>r.id===b.id&&r.branchId===access.branchId);
 if(r)check(!(r.events||[]).some(e=>e.date>day),'La operación no puede preceder al último movimiento.');
 const modules={construccion:'proyectos',agro:'lotes',manufactura:'produccion'},module=modules[profile];permit(module);
 const event=(r,action,extra={})=>{r.events||=[];check(r.events.length<10000,'Límite de historial alcanzado.');r.events.push({date:day,action,actor:session.email,...extra});};
 const cents=v=>{check(Number.isSafeInteger(v)&&v>=0&&v<=99999999900,'Usa centavos enteros no negativos dentro del límite.');return v};
 const quantity=(v,zero=false)=>{const n=Number(v);check(Number.isFinite(n)&&(zero?n>=0:n>0)&&n<=1e6&&Math.abs(n*1000-Math.round(n*1000))<1e-5,'Cantidad inválida (máximo tres decimales).');return n};
 const percent=v=>{const n=Number(v);check(Number.isFinite(n)&&n>=0&&n<=100,'Porcentaje inválido.');return n};
 const target=(id,kind)=>{const x=rows.find(x=>x.id===id&&x.kind===kind&&x.branchId===access.branchId);check(x,'Referencia no encontrada en la sucursal.');return x};
 const account=(code,types)=>{check(data.accounts.some(a=>a.code===code&&types.includes(a.tipo))&&!['1104','2107','1301','1201','1101','1102'].includes(code)&&!String(code).startsWith('1103-'),'Selecciona una cuenta compatible y separada de las cuentas de control.');return code};
 const post=(owner,lines,action,extra={})=>{permit('contabilidad');check(lines.length&&lines.every(l=>data.accounts.some(a=>a.code===l.a)),'Cuenta inexistente.');const total=lines.reduce((s,l)=>s+moneyCents(l.d),0);check(total===lines.reduce((s,l)=>s+moneyCents(l.c),0),'Asiento descuadrado.');const e=ctx.entry(data,session,{date:day,type:'sector',desc:action+' · '+owner.name,total:total/100,businessId:owner.id,project:owner.project||owner.id,lines,...extra});event(owner,action,{entryId:e.id});return e};
 const line=(a,d,c)=>({a,d:d/100,c:c/100});
 const cash=()=>{permit('cajas');ctx.financialCash(access);check(['1101','1102'].includes(b.pay),'Selecciona Caja general o Banco.');return b.pay};
 if(b.operation==='sectorCreate'){
  const kinds={construccion:['work'],agro:['parcel','cycle','animal'],manufactura:['order']};check(kinds[profile].includes(b.type)&&text(b.name,200),'Tipo o nombre inválido.');
  const rec={id:randomUUID(),module,kind:'sector-'+b.type,name:text(b.name,200),date:day,status:module==='proyectos'?'En proceso':module==='lotes'?'Disponible':'Inactiva',branchId:access.branchId,operationalProfile:profile,events:[]};
  if(b.type==='work'){read('clientes');check(data.customers.some(c=>c.id===b.customerId&&c.status==='activo'),'Selecciona cliente activo.');rec.customerId=b.customerId;rec.project=rec.name;rec.contractCents=cents(b.contractCents);rec.progress=0;rec.costCodes=[];rec.stageProgress={};rec.items=[];rec.retentionCents=0;rec.sectorCosts=[];}
  if(b.type==='parcel'){rec.area=quantity(b.area);rec.location=text(b.location);check(rec.location,'Indica ubicación.');rec.soil=text(b.soil,2000);}
  if(b.type==='cycle'){target(b.parcelId,'sector-parcel');read('inventario');check(data.products.some(p=>p.id===b.productId&&p.kind!=='service'),'Selecciona producto cosechado.');rec.parcelId=b.parcelId;rec.cropProductId=b.productId;rec.sowing=ctx.date(b.sowing);check(rec.sowing<=day,'La siembra no puede ser futura.');rec.expectedPriceCents=cents(b.expectedPriceCents);rec.logs=[];}
  if(b.type==='animal'){rec.tag=text(b.tag,80);check(rec.tag&&!rows.some(x=>x.kind==='sector-animal'&&x.tag.toLowerCase()===rec.tag.toLowerCase()),'Identificación animal vacía o duplicada.');rec.breed=text(b.breed);rec.birth=b.birth?ctx.date(b.birth):'';check(!rec.birth||rec.birth<=day,'Nacimiento futuro.');if(b.parentId)target(b.parentId,'sector-animal');rec.parentId=b.parentId||'';rec.logs=[];}
  if(b.type==='order'){read('inventario');const recipe=rows.find(x=>x.id===b.recipeId&&x.module==='produccion'&&!sectorRecord(x)&&x.status==='Activa');check(recipe,'Selecciona receta activa.');rec.recipeId=recipe.id;rec.q=quantity(b.q);rec.scheduled=ctx.date(b.scheduled);check(rec.scheduled>=day,'Programación anterior al alta.');if(b.demandId){read('documentos_venta');check(rows.some(x=>x.id===b.demandId&&x.module==='documentos_venta'),'Pedido inexistente.');}rec.demandId=b.demandId||'';rec.phase='Programada';rec.productId=recipe.productId;rec.routes=structuredClone(recipe.sectorRoutes||[]);rec.wipCents=0;rec.steps=[];}
  rows.push(rec);event(rec,'Alta sectorial');return rec.id;
 }
 // Las rutas se configuran sobre recetas existentes; no transforman productos históricos.
 if(b.operation==='sectorRoute'){
  check(profile==='manufactura'&&r?.module==='produccion'&&!sectorRecord(r)&&r.status==='Activa','Selecciona receta activa.');
  check(Array.isArray(b.routes)&&b.routes.length>0&&b.routes.length<=100,'Agrega hasta 100 pasos.');r.sectorRoutes=b.routes.map(s=>({name:text(s.name,200),minutes:quantity(s.minutes,true),amountCents:cents(s.amountCents)}));check(r.sectorRoutes.every(x=>x.name),'Nombre de paso requerido.');event(r,'Ruta de producción actualizada');return r.id;
 }
 check(r&&sectorRecord(r)&&r.module===module&&r.operationalProfile===profile&&day>=r.date,'Ficha sectorial no encontrada o fecha anterior al alta.');
 if(b.operation==='sectorWorkPlan'){
  check(r.kind==='sector-work'&&access.owner&&!r.costCodes.length,'Solo el dueño fija el presupuesto inicial una vez.');check(Array.isArray(b.codes)&&b.codes.length>0&&b.codes.length<=200,'Agrega códigos de costo.');const seen=new Set();r.costCodes=b.codes.map(c=>{const code=text(c.code,40);check(code&&!seen.has(code)&&['Mano de obra','Materiales','Equipo','Subcontratos'].includes(c.category),'Código duplicado o categoría inválida.');seen.add(code);return {code,category:c.category,name:text(c.name,200),amountCents:cents(c.amountCents)}});event(r,'Presupuesto inicial aprobado');return r.id;
 }
 if(b.operation==='sectorChange'){
  check(r.kind==='sector-work'&&access.owner&&text(b.reason)&&b.approved===true,'El dueño aprueba la orden de cambio con motivo.');const c=r.costCodes.find(c=>c.code===b.code);check(c,'Código de costo inexistente.');const delta=Number(b.deltaCents),contractDelta=Number(b.contractDeltaCents);check(Number.isSafeInteger(delta)&&Number.isSafeInteger(contractDelta),'Ajustes en centavos enteros.');cents(c.amountCents+delta);cents(r.contractCents+contractDelta);c.amountCents+=delta;r.contractCents+=contractDelta;event(r,'Orden de cambio aprobada',{code:c.code,adjustmentCents:delta,contractAdjustmentCents:contractDelta,reason:text(b.reason)});return r.id;
 }
 if(b.operation==='sectorProgress'){
  check(r.kind==='sector-work'&&text(b.stage,80),'Indica etapa.');const p=percent(b.progress);check(p>=r.progress,'El avance acumulado no puede retroceder.');r.progress=p;r.stageProgress[text(b.stage,80)]=percent(b.stageProgress);event(r,'Avance aprobado',{stage:text(b.stage,80),progress:p,stageProgress:percent(b.stageProgress)});return r.id;
 }
 if(b.operation==='sectorBill'){
  check(r.kind==='sector-work'&&text(b.stage,80)&&Object.hasOwn(r.stageProgress,text(b.stage,80)),'Selecciona una etapa con avance aprobado.');read('inventario');read('ventas');const p=data.products.find(p=>p.id===b.productId&&p.kind==='service');check(p,'Selecciona servicio de avance.');const n=cents(b.amountCents);check(n>0,'Importe requerido.');const billed=(r.progressBills||[]).reduce((n,x)=>n+x.amountCents,0);check(billed+n<=Math.round(r.contractCents*r.progress/100),'La base facturada supera el avance del contrato aprobado.');check(!(r.progressBills||[]).some(x=>x.stage===text(b.stage,80)),'Etapa ya facturada.');
  const entryId=await delegate({...b,operation:'businessBill',module,id:r.id,milestone:text(b.stage,80),items:[{p:p.id,q:1,u:n/100}],payments:[{method:'credito',amount:invoiceTotals([{q:1,u:n/100,vatRate:p.vatRate||0}]).total}],loyalty:false,discount:0,pay:'1201',due:b.due||day});
  r.progressBills||=[];r.progressBills.push({stage:text(b.stage,80),amountCents:n,entryId});event(r,'Factura por avance',{entryId});return entryId;
 }
 if(b.operation==='sectorRetention'){
  check(r.kind==='sector-work'&&['Retener','Liberar'].includes(b.action),'Operación de garantía inválida.');const invoice=(r.progressBills||[]).find(x=>x.entryId===b.invoiceId);check(invoice,'Factura ajena a la obra.');const n=cents(b.amountCents);check(n>0,'Importe requerido.');const acct=r.retentionAccount||account(b.account,'activo');check(!r.retentionAccount||r.retentionAccount===b.account,'Conserva la cuenta de garantía.');
  const retained=(r.retentionMoves||[]).filter(x=>x.invoiceId===invoice.entryId).reduce((n,x)=>n+(x.action==='Retener'?x.amountCents:-x.amountCents),0);
  const balance=data.entries.filter(e=>e.id===invoice.entryId||e.invoiceId===invoice.entryId).flatMap(e=>e.lines||[]).filter(l=>l.a==='1201').reduce((n,l)=>n+moneyCents(l.d)-moneyCents(l.c),0);
  check(n<=(b.action==='Retener'?balance:retained),'Importe superior al saldo disponible.');const e=post(r,b.action==='Retener'?[line(acct,n,0),line('1201',0,n)]:[line('1201',n,0),line(acct,0,n)],b.action+' garantía',{invoiceId:invoice.entryId});cents((r.retentionCents||0)+(b.action==='Retener'?n:-n));r.retentionAccount=acct;r.retentionCents=(r.retentionCents||0)+(b.action==='Retener'?n:-n);r.retentionMoves||=[];r.retentionMoves.push({date:day,action:b.action,invoiceId:invoice.entryId,amountCents:n,entryId:e.id});return e.id;
 }
 if(b.operation==='sectorSubcontract'){
  check(r.kind==='sector-work','Selecciona obra.');r.subcontracts||=[];
  if(b.action==='Contrato'){read('compras');check(access.owner&&data.suppliers.some(s=>s.id===b.supplierId&&s.active!==false)&&text(b.terms,2000),'El dueño registra proveedor y contrato.');const n=cents(b.amountCents);check(n>0&&r.costCodes.some(c=>c.code===b.code&&c.category==='Subcontratos'),'Contrato o código de subcontrato inválido.');r.subcontracts.push({id:randomUUID(),supplierId:b.supplierId,terms:text(b.terms,2000),amountCents:n,code:b.code,progress:0,accruedCents:0,paidCents:0});}
  else {const s=r.subcontracts.find(x=>x.id===b.subcontractId);check(s,'Subcontrato inexistente.');const n=cents(b.amountCents);check(n>0,'Importe requerido.');if(b.action==='Avance'){permit('costos');check(access.owner,'Solo el dueño aprueba avance del subcontrato.');const p=percent(b.progress);check(p>=s.progress&&s.accruedCents+n<=Math.round(s.amountCents*p/100),'Excede el avance aprobado.');const expense=account(b.expenseAccount,['gasto','costo']),liability=s.liabilityAccount||account(b.liabilityAccount,'pasivo');check(!s.liabilityAccount||s.liabilityAccount===b.liabilityAccount,'Conserva el pasivo del subcontrato.');const e=post(r,[line(expense,n,0),line(liability,0,n)],'Avance subcontratista',{supplierId:s.supplierId,subcontractId:s.id});s.movements||=[];s.movements.push({date:day,action:'Avance',entryId:e.id,amountCents:n});s.liabilityAccount=liability;s.progress=p;s.accruedCents+=n;r.sectorCosts||=[];r.sectorCosts.push({entryId:e.id,amountCents:n,code:s.code,date:day});}
   else {check(b.action==='Pago'&&n<=s.accruedCents-s.paidCents,'Pago superior a lo devengado.');const e=post(r,[line(s.liabilityAccount,n,0),line(cash(),0,n)],'Pago subcontratista',{supplierId:s.supplierId,subcontractId:s.id});s.movements||=[];s.movements.push({date:day,action:'Pago',entryId:e.id,amountCents:n});s.paidCents+=n;}}
  event(r,'Subcontrato · '+text(b.action));return r.id;
 }
 if(b.operation==='sectorCost'){
  check(r.kind!=='sector-order','Usa Costo al producto en proceso.');if(r.kind==='sector-work')check(r.costCodes.some(c=>c.code===b.code),'Selecciona código de costo.');
  const entryId=await delegate({...b,operation:'businessCost',id:r.id,module:r.module});const e=data.entries.find(e=>e.id===entryId),cost=data.costs?.find(c=>c.entryId===entryId);const n=moneyCents(cost?.base??e.subtotal??e.total);r.sectorCosts||=[];r.sectorCosts.push({date:day,entryId,amountCents:n,code:text(b.code,40),category:text(b.category,80)});return entryId;
 }
 if(b.operation==='sectorPurchase'){
  check(r.kind==='sector-work'&&r.costCodes.some(c=>c.code===b.code),'Selecciona obra y código.');check(data.entries.some(e=>e.id===b.purchaseId&&e.date<=day),'Compra posterior al vínculo.');const entryId=await delegate({...b,operation:'businessPurchase',id:r.id,module:r.module});r.codedPurchases||=[];r.codedPurchases.push({entryId,code:b.code});return entryId;
 }
 if(b.operation==='sectorLog'){
  const types=r.kind==='sector-work'?['Bitácora diaria','Equipo / maquinaria']:r.kind==='sector-parcel'?['Suelo','Certificación','Tarea','Mantenimiento']:r.kind==='sector-cycle'?['Siembra','Insumo','Aplicación','Pérdida','Tarea','Certificación','Mantenimiento']:r.kind==='sector-animal'?['Cría','Sanidad','Tratamiento','Producción','Pastoreo','Tarea','Certificación']:[];
  check(types.includes(b.type)&&text(b.note,2000),'Tipo y detalle requeridos.');r.logs||=[];check(r.logs.length<5000,'Límite de registros alcanzado.');const log={id:randomUUID(),date:day,type:b.type,note:text(b.note,2000),responsible:text(b.responsible,200),due:b.due?ctx.date(b.due):'',state:['Pendiente','Completada'].includes(b.state)?b.state:'Completada',q:quantity(b.q||0,true),reference:text(b.reference,200),cause:text(b.cause,500)};
  if(b.type==='Pérdida')check(log.q>0&&log.cause,'Cantidad perdida y causa requeridas.');if(b.type==='Tarea')check(log.responsible&&log.due,'Asigna responsable y fecha.');
  if(b.taskId){const task=r.logs.find(t=>t.id===b.taskId&&t.type==='Tarea');check(task&&b.state==='Completada','Tarea no encontrada.');task.state='Completada';log.reference=task.id;}
  r.logs.push(log);event(r,b.type);return r.id;
 }
 if(b.operation==='sectorHarvest'){
  check(r.kind==='sector-cycle'&&day>=r.sowing&&text(b.lot,120),'Selecciona ciclo sembrado y lote.');permit('inventario');permit('contabilidad');check(!rows.some(x=>x.module==='lotes'&&x.productId===r.cropProductId&&x.lot===text(b.lot,120)),'Lote ya registrado.');const p=data.products.find(p=>p.id===r.cropProductId&&p.kind!=='service');check(p,'Producto inexistente.');const q=quantity(b.q),n=moneyCents(Math.round(q*p.cost*100)/100),contra=account(b.account,['gasto','costo','ingreso']);check(n>0,'Configura el costo de inventario del producto antes de cosechar.');const e=post(r,[line('1301',n,0),line(contra,0,n)],'Cosecha valorizada a costo de catálogo',{stock:[{pid:p.id,q,unit:p.unit||'unidad',unitCost:p.cost}]});p.stock=quantity(p.stock+q);const due=ctx.date(b.due);check(due>=day,'Vencimiento anterior a cosecha.');const lot={id:randomUUID(),module:'lotes',kind:'lotes',name:text(b.lot,120),lot:text(b.lot,120),date:day,due,status:'Disponible',branchId:access.branchId,productId:p.id,q,entryId:e.id,sourceCycleId:r.id,sourceParcelId:r.parcelId,events:[]};rows.push(lot);r.logs.push({id:randomUUID(),type:'Cosecha',date:day,q,lotId:lot.id,entryId:e.id,note:text(b.note),reference:text(b.reference)});return e.id;
 }
 if(b.operation==='sectorSale'){
  check(r.kind==='sector-cycle','Selecciona ciclo.');permit('ventas');permit('inventario');const q=quantity(b.q),harvest=r.logs.filter(l=>l.type==='Cosecha').reduce((n,l)=>n+l.q,0),sold=(r.sectorSales||[]).reduce((n,l)=>n+l.q-data.entries.filter(e=>e.type==='nota-credito'&&e.invoiceId===l.entryId).flatMap(e=>e.items||[]).filter(i=>i.p===r.cropProductId).reduce((s,i)=>s+i.q,0),0);check(q+sold<=harvest,'La venta supera la cosecha del ciclo.');const ownLots=rows.filter(x=>x.sourceCycleId===r.id&&x.status==='Disponible'&&x.due>=day).reduce((n,x)=>n+x.q,0);check(q<=ownLots,'No quedan lotes vigentes del ciclo.');
  // FEFO global: impedir atribuir a este cultivo una venta que tomaría otro ciclo.
  const firstLots=rows.filter(x=>x.module==='lotes'&&x.productId===r.cropProductId&&x.status==='Disponible'&&x.due>=day).sort((a,b)=>a.due.localeCompare(b.due)||a.date.localeCompare(b.date));let remaining=q;for(const l of firstLots){if(remaining<=0)break;check(l.sourceCycleId===r.id,'FEFO prioriza otro ciclo: factura desde su ficha.');remaining-=l.q;}
  const p=data.products.find(p=>p.id===r.cropProductId),u=cents(b.unitPriceCents)/100;check(data.customers.some(c=>c.id===b.customerId&&c.status==='activo'),'Selecciona acopiador activo.');check(['1201','1101','1102'].includes(b.pay),'Forma de cobro inválida.');const total=invoiceTotals([{q,u,vatRate:p.vatRate||0}]).total,invoice=await ctx.sale({...b,items:[{p:r.cropProductId,q,u}],payments:[{method:b.pay==='1201'?'credito':b.pay==='1101'?'efectivo':'transferencia',amount:total}],saleContext:{sourceId:r.id,sourceModule:r.module,sourceName:r.name,project:target(r.parcelId,'sector-parcel').name},date:day,pay:b.pay,loyalty:false,discount:0},r.id);invoice.businessId=r.id;r.sectorSales||=[];r.sectorSales.push({date:day,entryId:invoice.id,q,amountCents:moneyCents(invoiceTotals(invoice.items).subtotal)});event(r,'Venta a acopiador',{entryId:invoice.id});return invoice.id;
 }
 if(b.operation==='sectorStart'){
  check(r.kind==='sector-order'&&r.phase==='Programada','Orden ya iniciada.');permit('inventario');permit('contabilidad');const recipe=rows.find(x=>x.id===r.recipeId&&x.status==='Activa');check(recipe,'Receta inactiva.');const recipes=rows.filter(x=>x.module==='produccion'&&!sectorRecord(x)&&x.status==='Activa');let plan;try{plan=sectorBom(recipe,r.q,recipes,data.products)}catch{check(false,'Lista de materiales cíclica o inválida.');}check(plan.length>0&&plan.length<=200,'Materiales inválidos.');
  const stock=[],lots=[];for(const i of plan){const p=data.products.find(p=>p.id===i.p);const reserved=rows.filter(x=>x.module==='rutas'&&x.consignment&&x.status==='Preparada'&&!x.entryId).flatMap(x=>x.items||[]).filter(x=>x.p===i.p).reduce((n,x)=>n+x.q,0);check(p&&p.kind!=='service'&&p.id!==r.productId&&p.stock-reserved>=i.q,'Material insuficiente o inválido.');check(!rows.some(x=>x.module==='variantes'&&x.productId===p.id&&x.serial),'No se consumen series automáticamente.');let remaining=i.q;if(rows.some(x=>x.module==='lotes'&&x.productId===p.id)){permit('lotes');for(const l of rows.filter(x=>x.module==='lotes'&&x.productId===p.id&&x.status==='Disponible'&&x.due>=day).sort((a,b)=>a.due.localeCompare(b.due)||a.date.localeCompare(b.date))){const q=Math.min(l.q,remaining);if(q>0){l.q=Math.round((l.q-q)*1e6)/1e6;remaining=Math.round((remaining-q)*1e6)/1e6;if(!l.q)l.status='Agotado';lots.push({lotId:l.id,p:p.id,q});event(l,'Consumo en orden · '+r.name,{orderId:r.id,q});}}check(remaining===0,'Lotes vigentes insuficientes.');}p.stock=Math.round((p.stock-i.q)*1e6)/1e6;stock.push({pid:p.id,q:-i.q,unit:p.unit||'unidad',unitCost:p.cost});}
  const n=sectorMaterialCost(plan,data.products);check(n>0,'Los materiales deben tener costo.');const acct=account(b.account,'activo');const e=post(r,[line(acct,n,0),line('1301',0,n)],'Inicio · producto en proceso',{stock});r.materials=plan;r.inputLots=lots;r.wipAccount=acct;r.wipCents=n;r.phase='En proceso';r.startEntryId=e.id;r.recipeSnapshot=structuredClone(recipe);return e.id;
 }
 if(b.operation==='sectorOverhead'){
  check(r.kind==='sector-order'&&r.phase==='En proceso','Orden no iniciada o terminada.');permit('costos');read('compras');const n=cents(b.amountCents);check(n>0&&text(b.note),'Importe y concepto requeridos.');cents(r.wipCents+n);const contra=b.pay==='2101'?'2101':cash();post(r,[line(r.wipAccount,n,0),line(contra,0,n)],'Costo de proceso · '+text(b.note));r.wipCents+=n;return r.id;
 }
 if(b.operation==='sectorStep'){
  check(r.kind==='sector-order'&&r.phase==='En proceso'&&Number.isInteger(b.step)&&r.routes[b.step]&&!r.steps.some(s=>s.step===b.step),'Paso inexistente o terminado.');check(b.step===r.steps.length&&text(b.note),'Confirma los pasos en orden con detalle.');r.steps.push({step:b.step,date:day,minutes:quantity(b.minutes,true),note:text(b.note),responsible:text(b.responsible)});event(r,'Paso terminado · '+r.routes[b.step].name);return r.id;
 }
 if(b.operation==='sectorInspection'){
  check(r.kind==='sector-order'&&r.phase==='En proceso'&&text(b.note,2000)&&text(b.responsible),'Inspección en proceso con responsable y resultado requeridos.');r.inspections||=[];check(r.inspections.length<1000,'Límite de inspecciones alcanzado.');r.inspections.push({date:day,note:text(b.note,2000),responsible:text(b.responsible),sampleQ:quantity(b.sampleQ),rejectQ:quantity(b.rejectQ,true)});check(r.inspections.at(-1).rejectQ<=r.inspections.at(-1).sampleQ,'Rechazos superiores a la muestra.');event(r,'Inspección de calidad en proceso');return r.id;
 }
 if(b.operation==='sectorFinish'){
  check(r.kind==='sector-order'&&r.phase==='En proceso'&&r.routes.length===r.steps.length,'Completa la ruta antes de terminar.');permit('inventario');permit('lotes');permit('contabilidad');const good=quantity(b.goodQ,true),reject=quantity(b.rejectQ,true),waste=quantity(b.wasteQ,true);check(Math.abs(good+reject+waste-r.q)<1e-6&&text(b.inspection,2000)&&text(b.lot,120),'Inspección y lote requeridos; cantidades deben sumar la orden.');check(!rows.some(x=>x.module==='lotes'&&x.productId===r.productId&&x.lot===text(b.lot,120)),'Lote duplicado.');const output=data.products.find(p=>p.id===r.productId&&p.kind!=='service');check(output,'Producto terminado inválido.');
  const goodCents=Math.round(r.wipCents*good/r.q),lossCents=r.wipCents-goodCents,oldValue=moneyCents(Math.round(output.stock*output.cost*100)/100),newStock=Math.round((output.stock+good)*1e6)/1e6,newCost=newStock?Math.round((oldValue+goodCents)/newStock)/100:output.cost;
  check(newCost===output.cost||(access.company.data.products.find(p=>p.id===output.id)?.stock??output.stock)===output.stock,'El nuevo costo afecta otras sucursales; revisa el costeo con el contador.');const valuation=moneyCents(Math.round(newStock*newCost*100)/100)-oldValue,diff=goodCents-valuation,expense=(lossCents||diff)?account(b.expenseAccount,['costo','gasto']):'';
  check(valuation>=0,'La valoración redondeada reduce el inventario existente; revisa el costo y cantidad.');const lines=[line('1301',valuation,0),line(r.wipAccount,0,r.wipCents)];if(lossCents+diff>=0&&lossCents+diff)lines.push(line(expense,lossCents+diff,0));else if(lossCents+diff<0)lines.push(line(expense,0,-lossCents-diff));
  const e=post(r,lines,'Terminación e inspección de producción',{stock:good?[{pid:output.id,q:good,unit:output.unit||'unidad',unitCost:newCost,productionAdjustment:{amountCents:valuation-moneyCents(Math.round(good*newCost*100)/100),reason:'Valoración del saldo anterior'}}]:[]});output.stock=newStock;output.cost=newCost;const due=ctx.date(b.due);check(due>=day,'Vencimiento anterior a producción.');
  if(good)rows.push({id:randomUUID(),module:'lotes',kind:'lotes',name:text(b.lot,120),lot:text(b.lot,120),productId:output.id,q:good,date:day,due,status:'Disponible',branchId:access.branchId,entryId:e.id,sourceOrderId:r.id,inputLots:structuredClone(r.inputLots),events:[]});
  Object.assign(r,{phase:'Terminada',finishEntryId:e.id,actualCostCents:r.wipCents,unitCostCents:good?Math.round(r.wipCents/good):0,goodQ:good,rejectQ:reject,wasteQ:waste,inspection:text(b.inspection,2000),wipCents:0});event(r,'Control de calidad cerrado');return e.id;
 }
 check(false,'Operación sectorial no disponible.');
}

// También valida el documento antes de guardarlo o restaurarlo.
export function validateSectorRecord(r,data,check){
 if(!sectorRecord(r))return;
 const kind=r.kind.slice(7),expected={work:'proyectos',parcel:'lotes',cycle:'lotes',animal:'lotes',order:'produccion'};
 check(expected[kind]===r.module&&typeof r.branchId==='string'&&r.branchId,'Ficha sectorial inválida.');
 const cent=v=>Number.isSafeInteger(v)&&v>=0&&v<=99999999900;
 for(const key of ['contractCents','retentionCents','expectedPriceCents','wipCents','actualCostCents','unitCostCents'])if(r[key]!==undefined)check(cent(r[key]),'Importe sectorial inválido.');
 const linked=(id,kind)=>data.businessRecords.some(x=>x.id===id&&x.kind===kind&&x.branchId===r.branchId);
 if(kind==='work'){
  check(Number.isFinite(r.progress)&&r.progress>=0&&r.progress<=100&&Array.isArray(r.costCodes)&&r.costCodes.length<=200,'Presupuesto o avance inválido.');
  const codes=new Set();for(const c of r.costCodes){check(typeof c.code==='string'&&c.code&&!codes.has(c.code)&&cent(c.amountCents)&&['Mano de obra','Materiales','Equipo','Subcontratos'].includes(c.category),'Código o presupuesto inválido.');codes.add(c.code);}
  for(const s of r.subcontracts||[])check(cent(s.amountCents)&&cent(s.accruedCents)&&cent(s.paidCents)&&s.paidCents<=s.accruedCents&&s.accruedCents<=s.amountCents,'Saldo de subcontrato inválido.');
 }
 if(kind==='parcel')check(Number.isFinite(r.area)&&r.area>0&&r.location,'Parcela inválida.');
 if(kind==='cycle')check(linked(r.parcelId,'sector-parcel')&&data.products.some(p=>p.id===r.cropProductId&&p.kind!=='service')&&/^\d{4}-\d{2}-\d{2}$/.test(r.sowing),'Ciclo o parcela inválidos.');
 if(kind==='animal')check(r.tag&&(!r.parentId||linked(r.parentId,'sector-animal')),'Animal o progenitor inválidos.');
 if(kind==='order'){
  check(['Programada','En proceso','Terminada'].includes(r.phase)&&Number.isFinite(r.q)&&r.q>0&&Array.isArray(r.routes)&&Array.isArray(r.steps),'Orden de producción inválida.');
  check(data.businessRecords.some(x=>x.id===r.recipeId&&x.module==='produccion'&&!sectorRecord(x)),'Conserva la receta de la orden.');
  if(r.phase==='En proceso')check(r.startEntryId&&data.accounts.some(a=>a.code===r.wipAccount&&a.tipo==='activo'),'Conserva el activo de producto en proceso.');
  if(r.phase==='Terminada')check(r.wipCents===0&&Math.abs(r.goodQ+r.rejectQ+r.wasteQ-r.q)<1e-6&&r.finishEntryId,'Terminación inválida.');
 }
 for(const c of r.sectorCosts||[])check(cent(c.amountCents)&&data.entries.some(e=>e.id===c.entryId),'Conserva los costos sectoriales.');
 for(const c of r.sectorSales||[])check(cent(c.amountCents)&&data.entries.some(e=>e.id===c.entryId&&e.type==='venta'),'Conserva las ventas del cultivo.');
}
