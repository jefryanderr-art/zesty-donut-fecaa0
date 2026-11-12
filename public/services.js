'use strict';
// Amplía fichas existentes y sus operaciones protegidas. No crea otro libro contable.
let SV_MODEL,SV_VIEW=0;
const svReady=()=>SV_MODEL?Promise.resolve(SV_MODEL):import('./service-model.mjs?v=b1ca44c863c3185e').then(m=>(SV_MODEL=m));
const svProfiles=['profesionales','software','freelance','inmobiliaria','seguros','recurrentes','belleza','salud','educacion','gimnasio','taller','lavanderia','transporte'];
const svActive=()=>svProfiles.includes(businessOperationalType());
const svModules=['agenda','proyectos','contratos','cuentas_abiertas','documentos_venta','reservas','medidas','despacho'];
const svButton=(a,r,label)=>bAction(a,r,label);
const svForm=(d,op,html,read,label)=>businessOperationForm(d,op,html+bConfirm(),read,label);
const svDate=()=>bField('date','Fecha de registro',today(),'date','required');
const svSelect=(name,label,rows,value='')=>bSelect(name,label,rows,value);
const svDayFields=m=>Object.fromEntries(m.serviceFields(businessOperationalType()).map(f=>[f.key,f.label]));
const svActionBase=businessActions;
businessActions=function(r){let html=svActionBase(r);if(!svActive()||!svModules.includes(r.module)||!permission(r.module,true))return html;
 html+=' '+svButton('businessServicesDetails',r,'Atención y seguimiento');
 if(r.entryId&&permission('contabilidad',true))html+=' '+svButton('businessServicesPayments',r,'Plan de pago');
 if(r.module==='proyectos')html+=' '+svButton('businessServicesTime',r,'Registrar tiempo')+' '+svButton('businessServicesProgress',r,'Entregables y avance')+(!r.entryId&&!r.deposit&&!r.billed?.length? ' '+svButton('businessServicesPackage',r,'Configurar bono prepagado'):'');
 if(['agenda','reservas','contratos'].includes(r.module)&&['gimnasio','educacion'].includes(businessOperationalType()))html+=' '+svButton('businessServicesAttendance',r,'Reserva / asistencia');
 if(r.module==='contratos'&&r.status==='Activo'&&!r.renewedTo)html+=' '+svButton('businessServicesRenew',r,'Renovar contrato');
 if(r.module==='documentos_venta'&&r.status==='Pendiente'&&!r.convertedProjectId&&permission('proyectos',true))html+=' '+svButton('businessServicesQuote',r,'Pasar a proyecto');
 if(r.service?.surveyEnabled)html+=' '+svButton('businessServicesFeedback',r,'Registrar satisfacción');
 if(businessOperationalType()==='lavanderia'&&['cuentas_abiertas','proyectos','despacho','medidas'].includes(r.module))html+=' '+svButton('businessServicesLaundry',r,'Avanzar lavado');
 if(businessOperationalType()==='taller'&&r.module==='proyectos'&&(r.receptionPhotos?.length||0)<5)html+=' '+svButton('businessServicesPhoto',r,'Foto de recepción');return html;
};
const svDetailsBase=businessDetailsMarkup;
businessDetailsMarkup=function(r){let html=svDetailsBase(r);if(!svActive())return html;
 if(r.service)html+='<h4>Atención y seguimiento</h4>'+accountingTable(['Dato','Detalle'],Object.entries(r.service).filter(([,v])=>v!==''&&v!==false).map(([k,v])=>'<tr><td>'+esc(SV_MODEL?svDayFields(SV_MODEL)[k]||k:k)+'</td><td>'+esc(v===true?'Sí':v)+'</td></tr>').join(''));
 if(r.servicePackage)html+=notice('Bono por sesiones: el anticipo se conserva como pasivo hasta facturar cada prestación. Disponible: '+bDisplayMoney(r.deposit||0)+'. Las devoluciones no reabren sesiones automáticamente.');
 if(r.serviceProgress!==undefined)html+='<p>Avance: '+esc(r.serviceProgress)+'%</p>';
 if(r.serviceTime?.length)html+='<h4>Tiempo por cliente y proyecto</h4>'+accountingTable(['Inicio','Fin','Horas','Estado'],r.serviceTime.map(t=>'<tr><td>'+esc(t.start)+'</td><td>'+esc(t.end)+'</td><td>'+esc((t.minutes/60).toFixed(3))+'</td><td>'+esc(t.entryId?'Facturado':'Pendiente')+'</td></tr>').join(''));
 if(r.servicePaymentPlans?.length&&SV_MODEL&&(permission('contabilidad')||permission('finanzas')))html+='<h4>Plan de pago: saldo por cuota</h4>'+r.servicePaymentPlans.map(p=>accountingTable(['Vence','Cuota','Pendiente'],SV_MODEL.servicePaymentBalances(p,S.entries).map(i=>'<tr><td>'+esc(i.due)+'</td><td>'+money(i.amountCents/100)+'</td><td>'+money(i.remainingCents/100)+'</td></tr>').join(''))).join('');
 if(r.serviceLaundryState)html+='<p>Lavado: '+esc(r.serviceLaundryState)+'</p>';
 if(businessOperationalType()==='taller'&&r.service?.plate){const history=businessRecords('proyectos').filter(o=>o.id!==r.id&&o.service?.plate===r.service.plate);if(history.length)html+='<h4>Historial de este vehículo / equipo</h4>'+history.map(o=>'<p>'+esc(o.date+' · '+o.name+' · '+o.status)+'</p>').join('');}
 if(r.receptionPhotos?.length)html+='<h4>Fotos privadas de recepción</h4>'+r.receptionPhotos.map((p,i)=>'<p><a target="_blank" rel="noopener" href="/api/order-reference?c='+encodeURIComponent(CO.id)+'&amp;id='+encodeURIComponent(r.id)+'&amp;photo='+encodeURIComponent(p.id)+'">Descargar foto '+(i+1)+'</a></p>').join('');
 else if(r.referencePhoto)html+='<p><a target="_blank" rel="noopener" href="/api/order-reference?c='+encodeURIComponent(CO.id)+'&amp;id='+encodeURIComponent(r.id)+'">Descargar referencia privada</a></p>';
 if(r.serviceAttendance?.length)html+='<h4>Asistencia</h4>'+accountingTable(['Fecha','Cliente'],r.serviceAttendance.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(S.customers.find(c=>c.id===x.customerId)?.name||x.customerId)+'</td></tr>').join(''));
 if(r.serviceReservations?.length)html+='<h4>Reservas de clase</h4>'+accountingTable(['Fecha','Cliente','Estado'],r.serviceReservations.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(S.customers.find(c=>c.id===x.customerId)?.name||x.customerId)+'</td><td>'+esc(x.cancelled?'Cancelada':'Reservada')+'</td></tr>').join(''));
 return html;
};
ACT.businessServicesDetails=async d=>{
 const model=await svReady(),r=businessRecord(d.id),fields=model.serviceFields(r.operationalProfile||businessOperationalType());
 let html=svDate()+notice('Ficha administrativa. Los avisos se consultan aquí; no se envían correos ni mensajes automáticamente. Las becas y condiciones de hermanos solo las autoriza el dueño. Los descuentos monetarios se autorizan al facturar.');
 for(const f of fields){const value=r.service?.[f.key];html+=f.type==='customer'?svSelect(f.key,f.label,[['','Cliente de la ficha'],...S.customers.filter(c=>c.status==='activo').map(c=>[c.id,c.name])],value):f.type==='boolean'?bCheck(f.key,f.label,value):bField(f.key,f.label,value??'',f.type==='integer'?'number':f.type==='date'?'date':'text',f.type==='integer'?'min="0" max="1000000" step="1"':'maxlength="1000"');}
 html+=bField('reason','Motivo de la actualización','','text','required minlength="3" maxlength="500"');
 if(businessOperationalType()==='salud')html+=bCheck('noSensitiveData','Confirmo que no incluyo diagnósticos, historias clínicas ni datos sensibles');
 return svForm(d,'businessServicesDetails',html,f=>({details:Object.fromEntries(fields.map(x=>[x.key,x.type==='boolean'?f.elements[x.key].checked:x.type==='integer'?Number(v(f,x.key)):v(f,x.key)])),reason:v(f,'reason'),noSensitiveData:f.elements.noSensitiveData?.checked===true}),'Guardar ficha de atención');
};
ACT.businessServicesTime=d=>svForm(d,'businessServicesTime',bField('start','Inicio','','datetime-local','required')+bField('end','Fin','','datetime-local','required')+svSelect('employeeId','Empleado (opcional)',[['','Sin asignar'],...S.employees.filter(e=>e.active!==false).map(e=>[e.id,e.name])])+bField('note','Trabajo realizado','','text','maxlength="500"')+notice('El tiempo se vincula a este cliente y proyecto. Para facturarlo selecciona los registros desde Facturar etapa. Usa intervalos de tres minutos para horas con hasta tres decimales.'),f=>({start:new Date(v(f,'start')).toISOString(),end:new Date(v(f,'end')).toISOString(),employeeId:v(f,'employeeId'),note:v(f,'note')}),'Registrar tiempo');
ACT.businessServicesProgress=d=>{const r=businessRecord(d.id);return svForm(d,'businessServicesProgress',svDate()+bField('progress','Avance (%)',r.serviceProgress||0,'number','min="0" max="100" step="1" required')+bField('note','Entregable / constancia del avance','','text','required maxlength="1000"'),f=>({date:v(f,'date'),progress:Number(v(f,'progress')),note:v(f,'note')}),'Actualizar avance')};
ACT.businessServicesPackage=d=>svForm(d,'businessServicesPackage',notice('Las líneas de este proyecto definen servicios, cantidades y precios del bono o tratamiento. Registra después el prepago con Registrar anticipo. Cada Facturar etapa consume únicamente las cantidades prestadas, a crédito y aplicando el anticipo. No factura ni consume inventario al configurar el bono.'),()=>({}),'Configurar bono por sesiones');
ACT.businessServicesQuote=d=>svForm(d,'businessServicesQuote',svDate()+notice('Traslada líneas y anticipos al proyecto una sola vez. La cotización queda convertida. Las etapas y facturas se registran desde el proyecto.'),f=>({date:v(f,'date')}),'Convertir cotización a proyecto');
ACT.businessServicesAttendance=d=>svForm(d,'businessServicesAttendance',svDate()+svSelect('customerId','Alumno / socio',S.customers.map(c=>[c.id,c.name]))+svSelect('mode','Acción',[['reservar','Reservar cupo'],['cancelar','Cancelar reserva'],['asistencia','Registrar asistencia']]),f=>({date:v(f,'date'),customerId:v(f,'customerId'),mode:v(f,'mode')}),'Reserva y asistencia');
ACT.businessServicesRenew=d=>svForm(d,'businessServicesRenew',svDate()+bField('newDate','Inicio del contrato renovado',today(),'date','required')+bField('due','Nuevo vencimiento',today(),'date','required')+bField('reason','Constancia de renovación','','text','required maxlength="500"')+notice('Crea un contrato vinculado con las mismas líneas y condiciones. Conserva facturas y deuda del contrato anterior; no genera cobros ni facturas por sí solo.'),f=>({date:v(f,'date'),newDate:v(f,'newDate'),due:v(f,'due'),reason:v(f,'reason')}),'Confirmar renovación');
ACT.businessServicesFeedback=d=>svForm(d,'businessServicesFeedback',svDate()+svSelect('score','Valoración',[1,2,3,4,5].map(n=>[String(n),n+'/5']))+bField('note','Comentario opcional','','text','maxlength="500"'),f=>({date:v(f,'date'),score:Number(v(f,'score')),note:v(f,'note')}),'Satisfacción opcional');
ACT.businessServicesLaundry=d=>{const r=businessRecord(d.id),states=['Recibido','Lavando','Listo','Entregado'],next=states[states.indexOf(r.serviceLaundryState||'Recibido')+1];if(!next)return toast('La orden ya está entregada.');return svForm(d,'businessServicesLaundry',svDate()+notice('Estado siguiente: '+next+'. Entregado exige factura. El aviso al cliente queda como constancia manual; no se envía automáticamente.')+bField('note','Constancia de aviso al cliente / entrega','','text','maxlength="1000"'),f=>({date:v(f,'date'),status:next,note:v(f,'note')}),'Avanzar a '+next)};
ACT.businessServicesPhoto=d=>{
 const r=businessRecord(d.id);modal('Foto de recepción · '+esc(r.name),notice('Hasta cinco fotos privadas por orden, una por carga. JPG, PNG o WebP de hasta 1 MB cada una. Requiere autorización del cliente. Se conserva en respaldos; no se envía al asistente.')+field('photo','Foto','','file','accept="image/jpeg,image/png,image/webp" required')+bCheck('photoConsent','Confirmo autorización para guardar la foto privada')+bConfirm(),async f=>{
  const file=f.elements.photo.files[0];if(!file||file.size>1048576)throw new Error('Selecciona una imagen de hasta 1 MB.');
  const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
  await operate('businessServicesPhoto',{module:r.module,id:r.id,confirmed:f.elements.confirmed.checked,photoConsent:f.elements.photoConsent.checked,photo:{name:file.name,type:file.type,content}});view();
 },'Guardar foto privada');
};
const svBillBase=ACT.businessBill;
ACT.businessBill=async function(d,...args){const result=await svBillBase(d,...args),r=businessRecord(d.id);svAddEmployee();if(!svActive()||r.module!=='proyectos'||!r.serviceTime?.some(t=>!t.entryId))return result;const form=document.querySelector('#modal form');if(form)form.insertAdjacentHTML('beforeend','<fieldset><legend>Tiempo a facturar (opcional)</legend><p>Selecciona registros y prepara una única línea de servicio con las horas exactas. Cada registro solo se factura una vez.</p>'+r.serviceTime.filter(t=>!t.entryId).map(t=>bCheck('svtime_'+t.id,t.start+' · '+(t.minutes/60).toFixed(3)+' horas')).join('')+'</fieldset>');return result;};
const svOperateBase=operate;
operate=async function(op,b={}){if(!pendingCloudOperation&&['businessBill','businessGenerate'].includes(op)&&svActive()){
 const r=businessRecord(b.id),form=document.querySelector('#modal form');if(r?.serviceTime&&form)b={...b,serviceTimeIds:r.serviceTime.filter(t=>form.elements['svtime_'+t.id]?.checked).map(t=>t.id)};
 if(form?.elements.serviceEmployeeId?.value)b={...b,serviceEmployeeId:form.elements.serviceEmployeeId.value};
 }return svOperateBase(op,b);};
for(const route of svModules){const original=V[route];if(!original)continue;V[route]=function(...args){const result=original.apply(this,args);if(!svActive())return result;const company=CO.id,generation=++SV_VIEW;svReady().then(model=>{if(CO?.id!==company||R!==route||generation!==SV_VIEW)return;const rows=businessRecords(route),labels=svDayFields(model),alerts=rows.filter(r=>!['Cancelada','Cancelado','Finalizado','Finalizada'].includes(r.status)).flatMap(r=>model.serviceAlerts(r,today()).map(a=>({r,...a})));
 let html='<section class="card"><h3>Operación de servicios</h3><p>Atención y seguimiento amplía cada ficha. Clientes conserva el historial y estado de cuenta imprimible. Las líneas de catálogo permiten servicio, hora, período, matrícula, materiales y eventos; los anticipos y cobros conservan sus operaciones contables. Verifica con tu contador.</p>';
 if(alerts.length)html+='<h4>Avisos de seguimiento y vencimiento</h4>'+accountingTable(['Ficha','Aviso','Fecha'],alerts.map(a=>'<tr><td>'+svButton('businessDetails',a.r,a.r.name)+'</td><td>'+esc(labels[a.key]||a.key)+'</td><td>'+esc(a.date)+'</td></tr>').join(''));else html+='<p class="mut">Sin avisos de seguimiento para la fecha actual.</p>';
 if((permission('contabilidad')||permission('finanzas'))&&permission('ventas')){const overdue=rows.flatMap(r=>(r.billed||[]).filter(b=>b.due&&b.due<today()).map(b=>({r,b,balance:model.serviceInvoiceBalance(S.entries,b.entryId)/100}))).filter(x=>x.balance>0.005);if(overdue.length)html+='<h4>Cobros vencidos / morosos</h4>'+overdue.map(x=>'<p>'+esc(x.r.name+' · '+x.b.due)+' · '+money(x.balance)+'</p>').join('');}
 const waiting=rows.filter(r=>r.service?.waiting);if(waiting.length)html+='<h4>Lista de espera</h4>'+waiting.map(r=>'<p>'+svButton('businessDetails',r,r.name)+'</p>').join('');
 if(businessOperationalType()==='transporte'&&['proyectos','contratos'].includes(route)&&permission('costos')&&permission('ventas')){
 const trips=model.serviceTripRows(rows,S.entries,S.costs||[]),units=new Map();
 for(const t of trips){const u=units.get(t.unit)||{name:t.unit,unit:t.unit,salesCents:0,costCents:0,profitCents:0};for(const k of ['salesCents','costCents','profitCents'])u[k]+=t[k];units.set(t.unit,u);}
 const table=list=>accountingTable(['Viaje / unidad','Unidad','Venta neta sin IVA','Costos registrados sin IVA','Margen'],list.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.unit)+'</td><td>'+money(t.salesCents/100)+'</td><td>'+money(t.costCents/100)+'</td><td>'+money(t.profitCents/100)+'</td></tr>').join(''));
 html+='<h4>Rentabilidad por viaje</h4>'+table(trips)+'<h4>Rentabilidad por unidad</h4>'+table([...units.values()])+notice('Acumulado de las fichas autorizadas de este módulo: ventas netas y costos vinculados vigentes. No incluye gastos indirectos ni convierte importes de distintas monedas.');
 }
 html+='</section>';$('#main')?.insertAdjacentHTML('afterbegin',html);
 }).catch(()=>{if(CO?.id===company&&R===route)$('#main')?.insertAdjacentHTML('afterbegin',notice('No se pudo cargar la guía operativa de servicios. Recarga la pantalla.'))});return result;};}
function svAddEmployee(){if(!svActive()||!permission('personal'))return;const form=document.querySelector('#modal form');if(form&&!form.elements.serviceEmployeeId)form.insertAdjacentHTML('beforeend',svSelect('serviceEmployeeId','Empleado para comisión de catálogo (opcional)',[['','Sin asignar'],...S.employees.filter(e=>e.active!==false).map(e=>[e.id,e.name])]));}
const svGenerateBase=ACT.businessGenerate;
ACT.businessGenerate=async function(...args){const result=await svGenerateBase(...args);svAddEmployee();return result};
const svCustomerHistory=ACT.customerHistory;
ACT.customerHistory=async function(d){const result=await svCustomerHistory(d);if(!svActive())return result;const rows=businessRecords().filter(r=>svModules.includes(r.module)&&permission(r.module)&&(r.customerId===d.id||r.service?.guardianId===d.id));if(rows.length)$('#main')?.insertAdjacentHTML('beforeend','<section class="card"><h3>Historial de atención y servicios</h3>'+accountingTable(['Fecha','Servicio / alumno','Estado','Ficha'],rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc([r.name,r.service?.student,r.service?.patient].filter(Boolean).join(' · '))+'</td><td>'+esc(r.status)+'</td><td>'+svButton('businessDetails',r,'Ver ficha')+'</td></tr>').join(''))+'</section>');return result};
ACT.businessServicesPayments=async d=>{
 const r=businessRecord(d.id),model=await svReady(),ids=[r.entryId,...(r.billed||[]).map(b=>b.entryId)],invoices=S.entries.filter(e=>e.type==='venta'&&ids.includes(e.id)&&e.creditAmount>0&&!r.servicePaymentPlans?.some(p=>p.entryId===e.id));
 if(!invoices.length)return toast('No hay facturas a crédito sin calendario en esta ficha.');
 let html=svDate()+svSelect('entryId','Factura a crédito',invoices.map(e=>[e.id,(e.reference||e.id)+' · crédito original '+money(e.creditAmount)]))+notice('Define hasta seis cuotas aquí. Deben sumar el crédito original. Los anticipos, abonos y notas de crédito se aplican primero a las cuotas más antiguas. El calendario no cobra, no agrega intereses y no genera asientos.');
 for(let i=0;i<6;i++)html+='<fieldset><legend>Cuota '+(i+1)+' (importe cero omite)</legend>'+bField('due'+i,'Vencimiento',today(),'date')+bMoney('amount'+i,'Importe',0)+'</fieldset>';
 return svForm(d,'businessServicesPayments',html,f=>({date:v(f,'date'),entryId:v(f,'entryId'),installments:Array.from({length:6},(_,i)=>({due:v(f,'due'+i),amountCents:Math.round(Number(v(f,'amount'+i))*100)})).filter(i=>i.amountCents>0)}),'Guardar plan de pago');
};
