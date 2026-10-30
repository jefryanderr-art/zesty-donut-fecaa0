'use strict';

const ACCESS_MODULES=[['ventas','Ventas'],['compras','Compras'],['gastos','Gastos'],['inventario','Productos e inventario'],['contabilidad','Contabilidad y cuentas por cobrar / pagar'],['finanzas','Estados financieros'],['personal','Personal, nómina y liquidaciones'],['fiscal','Fiscal y reglas'],['ajustes','Ajustes y respaldo completo'],['accesibilidad','Administración de accesos'],['auditoria','Bitácora de auditoría'],['diseno_factura','Edición de factura']];
const ROUTE_MODULE={ventas:'ventas',compras:'compras',gastos:'gastos',productos:'inventario',kardex:'inventario',apertura:'contabilidad',diario:'contabilidad',mayor:'contabilidad',cuentas:'contabilidad',cobrar:'contabilidad',pagar:'contabilidad',balanza:'finanzas',resultados:'finanzas',balance:'finanzas',flujo:'finanzas',personal:'personal',nomina:'personal',liquidaciones:'personal',provisiones:'personal',fiscal:'fiscal',impuestos:'fiscal',propiedades:'fiscal',reglas:'fiscal',ajustes:'ajustes',accesibilidad:'accesibilidad',auditoria:'auditoria'};
const permission=(module,write=false)=>{
  if(!CO)return false;if(CO.support&&write)return false;if(CO.readOnlyLimit&&write)return false;if(CO.billingPlan?.blockedModules?.includes(module))return false;if(CO.owner)return true;
  if(module==='diseno_factura'){const level=CO.permissions?.[module];return level==='escritura'||(!write&&level==='lectura')}
  const role=String(CO.role||'').trim().toLowerCase();
  if(module==='ventas'&&role!=='contador')return false;
  if(['cajero','vendedor','supervisor'].includes(role)&&['contabilidad','finanzas','personal','fiscal','ajustes','auditoria','accesibilidad'].includes(module))return false;
  if(['cajero','vendedor'].includes(role)&&(!['facturacion','inventario','cajas','cuentas_abiertas','agenda','despacho','documentos_venta','comprobantes','medidas','rutas'].includes(module)||(module==='inventario'&&write)))return false;
  const fallback={facturacion:'ventas',cajas:'contabilidad',costos:'gastos',proveedores:'compras'},level=CO.permissions?.[module]??(role==='contador'?CO.permissions?.[fallback[module]]:undefined);
  return level==='escritura'||(!write&&level==='lectura');
};
ROUTE_MODULE.clientes='ventas';
const completeAccess=(write=false)=>ACCESS_MODULES.slice(0,8).every(([module])=>permission(module,write));
function routeAllowed(route){if(route==='panel')return !!CO;if(route==='pagina')return !!U?.editor&&isAcontecCompany();if(route==='administracion')return !!U?.admin;return !!ROUTE_MODULE[route]&&permission(ROUTE_MODULE[route])}
function firstAllowedRoute(){return MENU.flatMap(([,items])=>items).find(([route])=>routeAllowed(route))?.[0]||'sinacceso'}
function canSave(){return !!CO&&!CO.support&&!CO.readOnlyLimit&&(CO.owner||ACCESS_MODULES.some(([module])=>permission(module,true)))}
const READ_ACTIONS=new Set(['nav','menu','close','switch','opencomp','logout','per','print','printEntry','printSale','backup','backupAll','companyPdf','downloadSnapshot','auditPrev','auditNext','auditDetails','taxDetails','invoiceHistory','payrollDetail','exportTaxes','exportTaxReport','downloadReceipt']);
const ACTION_MODULE={venta:'ventas',editventa:'ventas',compra:'compras',editcompra:'compras',gasto:'gastos',editgasto:'gastos',newprod:'inventario',editprod:'inventario',adjust:'inventario',delprod:'inventario',manual:'contabilidad',open:'contabilidad',newacc:'contabilidad',delacc:'contabilidad',newReceivable:'contabilidad',newPayable:'contabilidad',collectInvoice:'contabilidad',payInvoice:'contabilidad',newMember:'accesibilidad',editMember:'accesibilidad',toggleMember:'accesibilidad',restore:'ajustes',restoreSnapshot:'ajustes',cfg:'ajustes',newEmployee:'personal',editEmployee:'personal',newPayroll:'personal',editPayroll:'personal',closePayroll:'personal',deletePayroll:'personal',employeeLoan:'personal',newSettlement:'personal',closeSettlement:'personal',deleteSettlement:'personal',newTax:'fiscal',editTax:'fiscal',removeTax:'fiscal',payTax:'fiscal',nextTax:'fiscal',closeVAT:'fiscal',closeIncome:'fiscal',newProperty:'fiscal',editProperty:'fiscal',propertyTax:'fiscal',editRules:'fiscal'};
Object.assign(ACTION_MODULE,{invoiceOpening:'contabilidad',invoicePay:'contabilidad',cobro:'contabilidad',pago:'contabilidad',adjprod:'inventario'});
ACTION_MODULE.newCustomer='ventas';
function actionAllowed(action,data={}){
  if(action==='home')return isAcontecCompany()&&!exportBusy;
  if(action==='gear')return !!U?.editor;
  if(action==='accountingPanel')return !!CO&&HOME;
  if(!CO||HOME)return true;
  if(exportBusy&&['switch','opencomp','logout','cfg'].includes(action))return false;
  if(action==='cfg')return !!CO.owner;
  if(['uploadReceipt','deleteReceipt','downloadReceipt'].includes(action))return !!CO.owner;
  if(['backup','backupAll','companyPdf','downloadSnapshot'].includes(action))return permission('ajustes')&&completeAccess();
  if(['restore','restoreSnapshot'].includes(action))return permission('ajustes',true)&&completeAccess(true);
  if(action==='nav')return routeAllowed(data.r);
  if(action==='editCustomer')return permission('ventas');
  if(READ_ACTIONS.has(action))return true;
  if(action==='delentry'){const entry=S.entries.find(record=>record.id===data.id);return !!entry&&permission(clientEntryModule(entry),true)}
  return permission(ACTION_MODULE[action]||ROUTE_MODULE[R],true);
}
function clientEntryModule(entry){if(entry.type==='venta')return 'ventas';if(entry.type==='compra')return 'compras';if(entry.type==='gasto')return 'gastos';if(['invini','ajuste'].includes(entry.type))return 'inventario';if(['nomina','liquidacion'].includes(entry.type))return 'personal';if(entry.type.startsWith('fiscal'))return 'fiscal';return 'contabilidad'}
function enforceAccessUI(){
  $('#main > .access-status')?.remove();
  $$('#main [data-a]').forEach(button=>{button.hidden=!actionAllowed(button.dataset.a,button.dataset)});
  if(!CO.owner&&ROUTE_MODULE[R]&&!permission(ROUTE_MODULE[R],true)&&!['auditoria','accesibilidad'].includes(R))$('#main').insertAdjacentHTML('afterbegin','<p class="access-status">Solo lectura · Puedes consultar y descargar, pero no modificar este módulo.</p>');
}
const baseAccessModal=modal;
modal=function(...args){const form=baseAccessModal(...args);form.querySelectorAll('[data-a]').forEach(button=>{button.hidden=!actionAllowed(button.dataset.a,button.dataset)});return form};
V.sinacceso=()=>main('<div class="card"><h2>Sin módulos disponibles</h2><p>El responsable de la empresa debe revisar tus permisos. Cierra sesión y vuelve a ingresar después del cambio.</p></div>');
MENU[MENU.length-1][1].splice(0,0,['accesibilidad','<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>','Accesibilidad'],['auditoria','<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/></svg>','Bitácora de auditoría']);
const baseAuthView=authView;
authView=function(){
  baseAuthView();
  if(U)return;
  $('#af .reg').insertAdjacentHTML('beforeend','<label>Descripción de tu empresa (opcional)<textarea name="description" maxlength="2000" rows="2" placeholder="Actividad de tu negocio"></textarea></label>');
  $('#af').insertAdjacentHTML('afterend','<div class="collaborator-access"><span>¿Tienes un usuario asignado por tu empresa?</span><button type="button" class="btn ghost full" data-a="workerLogin">Ingresar como colaborador</button></div>');
  const note=$('.access-note');if(note)note.lastChild.textContent=' Tu información es privada. El dueño controla los accesos de su empresa.';
};
ACT.workerLogin=()=>modal('Acceso de colaborador','<p class="mut">Usa el usuario y la contraseña que te asignó el responsable. Solo verás los módulos autorizados.</p><label>Nombre de usuario<input name="username" minlength="4" maxlength="40" autocomplete="username" required autocapitalize="none"></label><label>Contraseña<input name="password" type="password" maxlength="128" autocomplete="current-password" required></label>',async form=>{await session(await api('worker-login','POST',{username:v(form,'username'),password:v(form,'password')}))},'Ingresar');

let memberList=[],memberOwner='',auditPage=0,auditRows=[],auditMore=false,accessRequest=0,auditSearchRequest=0;
const originalNav=ACT.nav;
ACT.nav=data=>{if(data.r==='auditoria')auditPage=0;originalNav(data)};
const levelLabel=level=>level==='escritura'?'Lectura y escritura':level==='lectura'?'Solo lectura':'Sin acceso';
const permissionSummary=permissions=>ACCESS_MODULES.filter(([module])=>permissions[module]&&permissions[module]!=='ninguno').map(([module,label])=>`${label}: ${levelLabel(permissions[module])}`).join(' · ');
const loadingCard=text=>`<div class="card access-loading" aria-busy="true"><p>${esc(text)}</p><span></span><span></span><span></span></div>`;
V.accesibilidad=async()=>{
  const request=++accessRequest,companyId=CO.id;
  main('<div class="ph"><h2>Accesibilidad</h2></div>'+loadingCard('Consultando los accesos de la empresa…'));
  try{
    const result=await api('members?c='+companyId);
    if(R!=='accesibilidad'||CO.id!==companyId||request!==accessRequest)return;
    memberList=result.members;memberOwner=result.owner;
    main(`<div class="ph"><div><h2>Accesibilidad</h2><p class="mut">Personas, cargos y permisos de ${esc(CO.name)}</p></div>${permission('accesibilidad',true)?'<button class="btn" data-a="newMember">Crear acceso</button>':''}</div><div class="card owner-access"><span class="access-avatar">${esc(memberOwner.charAt(0).toUpperCase())}</span><div><b>Dueño de la empresa</b><p>${esc(memberOwner)}</p></div><span class="ledger-badge paid">Acceso completo · protegido</span></div><p class="accounting-notice">Los permisos se aplican también en la API. Un colaborador no puede abrir módulos ocultos ni crear otra empresa con su usuario. Los accesos por correo usan el registro habitual y la confirmación del correo; los usuarios asignados ingresan desde «Ingresar como colaborador».</p>${memberList.length?`<div class="member-grid">${memberList.map(member=>`<article class="card member-card"><div class="member-heading"><span class="access-avatar">${esc(member.name.charAt(0).toUpperCase())}</span><div><h3>${esc(member.name)}</h3><p class="mut">${esc(member.role)}</p></div><span class="ledger-badge ${member.active?'paid':'pending'}">${member.active?'Activo':'Desactivado'}</span></div><p class="member-login">${member.username?`Usuario: <b>${esc(member.username)}</b><br>`:''}${member.email?`Correo: ${esc(member.email)}`:''}</p><p class="member-scopes">${esc(permissionSummary(member.permissions))}</p>${permission('accesibilidad',true)?`<div class="accounting-actions"><button class="btn ghost" data-a="editMember" data-id="${member.id}">Editar permisos</button><button class="lk" data-a="toggleMember" data-id="${member.id}">${member.active?'Desactivar':'Reactivar'}</button></div>`:''}</article>`).join('')}</div>`:'<div class="card empty-access"><h3>Tu equipo todavía no tiene accesos</h3><p>Crea un usuario para ventas, un acceso para tu contador o una cuenta de solo lectura.</p></div>'}`);
    installSearch();enforceAccessUI();
  }catch(error){if(R==='accesibilidad'&&CO.id===companyId)main(`<div class="card"><p class="bad">${esc(error.message)}</p><button class="btn ghost" data-a="nav" data-r="accesibilidad">Reintentar</button></div>`)}
};
function memberForm(member){
  const existing=member?.permissions||{};
  const form=modal(member?'Editar acceso':'Crear acceso',`<div class="permission-intro">El rol limita el acceso además de la matriz: solo dueño y contador ven Ventas. Cajero y vendedor trabajan en Facturación; el supervisor autoriza correcciones.</div><div class="member-form-grid"><label>Nombre de la persona<input name="name" required maxlength="100" value="${esc(member?.name||'')}"></label><label>Rol<select name="role">${['cajero','vendedor','supervisor','contador','observador',...(member&&!(['cajero','vendedor','supervisor','contador','observador'].includes(member.role))?[member.role]:[])].map(role=>`<option value="${esc(role)}" ${role===(member?.role||'cajero')?'selected':''}>${esc(role)}</option>`).join('')}</select></label><label>Correo (opcional)<input name="email" type="email" value="${esc(member?.email||'')}"></label><label>Nombre de usuario (opcional)<input name="username" pattern="[a-zA-Z][a-zA-Z0-9._-]{3,39}" maxlength="40" value="${esc(member?.username||'')}" autocapitalize="none"></label></div><label>${member?'Nueva contraseña (vacío = conservar)':'Contraseña del usuario'}<input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password"></label><p class="mut">Elige correo, usuario o ambos. El nombre de usuario es único en toda la plataforma y requiere una contraseña de al menos 8 caracteres. Las contraseñas no se muestran ni se incluyen en respaldos.</p><fieldset><legend>Sucursales asignadas</legend>${(CO.branches||[{id:'principal',name:'Principal'}]).map(branch=>`<label class="ck"><input type="checkbox" name="branchIds" value="${esc(branch.id)}" ${(member?.branchIds||['principal']).includes(branch.id)?'checked':''}>${esc(branch.name)}</label>`).join('')}<small>El dueño y el contador acceden a todas. Cambiar asignaciones revoca las sesiones anteriores.</small></fieldset><label>Plantilla de permisos<select name="preset"><option value="custom">Personalizar</option><option value="sales">Cajero</option><option value="seller">Vendedor</option><option value="supervisor">Supervisor</option><option value="accountant">Contador</option><option value="reader">Solo lectura de todos los datos</option></select></label><div class="permission-matrix">${ACCESS_MODULES.map(([module,label])=>`<label><span>${esc(label)}</span><select name="perm_${module}" aria-label="Permiso para ${esc(label)}">${['ninguno','lectura','escritura'].map(level=>`<option value="${level}" ${(existing[module]||(member?'ninguno':module==='facturacion'?'escritura':module==='inventario'?'lectura':'ninguno'))===level?'selected':''} ${level!=='ninguno'&&!permission(module,level==='escritura')?'disabled':''}>${levelLabel(level)}</option>`).join('')}</select></label>`).join('')}</div><p class="mut">Los estados financieros y la contabilidad consultan los movimientos contables completos. Ajustes y bitácora requieren lectura de todos los módulos; restaurar requiere escritura en todos ellos. Los comprobantes fiscales privados siguen reservados al dueño.</p><label class="ck"><input name="active" type="checkbox" ${member?.active!==false?'checked':''}> Acceso activo</label>`,async fields=>{
    prepareAccounting();
    if(CO.owner)save();
    if(!await flush())return 'Guarda primero los cambios pendientes.';
    const permissions=Object.fromEntries(ACCESS_MODULES.map(([module])=>[module,v(fields,'perm_'+module)]));
    await api('members?c='+CO.id,member?'PUT':'POST',{id:member?.id,version:member?.version,name:v(fields,'name'),role:v(fields,'role'),email:v(fields,'email'),username:v(fields,'username'),password:v(fields,'password'),permissions,branchIds:[...fields.querySelectorAll('[name=branchIds]:checked')].map(input=>input.value),active:fields.elements.active.checked});
    V.accesibilidad();
  },member?'Guardar cambios':'Crear acceso');
  form.elements.preset.onchange=()=>{
    const preset=form.elements.preset.value;
    if(preset==='custom')return;
    if(preset==='sales')form.elements.role.value='cajero';if(preset==='seller')form.elements.role.value='vendedor';if(preset==='supervisor')form.elements.role.value='supervisor';
    if(preset==='accountant')form.elements.role.value='contador';
    if(preset==='reader')form.elements.role.value='contador';

    for(const [module] of ACCESS_MODULES){
      let level='ninguno';
      if(['sales','seller','supervisor'].includes(preset)&&module==='facturacion')level='escritura';if(['sales','seller'].includes(preset)&&module==='inventario')level='lectura';if(['sales','seller'].includes(preset)&&module==='cajas')level='escritura';if(preset==='supervisor'&&['cajas','inventario','costos','proveedores','compras','gastos'].includes(module))level='escritura';

      if(preset==='reader'&&!['accesibilidad','diseno_factura'].includes(module))level='lectura';
      if(preset==='accountant'&&!['accesibilidad','diseno_factura'].includes(module))level=module==='auditoria'?'lectura':'escritura';
      const select=form.elements['perm_'+module];
      select.value=level!=='ninguno'&&!permission(module,level==='escritura')?'ninguno':level;
    }
  };
}
ACT.newMember=()=>memberForm();
ACT.editMember=data=>{const member=memberList.find(record=>record.id===data.id);if(member)memberForm(member)};
ACT.toggleMember=async data=>{
  const member=memberList.find(record=>record.id===data.id);if(!member)return;
  if(!confirm(`${member.active?'Desactivar':'Reactivar'} el acceso de ${member.name}? Los cambios cierran sus sesiones anteriores.`))return;
  await api('members?c='+CO.id,'PUT',{...member,active:!member.active});await V.accesibilidad();
};
const auditDate=value=>new Date(value).toLocaleString('es',{dateStyle:'medium',timeStyle:'medium'});
const auditArea={entries:'Asientos y documentos',products:'Inventario',accounts:'Cuentas',cfg:'Configuración',employees:'Empleados',payrolls:'Nóminas',settlements:'Liquidaciones',taxes:'Obligaciones fiscales',properties:'Propiedades',name:'Nombre de empresa',description:'Descripción',accesibilidad:'Accesos'};
auditArea.customers='Cartera de clientes';
V.auditoria=async()=>{
  const companyId=CO.id,page=auditPage,request=++auditSearchRequest;
  main('<div class="ph"><h2>Bitácora de auditoría</h2></div>'+loadingCard('Consultando el historial de cambios…'));
  try{
    const range=typeof searchPeriod==='function'?searchPeriod(SEARCHES.auditoria||''):null;const start=range?new Date(range[0]+'T00:00:00'):null,end=range?new Date(range[1]+'T00:00:00'):null;if(end)end.setDate(end.getDate()+1);const result=await api('audit?c='+companyId+'&offset='+page*50+(range?'&start='+encodeURIComponent(start.toISOString())+'&end='+encodeURIComponent(end.toISOString()):''));
    if(R!=='auditoria'||CO.id!==companyId||page!==auditPage||request!==auditSearchRequest)return;
    auditRows=result.events;auditMore=result.more;
    main(`<div class="ph"><div><h2>Bitácora de auditoría</h2><p class="mut">Quién cambió qué y cuándo · Fechas en tu zona horaria</p></div></div><p class="accounting-notice">El historial registra los cambios confirmados en la nube, incluidos accesos, adjuntos y restauraciones. No se puede editar ni borrar desde la aplicación. Las contraseñas nunca se registran.</p><div class="card"><div class="tw"><table><thead><tr><th>Fecha y hora</th><th>Persona</th><th>Sucursal</th><th>Acción</th><th>Qué cambió</th><th></th></tr></thead><tbody>${auditRows.map(event=>`<tr><td>${esc(auditDate(event.createdAt))}</td><td>${esc(event.actor)}</td><td>${esc((CO.branches||[]).find(b=>b.id===(event.branchId||'principal'))?.name||'Principal')}</td><td>${esc(event.action)}${event.revision!==null?`<small class="audit-revision">Versión ${event.revision}</small>`:''}</td><td>${esc([...new Set(event.changes.map(change=>auditArea[change.area]||change.area))].join(', ')||'Inicio de sesión')}</td><td>${event.changes.length?`<button class="lk" data-a="auditDetails" data-id="${event.id}">Ver cambios</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-ledger mut">Todavía no hay cambios registrados.</td></tr>'}</tbody></table></div></div><div class="audit-pager"><button class="btn ghost" data-a="auditPrev" ${page===0?'disabled':''}>Anterior</button><span>Página ${page+1}</span><button class="btn ghost" data-a="auditNext" ${auditMore?'':'disabled'}>Siguiente</button></div>`);installSearch();enforceAccessUI();
  }catch(error){if(R==='auditoria'&&CO.id===companyId)main(`<div class="card"><p class="bad">${esc(error.message)}</p><button class="btn ghost" data-a="nav" data-r="auditoria">Reintentar</button></div>`)}
};
ACT.auditPrev=()=>{if(auditPage>0){auditPage--;V.auditoria()}};
ACT.auditNext=()=>{if(auditMore){auditPage++;V.auditoria()}};
ACT.auditDetails=data=>{
  const event=auditRows.find(record=>record.id===data.id);if(!event)return;
  modal('Detalle del cambio',`<p>${esc(event.actor)} · ${esc(auditDate(event.createdAt))}</p>${event.changes.map(change=>`<section class="audit-change"><h4>${esc(auditArea[change.area]||change.area)} ${esc(change.id||'')}</h4><div class="audit-comparison"><div><b>Antes</b><pre>${esc(JSON.stringify(change.before,null,2))}</pre></div><div><b>Después</b><pre>${esc(JSON.stringify(change.after,null,2))}</pre></div></div>${change.passwordChanged?'<p class="mut">Se cambió la contraseña. Su valor no se registra.</p>':''}</section>`).join('')}`,()=>{},'Cerrar');
};

V.ajustes=async()=>{
  const companyId=CO.id;
  main(`<div class="ph"><h2>Ajustes y respaldo</h2></div><div class="card"><h3>${esc(CO.name)}</h3><p class="mut">${esc(CO.description||'Sin descripción')}<br>${esc(U.name||U.email)} · ${esc(CO.role||'Dueño')}</p><div class="backup-actions">${CO.owner?'<button class="btn" data-a="cfg">Datos de la empresa</button>':''}<button class="btn ghost" data-a="backup">Descargar respaldo JSON</button><button class="btn ghost" data-a="backupAll">Descargar todo (ZIP y adjuntos)</button><button class="btn ghost" data-a="companyPdf">Descargar informe completo PDF</button>${permission('ajustes',true)&&completeAccess(true)?'<button class="btn ghost" data-a="restore">Restaurar archivo JSON</button>':''}</div><input type="file" id="rf" accept=".json,application/json" hidden><p id="export-status" class="mut" role="status" aria-live="polite"></p></div><div class="card"><h3>Respaldo automático de versiones</h3><p>Cada cambio confirmado conserva la versión anterior, de forma atómica junto con la bitácora. Se guardan las últimas <b>30 versiones</b> de esta empresa. Restaurar conserva también el estado que reemplazas.</p><p class="mut">Esto permite recuperar cambios accidentales, pero no garantiza que nunca haya una pérdida. Descarga periódicamente una copia independiente. El ZIP incluye la información actual, sus versiones retenidas, la bitácora y los adjuntos privados si eres el dueño. El PDF contiene los registros contables y estados financieros; los archivos originales se incluyen en el ZIP, no dentro del PDF.</p><div id="backup-history">${loadingCard('Consultando versiones guardadas…')}</div></div>`);
  enforceAccessUI();
  try{
    const result=await api('backups?c='+companyId);
    if(R!=='ajustes'||CO.id!==companyId)return;
    $('#backup-history').innerHTML=result.backups.length?`<div class="tw"><table><thead><tr><th>Versión</th><th>Fecha</th><th>Empresa</th><th>Acciones</th></tr></thead><tbody>${result.backups.map(backup=>`<tr><td>${backup.revision}</td><td>${esc(auditDate(backup.createdAt))}</td><td>${esc(backup.name)}</td><td><button class="lk" data-a="downloadSnapshot" data-id="${backup.id}">Descargar</button>${permission('ajustes',true)&&completeAccess(true)?` <button class="lk" data-a="restoreSnapshot" data-id="${backup.id}">Restaurar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mut">El primer cambio guardado crea la primera versión recuperable.</p>';
  }catch(error){if(R==='ajustes'&&CO.id===companyId)$('#backup-history').innerHTML=`<p class="bad">${esc(error.message)}</p>`}
};
ACT.cfg=()=>modal('Datos de la empresa',`<label>Nombre<input name="name" required maxlength="80" value="${esc(CO.name)}"></label><label>Descripción<textarea name="description" rows="3" maxlength="2000">${esc(CO.description||'')}</textarea></label><label>RUC / identificación<input name="ruc" value="${esc(S.cfg.ruc||'')}"></label><label>Símbolo de moneda<input name="cur" value="${esc(S.cfg.cur||'C$')}"></label>`,async form=>{
  if(!CO.owner)return 'Solo el dueño modifica estos datos.';
  if(!await flush())return 'Guarda los cambios pendientes antes de modificar la empresa.';
  const result=await api('company','PUT',{id:CO.id,revision:REV,name:v(form,'name'),description:v(form,'description'),cfg:{ruc:v(form,'ruc'),cur:v(form,'cur')||'C$'}});
  REV=result.revision;S=result.data;rememberCloud();COS=result.companies;CO={...CO,...COS.find(company=>company.id===CO.id)};shell();view();
});
ACT.switch=()=>{
  menu(false);
  modal(U.worker?'Empresa asignada':'Mis empresas',(U.editor?'<button type="button" class="btn ghost full" style="margin-bottom:8px" data-a="home">Página principal de Acontec</button>':'')+COS.map(company=>`<button type="button" class="btn ${company.id===CO.id?'':'ghost'} full" style="margin-bottom:8px" data-a="opencomp" data-id="${company.id}">${esc(company.name)} · ${esc(company.role)}</button>`).join('')+(U.worker?'<p class="mut">El dueño administra tus accesos. Tu usuario no crea empresas.</p>':'<label>Crear nueva empresa<input name="name" maxlength="80" placeholder="Nombre de la empresa"></label><label>Descripción<textarea name="description" rows="2" maxlength="2000"></textarea></label>'+businessTypeField()),async form=>{
    if(U.worker)return;
    const name=v(form,'name').trim();if(!name)return 'Escribe un nombre o elige una empresa.';
    if(!await flush())return 'Guarda primero los cambios pendientes.';
    const result=await api('company','POST',{name,description:v(form,'description'),businessType:v(form,'businessType')});COS=result.companies;await openCompany(result.id);
  },U.worker?'Cerrar':'Crear empresa');
};
const backupEnvelope=(data=S,company=CO,revision=REV)=>({format:'acontec-backup',version:1,exportedAt:new Date().toISOString(),company:{id:company.id,name:company.name,description:company.description||'',businessType:company.businessType||'comercio',businessCustomization:company.businessCustomization||{},branchId:company.branchId??null,branchName:company.branchId?(company.branches||[]).find(b=>b.id===company.branchId)?.name||'Principal':'Todas las sucursales'},revision,data});
const safeFilename=value=>String(value).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ._-]/g,'-').slice(0,100);
function downloadBackup(envelope,name){downloadFile(new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'}),name)}
ACT.backup=async()=>{
  const saved=await flush();
  const current=saved?await api('data?c='+CO.id):null;
  downloadBackup({...(current?backupEnvelope(current.data,current.company,current.revision):backupEnvelope()),pendingChanges:!saved},`respaldo-${safeFilename(CO.name)}-${today()}${saved?'':'-pendiente'}.json`);
  if(!saved)alert('Se descargó una copia de recuperación con tus cambios pendientes. Esos cambios todavía no se han guardado en la nube.');
};
ACT.downloadSnapshot=async data=>{
  const {backup}=await api('backups?c='+CO.id+'&id='+data.id);
  downloadBackup(backupEnvelope(backup.data,{...CO,name:backup.name,description:backup.description,businessType:backup.businessType,businessCustomization:backup.businessCustomization},backup.revision),`respaldo-${safeFilename(backup.name)}-version-${backup.revision}.json`);
};
async function applyRestore(body){
  if(!permission('ajustes',true)||!completeAccess(true))throw new Error('No tienes permiso para restaurar.');
  if(!await flush())throw new Error('Guarda o descarga los cambios pendientes antes de restaurar.');
  const result=await api('backups?c='+CO.id,'POST',{...body,revision:REV});
  REV=result.revision;S=result.data;rememberCloud();saveVersion=0;savedVersion=0;COS=result.companies;const fresh=await api('data?c='+CO.id);CO=fresh.company;S=fresh.data;REV=fresh.revision;rememberCloud();shell();view();setSt('Respaldo restaurado en la nube');
}
async function restoreFile(file){
  if(file.size>25000000)throw new Error('El archivo JSON supera el límite de lectura de 25 MB.');
  let envelope;try{envelope=JSON.parse(await file.text())}catch{throw new Error('Archivo JSON inválido.')}
  const data=envelope.format==='acontec-backup'?envelope.data:envelope;
  if(envelope.company?.branchId && envelope.company.branchId!==CO.branchId)throw new Error('Selecciona la sucursal de este respaldo antes de restaurarlo.');
  if(envelope.company?.id&&envelope.company.id!==CO.id)throw new Error('Este respaldo pertenece a otra empresa.');
  if(!data||!Array.isArray(data.accounts)||!Array.isArray(data.entries)||!Array.isArray(data.products))throw new Error('El archivo no es un respaldo contable válido.');
  if(confirm('¿Restaurar este archivo? La versión actual se conserva en el historial antes de reemplazarla. Los adjuntos originales deben seguir disponibles en esta empresa.'))await applyRestore({data,...(envelope.company?.businessType?{profile:{businessType:envelope.company.businessType,businessCustomization:envelope.company.businessCustomization||{}}}:{})});
}
ACT.restore=()=>$('#rf').click();
ACT.restoreSnapshot=async data=>{if(confirm('¿Restaurar esta versión? Los cambios posteriores dejan de ser la versión activa, pero el estado actual se respalda antes de continuar.'))await applyRestore({id:data.id})};

let exportBusy=false;
const libraryLoads=new Map();
function loadExportScript(src){if(!libraryLoads.has(src))libraryLoads.set(src,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{libraryLoads.delete(src);reject(new Error('No se pudo cargar el generador de documentos.'))};document.head.append(script)}));return libraryLoads.get(src)}
const exportStatus=text=>{const target=$('#export-status');if(target)target.textContent=text};
async function runExport(operation){
  if(exportBusy)return;
  exportBusy=true;
  const companyId=CO.id;
  try{exportStatus('Preparando la descarga…');if(!await flush())throw new Error('Hay cambios pendientes. Descarga primero el respaldo JSON de recuperación.');const current=await api('data?c='+companyId);await operation(companyId,current);exportStatus('Descarga preparada. Guarda una copia fuera de Acontec.')}
  catch(error){exportStatus('No se completó la descarga: '+error.message);throw error}
  finally{exportBusy=false}
}
async function collectAudit(companyId){
  const events=[];let more=true;
  while(more){const page=await api('audit?c='+companyId+'&offset='+events.length);events.push(...page.events);more=page.more}
  return events;
}
ACT.backupAll=()=>runExport(async(companyId,current)=>{
  const company=structuredClone(current.company),state=structuredClone(current.data),revision=current.revision;
  await loadExportScript('/vendor/fflate.js?v=86d12f1b80ed5c94');
  const files={'empresa.json':fflate.strToU8(JSON.stringify(backupEnvelope(state,company,revision),null,2))};
  const receipts=new Map();
  const addReceipts=(data,backupId)=>{for(const collection of ['taxes','pettyVouchers','cashMovements','costs'])for(const tax of data?.[collection]||[])if(tax.receipt&&!receipts.has(tax.receipt.key))receipts.set(tax.receipt.key,{tax:{...tax,collection},backupId})};
  if(company.owner)addReceipts(state);
  if(permission('auditoria'))files['bitacora.json']=fflate.strToU8(JSON.stringify(await collectAudit(companyId),null,2));
  if(permission('accesibilidad')){const result=await api('members?c='+companyId);files['accesos-sin-contrasenas.json']=fflate.strToU8(JSON.stringify({owner:result.owner,members:result.members},null,2))}
  const {backups}=await api('backups?c='+companyId);
  for(const record of backups){const {backup}=await api('backups?c='+companyId+'&id='+record.id);files[`versiones/version-${backup.revision}.json`]=fflate.strToU8(JSON.stringify(backupEnvelope(backup.data,{...company,name:backup.name,description:backup.description,businessType:backup.businessType,businessCustomization:backup.businessCustomization},backup.revision),null,2));if(company.owner)addReceipts(backup.data,backup.id)}
  const manifest=[];
  for(const [key,{tax,backupId}] of receipts){
    exportStatus(`Descargando adjuntos: ${manifest.length+1} de ${receipts.size}…`);
    const response=await fetch((tax.collection==='taxes'?'/api/receipt?c='+companyId+'&tax=':'/api/operation-receipt?c='+companyId+'&id=')+encodeURIComponent(tax.id)+(backupId?'&backup='+backupId:'&revision='+revision),{credentials:'same-origin'});
    if(!response.ok)throw new Error('No se completó el respaldo: falta un adjunto o tu sesión venció. No se genera una copia incompleta.');
    const path=`adjuntos/${safeFilename(key.split('/').pop())}-${safeFilename(tax.receipt.name)}`;
    files[path]=new Uint8Array(await response.arrayBuffer());manifest.push({taxId:tax.id,key,path,name:tax.receipt.name,backupId:backupId||null});
  }
  files['adjuntos-indice.json']=fflate.strToU8(JSON.stringify(manifest,null,2));
  files['LEER.txt']=fflate.strToU8('Copia independiente de Acontec. empresa.json contiene la versión activa. versiones/ contiene las últimas versiones recuperables. Los archivos privados se incluyen solo en descargas del dueño. Las contraseñas y sesiones nunca se exportan. Para restaurar, usa un archivo JSON de esta empresa en Ajustes y respaldo; los adjuntos deben seguir disponibles en Acontec. Este ZIP conserva los originales para custodia independiente, pero no es un importador de archivos adjuntos.');
  const integrity=[];
  for(const [path,bytes] of Object.entries(files)){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    integrity.push({path,size:bytes.length,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')});
  }
  files['manifiesto-integridad.json']=fflate.strToU8(JSON.stringify(integrity,null,2));
  exportStatus('Comprimiendo el respaldo completo…');
  const archive=await new Promise((resolve,reject)=>fflate.zip(files,{level:1},(error,result)=>error?reject(error):resolve(result)));
  downloadFile(new Blob([archive],{type:'application/zip'}),`empresa-${safeFilename(company.name)}-${today()}.zip`);
});
function readableValue(value){if(value===null||value===undefined)return '';if(typeof value==='object')return JSON.stringify(value);return String(value)}
async function createCompanyPdf(company,state,revision){
  await loadExportScript('/vendor/jspdf.js?v=0f6fe797a6df06bd');await loadExportScript('/vendor/autotable.js?v=31884888608c7aab');
  const documentPdf=new jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const money=value=>(state.cfg.cur||'C$')+' '+(+value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const money2=value=>value<0?'('+money(-value)+')':money(value);
  const accName=code=>{const account=state.accounts.find(record=>record.code===code);return account?`${account.code} · ${account.name}`:code};
  documentPdf.setProperties({title:'Informe completo - '+company.name,author:'Acontec'});
  let cursor=18;
  const heading=(text,newPage=false)=>{if(newPage){documentPdf.addPage();cursor=18}documentPdf.setFontSize(16);documentPdf.setTextColor(35,78,64);const lines=documentPdf.splitTextToSize(String(text),175);documentPdf.text(lines,16,cursor);cursor+=lines.length*7+5};
  const table=(headers,rows)=>{documentPdf.autoTable({startY:cursor,head:[headers],body:rows.length?rows:[headers.map((_,index)=>index===0?'Sin registros':'')],margin:{left:16,right:16,top:18,bottom:18},styles:{fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[35,78,64]},didDrawPage:()=>{documentPdf.setFontSize(8);documentPdf.setTextColor(100);documentPdf.text(company.name,16,10)}});cursor=documentPdf.lastAutoTable.finalY+10};
  heading(company.name);
  table(['Datos de la empresa','Valor'],[['Descripción',company.description||''],['RUC / identificación',state.cfg.ruc||''],['Moneda',state.cfg.cur||'C$'],['Emitido',new Date().toLocaleString('es')],['Sucursal',company.branchId?(company.branches||[]).find(b=>b.id===company.branchId)?.name||'Principal':'Consolidado'],['Periodo','Todo el historial'],['Versión',String(revision)]]);
  heading('Estados financieros',true);
  const balances=Object.fromEntries(state.accounts.map(account=>[account.code,{...account,d:0,c:0}]));
  for(const entry of state.entries)for(const line of entry.lines){const account=balances[line.a];if(account){account.d+=line.d;account.c+=line.c}}
  for(const account of Object.values(balances))account.s=account.nat==='D'?account.d-account.c:account.c-account.d;
  const income=tot(balances,'ingreso'),cost=tot(balances,'costo'),expenses=tot(balances,'gasto'),profit=income-cost-expenses;
  table(['Estado de resultados','Importe'],[['Ingresos',money(income)],['Costo de ventas',money(cost)],['Gastos',money(expenses)],['Resultado neto',money(profit)]]);
  const assets=tot(balances,'activo'),liabilities=tot(balances,'pasivo'),equity=tot(balances,'patrimonio');
  table(['Balance general','Importe'],[['Activos',money(assets)],['Pasivos',money(liabilities)],['Patrimonio registrado',money(equity)],['Resultado del ejercicio',money(profit)],['Pasivos + patrimonio + resultado',money(liabilities+equity+profit)],['Diferencia de cuadre',money(assets-liabilities-equity-profit)]]);
  const cash={ini:0,sec:{op:{},inv:{},fin:{}}},cashCodes=new Set(state.accounts.filter(account=>account.sub==='ef').map(account=>account.code));
  for(const entry of state.entries){
    const cashLines=entry.lines.filter(line=>cashCodes.has(line.a));if(!cashLines.length)continue;
    if(entry.type==='apertura'){cash.ini+=cashLines.reduce((total,line)=>total+line.d-line.c,0);continue}
    for(const line of entry.lines.filter(record=>!cashCodes.has(record.a))){const account=state.accounts.find(record=>record.code===line.a);if(!account)continue;const section=account.sub==='fijo'?'inv':account.sub==='fin'||account.tipo==='patrimonio'?'fin':'op';cash.sec[section][account.name]=(cash.sec[section][account.name]||0)+line.c-line.d}
  }
  table(['Flujo de efectivo','Importe'],[['Efectivo inicial',money(cash.ini)],...Object.entries(cash.sec).map(([key,values])=>[{op:'Operación',inv:'Inversión',fin:'Financiamiento'}[key],money(Object.values(values).reduce((total,value)=>total+value,0))])]);
  const netCash=Object.values(cash.sec).reduce((total,values)=>total+Object.values(values).reduce((sum,value)=>sum+value,0),0);
  table(['Resumen de efectivo','Importe'],[['Aumento / disminución neta',money(netCash)],['Efectivo final',money(cash.ini+netCash)]]);
  heading('Balanza de comprobación',true);
  table(['Cuenta','Nombre','Debe','Haber','Saldo'],Object.values(balances).sort(byCode).map(account=>[account.code,account.name,money(account.d),money(account.c),money2(account.s)]));
  heading('Libro mayor',true);
  for(const account of [...state.accounts].sort(byCode)){
    const movements=state.entries.flatMap(entry=>entry.lines.filter(line=>line.a===account.code).map(line=>({entry,line}))).sort((first,second)=>first.entry.date.localeCompare(second.entry.date));
    if(!movements.length)continue;
    if(cursor>230){documentPdf.addPage();cursor=18}
    heading(`${account.code} · ${account.name}`);
    let balance=0;
    table(['Fecha','Documento / detalle','Debe','Haber','Saldo'],movements.map(({entry,line})=>{balance+=account.nat==='D'?line.d-line.c:line.c-line.d;return[entry.date,entry.reference||entry.desc||entry.id,money(line.d),money(line.c),money2(balance)]}));
  }
  heading('Libro diario y documentos contables',true);
  for(const entry of [...state.entries].sort((first,second)=>first.date.localeCompare(second.date))){
    if(cursor>230){documentPdf.addPage();cursor=18}
    heading(`${entry.date} · ${entry.reference||entry.id} · ${entry.desc||entry.type}`);
    table(['Campo','Valor'],Object.entries(entry).filter(([key])=>!['lines','items','stock'].includes(key)).map(([key,value])=>[key,readableValue(value)]));
    if(entry.items?.length)table(['Producto','Cantidad','Precio','IVA %','Costo unitario'],entry.items.map(item=>[state.products.find(product=>product.id===item.p)?.name||item.p,String(item.q),money(item.u),String(item.vatRate||0),money(item.cost||0)]));
    table(['Cuenta','Debe','Haber'],entry.lines.map(line=>[accName(line.a),money(line.d),money(line.c)]));
    if(entry.stock?.length)table(['Producto','Movimiento','Costo'],entry.stock.map(movement=>[state.products.find(product=>product.id===movement.pid)?.name||movement.pid,String(movement.q),money(movement.unitCost||0)]));
  }
  for(const [key,label] of [['customers','Cartera de clientes'],['products','Productos e inventario'],['accounts','Catálogo de cuentas'],['employees','Expedientes de empleados'],['payrolls','Nóminas'],['settlements','Liquidaciones'],['taxes','Obligaciones fiscales'],['properties','Propiedades']]){
    heading(label,true);
    const records=state[key]||[];
    if(!records.length){table(['Estado'],[['Sin registros']]);continue}
    for(const record of records){table(['Campo','Valor'],Object.entries(record).map(([field,value])=>[field,readableValue(value)]))}
  }
  {
    heading('Perfil y operaciones de negocio',true);
    table(['Perfil','Valor'],[['Tipo de negocio',company.businessType||'comercio'],['Personalización',JSON.stringify(company.businessCustomization||{})]]);
    for(const record of state.businessRecords||[]){heading(record.name||record.id);table(['Campo','Valor'],Object.entries(record).map(([key,value])=>[key,readableValue(value)]));}
  }
  heading('Configuración y reglas de la empresa',true);table(['Parámetro','Valor'],Object.entries(state.cfg).map(([key,value])=>[key,readableValue(value)]));
  for(let page=1;page<=documentPdf.getNumberOfPages();page++){documentPdf.setPage(page);documentPdf.setFontSize(8);documentPdf.setTextColor(100);documentPdf.text(`Acontec · ${page} / ${documentPdf.getNumberOfPages()}`,16,289)}
  return documentPdf;
}
ACT.companyPdf=()=>runExport(async(companyId,current)=>{const company=structuredClone(current.company),state=structuredClone(current.data),revision=current.revision;exportStatus('Generando estados financieros y documentos…');const documentPdf=await createCompanyPdf(company,state,revision);documentPdf.save(`informe-${safeFilename(company.name)}-${today()}.pdf`)});
