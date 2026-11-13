import {randomUUID} from 'node:crypto';
export function registerConnectedCost(data, access, session, body, ctx) {
  const {amount,round,text,dateValue,requireValue,accountExists,appendEntry,operatorId,createVoucher}=ctx;
  const catalog = data.costCatalog.find(record => record.id === body.catalogId && record.active);
  requireValue(catalog, 'Selecciona un costo activo del catálogo.');
  const fields=costFields(data,access,body,catalog,requireValue,ctx.readPermit);
  accountExists(data,fields.account,['gasto','costo']);
  const base = amount(body.base ?? catalog.amount), vatRate = Number(body.vatRate || 0);
  requireValue(Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100, 'IVA inválido.');
  const vat = round(base * vatRate / 100), total = round(base + vat), date = dateValue(body.date);
  requireValue(text(body.reference), 'El costo necesita un número de recibo o comprobante.');
  const supplier = data.suppliers.find(record => record.id === body.supplierId);
  if (body.supplierId) requireValue(supplier?.active, 'Selecciona un proveedor activo.');
  let pay = body.pay;
  requireValue(['1101', '1102', '2101', 'petty'].includes(pay), 'Forma de pago inválida.');
  if (pay === 'petty') pay = '2107';
  const lines = [{ a: fields.account, d: base, c: 0 }, { a: pay, d: 0, c: total }];
  if (vat) lines.push({ a: '1202', d: vat, c: 0 });
  const entry = appendEntry(data, session, { ...fields, costCenter:fields.center, date, type: 'costo', desc: 'Costo - ' + catalog.name + (fields.notes?' · '+fields.notes:''), party: supplier?.name || text(body.party) || catalog.name, supplierId: supplier?.id || '', reference: text(body.reference), due: body.pay==='2101'?dateValue(body.due):date, pay, subtotal: base, vat, total, lines });
  requireValue(entry.due >= date || pay !== '2101', 'El vencimiento no puede ser anterior al costo.');
  const record = { id: randomUUID(), entryId: entry.id, catalogId: catalog.id, name: catalog.name, ...fields, date, period: date.slice(0, 7), base, vat, total, pay: body.pay, reference: entry.reference, beneficiary: entry.party, operatorId: operatorId(access, session), recurringPeriod: body.recurringPeriod || null, saleId: fields.saleId || null };
  if (body.recurringPeriod) {
    requireValue(/^\d{4}-\d{2}$/.test(body.recurringPeriod) && body.recurringPeriod === date.slice(0, 7) && catalog.recurring && !data.costs.some(cost => cost.catalogId === catalog.id && cost.recurringPeriod === body.recurringPeriod && !cost.reversalId), 'Ese costo recurrente ya se confirmó o el período no corresponde.');
  }
  if (body.pay === 'petty') {
    const voucher = createVoucher(data, access, session, { ...body, base, vatRate, account: fields.account, category: catalog.name, concept: entry.desc, beneficiary: entry.party }, entry.id);
    record.voucherId = voucher.id;
  }
  data.costs.push(record);
  return record;
}

const linkFields=['saleId','eventId','businessId','customerId','productId'];
export function costReversalFields(entry){
 return Object.fromEntries([...linkFields,'branchId','costCenter','project','organizationEventId','organizationFundId','notes'].filter(k=>entry[k]!==undefined).map(k=>[k,entry[k]]));
}
export function costFields(data,access,body,catalog,check,read=()=>{}){
 const branchId=access.branchId;
 check(branchId,'Selecciona una sucursal para registrar el costo.');
 check(!body.branchId||body.branchId===branchId,'La sucursal debe coincidir con la sesión.');
 const fields={branchId,account:body.account??catalog.account,type:body.type??catalog.type,direct:body.direct??catalog.direct,center:String(body.center??body.costCenter??catalog.center??'').trim().slice(0,100),notes:String(body.notes||'').trim().slice(0,1000)};
 check(['fijo','variable'].includes(fields.type)&&typeof fields.direct==='boolean','Tipo o clasificación de costo inválidos.');
 check(body.center===undefined||!body.costCenter||String(body.center).trim()===String(body.costCenter).trim(),'Usa un solo centro de costo.');
 const lookup={saleId:data.entries,eventId:data.businessRecords,businessId:data.businessRecords,customerId:data.customers,productId:data.products};
 for(const key of linkFields){
  if(!body[key])continue;
  const r=(lookup[key]||[]).find(r=>r.id===body[key]);
  check(r,'El vínculo del costo no existe en esta empresa.');
  // Clientes y productos son catálogos compartidos; registros operativos son por sucursal.
  check(['customerId','productId'].includes(key)?(!r.branchId||r.branchId===branchId):(r.branchId||'principal')===branchId,'El vínculo pertenece a otra sucursal.');
  check(!r.date||r.date<=body.date,'El costo no puede preceder al documento vinculado.');
  if(key==='saleId')check(r.type==='venta'&&!r.reversalId,'Selecciona una venta vigente.');
  if(key==='eventId')check(r.kind==='organization-event','Selecciona un evento válido.');
  if(key==='businessId')check(['proyectos','lotes','produccion','reservas','contratos','rutas','aportes'].includes(r.module)||r.kind==='lodging-unit','Selecciona un proyecto, lote, reserva, contrato o ruta.');
  read(key==='saleId'?'sale':key==='eventId'?'aportes':key==='businessId'?r.module:key==='customerId'?'ventas':'inventario');
  fields[key]=r.id;
 }
 if(fields.eventId)fields.organizationEventId=fields.eventId;
 if(fields.businessId){const r=data.businessRecords.find(r=>r.id===fields.businessId);fields.project=r.project||r.name||r.id;}
 if(fields.saleId&&fields.customerId){const sale=data.entries.find(e=>e.id===fields.saleId);check(sale.customerId===fields.customerId,'El cliente no coincide con la venta.');}
 return fields;
}
export function seedCostCatalog(data){
 if(data.costCatalog?.length)return false;
 data.costCatalog||=[];
 const profile=data.businessType==='personalizado'?(data.businessCustomization?.operationalProfile||'comercio'):(data.businessType||'comercio');
 const production=['manufactura','industria','agricultura','panaderia','restaurante','comida_rapida','catering'].some(p=>profile.includes(p));
 const rows=[['Alquiler','6102','fijo',false],['Servicios básicos','6103','fijo',false],['Transporte y fletes','6104','variable',true],['Publicidad','6105','fijo',false],['Sueldos','6101','fijo',false],['Comisiones','6110','variable',true],['Mantenimiento','6111','fijo',false],['Empaque','5110','variable',true],['Materia prima','5111','variable',true],['Mano de obra directa','5112','variable',true],['Costos indirectos de fabricación','5113','variable',false],['Intereses y comisiones bancarias','6112','variable',false]];
 for(const [name,preferred,type,direct] of rows){
  let account=data.accounts.find(a=>a.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')&&['gasto','costo'].includes(a.tipo));
  if(['6101','6102','6103','6104','6105'].includes(preferred))account||=data.accounts.find(a=>a.code===preferred&&['gasto','costo'].includes(a.tipo));
  if(!account){let code=preferred,index=1;while(data.accounts.some(a=>a.code===code))code=preferred+'-'+index++;account={code,name,tipo:preferred.startsWith('5')?'costo':'gasto',nat:'D',sub:''};data.accounts.push(account);}
  data.costCatalog.push({id:randomUUID(),name,account:account.code,type,direct,center:production&&preferred.startsWith('5')?'Producción':'General',amount:0,recurring:false,startMonth:new Date().toISOString().slice(0,7),active:true});
 }
 return true;
}

export function reverseConnectedCost(data,session,body,ctx){
 const {requireValue,dateValue,text,appendEntry}=ctx;
 const cost = data.costs.find(record => record.id === body.id && !record.reversalId), original = data.entries.find(entry => entry.id === cost?.entryId);
        requireValue(cost && original && text(body.reason) && text(body.reference), 'Costo no encontrado o motivo vacío.');
        const date = dateValue(body.date);
        requireValue(date >= original.date, 'La anulación no puede ser anterior al costo.');
        requireValue(!data.entries.some(entry => entry.invoiceId === original.id||entry.lines?.some(l=>l.invoiceId===original.id)), 'El costo tiene abonos; revierte primero esos pagos mediante un asiento autorizado.');
        const voucher = data.pettyVouchers.find(record => record.id === cost.voucherId);
        requireValue(!voucher?.replenishmentId, 'El vale ya fue repuesto; requiere un ajuste autorizado de caja.');
        const reversal = appendEntry(data, session, { ...costReversalFields({...cost,costCenter:cost.center,...original}), date, type: 'costo', reversalOf: original.id, desc: 'Anulación de costo - ' + text(body.reason), reference: text(body.reference), total: original.total, lines: original.lines.map(line => ({ a: line.a, d: line.c, c: line.d })) });
        cost.reversalId = reversal.id; if (voucher) voucher.reversalId = reversal.id;
 return reversal;
}
