'use strict';
// Adaptación aditiva: las autorizaciones y todos los cálculos definitivos residen en Functions.
const BUSINESS=AcontecProfiles;
const businessProfile=()=>BUSINESS.get(CO?.businessType);
const businessLabels=()=>({...businessProfile().labels,...CO?.businessCustomization?.labels});
const businessTypeField=(selected='comercio')=>selectField('businessType','Tipo de negocio',BUSINESS.profiles.map(p=>option(p.id,p.name,p.id===selected)).join(''));
const businessRecords=(module)=>((S?.businessRecords)||[]).filter(r=>!module||r.module===module);
const businessRecord=id=>businessRecords().find(r=>r.id===id);
const businessModuleName=module=>BUSINESS.capabilities[module]?.name||module;
for(const id of BUSINESS.all){ACCESS_MODULES.push([id,businessModuleName(id)]);BILLING_MODULES.push([id,businessModuleName(id)]);ROUTE_MODULE[id]=id;}
const businessInvoiceOnly=()=>CO?.billingPlan?.id==='facturacion';
const businessAllowedRoute=routeAllowed;
routeAllowed=function(route){if(route==='businessMore')return !!CO&&!businessInvoiceOnly();if(businessInvoiceOnly()&&BUSINESS.all.includes(route)&&!['documentos_venta','comprobantes'].includes(route))return false;return businessAllowedRoute(route)};
const businessAllowedAction=actionAllowed;
actionAllowed=function(action,data={}){
 if(action==='businessClear')return !!CO;
 if(action==='businessProfile'||action==='businessOnboard'||action==='businessMenu')return !!CO?.owner&&permission('ajustes',true);
 if(action==='businessDetails'||action==='businessPrint')return !!businessRecord(data.id)&&permission(businessRecord(data.id).module)&&(action!=='businessPrint'||permission('comprobantes'));
 if(action==='businessService')return permission('inventario',true);
 if(action.startsWith('business'))return permission(data.module||businessRecord(data.id)?.module||R,true);
 return businessAllowedAction(action,data);
};
for(const a of ['businessDetails','businessPrint'])READ_ACTIONS.add(a);
READ_ACTIONS.add('businessClear');
function businessVisible(route){
 if(!routeAllowed(route))return false;
 if(['panel','ajustes','accesibilidad','auditoria','businessMore'].includes(route))return true;
 const custom=CO.businessCustomization||{};if(custom.hidden?.includes(route))return false;if(custom.shown?.includes(route))return true;
 const p=businessProfile();if(p.id==='comercio')return !BUSINESS.all.includes(route);return MENU.some(([,items])=>items.some(([id])=>id===route))||p.modules.includes(route);
}
const businessChrome=chrome;
chrome=function(){
 businessChrome();if(!CO||HOME)return;
 const drawer=$('#drawer');if(!drawer)return;
 for(const button of drawer.querySelectorAll('[data-a="nav"]'))if(!businessVisible(button.dataset.r)&&button.dataset.r!=='control'&&button.dataset.r!=='administracion')button.remove();
 for(const heading of drawer.querySelectorAll('h4')){if(heading.nextElementSibling?.tagName==='H4')heading.remove()}
 const active=businessInvoiceOnly()?['documentos_venta','comprobantes'].filter(id=>routeAllowed(id)):BUSINESS.all.filter(id=>businessVisible(id)&&routeAllowed(id));
 if(active.length)drawer.querySelector('.bot')?.insertAdjacentHTML('beforebegin',(businessInvoiceOnly()?'':'<h4>Mi negocio</h4>')+active.map(id=>`<button data-a="nav" data-r="${esc(id)}" class="${R===id?'on':''}"><span>◫</span>${esc(businessModuleName(id))}</button>`).join(''));
 if(routeAllowed('businessMore'))drawer.querySelector('.bot')?.insertAdjacentHTML('beforebegin','<button data-a="nav" data-r="businessMore" class="'+(R==='businessMore'?'on':'')+'"><span>＋</span>Más módulos</button>');
 for(const button of $('#bnav')?.querySelectorAll('[data-r]')||[])if(!businessVisible(button.dataset.r))button.remove();
 if(businessProfile().id!=='comercio'){
  const labels=businessLabels(),names={clientes:labels.customer,productos:labels.product};
  for(const button of document.querySelectorAll('#drawer [data-r],#bnav [data-r]')){const label=names[button.dataset.r];if(label){const icon=button.querySelector('span');button.replaceChildren(...(icon?[icon]:[]),document.createTextNode(label.charAt(0).toUpperCase()+label.slice(1)+(button.dataset.r==='productos'?' · inventario':'')));}}
 }
};
V.businessMore=(message='')=>{
 if(!routeAllowed('businessMore')){R=firstAllowedRoute();view();return}
 const existing=MENU.flatMap(([,list])=>list).filter(([route])=>routeAllowed(route)),canCustomize=CO.owner&&permission('ajustes',true);
 main(pageHead('Más módulos')+notice('El perfil organiza el menú. Ocultar una herramienta no bloquea el acceso ni elimina información. Los permisos y el plan siempre se aplican.')+(message?notice(esc(message)):'')+`<div class="business-modules">${[...existing,...BUSINESS.all.filter(id=>routeAllowed(id)).map(id=>[id,'◫',businessModuleName(id)])].map(([route,icon,name])=>`<div class="card business-module"><button class="btn ghost" style="min-height:44px;white-space:normal;text-align:left" data-a="nav" data-r="${esc(route)}"><b>${esc(name)}</b></button><small>${esc(BUSINESS.capabilities[route]?.flow||'Abrir módulo existente')}</small>${canCustomize&&!businessFixedMenuRoutes.includes(route)?`<button class="btn ghost" style="min-height:44px;white-space:normal" data-a="businessMenu" data-r="${esc(route)}">${businessVisible(route)?'Quitar de mi menú':'Agregar a mi menú'}</button>`:''}</div>`).join('')}</div>`+(canCustomize?'<button class="btn ghost" data-a="businessProfile">Personalizar mi sistema</button>':''));
};
// Igual que en Personalizar mi sistema: los accesos fijos no se ocultan.
const businessFixedMenuRoutes=['panel','ajustes','accesibilidad','auditoria'];
let businessProfileSaving=false;
async function businessSaveProfile(businessType,businessCustomization){
 if(businessProfileSaving)throw new Error('Espera a que termine el guardado.');
 businessProfileSaving=true;
 const companyId=CO.id;
 try{
  if(!await flush())throw new Error('Guarda los cambios pendientes.');
  if(CO?.id!==companyId)return false;
  await api('business-profile?c='+companyId,'POST',{revision:REV,businessType,businessCustomization});
  const fresh=await api('data?c='+companyId);
  if(CO?.id!==companyId)return false;
  CO=fresh.company;S=fresh.data;REV=fresh.revision;rememberCloud();
  return true;
 }finally{businessProfileSaving=false}
}
ACT.businessMenu=async({r:route},button)=>{
 if(!CO?.owner||!permission('ajustes',true)||businessInvoiceOnly()||!routeAllowed(route)||businessFixedMenuRoutes.includes(route)||![...MENU.flatMap(([,list])=>list).map(([id])=>id),...BUSINESS.all].includes(route))return;
 const visible=businessVisible(route),current=CO.businessCustomization||{};
 const businessCustomization={...current,shown:(current.shown||[]).filter(id=>id!==route),hidden:(current.hidden||[]).filter(id=>id!==route)};
 businessCustomization[visible?'hidden':'shown'].push(route);
 if(button.disabled)return;
 button.disabled=true;
 try{
  if(await businessSaveProfile(CO.businessType||'comercio',businessCustomization)){
   chrome();if(R==='businessMore')V.businessMore(visible?'Quitado de tu menú':'Agregado a tu menú');
  }
 }finally{button.disabled=false}
};
const businessAuth=authView;
authView=function(){businessAuth();if(!U)$('#af .reg')?.insertAdjacentHTML('beforeend',businessTypeField())};
const businessSettings=V.ajustes;
V.ajustes=async function(){const id=CO.id;await businessSettings();if(R!=='ajustes'||CO?.id!==id)return;$('#main').insertAdjacentHTML('afterbegin',`<section class="card"><h3>Mi tipo de negocio</h3><p>${esc(businessProfile().name)}</p><p>${esc(businessProfile().salesFlow)}</p>${CO.owner?'<button class="btn ghost" data-a="businessProfile">Personalizar mi sistema</button>':''}</section>`);enforceAccessUI()};
ACT.businessProfile=()=>{
 const current=CO.businessCustomization||{},routes=[...new Map([...MENU.flatMap(([,list])=>list).map(([id,,name])=>[id,name]),...Object.entries(BUSINESS.moduleLabels)]).entries()];
 const form=modal('Personalizar mi sistema',businessTypeField(CO.businessType||'comercio')+bField('businessTimeZone','Zona horaria IANA para tarifas',current.timeZone||'America/Managua','text','required maxlength="80"')+notice('Cambiar de rubro solo cambia la organización y las etiquetas. Ningún registro ni operación se convierte o elimina.')+'<p id="business-description"></p><h4>Módulos del menú</h4><p>Automático sigue el perfil. '+(businessInvoiceOnly()?'El plan y los permisos determinan los accesos disponibles.':'Oculto queda disponible en Más módulos según tus permisos y plan.')+'</p><div class="business-module-settings">'+routes.filter(([id])=>!['panel','ajustes','accesibilidad','auditoria'].includes(id)).map(([id,name])=>selectField('module_'+id,name,option('auto','Automático',!current.shown?.includes(id)&&!current.hidden?.includes(id))+option('show','Visible',current.shown?.includes(id))+option('hide','Oculto',current.hidden?.includes(id)))).join('')+'</div><h4>Etiquetas personalizadas (opcionales)</h4>'+['customer','product','document'].map((key,i)=>field('label_'+key,['Cliente / paciente / alumno','Producto / servicio','Factura / cuenta / recibo'][i],current.labels?.[key]||'','text','maxlength="40"')).join(''),async f=>{
  const businessCustomization={shown:[],hidden:[],labels:{},timeZone:v(f,'businessTimeZone').trim()};for(const [id]of routes){const value=f.elements['module_'+id]?.value;if(value==='show')businessCustomization.shown.push(id);if(value==='hide')businessCustomization.hidden.push(id)}for(const key of ['customer','product','document'])if(v(f,'label_'+key).trim())businessCustomization.labels[key]=v(f,'label_'+key).trim();
  if(await businessSaveProfile(v(f,'businessType'),businessCustomization)){shell();view()}
 });
 const update=()=>{const p=BUSINESS.get(form.elements.businessType.value);form.querySelector('#business-description').textContent=p.description;};form.elements.businessType.addEventListener('change',update);update();
};
const businessPanel=V.panel;
V.panel=function(){
 businessPanel();if(!CO||HOME)return;const p=businessProfile();
 if(businessInvoiceOnly())$('#main .accounting-actions')?.insertAdjacentHTML('beforeend',['documentos_venta','comprobantes'].filter(id=>routeAllowed(id)).map(id=>`<button class="btn ghost" data-a="nav" data-r="${esc(id)}">${esc(businessModuleName(id))}</button>`).join(''));
 if(CO.owner&&!CO.onboardingDone)$('#main').insertAdjacentHTML('afterbegin',`<section class="card business-start"><h3>Empieza a tu ritmo</h3><p>Selecciona tu rubro y revisa las sugerencias. El catálogo de ejemplo se agrega sin precios, IVA ni existencias.</p><div class="accounting-actions"><button class="btn ghost" data-a="businessProfile">Elegir tipo de negocio</button><button class="btn" data-a="businessOnboard">Ver arranque opcional</button></div></section>`);
 if(p.id!=='comercio'&&!businessInvoiceOnly()){
  const accounting=MENU.find(([name])=>name==='Contabilidad')?.[1].find(([route])=>routeAllowed(route));
  $('#main').insertAdjacentHTML('afterbegin',`<section class="card"><span class="section-eyebrow">${esc(p.group)}</span><h3>${esc(p.name)}</h3><p>${esc(p.salesFlow)}</p><div class="business-panel-modules">${p.capabilities.filter(id=>routeAllowed(id)).map(id=>`<button class="btn ghost" data-a="nav" data-r="${esc(id)}">${esc(businessModuleName(id))}</button>`).join('')}${accounting?`<button class="btn ghost" data-a="nav" data-r="${esc(accounting[0])}">Contabilidad</button>`:''}</div></section>`);
 }
};
ACT.businessOnboard=()=>{
 const p=businessProfile();modal('Arranque opcional · '+esc(p.name),notice('Solo para empresas nuevas sin productos ni movimientos. Los ejemplos son editables y no incluyen precios, impuestos ni saldos.')+`<p>Categorías: ${esc(p.startup.categories.join(', '))}</p><p>Unidades: ${esc(p.startup.units.join(', '))}</p><ul>${p.startup.examples.map(e=>'<li>'+esc(e.name+' · '+e.unit)+'</li>').join('')}</ul>`+selectField('seed','Qué deseas hacer',option('no','Omitir y continuar sin ejemplos')+option('yes','Agregar estos ejemplos')),async f=>{await operate('businessOnboard',{seed:v(f,'seed')==='yes'});CO.onboardingDone=true;view()},'Continuar');
};
const bField=(name,label,value='',type='text',attrs='')=>field(name,label,value,type,attrs);
const bSelect=(name,label,rows,value='')=>selectField(name,label,option('','Selecciona')+rows.map(([id,title])=>option(id,title,id===value)).join(''));
const bAccounts=(name,label,value='',type)=>bSelect(name,label,S.accounts.filter(a=>!type||a.tipo===type).map(a=>[a.code,a.code+' · '+a.name]),value);
const bProduct=(name,label,value='')=>bSelect(name,label,S.products.map(p=>[p.id,p.name+' · '+(p.unit||'unidad')]),value);
const bDisplayMoney=value=>esc(money(value));
const bMoney=(name,label,value=0)=>amountField(name,label,value);
const bCheck=(name,label,value=false)=>`<label class="ck"><input type="checkbox" name="${esc(name)}" ${value?'checked':''}> ${esc(label)}</label>`;
function businessItemRow(item={}){return `<div class="business-item">${bProduct('bp','Producto / servicio',item.p)}${bField('bq','Cantidad',item.q??1,'number','min="0.001" step="0.001" required')}${bMoney('bu','Precio confirmado sin IVA',item.u??0)}<button type="button" class="lk" data-a="businessRemoveItem">Quitar</button></div>`}
function businessReadItems(form,selector='.business-items'){
 return [...form.querySelectorAll(selector+' .business-item')].map(row=>({p:row.querySelector('[name=bp]').value,q:Number(row.querySelector('[name=bq]').value),u:Number(row.querySelector('[name=bu]').value)})).filter(i=>i.p);
}
ACT.businessAddItem=(d,button)=>button.previousElementSibling.insertAdjacentHTML('beforeend',businessItemRow());
ACT.businessRemoveItem=(d,button)=>button.closest('.business-item').remove();
document.addEventListener('change',event=>{if(!event.target.matches('.business-item [name=bp]'))return;const p=S.products.find(p=>p.id===event.target.value);if(p)event.target.closest('.business-item').querySelector('[name=bu]').value=p.price});
const bItems=(items=[])=>'<div class="business-items">'+items.map(businessItemRow).join('')+'</div><button type="button" class="btn ghost" data-a="businessAddItem">Agregar producto o servicio</button>';
const businessLegal=()=>notice('Las tasas, intereses, mora, propinas y cargos son configurables; verifica con tu contador. No se configura ninguna obligación legal automáticamente.');
ACT.businessService=()=>modal('Crear servicio sin inventario',bField('name','Nombre','','text','required maxlength="200"')+bField('unit','Unidad de cobro','servicio','text','required maxlength="40"')+bMoney('price','Precio sin IVA')+bField('vatRate','IVA configurado (%)',0,'number','min="0" max="100" step="0.01"'),async f=>{await operate('businessProduct',{name:v(f,'name'),unit:v(f,'unit'),price:+v(f,'price'),vatRate:+v(f,'vatRate')});view()});
const bLocalTime=t=>t?new Date(new Date(t).getTime()-new Date(t).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
function businessForm(module,record){
 const r=record||{},label=businessLabels(),financial=['cartera','comisiones','aportes'].includes(module),itemModules=['cuentas_abiertas','agenda','proyectos','contratos','reservas','rutas','despacho','documentos_venta'];
 let html=bField('name','Nombre / referencia',r.name||'','text','required maxlength="200"')+bField('date','Fecha',r.date||today(),'date','required');
 if(itemModules.includes(module)||module==='cartera')html+=bSelect('customerId',label.customer,S.customers.map(c=>[c.id,c.name]),r.customerId);
 if(itemModules.includes(module))html+=bItems(r.items||[]);
 if(['cuentas_abiertas','agenda','reservas','proyectos'].includes(module))html+=bField('resource','Mesa / habitación / recurso / equipo',r.resource)+bField('responsible','Responsable',r.responsible);
 if(['cuentas_abiertas','reservas'].includes(module))html+=bField('serviceRate','Cargo por servicio / propina acordada (%)',r.serviceRate||0,'number','min="0" max="100" step="0.01"')+bProduct('serviceProductId','Servicio usado para facturar el cargo',r.serviceProductId)+businessLegal();
 if(['agenda','reservas'].includes(module))html+=notice('Introduce los horarios según la zona de tu dispositivo. Las tarifas usan la zona IANA de Personalizar mi sistema.')+bField('start','Inicio',bLocalTime(r.start),'datetime-local','required')+bField('end','Fin',bLocalTime(r.end),'datetime-local','required')+bField('reminder','Recordatorio visible en agenda',r.reminder||'');
 if(module==='reservas')html+='<p>Tarifas por temporada (opcional): fecha inicial, fecha final e importe por unidad de tiempo.</p><div class="business-tariffs">'+(r.tariffs||[]).map(t=>`<div>${bField('tariffFrom','Desde',t.from,'date')}${bField('tariffTo','Hasta',t.to,'date')}${bMoney('tariffPrice','Tarifa',t.price)}</div>`).join('')+'</div><button type="button" class="lk" data-a="businessAddTariff">Agregar temporada</button>'+bProduct('tariffProductId','Servicio de alojamiento / alquiler para la tarifa',r.tariffProductId)+bField('timeUnit','Unidad de tarifa (hora / día / noche)',r.timeUnit||'noche');
 if(module==='proyectos')for(const [k,l]of [['diagnosis','Recepción / diagnóstico'],['stages','Etapas y avance'],['materials','Materiales previstos'],['labor','Mano de obra'],['subcontractors','Subcontratos'],['vehicle','Unidad / vehículo / equipo']])html+=bField(k,l,r[k]||'');
 if(['lotes','variantes','produccion','medidas'].includes(module))html+=bProduct('productId',label.product,r.productId);
 if(module==='lotes')html+=bField('lot','Lote',r.lot||'','text','required')+bField('q','Cantidad ya comprada / producida',r.q??1,'number','min="0.001" step="0.001" required')+bField('due','Vencimiento',r.due||today(),'date','required')+bField('prescription','Receta / prescripción opcional (evita datos sensibles)',r.prescription||'')+bField('cycle','Ciclo de cultivo / producción',r.cycle||'');
 if(module==='variantes')for(const [k,l]of [['size','Talla'],['color','Color'],['model','Modelo'],['serial','Serie / IMEI (único por empresa)'],['warranty','Condiciones de garantía']])html+=bField(k,l,r[k]||'');
 if(module==='produccion')html+=bField('yield','Rendimiento de la receta',r.yield??1,'number','min="0.001" step="0.001" required')+bField('waste','Merma adicional de insumos (%)',r.waste||0,'number','min="0" max="100" step="0.01"')+bCheck('autoProduce','Preparar automáticamente al vender',r.autoProduce)+bAccounts('varianceAccount','Cuenta para diferencias de costo',r.varianceAccount)+'<h4>Ingredientes / materiales por receta</h4><div class="business-ingredients">'+bItems(r.ingredients||[])+'</div>';
 if(module==='medidas')html+=bField('gross','Medida / peso bruto',r.gross||1,'number','min="0.001" step="0.001" required')+bField('tare','Tara',r.tare||0,'number','min="0" step="0.001"')+bMoney('price','Precio por unidad de medida',r.items?.[0]?.u||0)+notice('Introduce la lectura de tu balanza o lector como teclado. Confirma siempre unidad, tara, medida neta y precio; no se conecta a hardware automáticamente.');
 if(module==='cartera')html+=bMoney('principal','Capital a desembolsar',r.principal||0)+bField('rate','Tasa de interés por período (%)',r.rate||0,'number','min="0" max="100" step="0.0001" required')+bField('periods','Número de cuotas',r.periods||12,'number','min="1" max="600" step="1" required')+selectField('method','Método',option('frances','Cuota constante',r.method==='frances')+option('capital_constante','Capital constante',r.method==='capital_constante')+option('plano','Interés plano sobre capital inicial',r.method==='plano'))+bFrequency(r.frequency)+bField('lateRate','Mora diaria sobre capital de la cuota (%)',r.lateRate||0,'number','min="0" max="100" step="0.0001"')+bAccounts('principalAccount','Activo: capital por cobrar',r.principalAccount,'activo')+bAccounts('interestAccount','Activo: intereses y mora por cobrar',r.interestAccount,'activo')+bAccounts('incomeAccount','Ingreso: intereses',r.incomeAccount,'ingreso')+bAccounts('lateAccount','Ingreso: mora',r.lateAccount,'ingreso')+bField('collateral','Prenda / garantía (opcional)',r.collateral||'')+bMoney('valuation','Valoración de la garantía',r.valuation||0)+bField('collateralDue','Vencimiento de la prenda',r.collateralDue||'','date')+businessLegal();
 if(module==='contratos')html+=bFrequency(r.frequency)+bField('periods','Cantidad de períodos',r.periods||12,'number','min="1" max="600" required')+bField('lateRate','Mora diaria (%)',r.lateRate||0,'number','min="0" max="100" step="0.0001"')+bProduct('lateProductId','Servicio para facturar mora',r.lateProductId)+bField('suspendAfter','Suspender generación con cuotas impagas por más de estos días (0: sin suspensión)',r.suspendAfter||0,'number','min="0" max="3650"')+bField('reminder','Recordatorio visible',r.reminder||'')+businessLegal();
 if(module==='rutas')html+=bField('route','Ruta',r.route||'')+bField('seller','Vendedor',r.seller||'')+bSelect('employeeId','Empleado vinculado para comisión',S.employees.map(e=>[e.id,e.name]),r.employeeId)+bCheck('consignment','Pedido en consignación (no registra venta hasta confirmar)',r.consignment)+bField('commissionRate','Comisión del vendedor (%)',r.commissionRate||0,'number','min="0" max="100" step="0.01"');
 if(module==='despacho')html+=selectField('kind','Modalidad',option('llevar','Para llevar',r.kind==='llevar')+option('domicilio','A domicilio',r.kind==='domicilio')+option('local','Consumo local',r.kind==='local'))+bField('delivery','Dirección / indicaciones de entrega',r.delivery||'');
 if(module==='documentos_venta')html+=selectField('kind','Documento',Object.entries({cotizacion:'Cotización',proforma:'Proforma',pedido:'Pedido',entrega:'Nota de entrega',anticipo:'Solicitud de anticipo'}).map(([k,l])=>option(k,l,r.kind===k)).join(''));
 if(module==='comisiones')html+=bSelect('employeeId','Empleado',S.employees.map(e=>[e.id,e.name]),r.employeeId)+bSelect('saleId','Venta confirmada',S.entries.filter(e=>e.type==='venta').map(e=>[e.id,e.reference+' · '+e.party]),r.saleId)+bField('rate','Comisión (%)',r.rate||0,'number','min="0" max="100" step="0.0001"')+businessLegal();
 if(module==='aportes')html+=bField('donor','Socio / donante',r.donor||'','text','required')+bField('fund','Fondo / proyecto',r.fund||'','text','required')+bMoney('total','Importe del aporte',r.total||0)+bAccounts('incomeAccount','Cuenta de ingreso por aportes',r.incomeAccount,'ingreso');
 html+=bField('project','Proyecto / centro de costo',r.project||'')+`<label>Notas<textarea name="note" maxlength="3000" rows="3">${esc(r.note||'')}</textarea></label>`;
 return modal((r.id?'Editar · ':'Nuevo · ')+esc(businessModuleName(module)),html,async f=>{
  const body={module,id:r.id,items:businessReadItems(f),ingredients:businessReadItems(f,'.business-ingredients'),confirmed:true};
  for(const field of f.querySelectorAll('input[name],select[name],textarea[name]'))if(!['bp','bq','bu','tariffFrom','tariffTo','tariffPrice'].includes(field.name))body[field.name]=field.type==='checkbox'?field.checked:field.value;
  for(const key of ['price','total','principal','valuation','gross','tare','q','rate','periods','lateRate','serviceRate','yield','waste','commissionRate','suspendAfter'])if(body[key]!==undefined)body[key]=Number(body[key]);
  for(const key of ['start','end'])if(body[key])body[key]=new Date(body[key]).toISOString();
  body.tariffs=[...f.querySelectorAll('.business-tariffs > div')].map(row=>({from:row.querySelector('[name=tariffFrom]').value,to:row.querySelector('[name=tariffTo]').value,price:Number(row.querySelector('[name=tariffPrice]').value)}));
  await operate('businessSave',body);view();
 });
}
const bFrequency=value=>selectField('frequency','Frecuencia de cobro',Object.entries({mensual:'Mensual',quincenal:'Cada 15 días',semanal:'Semanal',diaria:'Diaria'}).map(([k,l])=>option(k,l,k===value)).join(''));
ACT.businessAddTariff=(d,b)=>b.previousElementSibling.insertAdjacentHTML('beforeend','<div>'+bField('tariffFrom','Desde',today(),'date')+bField('tariffTo','Hasta',today(),'date')+bMoney('tariffPrice','Tarifa')+'</div>');
ACT.businessNew=d=>businessForm(d.module||R);
ACT.businessEdit=d=>{const r=businessRecord(d.id);if(r)businessForm(r.module,r)};
const bAction=(action,r,label,extra='')=>`<button type="button" class="lk" data-a="${esc(action)}" data-id="${esc(r.id)}" data-module="${esc(r.module)}" ${extra}>${esc(label)}</button>`;
function businessActions(r){
 let html=bAction('businessDetails',r,'Ver ficha')+' '+bAction('businessPrint',r,'Imprimir');
 if(!permission(r.module,true))return html;
 if(!r.entryId&&!r.events?.length&&!r.billed?.length&&!['Cerrada','Vendida','Agotado','Registrado'].includes(r.status))html+=' '+bAction('businessEdit',r,'Editar');
 if(['cuentas_abiertas','agenda','proyectos','reservas','rutas','despacho','documentos_venta','medidas','variantes'].includes(r.module)&&(!r.entryId||r.module==='proyectos')&&!['Cancelada','Cancelado','Cerrada','Finalizada','Vendida'].includes(r.status))html+=' '+bAction('businessBill',r,r.module==='proyectos'?'Facturar etapa':'Facturar');
 if(['cuentas_abiertas','agenda','proyectos','reservas','documentos_venta'].includes(r.module)&&!r.entryId&&!['Cancelada','Cancelado','Cerrada','Finalizada'].includes(r.status))html+=' '+bAction('businessAdvance',r,'Registrar anticipo');
 if(['proyectos','lotes','produccion','reservas','contratos','rutas','aportes'].includes(r.module)&&permission('costos',true))html+=' '+bAction('businessCost',r,'Registrar costo');
 if(r.module==='proyectos'&&permission('compras'))html+=' '+bAction('businessPurchase',r,'Vincular compra');
 if(r.deposit>0)html+=' '+bAction('businessRefund',r,'Devolver depósito');
 if(r.module==='cuentas_abiertas'&&r.status==='Abierta')html+=' '+bAction('businessConsume',r,'Agregar consumo')+' '+bAction('businessMove',r,'Mover / responsable')+' '+bAction('businessMerge',r,'Unir')+' '+bAction('businessSplit',r,'Dividir');
 if(['agenda','proyectos','produccion','contratos','rutas','despacho','documentos_venta'].includes(r.module)&&!['Cancelada','Cancelado','Finalizado'].includes(r.status))html+=' '+bAction('businessState',r,'Cambiar estado');
 if(r.module==='produccion'&&r.status==='Activa')html+=' '+bAction('businessProduce',r,'Producir');
 if(r.module==='cartera'){
  if(r.status==='Borrador')html+=' '+bAction('businessDisburse',r,'Desembolsar');
  if(r.status==='Vigente')html+=' '+bAction('businessCollect',r,'Cobrar cuota')+' '+bAction('businessAccrue',r,'Devengar vencidas');
  if(r.collateral&&r.status==='Liquidada'&&!r.collateralReleased)html+=' '+bAction('businessRelease',r,'Liberar garantía');
 }
 if(r.module==='contratos'&&r.status==='Activo')html+=' '+bAction('businessGenerate',r,'Generar cobro');
 if(r.module==='reservas'){if(r.status==='Reservada')html+=' '+bAction('businessCheckin',r,'Registrar entrada');if(r.status==='Ocupada')html+=' '+bAction('businessCheckout',r,'Registrar salida');}
 if(r.module==='comisiones'&&r.status==='Pendiente')html+=' '+bAction(r.entryId?'businessLiquidate':'businessCommission',r,r.entryId?'Liquidar':'Devengar comisión');
 if(r.module==='aportes'&&r.status==='Pendiente')html+=' '+bAction('businessDonate',r,'Confirmar aporte');
 if(r.module==='rutas'&&r.entryId)html+=' <button class="lk" data-a="creditNote" data-id="'+esc(r.entryId)+'">Registrar devolución</button>';
 return html;
}
function businessScheduleMarkup(r){return accountingTable(['Cuota','Vencimiento','Capital','Interés','Mora devengada','Cobrado','Saldo'],(r.schedule||[]).map(row=>`<tr><td>${esc(row.number)}</td><td>${esc(row.due)}</td><td>${bDisplayMoney(row.principal)}</td><td>${bDisplayMoney(row.interest)}</td><td>${bDisplayMoney(row.penalty)}</td><td>${bDisplayMoney(row.paid)}</td><td>${bDisplayMoney(Math.max(0,r2(row.total+row.penalty-row.paid)))}</td></tr>`).join(''))}
function businessDetailsMarkup(r){
 const fields={name:'Nombre',date:'Fecha',status:'Estado',kind:'Tipo',resource:'Recurso',responsible:'Responsable',project:'Proyecto / centro de costo',fund:'Fondo',donor:'Donante / socio',start:'Inicio',end:'Fin',reminder:'Recordatorio',diagnosis:'Diagnóstico',stages:'Etapas',materials:'Materiales previstos',labor:'Mano de obra',subcontractors:'Subcontratos',vehicle:'Unidad / vehículo',lot:'Lote',due:'Vencimiento',q:'Cantidad disponible',prescription:'Receta / prescripción opcional',cycle:'Ciclo',size:'Talla',color:'Color',model:'Modelo',serial:'Serie / IMEI',warranty:'Garantía',yield:'Rendimiento',waste:'Merma %',rate:'Tasa % por período',frequency:'Frecuencia',method:'Método',lateRate:'Mora diaria %',collateral:'Garantía prendaria',collateralDue:'Vencimiento de prenda',route:'Ruta',seller:'Vendedor',commissionRate:'Comisión %',delivery:'Entrega',ticket:'Ticket',note:'Notas'};
 let html=accountingTable(['Campo','Valor'],Object.entries(fields).filter(([key])=>r[key]!==undefined&&r[key]!=='').map(([key,name])=>'<tr><th>'+esc(name)+'</th><td>'+esc(r[key])+'</td></tr>').join(''));
 const moneyFields={total:'Total previsto',principal:'Capital',paid:'Cobrado / pagado',deposit:'Depósito pendiente de aplicar',valuation:'Valoración de garantía'};
 html+=accountingTable(['Importe','Valor'],Object.entries(moneyFields).filter(([key])=>r[key]!==undefined).map(([key,name])=>'<tr><th>'+esc(name)+'</th><td>'+bDisplayMoney(r[key])+'</td></tr>').join(''));
 for(const [key,title]of [['items','Productos / servicios'],['ingredients','Ingredientes / materiales']])if(r[key]?.length)html+='<h4>'+title+'</h4>'+accountingTable(['Concepto','Cantidad','Precio sin IVA'],r[key].map(i=>'<tr><td>'+esc(S.products.find(p=>p.id===i.p)?.name||i.name||i.p)+'</td><td>'+esc(i.q)+'</td><td>'+bDisplayMoney(i.u)+'</td></tr>').join(''));
 if(permission('costos')){const costs=(S.costs||[]).filter(c=>c.businessId===r.id&&!c.reversalId);if(costs.length)html+='<h4>Costos asociados</h4>'+accountingTable(['Fecha','Concepto','Importe'],costs.map(c=>'<tr><td>'+esc(c.date)+'</td><td>'+esc(c.name)+'</td><td>'+bDisplayMoney(c.total)+'</td></tr>').join(''));}
 if(r.schedule)html+=businessLegal()+businessScheduleMarkup(r);
 if(r.billed?.length)html+='<h4>Facturación confirmada</h4>'+accountingTable(['Etapa / período','Documento','Total'],r.billed.map(b=>'<tr><td>'+esc(b.key)+'</td><td>'+esc(S.entries.find(e=>e.id===b.entryId)?.reference||b.entryId)+'</td><td>'+bDisplayMoney(b.total)+'</td></tr>').join(''));
 if(r.events?.length)html+='<h4>Historial</h4>'+accountingTable(['Fecha','Acción','Referencia'],r.events.map(e=>'<tr><td>'+esc(e.date)+'</td><td>'+esc(e.action)+'</td><td>'+esc(e.entryId||e.targetId||e.resource||'')+'</td></tr>').join(''));
 return html;
}
ACT.businessDetails=d=>{const r=businessRecord(d.id);modal(esc(businessModuleName(r.module)+' · '+r.name),businessDetailsMarkup(r),()=>{},'Cerrar')};
ACT.businessPrint=d=>{const r=businessRecord(d.id);$('#rcpt')?.remove();document.body.insertAdjacentHTML('beforeend',`<article id="rcpt" class="business-receipt"><h1>${esc(CO.name)}</h1><h2>${esc(businessModuleName(r.module))}</h2><h3>${esc(r.name)}</h3><p>Referencia: ${esc(r.id)} · Sucursal: ${esc((CO.branches||[]).find(b=>b.id===r.branchId)?.name||'Principal')}</p>${businessDetailsMarkup(r)}<p>Documento operativo. Solo los asientos y facturas confirmados tienen efecto contable. ${['cartera','contratos','comisiones'].includes(r.module)?'verifica con tu contador':''}</p></article>`);return printReceiptDocument()};
function businessKpis(module,rows){
 const now=today();let items=[['Registros',rows.length],['Pendientes',rows.filter(r=>!r.entryId&&!['Cancelada','Cancelado','Cerrada','Finalizada'].includes(r.status)).length]];
 if(module==='cartera'){const schedule=rows.filter(r=>r.status!=='Borrador').flatMap(r=>r.schedule||[]);items=[['Capital pendiente',bDisplayMoney(rows.filter(r=>r.status!=='Borrador').reduce((s,r)=>s+r.principal-(r.events||[]).reduce((s,e)=>s+(e.principal||0),0),0))],['Cuotas vencidas',schedule.filter(r=>r.due<now&&r.total+r.penalty>r.paid).length],['Saldo vencido',bDisplayMoney(schedule.filter(r=>r.due<now).reduce((s,r)=>s+Math.max(0,r.total+r.penalty-r.paid),0))]];}
 if(module==='lotes')items=[['Lotes vencidos',rows.filter(r=>r.due<now&&r.q>0).length],['Por vencer en 30 días',rows.filter(r=>r.due>=now&&r.due<=new Date(Date.now()+30*86400000).toISOString().slice(0,10)&&r.q>0).length]];
 if(module==='reservas')items.push(['Ocupadas',rows.filter(r=>r.status==='Ocupada').length]);
 if(module==='aportes')items.push(['Aportes confirmados',bDisplayMoney(rows.filter(r=>r.entryId).reduce((s,r)=>s+r.total,0))]);
 const billed=rows.reduce((sum,r)=>sum+(r.billed||[]).reduce((sum,b)=>sum+b.total,0),0);
 const costs=permission('costos')?(S.costs||[]).filter(c=>rows.some(r=>r.id===c.businessId)&&!c.reversalId).reduce((sum,c)=>sum+c.total,0):null;
 if(module==='cuentas_abiertas')items=[['Cuentas abiertas',rows.filter(r=>r.status==='Abierta').length],['Consumos pendientes',bDisplayMoney(rows.filter(r=>r.status==='Abierta').reduce((s,r)=>s+(r.total||0),0))]];
 if(module==='agenda')items=[['Citas confirmadas',rows.filter(r=>r.status==='Confirmada').length],['Atenciones realizadas',rows.filter(r=>r.status==='Atendida').length],['Recursos',new Set(rows.map(r=>r.resource)).size]];
 if(module==='proyectos')items=[['Órdenes en proceso',rows.filter(r=>!['Entregada','Cancelada'].includes(r.status)).length],['Facturación por etapas',bDisplayMoney(billed)]];
 if(module==='variantes')items=[['Series disponibles',rows.filter(r=>r.serial&&r.status==='Disponible').length],['Series entregadas',rows.filter(r=>r.serial&&r.status==='Vendida').length],['Variantes',rows.filter(r=>r.size||r.color||r.model).length]];
 if(module==='produccion')items=[['Recetas activas',rows.filter(r=>r.status==='Activa').length],['Preparación al vender',rows.filter(r=>r.autoProduce&&r.status==='Activa').length],['Órdenes producidas',S.entries.filter(e=>e.type==='produccion'&&rows.some(r=>r.id===e.businessId)).length]];
 if(module==='medidas')items=[['Lecturas registradas',rows.length],['Lecturas facturadas',rows.filter(r=>r.entryId).length],['Facturación confirmada',bDisplayMoney(billed)]];
 if(module==='contratos')items=[['Contratos activos',rows.filter(r=>r.status==='Activo').length],['Suspendidos',rows.filter(r=>r.status==='Suspendido').length],['Períodos generados',rows.reduce((s,r)=>s+(r.billed?.length||0),0)]];
 if(module==='rutas')items=[['Rutas registradas',new Set(rows.map(r=>r.route).filter(Boolean)).size],['En consignación',rows.filter(r=>r.consignment&&r.status==='Preparada'&&!r.entryId).length],['Entregas facturadas',rows.filter(r=>r.entryId).length]];
 if(module==='despacho')items=['Recibido','Preparando','Listo','Entregado'].map(s=>[s,rows.filter(r=>r.status===s).length]);
 if(module==='comisiones')items=[['Por devengar',rows.filter(r=>!r.entryId).length],['Por liquidar',bDisplayMoney(rows.filter(r=>r.entryId&&r.status==='Pendiente').reduce((s,r)=>s+(r.total||0),0))],['Liquidadas',bDisplayMoney(rows.filter(r=>r.status==='Liquidada').reduce((s,r)=>s+(r.total||0),0))]];
 if(module==='documentos_venta')items=[['Documentos pendientes',rows.filter(r=>r.status==='Pendiente').length],['Convertidos a factura',rows.filter(r=>r.entryId).length],['Importe en borradores',bDisplayMoney(rows.filter(r=>r.status==='Pendiente').reduce((s,r)=>s+(r.total||0),0))]];
 if(module==='aportes')items.push(['Fondos / proyectos',new Set(rows.map(r=>r.fund)).size]);
 if(costs!==null&&['proyectos','lotes','produccion','reservas','rutas','aportes'].includes(module))items.push(['Costos asociados',bDisplayMoney(costs)]);
 return '<div class="business-kpis">'+items.map(([label,value])=>'<div class="card"><small>'+esc(label)+'</small><strong>'+(typeof value==='string'?value:esc(value))+'</strong></div>').join('')+'</div>';
}
let BUSINESS_FILTER='',BUSINESS_DATE='';
function businessView(module){
 const records=businessRecords(module),search=BUSINESS_FILTER.toLowerCase(),rows=records.filter(r=>(!search||[r.name,r.resource,r.status,r.lot,r.serial,r.route,r.fund,r.donor,r.seller].some(v=>String(v||'').toLowerCase().includes(search)))&&(!BUSINESS_DATE||r.date===BUSINESS_DATE||r.start?.slice(0,10)===BUSINESS_DATE));
 if(module==='comprobantes'){
  const all=businessRecords().filter(r=>r.module!=='comprobantes'&&permission(r.module));main(pageHead('Comprobantes adaptados')+notice('Imprime fichas, cuentas, órdenes, contratos y estados de cuenta con los formatos existentes. Las facturas mantienen su impresión actual.')+accountingTable(['Módulo','Nombre','Estado','Acciones'],all.map(r=>'<tr><td>'+esc(businessModuleName(r.module))+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.status)+'</td><td>'+bAction('businessDetails',r,'Ver ficha')+' '+bAction('businessPrint',r,'Imprimir')+'</td></tr>').join('')));return;
 }
 main(pageHead(businessModuleName(module),`<button class="btn" data-a="businessNew" data-module="${esc(module)}">Nuevo registro</button> <button class="btn ghost" data-a="businessService">Crear servicio</button>`)+notice(BUSINESS.capabilities[module].flow)+(['cartera','contratos','cuentas_abiertas','comisiones'].includes(module)?businessLegal():'')+businessKpis(module,records)+`<form id="business-filter" class="module-search"><label>Buscar<input name="query" type="search" value="${esc(BUSINESS_FILTER)}" placeholder="Nombre, recurso, estado o referencia"></label><label>Fecha<input name="date" type="date" value="${esc(BUSINESS_DATE)}"></label><button class="btn ghost">Filtrar</button><button type="button" class="lk" data-a="businessClear">Limpiar</button></form>`+
 (module==='despacho'?'<div class="business-board">'+['Recibido','Preparando','Listo','Entregado'].map(status=>'<section class="card"><h3>'+status+'</h3>'+rows.filter(r=>r.status===status).map(r=>'<article><b>#'+esc(r.ticket)+' · '+esc(r.name)+'</b><p>'+esc(r.delivery||r.kind)+'</p><div class="accounting-actions">'+businessActions(r)+'</div></article>').join('')+'</section>').join('')+'</div>':accountingTable(['Fecha / horario','Nombre / recurso','Estado','Importe / cantidad','Acciones'],rows.map(r=>'<tr><td>'+esc(r.start?new Date(r.start).toLocaleString('es'):r.date)+(r.due?'<small class="ledger-sub">Vence '+esc(r.due)+'</small>':'')+'</td><td><b>'+esc(r.name)+'</b><small class="ledger-sub">'+esc([r.resource,r.lot,r.serial,r.route,r.fund].filter(Boolean).join(' · '))+'</small></td><td>'+esc(r.status)+'</td><td>'+(r.total!==undefined?bDisplayMoney(r.total):r.q!==undefined?esc(r.q):'—')+'</td><td><div class="accounting-actions">'+businessActions(r)+'</div></td></tr>').join(''))));
 if(['agenda','reservas'].includes(module))$('#main').insertAdjacentHTML('beforeend','<p class="mut">La fecha filtra citas y reservas; cada fila muestra su recurso y horario. Los solapamientos se comprueban en el servidor. Los recordatorios son avisos en la aplicación, sin envío automático.</p>');
 enforceAccessUI();
}
for(const module of BUSINESS.all)V[module]=()=>businessView(module);
document.addEventListener('submit',event=>{if(event.target.id==='business-filter'){event.preventDefault();BUSINESS_FILTER=v(event.target,'query');BUSINESS_DATE=v(event.target,'date');businessView(R)}});
ACT.businessClear=()=>{BUSINESS_FILTER='';BUSINESS_DATE='';view()};
const bConfirm=()=>bCheck('confirmed','Confirmo los datos y el efecto contable')+businessLegal();
const bPaymentFields=()=>bField('date','Fecha',today(),'date','required')+selectField('pay','Cuenta de dinero',option('1101','Caja general')+option('1102','Banco'))+bField('reference','Referencia de comprobante','','text','required maxlength="200"');
function businessOperationForm(d,operation,html,reader=()=>({}),label='Confirmar'){
 const r=businessRecord(d.id);return modal(esc(label+' · '+r.name),html,async f=>{await operate(operation,{module:r.module,id:r.id,confirmed:f.elements.confirmed?.checked===true,...reader(f)});view()},label);
}
ACT.businessState=d=>{
 const r=businessRecord(d.id),states={agenda:['Pendiente','Confirmada','Atendida','Cancelada'],proyectos:['Recibida','Diagnóstico','Presupuestada','En proceso','Entregada','Cancelada'],produccion:['Activa','Inactiva'],contratos:['Activo','Suspendido','Finalizado'],rutas:['Preventa','Preparada','Entregada','Cancelada'],despacho:['Recibido','Preparando','Listo','Entregado','Cancelado'],documentos_venta:['Pendiente','Cancelado']};
 businessOperationForm(d,'businessState',selectField('status','Estado',states[r.module].map(s=>option(s,s,s===r.status)).join('')),f=>({status:v(f,'status')}),'Cambiar estado');
};
ACT.businessConsume=d=>businessOperationForm(d,'businessConsume',bItems(),f=>({items:businessReadItems(f)}),'Agregar consumos');
ACT.businessMove=d=>{const r=businessRecord(d.id);businessOperationForm(d,'businessMove',bField('resource','Destino / recurso',r.resource,'text','required')+bField('responsible','Responsable',r.responsible),f=>({resource:v(f,'resource'),responsible:v(f,'responsible')}),'Mover cuenta')};
ACT.businessMerge=d=>{const r=businessRecord(d.id);businessOperationForm(d,'businessMerge',bSelect('targetId','Cuenta que recibe los consumos',businessRecords('cuentas_abiertas').filter(o=>o.id!==r.id&&o.status==='Abierta').map(o=>[o.id,o.name])),f=>({targetId:v(f,'targetId')}),'Unir cuentas')};
ACT.businessSplit=d=>{const r=businessRecord(d.id);businessOperationForm(d,'businessSplit',bField('name','Nombre de la cuenta separada',r.name+' · separada')+notice('Indica cuántas unidades de cada consumo pasan a la cuenta nueva. Cero conserva toda la línea en la cuenta actual.')+r.items.map((i,n)=>bField('split_'+n,(S.products.find(p=>p.id===i.p)?.name||i.p)+' · disponible '+i.q,0,'number','min="0" max="'+i.q+'" step="0.001"')).join(''),f=>({name:v(f,'name'),splitItems:r.items.map((i,index)=>({index,q:Number(v(f,'split_'+index))})).filter(i=>i.q>0)}),'Dividir cuenta')};
ACT.businessProduce=d=>businessOperationForm(d,'businessProduce',bField('date','Fecha',today(),'date','required')+bField('q','Unidades terminadas',1,'number','min="0.001" step="0.001" required')+bConfirm(),f=>({date:v(f,'date'),q:+v(f,'q')}),'Producir');
ACT.businessAdvance=d=>businessOperationForm(d,'businessAdvance',bPaymentFields()+bMoney('total','Anticipo / depósito recibido')+bAccounts('liability','Pasivo: anticipos recibidos','','pasivo')+notice('Se registra como pasivo, separado del ingreso. Para aplicarlo, factura a crédito con un saldo suficiente.')+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference'),total:+v(f,'total'),liability:v(f,'liability')}),'Registrar anticipo');
ACT.businessDisburse=d=>{const r=businessRecord(d.id);businessOperationForm(d,'businessDisburse',businessScheduleMarkup(r)+bPaymentFields()+notice('Capital: '+bDisplayMoney(r.principal)+'. La fecha debe coincidir con el plan.')+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference')}),'Desembolsar')};
ACT.businessCollect=d=>{const r=businessRecord(d.id),row=r.schedule.find(s=>r2(s.total+s.penalty-s.paid)>0);businessOperationForm(d,'businessCollect',notice('Primera cuota pendiente: '+row.number+' · vence '+row.due+'. El cobro aplica primero interés y mora devengados, luego capital. La mora se calcula al confirmar según la fecha.')+businessScheduleMarkup(r)+bPaymentFields()+bMoney('total','Importe que se cobra',r2(row.total+row.penalty-row.paid))+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference'),total:+v(f,'total')}),'Cobrar cuota')};
ACT.businessRelease=d=>businessOperationForm(d,'businessRelease',bField('date','Fecha',today(),'date','required')+bField('note','Constancia de entrega de la prenda')+bConfirm(),f=>({date:v(f,'date'),note:v(f,'note')}),'Liberar garantía');
ACT.businessCommission=d=>businessOperationForm(d,'businessCommission',bPaymentFields()+bAccounts('expenseAccount','Gasto de comisiones','','gasto')+bAccounts('liabilityAccount','Comisiones por pagar','','pasivo')+notice('Base: subtotal de la venta menos devoluciones registradas. Esta liquidación es independiente de la nómina: no vuelvas a pagar el mismo concepto en Personal.')+bConfirm(),f=>({date:v(f,'date'),reference:v(f,'reference'),expenseAccount:v(f,'expenseAccount'),liabilityAccount:v(f,'liabilityAccount')}),'Devengar comisión');
ACT.businessLiquidate=d=>businessOperationForm(d,'businessLiquidate',bPaymentFields()+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference')}),'Liquidar comisión');
ACT.businessDonate=d=>businessOperationForm(d,'businessDonate',bPaymentFields()+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference')}),'Confirmar aporte');
ACT.businessCheckin=d=>businessOperationForm(d,'businessCheckin',notice('Confirma el recurso y el horario antes de registrar la entrada.')+bConfirm(),()=>({}),'Registrar entrada');
ACT.businessCheckout=d=>businessOperationForm(d,'businessCheckout',notice('La salida exige factura confirmada y depósito aplicado.')+bConfirm(),()=>({}),'Registrar salida');
function businessBillForm(d,recurring=false){
 const r=businessRecord(d.id),serials=businessRecords('variantes').filter(s=>s.serial&&s.status==='Disponible'&&(r.items||[]).some(i=>i.p===s.productId));
 let html=notice('Se emite una factura por el flujo existente. Revisa los precios confirmados y pagos; los anticipos se aplican contra crédito.')+bField('date','Fecha',today(),'date','required')+bField('due','Vencimiento',today(),'date','required')+selectField('shiftId','Turno abierto',shiftOptions(''))+bField('series','Serie autorizada','A','text','required maxlength="16"');
 if(r.module==='proyectos')html+=bField('milestone','Etapa única a facturar','','text','required maxlength="80"')+bItems(r.items||[]);
 if(recurring)html+=bField('period','Período a generar',(r.billed?.length||0)+1,'number',`min="1" max="${r.periods}" step="1" required`);
 if(serials.length)html+='<h4>Series a entregar</h4>'+serials.map(s=>bCheck('serial_'+s.id,s.serial+' · '+s.name)).join('');
 html+=selectField('payment','Forma de pago',option('credito','Crédito (aplica anticipos)')+option('efectivo','Efectivo en turno')+option('transferencia','Transferencia / banco')+option('tarjeta','Tarjeta'))+bMoney('paymentAmount','Total de factura confirmado (incluye IVA y cargos)',r.total||0)+bConfirm();
 const form=businessOperationForm(d,recurring?'businessGenerate':'businessBill',html,f=>({date:v(f,'date'),due:v(f,'due'),shiftId:v(f,'shiftId'),series:v(f,'series'),milestone:f.elements.milestone?.value,period:Number(f.elements.period?.value),items:r.module==='proyectos'?businessReadItems(f):undefined,serialIds:serials.filter(s=>f.elements['serial_'+s.id]?.checked).map(s=>s.id),payments:[{method:v(f,'payment'),amount:+v(f,'paymentAmount')}]}),'Emitir factura');
 const update=async()=>{try{const math=await businessMath();if(!form.isConnected)return;const items=math.businessBillItems(r,S.products,r.module==='proyectos'?businessReadItems(form):undefined),late=math.businessContractLateItems(r,S.entries,S.products,v(form,'date'));form.elements.paymentAmount.value=math.invoiceTotals([...items,...late.items]).total;}catch(error){form.querySelector('.err').textContent=error.message}};
 form.addEventListener('change',update);update();return form;
}
ACT.businessBill=d=>businessBillForm(d);
ACT.businessGenerate=d=>businessBillForm(d,true);
// Indicadores operativos según permisos; las cifras contables siguen en los informes existentes.
function businessReport(){
 const rows=businessRecords().filter(r=>permission(r.module));if(!rows.length)return '';
 const p=businessProfile(),modules=p.id==='comercio'?[...new Set(rows.map(r=>r.module))]:p.capabilities;
 return '<section class="card business-report"><h3>Indicadores de '+esc(p.name)+'</h3>'+modules.filter(m=>permission(m)&&rows.some(r=>r.module===m)).map(m=>'<h4>'+esc(businessModuleName(m))+'</h4>'+businessKpis(m,rows.filter(r=>r.module===m))).join('')+'<p class="mut">Datos operativos de la sucursal seleccionada. Los saldos e impuestos oficiales se consultan en los estados contables.</p></section>';
}
for(const route of ['analisis','decisiones','simuladores','pronostico','rentabilidad','resultados'])if(V[route]){const original=V[route];V[route]=function(...args){const result=original.apply(this,args);if(businessProfile().id!=='comercio')$('#main')?.insertAdjacentHTML('beforeend',businessReport());return result}}
const businessSwitch=ACT.switch;
ACT.switch=function(...args){BUSINESS_FILTER='';BUSINESS_DATE='';return businessSwitch.apply(this,args)};
// Adapta textos de interfaz, sin cambiar nombres de cuentas, registros ni documentos guardados.
function applyBusinessLabels(root){
 if(!CO||(businessProfile().id==='comercio'&&!Object.keys(CO.businessCustomization?.labels||{}).length))return;
 const labels=businessLabels(),cap=s=>s.charAt(0).toUpperCase()+s.slice(1),map={Cliente:cap(labels.customer),Producto:cap(labels.product),'Productos e inventario':cap(labels.product)+' e inventario','Cartera de clientes':cap(labels.customer)+' · directorio'};
 for(const element of root.querySelectorAll('h2,h3,label,th'))for(const node of element.childNodes)if(node.nodeType===Node.TEXT_NODE&&map[node.textContent.trim()])node.textContent=map[node.textContent.trim()];
}
const businessViewBase=view;
view=function(...args){const result=businessViewBase.apply(this,args);applyBusinessLabels($('#main'));return result};
const businessModalBase=modal;
modal=function(...args){const form=businessModalBase(...args);applyBusinessLabels(form);if(form.querySelector('#pos-items')){const serials=businessRecords('variantes').filter(r=>r.serial&&r.status==='Disponible');if(serials.length)form.querySelector('.mb').insertAdjacentHTML('beforeend','<h4>Series a entregar</h4>'+serials.map(r=>'<label class="ck"><input type="checkbox" name="businessSerial" value="'+esc(r.id)+'"> '+esc(r.serial+' · '+r.name)+'</label>').join(''));}return form};
function businessCalendar(module,rows){
 const now=BUSINESS_DATE?new Date(BUSINESS_DATE+'T12:00:00'):new Date(),year=now.getFullYear(),month=now.getMonth(),days=new Date(year,month+1,0).getDate(),offset=(new Date(year,month,1).getDay()+6)%7;
 const dayKey=n=>year+'-'+String(month+1).padStart(2,'0')+'-'+String(n).padStart(2,'0');
 return '<section class="card business-calendar"><h3>'+esc(new Intl.DateTimeFormat('es',{month:'long',year:'numeric'}).format(now))+'</h3><div class="business-calendar-grid">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>'<b>'+d+'</b>').join('')+Array.from({length:offset},()=>'<div aria-hidden="true"></div>').join('')+Array.from({length:days},(_,i)=>{const day=dayKey(i+1),events=rows.filter(r=>r.start?.slice(0,10)<=day&&r.end?.slice(0,10)>=day&&!['Cancelada','Finalizada'].includes(r.status));return '<div class="business-calendar-day"><span>'+esc(i+1)+'</span>'+events.map(r=>'<button type="button" class="lk" data-a="businessDetails" data-id="'+esc(r.id)+'" title="'+esc(r.resource+' · '+r.name)+'">'+esc(r.resource+' · '+r.name)+'</button>').join('')+'</div>'}).join('')+'</div></section>';
}
for(const module of ['agenda','reservas']){const original=V[module];V[module]=function(){original();$('#business-filter')?.insertAdjacentHTML('afterend',businessCalendar(module,businessRecords(module)));};}
ACT.businessAccrue=d=>businessOperationForm(d,'businessAccrue',bField('date','Devengar hasta',today(),'date','required')+notice('Devenga solo intereses y mora nuevos de cuotas vencidas. No registra entrada de dinero.')+bConfirm(),f=>({date:v(f,'date')}),'Devengar vencidas');
if(V.personal){const original=V.personal;V.personal=function(){original();if(permission('comisiones')){const rows=businessRecords('comisiones');$('#main')?.insertAdjacentHTML('beforeend','<section class="card"><h3>Comisiones por servicio</h3><p>Vinculadas al expediente del empleado; cada devengo y liquidación conserva su referencia. Evita repetir el mismo concepto en nómina.</p>'+accountingTable(['Empleado','Fecha','Estado','Importe'],rows.map(r=>'<tr><td>'+esc(S.employees.find(e=>e.id===r.employeeId)?.name||r.employeeId)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.status)+'</td><td>'+bDisplayMoney(r.total||0)+'</td></tr>').join(''))+'<button class="btn ghost" data-a="nav" data-r="comisiones">Abrir comisiones</button></section>')}};}
ACT.businessRefund=d=>{const r=businessRecord(d.id);businessOperationForm(d,'businessRefund',bPaymentFields()+bMoney('total','Depósito a devolver',r.deposit)+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference'),total:+v(f,'total')}),'Devolver depósito')};
ACT.businessCost=d=>businessOperationForm(d,'businessCost',bPaymentFields()+bSelect('catalogId','Costo del catálogo',(S.costCatalog||[]).filter(c=>c.active).map(c=>[c.id,c.name]))+bMoney('base','Importe sin IVA')+bField('vatRate','IVA acreditable (%)',0,'number','min="0" max="100" step="0.01" required')+bField('due','Vencimiento',today(),'date','required')+bConfirm(),f=>({date:v(f,'date'),pay:v(f,'pay'),reference:v(f,'reference'),catalogId:v(f,'catalogId'),base:+v(f,'base'),vatRate:+v(f,'vatRate'),due:v(f,'due')}),'Registrar costo asociado');
for(const module of ['agenda','reservas','contratos']){const original=V[module];V[module]=function(){original();const day=today(),reminders=businessRecords(module).filter(r=>r.reminder&&!['Cancelada','Finalizada','Finalizado'].includes(r.status)&&(module==='contratos'||r.start?.slice(0,10)===day));if(reminders.length)$('#main')?.insertAdjacentHTML('afterbegin','<section class="card"><h3>Recordatorios</h3>'+reminders.map(r=>'<p><b>'+esc(r.name)+'</b> · '+esc(r.reminder)+'</p>').join('')+'</section>');};}

ACT.businessPurchase=d=>businessOperationForm(d,'businessPurchase',bField('date','Fecha del vínculo',today(),'date','required')+bSelect('purchaseId','Compra existente',S.entries.filter(e=>e.type==='compra').map(e=>[e.id,e.date+' · '+(e.reference||e.desc)]))+notice('Vincula una compra ya registrada a esta obra. No genera otro asiento ni cambia importes.')+bConfirm(),f=>({date:v(f,'date'),purchaseId:v(f,'purchaseId')}),'Vincular compra a proyecto');
