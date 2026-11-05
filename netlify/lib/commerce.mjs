import {randomUUID} from 'node:crypto';
import {commerceQuantity as qty,commerceUnitCents,commerceMeasure,commerceReplenishment,commerceABC,commerceSupplierNetCents,commerceRouteCashRows} from '../../public/commerce-math.mjs';
import {moneyCents,invoiceTotals} from './accounting-engine.mjs';
export const COMMERCE_PROFILES=['comercio','minorista','ropa','ferreteria','farmacia','tecnologia','distribuidora','comercio_electronico'];
export const COMMERCE_OPS=['commerceRouteSettings','commerceLoad','commerceLoadReturn','commerceExpiredReturn','commerceCancel','commerceTradeIn','commerceLoss','commerceReturn','commercePurchaseOrder','commerceProduct','commerceSupplier','commercePromotion','commerceMatrix','commerceOrder','commerceStage','commerceReceipt','commerceSupplierReview','commerceVisit','commerceRouteClose','commerceClaim','commerceInstallments'];
export const commerceRecord=r=>r.kind?.startsWith('commerce-');
const txt=(v,n=200)=>String(v??'').trim().slice(0,n);
const configs=data=>(data.businessRecords||[]).filter(r=>r.kind==='commerce-product');
export const commerceConfig=(data,id)=>configs(data).find(r=>r.productId===id);
export function commercePrice(data,p,customerId,presentation='base'){
 const c=commerceConfig(data,p.id);if(!c)return p.price;
 const channel=(c.customerPrices||[]).find(l=>l.customerIds.includes(customerId));
 const unit=channel?.unitCents??(presentation==='base'?null:c.presentations.find(s=>s.code===presentation)?.unitCents);
 if(unit==null)return p.price;const factor=channel?1:c.presentations.find(s=>s.code===presentation).factor;return commerceUnitCents(unit,factor)/100;
}
export function commerceReserved(data,pid,exceptId=''){
 return (data.businessRecords||[]).filter(r=>r.id!==exceptId&&((r.kind==='commerce-order'&&r.reserved===true&&!r.entryId&&r.status!=='Cancelado')||(r.kind==='commerce-load'&&!r.closed))).flatMap(r=>r.kind==='commerce-load'?r.remaining||[]:r.items||[]).filter(i=>i.p===pid).reduce((n,i)=>n+i.q,0);
}
export function commerceCheckStock(data,body,check,exceptId=''){
 const demand=new Map();for(const i of body.items||[])demand.set(i.p,(demand.get(i.p)||0)+i.q);
 for(const [id,q]of demand){const p=data.products.find(p=>p.id===id);if(p?.kind!=='service')check(q+commerceReserved(data,id,exceptId)<=p.stock+1e-9,'Existencia comprometida por pedidos pagados; revisa la sucursal.');}
}
export function commerceReserve(data,r,check){if(r.kind!=='commerce-order')return;if(moneyCents(r.deposit||0)>=moneyCents(r.total)&&r.total>0){commerceCheckStock(data,r,check,r.id);r.reserved=true;r.paymentState='Anticipo completo';}else {r.reserved=false;r.paymentState=r.deposit?'Anticipo parcial':'Pendiente';}}
export function commerceSaleGuard(data,body,check,trustedSourceId,permit){
 if(body.commerceLoadId){permit('rutas');check(!trustedSourceId,'Factura la carga desde la venta directa.');check((data.businessRecords||[]).some(r=>r.id===body.commerceLoadId&&r.kind==='commerce-load'&&!r.closed),'Carga inexistente o cerrada.');}
 commerceCheckStock(data,body,check,body.commerceLoadId||trustedSourceId);
 check(!body.commercePresentations||Array.isArray(body.commercePresentations)&&body.commercePresentations.length<=200,'Presentaciones inválidas.');
 const choices=new Map();for(const choice of body.commercePresentations||[]){check(choice&&typeof choice.p==='string'&&typeof choice.code==='string','Presentación inválida.');check(!choices.has(choice.p)||choices.get(choice.p)===choice.code,'Factura por separado presentaciones diferentes del mismo producto.');choices.set(choice.p,choice.code);if(choice.code!=='base')check(commerceConfig(data,choice.p)?.presentations?.some(s=>s.code===choice.code),'La presentación ya no está configurada.');}
 for(const i of body.items||[]){const c=commerceConfig(data,i.p);if(!c)continue;if(c.requiresPrescription)check(txt(body.prescriptionReference,100),'Este producto exige referencia de receta; no incluyas datos clínicos.');if(c.controlled)check(txt(body.controlReference,100),'Este producto exige referencia del registro de control.');}
}
export function commerceSnapshot(body){return {...(txt(body.prescriptionReference,100)?{prescriptionReference:txt(body.prescriptionReference,100)}:{}),...(txt(body.controlReference,100)?{controlReference:txt(body.controlReference,100)}:{})}}
export async function commerceOperation(data,access,session,b,ctx){
 const {check}=ctx,permit=m=>ctx.permit(access,m,true);check(COMMERCE_PROFILES.includes(access.company.businessType||'comercio'),'Estas operaciones corresponden a comercio.');check(access.branchId&&b.operationId&&b.confirmed===true,'Selecciona sucursal y confirma.');
 const rows=data.businessRecords||=[],date=ctx.date(b.date),event={date,at:new Date().toISOString(),action:b.operation,actor:session.email,reason:txt(b.reason,500)};
 const add=(module,kind,values)=>{const r={id:randomUUID(),module,kind,name:txt(values.name)||kind,date,status:'Pendiente',branchId:access.branchId,events:[event],...values};rows.push(r);return r};
 const product=id=>{const p=data.products.find(p=>p.id===id);check(p,'Producto inexistente.');return p};
 const supplier=id=>{const s=data.suppliers.find(s=>s.id===id&&s.active!==false);check(s,'Proveedor inexistente o inactivo.');return s};
 const own=()=>check(access.owner,'Solo el dueño configura estas condiciones.');
 const cents=n=>{check(Number.isSafeInteger(n)&&n>=0&&n<=99999999900,'Usa centavos enteros válidos.');return n};
 const get=(kind,id=b.id)=>{const r=rows.find(r=>r.id===id&&r.kind===kind&&r.branchId===access.branchId);check(r,'Registro inexistente en esta sucursal.');ctx.permit(access,r.module,true);return r};
 const put=(module,kind,match,values)=>{const r=rows.find(r=>r.kind===kind&&match(r));if(r){Object.assign(r,values);r.events.push(event);return r.id}return add(module,kind,values).id};
 if(b.operation==='commerceRouteSettings'){
  check(access.company.businessType==='distribuidora','Configuración exclusiva de distribuidora.');permit('rutas');permit('personal');permit('comisiones');own();const route=rows.find(r=>r.module==='rutas'&&r.id===b.routeId&&!commerceRecord(r));check(route&&!route.entryId&&data.employees.some(e=>e.id===b.employeeId&&e.active!==false),'Selecciona ruta sin facturar y vendedor activo.');const commissionRate=Number(b.commissionRate);check(Number.isFinite(commissionRate)&&commissionRate>=0&&commissionRate<=100,'Comisión inválida.');route.employeeId=b.employeeId;route.seller=data.employees.find(e=>e.id===b.employeeId).name;route.commissionRate=commissionRate;route.route=txt(b.zone,100);route.events.push(event);
  return put('rutas','commerce-route-settings',r=>r.routeId===route.id&&r.date===date,{name:route.name,routeId:route.id,employeeId:b.employeeId,zone:txt(b.zone,100),targetCents:cents(b.targetCents)});
 }
 if(b.operation==='commerceLoad'){
  check(access.company.businessType==='distribuidora','La carga corresponde a distribuidora.');permit('rutas');permit('inventario');const route=rows.find(r=>r.module==='rutas'&&r.id===b.routeId&&!commerceRecord(r));check(route&&Array.isArray(b.items)&&b.items.length&&b.items.length<=200,'Selecciona ruta y productos.');const seen=new Set(),items=b.items.map(i=>{const p=product(i.p),q=qty(i.q);check(p.kind!=='service'&&q>0&&!seen.has(p.id),'Cantidad o producto repetido en carga.');seen.add(p.id);return {p:p.id,q,u:0}});commerceCheckStock(data,{items},check);
  return add('rutas','commerce-load',{name:'Carga · '+route.name,status:'Preparada',routeId:route.id,items,remaining:structuredClone(items),sales:[],closed:false}).id;
 }
 if(b.operation==='commerceLoadReturn'){
  permit('rutas');permit('inventario');const load=get('commerce-load');check(!load.closed&&txt(b.reason),'La carga ya fue cerrada o falta motivo.');load.returnedItems=structuredClone(load.remaining);load.remaining=[];load.closed=true;load.status='Entregada';load.events.push(event);return load.id;
 }
 if(b.operation==='commerceExpiredReturn'){
  check(access.company.businessType==='farmacia','Esta devolución corresponde al perfil farmacia.');permit('compras');permit('inventario');permit('lotes');permit('documentos_venta');permit('contabilidad');permit('cajas');
  const lot=rows.find(r=>r.module==='lotes'&&r.id===b.lotId&&r.status==='Disponible'),q=qty(b.q);check(lot&&lot.due<date&&q>0&&q<=lot.q,'Selecciona un lote vencido con cantidad suficiente.');check(!lot.purchaseId||lot.purchaseId===b.invoiceId,'Conserva la compra ya vinculada a este lote.');check(lot.purchaseId||access.owner&&b.purchaseConfirmed===true,'El dueño debe confirmar la compra de origen del lote histórico.');
  const id=ctx.trade({...b,operation:'purchaseReturn',items:[{p:lot.productId,q}]});lot.purchaseId=b.invoiceId;lot.q=qty(lot.q-q);if(!lot.q)lot.status='Agotado';lot.events.push({...event,action:'Devolución de lote vencido al proveedor',entryId:id,q});return add('documentos_venta','commerce-expired-return',{name:lot.name,productId:lot.productId,lotId:lot.id,entryId:id,q,note:txt(b.reason,500)}).id;
 }
 if(b.operation==='commerceCancel'){
  const r=get('commerce-order');check(!r.entryId&&!r.deposit&&txt(b.reason),'Devuelve el anticipo antes de cancelar un pedido sin factura.');r.status='Cancelado';r.commerceStage='Cancelado';r.reserved=false;r.events.push(event);return r.id;
 }
 if(b.operation==='commerceTradeIn'){
  check(access.company.businessType==='tecnologia'&&access.owner,'Solo el dueño registra equipos usados recibidos en tecnología.');permit('inventario');permit('contabilidad');permit('facturacion');permit('documentos_venta');
  const c=data.customers.find(c=>c.id===b.customerId&&c.status==='activo'),amountCents=cents(b.amountCents),code=txt(b.code,80),serial=txt(b.serial,200);check(c&&amountCents>0&&code&&txt(b.name)&&txt(b.reason),'Completa cliente, equipo, valoración, código y motivo.');check(!data.products.some(p=>p.code===code),'El código ya existe.');check(data.accounts.some(a=>a.code===b.liability&&a.tipo==='pasivo'&&a.nat==='C'),'Selecciona pasivo acreedor para el vale del equipo usado.');
  if(serial){permit('variantes');check(!rows.some(r=>r.module==='variantes'&&r.serial?.toLowerCase()===serial.toLowerCase()),'La serie ya existe.');}
  const p={id:randomUUID(),name:txt(b.name),code,kind:'stock',unit:'unidad',category:'Equipos usados',stock:1,cost:amountCents/100,price:cents(b.unitCents)/100,vatRate:Number(b.vatRate||0),used:true};check(Number.isFinite(p.vatRate)&&p.vatRate>=0&&p.vatRate<=100,'IVA de futura venta inválido.');data.products.push(p);
  const e=ctx.entry({date,type:'compra',desc:'Equipo usado recibido · '+p.name,party:c.name,customerId:c.id,reference:'USADO-'+p.id.slice(0,8),pay:b.liability,total:p.cost,subtotal:p.cost,vat:0,stock:[{pid:p.id,q:1,unit:'unidad',unitCost:p.cost}],lines:[{a:'1301',d:p.cost,c:0},{a:b.liability,d:0,c:p.cost}]});
  const voucher={id:randomUUID(),module:'facturacion',kind:'gift-voucher',name:'USADO-'+p.id.slice(0,8),date,due:'',status:'Activa',branchId:access.branchId,customerId:c.id,entryId:e.id,liability:b.liability,originalCents:amountCents,balanceCents:amountCents,events:[{...event,action:'Equipo recibido como parte de pago',entryId:e.id,amountCents}]};rows.push(voucher);
  if(serial)add('variantes','serie',{name:p.name,status:'Disponible',productId:p.id,serial,warranty:txt(b.warranty,1000)});
  return add('documentos_venta','commerce-tradein',{name:p.name,productId:p.id,customerId:c.id,entryId:e.id,voucherId:voucher.id,amountCents,note:txt(b.reason,500)}).id;
 }
 if(b.operation==='commerceReturn'){
  permit('facturacion');permit('contabilidad');permit('cajas');const note=ctx.credit({...b,id:b.invoiceId,refundMethod:'vale_cambio',reasonCategory:'devolución'});return note.id;
 }
 if(b.operation==='commerceLoss'){
  permit('inventario');permit('contabilidad');permit('documentos_venta');const p=product(b.productId),q=qty(b.q);check(p.kind!=='service'&&q>0&&q<=p.stock&&['robo','daño','merma','faltante'].includes(b.lossType)&&txt(b.reason),'Indica cantidad, tipo y motivo de la pérdida.');
  check(!data.entries.some(e=>e.date>date&&e.stock?.some(i=>i.pid===p.id)),'La pérdida no puede preceder movimientos posteriores.');
  const serials=rows.filter(r=>r.module==='variantes'&&r.productId===p.id&&r.serial);if(serials.length){permit('variantes');const ids=Array.isArray(b.serialIds)?b.serialIds:[];check(Number.isInteger(q)&&ids.length===q&&new Set(ids).size===q,'Selecciona una serie por unidad perdida.');for(const id of ids){const serial=serials.find(r=>r.id===id&&r.status==='Disponible');check(serial,'Una serie no está disponible para dar de baja.');serial.status='Baja';serial.events.push({...event,action:'Baja por pérdida · '+b.lossType});}}

  const lots=rows.filter(r=>r.module==='lotes'&&r.productId===p.id);if(lots.length){permit('lotes');const lot=lots.find(r=>r.id===b.lotId&&r.status==='Disponible'&&r.q>=q);check(lot,'Selecciona un lote con cantidad suficiente.');lot.q=qty(lot.q-q);if(!lot.q)lot.status='Agotado';lot.events.push({...event,action:'Pérdida · '+b.lossType,q});}
  check(data.accounts.some(a=>a.code===b.account&&['gasto','costo'].includes(a.tipo)),'Selecciona una cuenta de gasto o costo.');
  const total=invoiceTotals([{q,u:p.cost,vatRate:0}]).total,e=ctx.entry({date,type:'ajuste',adjustmentReason:'merma',desc:'Pérdida · '+b.lossType+' · '+p.name+' · '+txt(b.reason,500),total,stock:[{pid:p.id,q:-q,unit:p.unit||'unidad',unitCost:p.cost}],lines:total?[{a:b.account,d:total,c:0},{a:'1301',d:0,c:total}]:[]});p.stock=qty(p.stock-q);
  return add('documentos_venta','commerce-loss',{name:p.name,productId:p.id,q,lossType:b.lossType,note:txt(b.reason,500),entryId:e.id,amountCents:moneyCents(total),lotId:b.lotId||'',serialIds:Array.isArray(b.serialIds)?b.serialIds:[]}).id;
 }
 if(b.operation==='commercePurchaseOrder'){
  permit('documentos_venta');permit('compras');permit('inventario');permit('proveedores');const s=supplier(b.supplierId);check(Array.isArray(b.items)&&b.items.length&&b.items.length<=200,'Agrega productos a la orden.');
  const items=b.items.map(i=>{const p=product(i.p),q=qty(i.q),offer=rows.find(r=>r.kind==='commerce-supplier'&&r.supplierId===s.id&&r.productId===p.id);check(p.kind!=='service'&&q>0&&offer,'Cada producto debe tener una oferta de este proveedor.');return {p:p.id,q,u:commerceSupplierNetCents(offer.unitCents,offer.discount)/100}});
  ctx.purchase({operation:'purchaseOrder',date,name:s.name,supplierId:s.id,items,confirmed:true});const order=data.purchaseOrders.at(-1);order.supplierTerms=items.map(i=>{const o=rows.find(r=>r.kind==='commerce-supplier'&&r.supplierId===s.id&&r.productId===i.p);return {productId:i.p,unitCents:o.unitCents,discount:o.discount,days:o.days,terms:o.terms}});return order.id;
 }
 if(b.operation==='commerceProduct'){
  permit('documentos_venta');permit('inventario');own();const p=product(b.productId);check(p.kind!=='service','Configura un artículo inventariable.');
  check(Array.isArray(b.presentations)&&b.presentations.length<=12&&Array.isArray(b.customerPrices)&&b.customerPrices.length<=12,'Máximo doce presentaciones y listas.');
  const seen=new Set(),presentations=b.presentations.map(s=>{const code=txt(s.code,30),factor=qty(s.factor),unitCents=cents(s.unitCents);check(code&&code!=='base'&&!seen.has(code)&&factor>0,'Presentación duplicada o inválida.');seen.add(code);commerceUnitCents(unitCents,factor);return {code,factor,unitCents}});
  const used=new Set(),customerPrices=b.customerPrices.map(l=>{const name=txt(l.name,60);check(name&&Array.isArray(l.customerIds)&&l.customerIds.length&&l.customerIds.length<=200,'Selecciona clientes para cada lista.');const customerIds=l.customerIds.map(id=>{check(data.customers.some(c=>c.id===id&&c.status==='activo')&&!used.has(id),'Cliente repetido o inactivo en listas.');used.add(id);return id});return {name,customerIds,unitCents:cents(l.unitCents)}});
  const min=qty(b.min),max=qty(b.max);check(max>=min,'El máximo no puede ser menor que el mínimo.');if(b.supplierId){permit('proveedores');supplier(b.supplierId)}
  const seasons=(Array.isArray(b.seasons)?b.seasons:[]).map(s=>({name:txt(s.name,60),from:ctx.date(s.from),to:ctx.date(s.to),min:qty(s.min),max:qty(s.max)}));check(seasons.length<=8&&seasons.every((s,i)=>s.to>=s.from&&s.max>=s.min&&seasons.every((o,j)=>i===j||s.to<o.from||s.from>o.to)),'Temporadas superpuestas o límites inválidos.');
  const accessories=(Array.isArray(b.accessoryIds)?b.accessoryIds:[]).map(id=>product(id).id);check(accessories.length<=12&&!accessories.includes(p.id),'Accesorios inválidos.');
  return put('documentos_venta','commerce-product',r=>r.productId===p.id,{name:p.name,productId:p.id,presentations,customerPrices,min,max,supplierId:b.supplierId||'',seasons,collection:txt(b.collection,80),size:txt(b.size,40),color:txt(b.color,40),compatibility:txt(b.compatibility,1000),laboratory:txt(b.laboratory,120),ingredient:txt(b.ingredient,120),requiresPrescription:b.requiresPrescription===true,controlled:b.controlled===true,accessoryIds:accessories});
 }
 if(b.operation==='commerceSupplier'){
  permit('documentos_venta');permit('compras');permit('proveedores');own();const s=supplier(b.supplierId),p=product(b.productId),days=Number(b.days),discount=Number(b.discount);commerceSupplierNetCents(cents(b.unitCents),discount);check(Number.isInteger(days)&&days>=0&&days<=730&&Number.isFinite(discount)&&discount>=0&&discount<100,'Condiciones de pago inválidas.');
  return put('documentos_venta','commerce-supplier',r=>r.supplierId===s.id&&r.productId===p.id,{name:txt(s.name+' · '+p.name),supplierId:s.id,productId:p.id,unitCents:cents(b.unitCents),days,discount,terms:txt(b.terms,1000)});
 }
 if(b.operation==='commercePromotion'){
  permit('documentos_venta');own();product(b.productId);const from=ctx.date(b.from),to=ctx.date(b.to),minimum=qty(b.minimum),percent=Number(b.percent);check(to>=from&&minimum>0&&['2x1','volumen','temporada','cupon'].includes(b.mode)&&Number.isFinite(percent)&&percent>0&&percent<100,'Promoción inválida.');
  return add('documentos_venta','commerce-promotion',{name:txt(b.name)||'Promoción',productId:b.productId,from,to,minimum,percent,mode:b.mode,code:txt(b.code,40)}).id;
 }
 if(b.operation==='commerceMatrix'){
  permit('inventario');permit('documentos_venta');own();check(access.company.businessType==='ropa','La matriz corresponde al perfil ropa.');
  const sizes=[...new Set((b.sizes||[]).map(v=>txt(v,30)).filter(Boolean))],colors=[...new Set((b.colors||[]).map(v=>txt(v,30)).filter(Boolean))],name=txt(b.name,100),prefix=txt(b.prefix,30);check(name&&prefix&&sizes.length&&colors.length&&sizes.length*colors.length<=100,'Configura de 1 a 100 variantes.');
  const price=cents(b.unitCents)/100,vatRate=Number(b.vatRate||0);check(vatRate>=0&&vatRate<=100&&Number.isFinite(vatRate),'IVA inválido.');const codes=sizes.flatMap((s,i)=>colors.map((c,j)=>prefix+'-'+(i+1)+'-'+(j+1)));check(codes.every(code=>!data.products.some(p=>p.code===code)),'Un código ya existe; cambia el prefijo.');let n=0;
  for(const size of sizes)for(const color of colors){const p={id:randomUUID(),code:codes[n++],name:name+' · '+size+' · '+color,unit:'unidad',kind:'stock',category:txt(b.collection,80)||'Ropa',price,cost:0,stock:0,min:0,vatRate};data.products.push(p);add('documentos_venta','commerce-product',{name:p.name,productId:p.id,size,color,collection:txt(b.collection,80),presentations:[],customerPrices:[],min:0,max:0,seasons:[],accessoryIds:[]});}return data.products.at(-1).id;
 }
 if(b.operation==='commerceOrder'){
  permit('documentos_venta');permit('inventario');check(['retiro','envio','apartado','obra','reparacion'].includes(b.mode),'Modalidad inválida.');const customer=data.customers.find(c=>c.id===b.customerId&&c.status==='activo');check(customer,'Selecciona un cliente activo.');
  check(Array.isArray(b.items)&&b.items.length&&b.items.length<=200,'Agrega de 1 a 200 líneas.');const items=b.items.map(i=>{const p=product(i.p),q=commerceMeasure({quantity:i.q,factor:1}),u=commercePrice(data,p,customer.id,i.presentation||'base');check(Number.isFinite(u)&&u>=0,'Precio inválido.');return {p:p.id,q,u,commercePresentation:i.presentation||'base',name:p.name,unit:p.unit||'unidad',vatRate:p.vatRate||0}});
  if(b.shippingProductId){const p=product(b.shippingProductId);check(p.kind==='service'&&!p.serviceDefinition?.enabled,'El envío debe ser un servicio sin consumibles.');items.push({p:p.id,q:1,u:p.price,name:p.name,unit:p.unit||'servicio',vatRate:p.vatRate||0})}
  const origin=txt(b.origin,30)||'tienda';check(['tienda','web','WhatsApp','redes'].includes(origin),'Origen inválido.');
  return add('documentos_venta','commerce-order',{name:txt(b.name)||customer.name,customerId:customer.id,items,total:invoiceTotals(items).total,mode:b.mode,origin,commerceStage:'Recibido',paymentState:'Pendiente',reserved:false,deposit:0,due:ctx.date(b.due||date),address:txt(b.address,500),equipment:txt(b.equipment,200),resource:txt(b.equipment,200),modality:['retiro','apartado'].includes(b.mode)?'llevar':['envio','obra'].includes(b.mode)?'domicilio':'local'}).id;
 }
 if(b.operation==='commerceStage'){
  const r=get('commerce-order'),stages=['retiro','apartado','reparacion'].includes(r.mode)?['Recibido','Preparando','Listo','Entregado']:['Recibido','Preparando','Listo','Enviado','Entregado'];check(r.status!=='Cancelado'&&stages.indexOf(b.stage)===stages.indexOf(r.commerceStage)+1,'Avanza al siguiente estado.');
  if(['Enviado','Entregado'].includes(b.stage)){check(r.entryId,'Factura el pedido antes de despachar.');if(b.stage==='Enviado'&&r.mode!=='retiro')check(txt(b.tracking,100),'Indica número de guía.');if(b.stage==='Entregado'&&r.mode==='obra')check(txt(b.signedBy,120)&&txt(b.signature,1000),'Registra receptor y firma de conformidad.');}
  r.commerceStage=b.stage;r.tracking=txt(b.tracking,100)||r.tracking||'';r.signedBy=txt(b.signedBy,120);r.signature=txt(b.signature,1000);r.events.push(event);return r.id;
 }
 if(b.operation==='commerceReceipt'){
  permit('documentos_venta');permit('compras');permit('inventario');permit('proveedores');const order=data.purchaseOrders.find(o=>o.id===b.orderId),entry=data.entries.find(e=>e.id===b.entryId&&e.type==='compra');check(order&&entry&&order.entryId===entry.id&&order.status==='Convertida','Recibe la orden desde Compras antes de evaluar la recepción.');const s=supplier(b.supplierId);check(!entry.supplierId||entry.supplierId===s.id,'Conserva el proveedor de la compra.');check(!rows.some(r=>r.kind==='commerce-receipt'&&r.entryId===entry.id),'La recepción ya está evaluada.');return add('documentos_venta','commerce-receipt',{name:'Recepción · '+order.name,entryId:entry.id,orderId:order.id,supplierId:s.id,note:txt(b.note,1000),difference:txt(b.difference,500)}).id;
 }
 if(b.operation==='commerceSupplierReview'){
  permit('documentos_venta');permit('compras');permit('proveedores');const s=supplier(b.supplierId),score=Number(b.score);check(Number.isInteger(score)&&score>=1&&score<=5&&txt(b.reason),'Evalúa de 1 a 5 y explica el motivo.');return add('documentos_venta','commerce-review',{name:s.name,supplierId:s.id,score,note:txt(b.reason,500)}).id;
 }
 if(b.operation==='commerceVisit'){
  permit('rutas');const customer=data.customers.find(c=>c.id===b.customerId&&c.status==='activo');check(customer,'Cliente inválido.');check(['Pendiente','Realizada','No realizada'].includes(b.result),'Resultado inválido.');return add('rutas','commerce-visit',{name:customer.name,status:'Preventa',customerId:customer.id,zone:txt(b.zone,100),seller:txt(b.seller,120),result:b.result,note:txt(b.reason,500)}).id;
 }
 if(b.operation==='commerceRouteClose'){
  permit('rutas');permit('contabilidad');permit('cajas');const r=rows.find(r=>r.id===b.id&&r.module==='rutas'&&!commerceRecord(r));check(r,'Ruta inexistente.');check(!rows.some(x=>x.kind==='commerce-route-close'&&x.routeId===r.id&&x.date===date),'La ruta ya tiene cuadre de esta fecha.');
  const available=commerceRouteCashRows(rows,data.entries,r.id,date),ids=b.entryIds||[];check(Array.isArray(ids)&&ids.length<=1000&&new Set(ids).size===ids.length&&available.length===ids.length&&available.every(e=>ids.includes(e.entryId)),'Incluye todos los cobros y devoluciones de la ruta y fecha.');check(!rows.some(x=>x.kind==='commerce-route-close'&&x.entryIds.some(id=>ids.includes(id))),'Un movimiento ya está incluido en otro cuadre.');
  const amountCents=available.reduce((n,e)=>n+e.amountCents,0),bankCents=available.reduce((n,e)=>n+e.bankCents,0),counted=cents(b.amountCents);check(txt(b.reason),'Explica el resultado del cuadre.');return add('rutas','commerce-route-close',{name:'Cuadre · '+r.name,status:'Preparada',routeId:r.id,entryIds:ids,cashRows:available,amountCents,bankCents,receivedCents:counted,differenceCents:counted-amountCents}).id;
 }
 if(b.operation==='commerceClaim'){
  permit('variantes');permit('proveedores');const serial=rows.find(r=>r.id===b.serialId&&r.module==='variantes'&&r.serial);check(serial&&txt(b.reason),'Selecciona serie y motivo.');const s=supplier(b.supplierId);return add('variantes','commerce-claim',{name:'Reclamo · '+serial.serial,status:'Disponible',serialId:serial.id,supplierId:s.id,note:txt(b.reason,1000)}).id;
 }
 if(b.operation==='commerceInstallments'){
  permit('documentos_venta');permit('contabilidad');const e=data.entries.find(e=>e.id===b.entryId&&e.type==='venta'&&e.customerId&&e.creditAmount>0);check(e&&!rows.some(r=>r.kind==='commerce-installments'&&r.entryId===e.id),'Selecciona una factura a crédito sin calendario.');check(Array.isArray(b.installments)&&b.installments.length&&b.installments.length<=60,'Agrega de 1 a 60 cuotas.');const installments=b.installments.map(i=>({due:ctx.date(i.due),amountCents:cents(i.amountCents)}));check(installments.every((i,n)=>i.amountCents>0&&i.due>=e.date&&(!n||i.due>installments[n-1].due))&&installments.reduce((s,i)=>s+i.amountCents,0)===moneyCents(e.creditAmount),'Las cuotas deben sumar el crédito original y tener fechas crecientes.');return add('documentos_venta','commerce-installments',{name:'Cuotas · '+e.reference,entryId:e.id,customerId:e.customerId,installments}).id;
 }
 check(false,'Operación de comercio no disponible.');
}
export function commerceReport(data,access,b,ctx){
 const {check}=ctx;check(access.branchId,'Selecciona una sucursal para consultar la operación de comercio.');ctx.permit(access,'documentos_venta',false);ctx.permit(access,'inventario',false);check(COMMERCE_PROFILES.includes(access.company.businessType||'comercio'),'Informe exclusivo de comercio.');const date=ctx.date(b.date),from=ctx.date(b.from||date),to=ctx.date(b.to||date);check(from<=to,'Período inválido.');const rows=data.businessRecords||[],orders=data.purchaseOrders||[];
 const replenishment=configs(data).map(c=>{const p=data.products.find(p=>p.id===c.productId),s=(c.seasons||[]).find(s=>s.from<=date&&s.to>=date)||c,pending=orders.filter(o=>o.status==='Pendiente').flatMap(o=>o.items).filter(i=>i.p===p?.id).reduce((n,i)=>n+i.q,0);return {productId:p?.id,name:p?.name||c.name,stock:p?.stock||0,reserved:commerceReserved(data,c.productId),min:s.min,max:s.max,pending,supplierId:c.supplierId,season:s.name||'',q:commerceReplenishment({stock:(p?.stock||0)-commerceReserved(data,c.productId),min:s.min,max:s.max,pending})}}).filter(r=>r.q>0);
 const expiry=rows.filter(r=>r.module==='lotes'&&r.status==='Disponible'&&r.q>0).map(r=>({...r,days:Math.ceil((Date.parse(r.due)-Date.parse(date))/86400000)})).filter(r=>r.days<=90).map(r=>({id:r.id,name:r.name,productId:r.productId,q:r.q,due:r.due,days:r.days,alert:r.days<0?'Vencido':r.days<=30?'30 días':r.days<=60?'60 días':'90 días'}));
 return {replenishment,expiry,records:rows.filter(commerceRecord),abc:ctx.canRead('ventas')?commerceABC(data.products,data.entries,from,to):null,comparisons:ctx.canRead('proveedores')&&ctx.canRead('compras')?rows.filter(r=>r.kind==='commerce-supplier').map(r=>({...r,netUnitCents:commerceSupplierNetCents(r.unitCents,r.discount)})):null};
}

export function commerceCanRead(r,can){
 if(!commerceRecord(r))return true;
 if(['commerce-supplier','commerce-review','commerce-receipt'].includes(r.kind))return can('compras')&&can('proveedores');
 if(['commerce-installments','commerce-loss','commerce-tradein'].includes(r.kind))return can('contabilidad');
 if(r.kind==='commerce-expired-return')return can('compras')&&can('lotes')&&can('contabilidad');
 if(r.kind==='commerce-route-settings')return can('personal')&&can('comisiones');
 if(r.kind==='commerce-load')return can('inventario');
 if(r.kind==='commerce-route-close')return can('contabilidad')&&can('cajas');
 if(r.kind==='commerce-claim')return can('proveedores');
 return true;
}
export function commerceReservationsValid(data,check){
 for(const p of data.products||[])if(p.kind!=='service')check(commerceReserved(data,p.id)<=p.stock+1e-9,'La operación invade existencias reservadas por pedidos pagados.');
}

export function commerceLoadSale(data,body,entry,check,permit){
 if(!body.commerceLoadId)return;
 const records=data.businessRecords||[],load=records.find(r=>r.kind==='commerce-load'&&r.id===body.commerceLoadId&&!r.closed);check(load,'Carga no disponible.');permit('rutas');const route=records.find(r=>r.module==='rutas'&&r.id===load.routeId);check(route,'Ruta inexistente.');
 for(const i of entry.items.filter(i=>!i.service)){const remaining=load.remaining.find(r=>r.p===i.p);check(remaining&&remaining.q>=i.q,'La venta supera la cantidad pendiente de la carga.');remaining.q=qty(remaining.q-i.q);}
 load.sales.push(entry.id);entry.commerceLoadId=load.id;load.events.push({date:entry.date,action:'Venta de carga',entryId:entry.id});
 if(route.commissionRate){permit('comisiones');permit('personal');check(data.employees.some(e=>e.id===route.employeeId&&e.active!==false),'Vendedor inactivo.');records.push({id:randomUUID(),module:'comisiones',kind:'ruta',name:txt('Comisión · '+entry.reference),date:entry.date,status:'Pendiente',branchId:load.branchId,employeeId:route.employeeId,saleId:entry.id,rate:route.commissionRate,paid:0,events:[]});}
}
