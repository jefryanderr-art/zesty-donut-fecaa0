'use strict';
// Extiende el editor de servicios; el catálogo y la navegación de la entrega anterior se conservan.
const serviceCatalogProductForm=productForm;
const serviceText=(key,text)=>uiT('serviceCatalog.'+key,text);
const serviceEscape=(key,text)=>esc(serviceText(key,text));
const serviceSelect=(name,label,rows,selected)=>selectField(name,label,rows.map(([id,text])=>option(id,text,id===selected)).join(''));
const serviceOptions=kind=>S.products.filter(p=>kind==='component'?p.kind==='service':p.kind!=='service').map(p=>[p.id,p.name]);
function serviceCatalogRow(kind,row={}){
 const employee=kind==='employee',choices=employee?S.employees.map(e=>[e.id,e.name]):serviceOptions(kind);
 return `<div class="business-item" data-service-row="${esc(kind)}">${serviceSelect('serviceRef',serviceText(employee?'employee':'concept',employee?'Empleado':'Concepto'),[['',serviceText('select','Selecciona')],...choices],employee?row.employeeId:row.p)}${field('serviceQuantity',serviceText(employee?'bps':'quantity',employee?'Comisión en puntos básicos (100 = 1%)':'Cantidad por servicio'),employee?(row.basisPoints||0):(row.q||1),'number',employee?'min="0" max="10000" step="1" required':'min="0.001" max="1000000" step="0.001" required')}<button type="button" class="lk" data-a="serviceRemoveRow">${serviceEscape('remove','Quitar')}</button></div>`;
}
function serviceCatalogRows(kind,rows,label){return `<fieldset><legend>${esc(label)}</legend><div data-service-rows="${esc(kind)}">${rows.map(row=>serviceCatalogRow(kind,row)).join('')}</div><button type="button" class="btn ghost" data-a="serviceAddRow" data-kind="${esc(kind)}">${serviceEscape('add','Agregar línea')}</button></fieldset>`;}
ACTION_MODULE.serviceAddRow='inventario';ACTION_MODULE.serviceRemoveRow='inventario';
ACT.serviceAddRow=(data,button)=>button.previousElementSibling.insertAdjacentHTML('beforeend',serviceCatalogRow(data.kind));
ACT.serviceRemoveRow=(data,button)=>button.closest('[data-service-row]').remove();
function serviceCharacteristics(product){
 const def=product.serviceDefinition||{},personal=permission('personal',true);
 const html=field('name',serviceText('name','Nombre del servicio'),product.name,'text','required maxlength="200"')+field('code',serviceText('code','Código'),product.code||'','text','maxlength="80"')+amountField('price',serviceText('price','Precio por unidad sin IVA'),product.price)+
 bCheck('enabled',serviceText('enabled','Activar características del servicio para ventas futuras'),def.enabled===true)+
 field('durationMinutes',serviceText('duration','Duración estándar en minutos (0: sin duración)'),def.durationMinutes||0,'number','required min="0" max="525600" step="1"')+
 serviceSelect('billingUnit',serviceText('unit','Unidad de cobro'),['hora','sesión','mes','visita','servicio'].map(unit=>[unit,serviceText('unit.'+unit,unit)]),def.billingUnit||(['hora','sesión','mes','visita'].includes(product.unit)?product.unit:'servicio'))+
 serviceSelect('taxMode',serviceText('tax','Tratamiento del IVA'),[['gravado',serviceText('taxed','Gravado')],['exento',serviceText('exempt','Exento (requiere motivo)')],['tasa_cero',serviceText('zero','Tasa cero')]],def.taxMode||(product.vatRate?'gravado':'tasa_cero'))+
 field('vatRate',serviceText('vat','IVA configurado (%)'),def.vatRate??product.vatRate??0,'number','required min="0" max="100" step="0.01"')+
 field('taxReason',serviceText('taxReason','Motivo de exención / referencia para revisión'),def.taxReason||'','text','maxlength="500"')+
 field('commissionBasisPoints',serviceText('commission','Comisión del catálogo en puntos básicos (100 = 1%)'),def.commissionBasisPoints||0,'number','required min="0" max="10000" step="1"')+
 notice(serviceText('commissionHelp','La comisión se calcula sobre el importe sin IVA después del descuento y queda como referencia; no genera pago ni nómina.'))+
 (personal?serviceCatalogRows('employee',def.employeeCommissions||[],serviceText('employees','Comisiones por empleado')):notice(serviceText('personalHelp','Las comisiones individuales requieren permiso de Personal; una configuración que las use solo puede cambiarse con ese permiso.')))+
 serviceCatalogRows('component',def.components||[],serviceText('components','Paquete de servicios (sin stock ni paquetes anidados)'))+
 serviceCatalogRows('consumable',def.consumables||[],serviceText('consumables','Consumibles inventariables por prestación'))+
 notice(serviceText('help','El precio del paquete es el del catálogo; no suma precios de componentes ni los factura dos veces. Los consumibles requieren existencias libres en la sucursal activa. No se consumen automáticamente artículos con lotes, series o producción. Una nota de crédito no repone insumos ya utilizados. El IVA y las comisiones requieren revisión: verifica con tu contador.'))+
 field('reason',serviceText('reason','Motivo del cambio'),'','text','required minlength="3" maxlength="500"')+
 bCheck('confirmed',serviceText('confirmed','Confirmo el cambio solo para operaciones futuras, sin modificar documentos anteriores.'));
 modal(serviceText('title','Características del servicio'),html,async form=>{
  if(!form.elements.confirmed.checked)return serviceText('confirmError','Confirma el cambio antes de guardar.');
  const read=kind=>[...form.querySelectorAll('[data-service-row="'+kind+'"]')].map(row=>{
   const ref=row.querySelector('[name=serviceRef]').value,n=Number(row.querySelector('[name=serviceQuantity]').value);
   return kind==='employee'?{employeeId:ref,basisPoints:n}:{p:ref,q:n};
  });
  await operate('serviceDefinition',{id:product.id,name:v(form,'name'),code:v(form,'code'),price:+v(form,'price'),reason:v(form,'reason'),confirmed:true,definition:{version:1,enabled:form.elements.enabled.checked,durationMinutes:+v(form,'durationMinutes'),billingUnit:v(form,'billingUnit'),taxMode:v(form,'taxMode'),taxReason:v(form,'taxReason'),vatRate:+v(form,'vatRate'),commissionBasisPoints:+v(form,'commissionBasisPoints'),employeeCommissions:personal?read('employee'):[],components:read('component'),consumables:read('consumable')}});view();
 });
}
ACTION_MODULE.serviceCharacteristics='inventario';
ACT.serviceCharacteristics=data=>{const product=S.products.find(p=>p.id===data.id&&p.kind==='service');if(product)serviceCharacteristics(product);};
productForm=function(product){
 if(product?.kind==='service'&&product.serviceDefinition?.enabled){serviceCharacteristics(product);return;}
 const result=serviceCatalogProductForm(product);
 if(product?.kind==='service')document.querySelector('#modal form')?.insertAdjacentHTML('beforeend',`<button type="button" class="btn ghost" data-a="serviceCharacteristics" data-id="${esc(product.id)}">${serviceEscape('configure','Configurar características del servicio')}</button>`);
 return result;
};

// La confirmación precede a la creación del identificador idempotente. Los reintentos conservan el cuerpo.
const serviceCatalogOperate=operate;
operate=async function(operation,body={}){
 if(pendingCloudOperation?.operation===operation){
  const pendingBody=pendingCloudOperation.body||{};
  for(const key of ['serviceConsumptionConfirmed','serviceEmployeeId'])if(body[key]===undefined&&pendingBody[key]!==undefined)body={...body,[key]:pendingBody[key]};
 }
 if(!pendingCloudOperation&&operation==='sale'&&permission('personal')){
  const employee=document.querySelector('#modal [name=serviceEmployeeId]')?.value;
  if(employee)body={...body,serviceEmployeeId:employee};
 }
 if(!pendingCloudOperation&&['sale','businessBill','businessGenerate'].includes(operation)&&!body.serviceConsumptionConfirmed){
  const candidates=operation==='sale'?(body.items||[]):(businessRecord(body.id)?.items||[]);
  const usesConsumables=(pid)=>{const def=S.products.find(p=>p.id===pid)?.serviceDefinition;return def?.enabled&&(def.consumables?.length||def.components?.some(row=>S.products.find(p=>p.id===row.p)?.serviceDefinition?.enabled&&S.products.find(p=>p.id===row.p)?.serviceDefinition?.consumables?.length));};
  if(candidates.some(row=>usesConsumables(row.p))){
   if(!confirm(serviceText('consumeConfirm','Esta prestación descontará los consumibles configurados de la sucursal activa y registrará su costo. Una nota de crédito no los repone. ¿Confirmas la prestación y el consumo?')))throw new Error(serviceText('cancelled','Prestación cancelada antes de guardar.'));
   body={...body,serviceConsumptionConfirmed:true};
  }
 }
 return serviceCatalogOperate(operation,body);
};
const serviceCatalogSaleForm=ACT.venta;
ACT.venta=async function(...args){
 const result=await serviceCatalogSaleForm(...args);
 if(permission('personal')&&S.products.some(p=>p.serviceDefinition?.enabled)){
  const form=document.querySelector('#modal form');
  if(form&&!form.querySelector('[name=serviceEmployeeId]'))form.insertAdjacentHTML('beforeend',serviceSelect('serviceEmployeeId',serviceText('saleEmployee','Empleado para comisión de servicios (opcional)'),[['',serviceText('noEmployee','Sin asignar')],...S.employees.filter(e=>e.active!==false).map(e=>[e.id,e.name])],''));
 }
 return result;
};

const serviceSectorSettings=V.ajustes;
V.ajustes=async function(){
 const companyId=CO.id;await serviceSectorSettings();
 if(CO?.id!==companyId||R!=='ajustes'||!CO.owner)return;
 const sector=AcontecSectors.get(S.cfg.economicSector?.id);
 $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h3>${serviceEscape('sectorTitle','Sector económico y plantilla contable')}</h3><p>${esc(sector?serviceText('sector.'+sector.id,sector.name):serviceText('sectorEmpty','Sin sector seleccionado'))}</p><p>${serviceEscape('sectorHelp','El sector solo organiza sugerencias; no cambia datos, impuestos ni documentos anteriores. La plantilla agrega cuentas sugeridas únicamente cuando toda la empresa carece de movimientos. Verifica con tu contador.')}</p><button type="button" class="btn ghost" data-a="serviceSector">${serviceEscape('sectorConfigure','Configurar sector y ver plantilla')}</button></section>`);
 enforceAccessUI();
};
const serviceSectorAllowed=actionAllowed;
actionAllowed=function(action,data={}){if(action==='serviceSector')return !!CO?.owner&&permission('ajustes',true);return serviceSectorAllowed(action,data);};
ACT.serviceSector=()=>{
 const form=modal(serviceText('sectorTitle','Sector económico y plantilla contable'),
  serviceSelect('sector',serviceText('sector','Sector económico'),[['',serviceText('select','Selecciona')],...AcontecSectors.sectors.map(s=>[s.id,serviceText('sector.'+s.id,s.name)])],S.cfg.economicSector?.id||'')+
  `<div id="service-sector-preview" aria-live="polite"></div>`+
  (permission('contabilidad',true)?bCheck('applyTemplate',serviceText('applyTemplate','Agregar las cuentas de esta vista previa (solo empresa sin movimientos)')):'')+
  notice(serviceText('templateHelp','La plantilla es una sugerencia aditiva, no reemplaza el catálogo. Las cuentas existentes conservan nombre y saldo; una naturaleza incompatible impide aplicarla. El servidor revisa los movimientos de todas las sucursales.'))+
  field('reason',serviceText('reason','Motivo del cambio'),'','text','required minlength="3" maxlength="500"')+
  bCheck('confirmed',serviceText('sectorConfirmed','Confirmo el sector y, si lo marqué, la aplicación de la plantilla mostrada.')),
  async f=>{
   if(!f.elements.confirmed.checked)return serviceText('confirmError','Confirma el cambio antes de guardar.');
   await operate('economicSector',{sector:v(f,'sector'),templateVersion:AcontecSectors.version,applyTemplate:f.elements.applyTemplate?.checked===true,reason:v(f,'reason'),confirmed:true});view();
  });
 const preview=()=>{
  const sector=AcontecSectors.get(v(form,'sector')),container=form.querySelector('#service-sector-preview');
  container.innerHTML=sector?accountingTable([serviceText('code','Código'),serviceText('account','Cuenta sugerida'),serviceText('templateAction','Aplicación')],sector.accounts.map(a=>`<tr><td>${esc(a.code)}</td><td>${esc(serviceText('account.'+sector.id+'.'+a.code,a.name))}</td><td>${esc(S.accounts.some(old=>old.code===a.code)?serviceText('keepAccount','Conservar cuenta existente'):serviceText('addAccount','Agregar cuenta nueva'))}</td></tr>`).join('')):notice(serviceText('sectorSelect','Selecciona un sector para revisar las cuentas sugeridas.'));
 };
 form.elements.sector.addEventListener('change',preview);preview();
};
