'use strict';

const ACCESS_MODULES=[['ventas','Ventas'],['compras','Compras'],['gastos','Gastos'],['inventario','Productos e inventario'],['contabilidad','Contabilidad y cuentas por cobrar / pagar'],['finanzas','Estados financieros'],['personal','Personal, nómina y liquidaciones'],['fiscal','Fiscal y reglas'],['ajustes','Ajustes y respaldo completo'],['accesibilidad','Administración de accesos'],['auditoria','Bitácora de auditoría'],['auditoria_revision',uiT('review.permission','Ejecutar y seguir auditoría interna')],['diseno_factura','Edición de factura']];
const ROUTE_MODULE={ventas:'ventas',compras:'compras',gastos:'gastos',productos:'inventario',kardex:'inventario',apertura:'contabilidad',diario:'contabilidad',mayor:'contabilidad',cuentas:'contabilidad',cobrar:'contabilidad',pagar:'contabilidad',balanza:'finanzas',resultados:'finanzas',balance:'finanzas',flujo:'finanzas',personal:'personal',nomina:'personal',liquidaciones:'personal',provisiones:'personal',fiscal:'fiscal',impuestos:'fiscal',propiedades:'fiscal',reglas:'fiscal',ajustes:'ajustes',accesibilidad:'accesibilidad',auditoria:'auditoria'};
const permission=(module,write=false)=>{
  if(!CO)return false;if(CO.support&&write)return false;if(CO.readOnlyLimit&&write)return false;if(CO.billingPlan?.blockedModules?.includes(module))return false;if(CO.owner)return true;
  if(module==='accesibilidad'){if(CO.rolePolicy)return AcontecRoles.permits(CO.rolePolicy,module,'edit');if(CO.permissions?.accesibilidad!=='escritura')return false;}
  if(CO.rolePolicy)module=({control_personal:'personal',decisiones:'finanzas',sucursales:'ajustes'})[module]||module;
  if(CO.rolePolicy)return write?['create','edit','delete'].some(action=>AcontecRoles.permits(CO.rolePolicy,module,action)):AcontecRoles.permits(CO.rolePolicy,module);
  if(module==='diseno_factura'){const level=CO.permissions?.[module];return level==='escritura'||(!write&&level==='lectura')}
  const role=String(CO.role||'').trim().toLowerCase();
  if(module==='auditoria_revision'){if(CO.support)return false;const level=CO.permissions?.[module]??(role==='contador'?'escritura':'ninguno');return level==='escritura'||(!write&&level==='lectura')}
  if(module==='ventas'&&role!=='contador')return false;
  if(['cajero','vendedor','supervisor'].includes(role)&&['contabilidad','finanzas','personal','fiscal','ajustes','auditoria','accesibilidad'].includes(module))return false;
  if(['cajero','vendedor'].includes(role)&&(!['tableros_rol','facturacion','inventario','cajas','cuentas_abiertas','agenda','despacho','documentos_venta','comprobantes','medidas','rutas'].includes(module)||(module==='inventario'&&write)))return false;
  const fallback={facturacion:'ventas',cajas:'contabilidad',costos:'gastos',proveedores:'compras'},level=CO.permissions?.[module]??(role==='contador'?CO.permissions?.[fallback[module]]:undefined);
  return level==='escritura'||(!write&&level==='lectura');
};
ROUTE_MODULE.clientes='ventas';
const completeAccess=(write=false)=>ACCESS_MODULES.slice(0,8).every(([module])=>permission(module,write));
function routeAllowed(route){if(route==='panel')return !!CO&&(!CO.rolePolicy||permission('panel'));if(route==='pagina')return !!U?.editor&&isAcontecCompany();if(route==='administracion')return !!U?.admin;return !!ROUTE_MODULE[route]&&permission(ROUTE_MODULE[route])}
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
  if(['editCustomer','customerHistory','customerStatementPrint','customerStatementExport'].includes(action))return permission('ventas');
  if(READ_ACTIONS.has(action))return true;
  if(action==='delentry'){const entry=S.entries.find(record=>record.id===data.id);return !!entry&&permission(clientEntryModule(entry),true)}
  const module=ACTION_MODULE[action]||ROUTE_MODULE[R];
  if(CO.rolePolicy&&!CO.owner){const kind=/^(del|delete|remove|reverse|void)/i.test(action)?'delete':/^(edit|update|close|toggle|replenish|restore|adjust|adj)/i.test(action)?'edit':'create';if(!AcontecRoles.permits(CO.rolePolicy,module,module==='accesibilidad'?'edit':kind))return false;}
  return permission(module,true);
}
function clientEntryModule(entry){if(entry.type==='venta')return 'ventas';if(entry.type==='compra')return 'compras';if(entry.type==='gasto')return 'gastos';if(['invini','ajuste'].includes(entry.type))return 'inventario';if(['nomina','liquidacion'].includes(entry.type))return 'personal';if(entry.type.startsWith('fiscal'))return 'fiscal';return 'contabilidad'}
function enforceAccessUI(){
  $('#main > .access-status')?.remove();
  $$('#main [data-a]').forEach(button=>{button.hidden=!actionAllowed(button.dataset.a,button.dataset)});
  if(!CO.owner&&ROUTE_MODULE[R]&&!permission(ROUTE_MODULE[R],true)&&!['auditoria','accesibilidad'].includes(R))$('#main').insertAdjacentHTML('afterbegin',`<p class="access-status">${esc(uiT("access.1","Solo lectura · Puedes consultar y descargar, pero no modificar este módulo."))}</p>`);
}
const baseAccessModal=modal;
modal=function(...args){const form=baseAccessModal(...args);form.querySelectorAll('[data-a]').forEach(button=>{button.hidden=!actionAllowed(button.dataset.a,button.dataset)});return form};
V.sinacceso=()=>main(`<div class="card"><h2>${esc(uiT("access.2","Sin módulos disponibles"))}</h2><p>${esc(uiT("access.3","El responsable de la empresa debe revisar tus permisos. Cierra sesión y vuelve a ingresar después del cambio."))}</p></div>`);
MENU[MENU.length-1][1].splice(0,0,['accesibilidad','<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>','Accesibilidad'],['auditoria','<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/></svg>','Bitácora de auditoría']);
const baseAuthView=authView;
authView=function(){
  baseAuthView();
  if(U)return;
  $('#af .reg').insertAdjacentHTML('beforeend',`<label>${esc(uiT("access.4","Descripción de tu empresa (opcional)"))}<textarea name="description" maxlength="2000" rows="2" placeholder="Actividad de tu negocio"></textarea></label>`);
  $('#af').insertAdjacentHTML('afterend',`<div class="collaborator-access"><span>${esc(uiT("access.5","¿Tienes un usuario asignado por tu empresa?"))}</span><button type="button" class="btn ghost full" data-a="workerLogin">${esc(uiT("access.6","Ingresar como colaborador"))}</button></div>`);
  const note=$('.access-note');if(note)note.lastChild.textContent=uiT("access.extra.1"," Tu información es privada. El dueño controla los accesos de su empresa.");
};
ACT.workerLogin=()=>modal(uiT("access.extra.2","Acceso de colaborador"),`<p class="mut">${esc(uiT("access.7","Usa el usuario y la contraseña que te asignó el responsable. Solo verás los módulos autorizados."))}</p><label>${esc(uiT("access.8","Nombre de usuario"))}<input name="username" minlength="4" maxlength="40" autocomplete="username" required autocapitalize="none"></label><label>${esc(uiT("access.9","Contraseña"))}<input name="password" type="password" maxlength="128" autocomplete="current-password" required></label>`,async form=>{await session(await api('worker-login','POST',{username:v(form,'username'),password:v(form,'password')}))},'Ingresar');

let companyRoleList=[],roleModuleList=[],memberList=[],memberOwner='',auditPage=0,auditRows=[],auditMore=false,accessRequest=0,auditSearchRequest=0;
const originalNav=ACT.nav;
ACT.nav=data=>{if(data.r==='auditoria')auditPage=0;originalNav(data)};
const levelLabel=level=>level==='escritura'?'Lectura y escritura':level==='lectura'?'Solo lectura':'Sin acceso';
const permissionSummary=permissions=>ACCESS_MODULES.filter(([module])=>permissions[module]&&permissions[module]!=='ninguno').map(([module,label])=>`${label}: ${levelLabel(permissions[module])}`).join(' · ');
const loadingCard=text=>`<div class="card access-loading" aria-busy="true"><p>${esc(text)}</p><span></span><span></span><span></span></div>`;
V.accesibilidad=async()=>{
  if(!permission('accesibilidad',true)){V.sinacceso();return;}
  const request=++accessRequest,companyId=CO.id;
  main(`<div class="ph"><h2>${esc(uiT("access.10","Accesibilidad"))}</h2></div>`+loadingCard(uiT("access.11","Consultando los accesos de la empresa…")));
  try{
    const result=await api('roles?c='+companyId);
    if(R!=='accesibilidad'||CO.id!==companyId||request!==accessRequest)return;
    memberList=result.members;memberOwner=result.owner;companyRoleList=result.roles;roleModuleList=result.modules;
    main(`<div class="ph"><div><h2>${esc(uiT("access.16","Accesibilidad"))}</h2><p class="mut">Personas, cargos y permisos de ${esc(CO.name)}</p></div>${permission('accesibilidad',true)?`<button class="btn" data-a="newMember">${esc(uiT("access.12","Crear acceso"))}</button>`:''}</div><div class="card owner-access"><span class="access-avatar">${esc(memberOwner.charAt(0).toUpperCase())}</span><div><b>${esc(uiT("access.17","Dueño de la empresa"))}</b><p>${esc(memberOwner)}</p></div><span class="ledger-badge paid">${esc(uiT("access.18","Acceso completo · protegido"))}</span></div><p class="accounting-notice">${esc(uiT("access.19","Los permisos se aplican también en la API. Un colaborador no puede abrir módulos ocultos ni crear otra empresa con su usuario. Los accesos por correo usan el registro habitual y la confirmación del correo; los usuarios asignados ingresan desde «Ingresar como colaborador»."))}</p>${roleCards()}${memberList.length?`<div class="member-grid">${memberList.map(member=>`<article class="card member-card"><div class="member-heading"><span class="access-avatar">${esc(member.name.charAt(0).toUpperCase())}</span><div><h3>${esc(member.name)}</h3><p class="mut">${esc(member.role)}</p></div><span class="ledger-badge ${member.active?'paid':'pending'}">${member.active?'Activo':'Desactivado'}</span></div><p class="member-login">${member.username?`Usuario: <b>${esc(member.username)}</b><br>`:''}${member.email?`Correo: ${esc(member.email)}`:''}</p><p class="member-scopes">${esc(permissionSummary(AcontecRoles.levels(member.effectivePolicy)))}</p><p class="mut">${member.hasExceptions?'Excepciones individuales conservadas':'Usa los permisos del cargo'}</p>${permission('accesibilidad',true)?`<div class="accounting-actions"><button class="btn ghost" data-a="editMember" data-id="${member.id}">${esc(uiT("access.13","Editar permisos"))}</button><button class="lk" data-a="toggleMember" data-id="${member.id}">${member.active?'Desactivar':'Reactivar'}</button></div>`:''}</article>`).join('')}</div>`:`<div class="card empty-access"><h3>${esc(uiT("access.14","Tu equipo todavía no tiene accesos"))}</h3><p>${esc(uiT("access.15","Crea un usuario para ventas, un acceso para tu contador o una cuenta de solo lectura."))}</p></div>`}`);
    installSearch();enforceAccessUI();
  }catch(error){if(R==='accesibilidad'&&CO.id===companyId)main(`<div class="card"><p class="bad">${esc(error.message)}</p><button class="btn ghost" data-a="nav" data-r="accesibilidad">${esc(uiT("access.20","Reintentar"))}</button></div>`)}
};
function memberForm(member){
  if(!permission('accesibilidad',true))return;
  const selectedRole=companyRoleList.find(role=>role.id===member?.roleId)||companyRoleList.find(role=>role.key===member?.role?.toLowerCase())||companyRoleList.find(role=>role.key==='cajero');
  const initial=member?.effectivePolicy||selectedRole?.policy||emptyRolePolicy();
  const form=modal(member?'Editar acceso':'Crear acceso',`<p class="mut">El cargo define los permisos. Los accesos existentes conservan sus excepciones individuales hasta que confirmes reemplazarlas.</p><div class="member-form-grid"><label>Nombre de la persona<input name="name" required maxlength="100" value="${esc(member?.name||'')}"></label><label>Cargo<select name="roleId" required>${companyRoleList.map(role=>`<option value="${esc(role.id)}" ${role.id===selectedRole?.id?'selected':''} ${!canManageRole(role.policy)?'disabled':''}>${esc(role.name)}</option>`).join('')}</select></label><label>Correo (opcional)<input name="email" type="email" value="${esc(member?.email||'')}"></label><label>Nombre de usuario (opcional)<input name="username" pattern="[a-zA-Z][a-zA-Z0-9._-]{3,39}" maxlength="40" autocapitalize="none" value="${esc(member?.username||'')}"></label></div><label>${member?'Nueva contraseña (vacío = conservar)':'Contraseña del usuario'}<input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password"></label><p class="mut">Indica correo, usuario o ambos. El usuario requiere contraseña y es único en la plataforma. Las contraseñas no se muestran.</p><fieldset><legend>Sucursales asignadas</legend>${(CO.branches||[{id:'principal',name:'Principal'}]).map(branch=>`<label class="ck"><input type="checkbox" name="branchIds" value="${esc(branch.id)}" ${(member?.branchIds||['principal']).includes(branch.id)?'checked':''}>${esc(branch.name)}</label>`).join('')}</fieldset><label>Permisos de este acceso<select name="policyMode">${member?'<option value="preserve">Conservar permisos y excepciones actuales</option>':''}<option value="role">Usar los permisos del cargo</option><option value="custom">Definir excepciones individuales</option></select></label><div data-role-policy ${member?'hidden':''}>${rolePolicyFields(initial)}</div><label class="ck"><input name="active" type="checkbox" ${member?.active!==false?'checked':''}>Acceso activo</label>`,async fields=>{
    if(!await flush())return 'Guarda primero los cambios pendientes.';
    const mode=v(fields,'policyMode'),role=companyRoleList.find(r=>r.id===v(fields,'roleId'));
    if(!role)return 'Selecciona un cargo.';
    if(member&&mode!=='preserve'&&!confirm('¿Reemplazar los permisos actuales de este acceso? Sus sesiones anteriores se cierran.'))return 'Cambio sin confirmar.';
    const assigned=mode==='preserve'?member?.roleId:role.id;
    const exceptions=mode==='preserve'?member?.permissionExceptions:mode==='custom'?readRolePolicy(fields):null;
    await api('members?c='+CO.id,member?'PUT':'POST',{id:member?.id,version:member?.version,name:v(fields,'name'),role:mode==='preserve'?member.role:role.name,roleId:assigned,permissionExceptions:exceptions,applyRole:mode!=='preserve',email:v(fields,'email'),username:v(fields,'username'),password:v(fields,'password'),branchIds:[...fields.querySelectorAll('[name=branchIds]:checked')].map(input=>input.value),active:fields.elements.active.checked});
    await V.accesibilidad();
  },member?'Guardar cambios':'Crear acceso');
  const showPolicy=()=>{
    const mode=form.elements.policyMode.value,box=form.querySelector('[data-role-policy]'),role=companyRoleList.find(r=>r.id===form.elements.roleId.value);
    box.hidden=mode==='preserve';
    if(mode!=='preserve')box.innerHTML=rolePolicyFields(mode==='custom'&&member?member.effectivePolicy:role?.policy||emptyRolePolicy());
    box.querySelectorAll('input').forEach(input=>{if(mode==='role')input.disabled=true;});
  };
  form.elements.policyMode.onchange=showPolicy;
  form.elements.roleId.onchange=()=>{form.elements.policyMode.value='role';showPolicy()};
  showPolicy();
}
ACT.newMember=()=>memberForm();
ACT.editMember=data=>{const member=memberList.find(record=>record.id===data.id);if(member)memberForm(member)};
ACT.toggleMember=async data=>{
  const member=memberList.find(record=>record.id===data.id);if(!member)return;
  if(!confirm(`${member.active?'Desactivar':'Reactivar'} el acceso de ${member.name}? Los cambios cierran sus sesiones anteriores.`))return;
  await api('members?c='+CO.id,'PUT',{id:member.id,version:member.version,name:member.name,role:member.role,roleId:member.roleId,permissionExceptions:member.permissionExceptions,email:member.email,username:member.username,branchIds:member.branchIds,active:!member.active});await V.accesibilidad();
};
const auditDate=value=>new Date(value).toLocaleString('es',{dateStyle:'medium',timeStyle:'medium'});
const auditArea={entries:'Asientos y documentos',products:'Inventario',accounts:'Cuentas',cfg:'Configuración',employees:'Empleados',payrolls:'Nóminas',settlements:'Liquidaciones',taxes:'Obligaciones fiscales',properties:'Propiedades',name:'Nombre de empresa',description:'Descripción',accesibilidad:'Accesos'};
auditArea.customers='Cartera de clientes';
V.auditoria=async()=>{
  const companyId=CO.id,page=auditPage,request=++auditSearchRequest;
  main(`<div class="ph"><h2>${esc(uiT("access.38","Bitácora de auditoría"))}</h2></div>`+loadingCard(uiT("access.39","Consultando el historial de cambios…")));
  try{
    const range=typeof searchPeriod==='function'?searchPeriod(SEARCHES.auditoria||''):null;const start=range?new Date(range[0]+'T00:00:00'):null,end=range?new Date(range[1]+'T00:00:00'):null;if(end)end.setDate(end.getDate()+1);const result=await api('audit?c='+companyId+'&offset='+page*50+(range?'&start='+encodeURIComponent(start.toISOString())+'&end='+encodeURIComponent(end.toISOString()):''));
    if(R!=='auditoria'||CO.id!==companyId||page!==auditPage||request!==auditSearchRequest)return;
    auditRows=result.events;auditMore=result.more;
    main(`<div class="ph"><div><h2>${esc(uiT("access.42","Bitácora de auditoría"))}</h2><p class="mut">${esc(uiT("access.43","Quién cambió qué y cuándo · Fechas en tu zona horaria"))}</p></div></div><p class="accounting-notice">${esc(uiT("access.44","El historial registra los cambios confirmados en la nube, incluidos accesos, adjuntos y restauraciones. No se puede editar ni borrar desde la aplicación. Las contraseñas nunca se registran."))}</p><div class="card"><div class="tw"><table><thead><tr><th>${esc(uiT("access.45","Fecha y hora"))}</th><th>${esc(uiT("access.46","Persona"))}</th><th>${esc(uiT("access.47","Sucursal"))}</th><th>${esc(uiT("access.48","Acción"))}</th><th>${esc(uiT("access.49","Qué cambió"))}</th><th></th></tr></thead><tbody>${auditRows.map(event=>`<tr><td>${esc(auditDate(event.createdAt))}</td><td>${esc(event.actor)}</td><td>${esc((CO.branches||[]).find(b=>b.id===(event.branchId||'principal'))?.name||'Principal')}</td><td>${esc(event.action)}${event.revision!==null?`<small class="audit-revision">Versión ${event.revision}</small>`:''}</td><td>${esc([...new Set(event.changes.map(change=>auditArea[change.area]||change.area))].join(', ')||'Inicio de sesión')}</td><td>${event.changes.length?`<button class="lk" data-a="auditDetails" data-id="${event.id}">${esc(uiT("access.40","Ver cambios"))}</button>`:''}</td></tr>`).join('')||`<tr><td colspan="5" class="empty-ledger mut">${esc(uiT("access.41","Todavía no hay cambios registrados."))}</td></tr>`}</tbody></table></div></div><div class="audit-pager"><button class="btn ghost" data-a="auditPrev" ${page===0?'disabled':''}>${esc(uiT("access.50","Anterior"))}</button><span>Página ${page+1}</span><button class="btn ghost" data-a="auditNext" ${auditMore?'':'disabled'}>${esc(uiT("access.51","Siguiente"))}</button></div>`);installSearch();enforceAccessUI();
  }catch(error){if(R==='auditoria'&&CO.id===companyId)main(`<div class="card"><p class="bad">${esc(error.message)}</p><button class="btn ghost" data-a="nav" data-r="auditoria">${esc(uiT("access.52","Reintentar"))}</button></div>`)}
};
ACT.auditPrev=()=>{if(auditPage>0){auditPage--;V.auditoria()}};
ACT.auditNext=()=>{if(auditMore){auditPage++;V.auditoria()}};
ACT.auditDetails=data=>{
  const event=auditRows.find(record=>record.id===data.id);if(!event)return;
  modal(uiT("access.extra.3","Detalle del cambio"),`<p>${esc(event.actor)} · ${esc(auditDate(event.createdAt))}</p>${event.changes.map(change=>`<section class="audit-change"><h4>${esc(auditArea[change.area]||change.area)} ${esc(change.id||'')}</h4><div class="audit-comparison"><div><b>${esc(uiT("access.54","Antes"))}</b><pre>${esc(JSON.stringify(change.before,null,2))}</pre></div><div><b>${esc(uiT("access.55","Después"))}</b><pre>${esc(JSON.stringify(change.after,null,2))}</pre></div></div>${change.passwordChanged?`<p class="mut">${esc(uiT("access.53","Se cambió la contraseña. Su valor no se registra."))}</p>`:''}</section>`).join('')}`,()=>{},'Cerrar');
};

V.ajustes=async()=>{
  const companyId=CO.id;
  main(`<div class="ph"><h2>${esc(uiT("access.59","Ajustes y respaldo"))}</h2></div><div class="card"><h3>${esc(CO.name)}</h3><p class="mut">${esc(CO.description||'Sin descripción')}<br>${esc(U.name||U.email)} · ${esc(CO.role||'Dueño')}</p><div class="backup-actions">${CO.owner?`<button class="btn" data-a="cfg">${esc(uiT("access.56","Datos de la empresa"))}</button>`:''}<button class="btn ghost" data-a="backup">${esc(uiT("access.60","Descargar respaldo JSON"))}</button><button class="btn ghost" data-a="backupAll">${esc(uiT("access.61","Descargar todo (ZIP y adjuntos)"))}</button><button class="btn ghost" data-a="companyPdf">${esc(uiT("access.62","Descargar informe completo PDF"))}</button>${permission('ajustes',true)&&completeAccess(true)?`<button class="btn ghost" data-a="restore">${esc(uiT("access.57","Restaurar archivo JSON"))}</button>`:''}</div><input type="file" id="rf" accept=".json,application/json" hidden><p id="export-status" class="mut" role="status" aria-live="polite"></p></div><div class="card"><h3>${esc(uiT("access.63","Respaldo automático de versiones"))}</h3><p>${esc(uiT("access.64","Cada cambio confirmado conserva la versión anterior, de forma atómica junto con la bitácora. Se guardan las últimas"))} <b>${esc(uiT("access.65","30 versiones"))}</b> ${esc(uiT("access.66","de esta empresa. Restaurar conserva también el estado que reemplazas."))}</p><p class="mut">${esc(uiT("access.67","Esto permite recuperar cambios accidentales, pero no garantiza que nunca haya una pérdida. Descarga periódicamente una copia independiente. El ZIP incluye la información actual, sus versiones retenidas, la bitácora y los adjuntos privados si eres el dueño. El PDF contiene los registros contables y estados financieros; los archivos originales se incluyen en el ZIP, no dentro del PDF."))}</p><div id="backup-history">${loadingCard(uiT("access.58","Consultando versiones guardadas…"))}</div></div>`);
  enforceAccessUI();
  try{
    const result=await api('backups?c='+companyId);
    if(R!=='ajustes'||CO.id!==companyId)return;
    $('#backup-history').innerHTML=result.backups.length?`<div class="tw"><table><thead><tr><th>${esc(uiT("access.70","Versión"))}</th><th>${esc(uiT("access.71","Fecha"))}</th><th>${esc(uiT("access.72","Empresa"))}</th><th>${esc(uiT("access.73","Acciones"))}</th></tr></thead><tbody>${result.backups.map(backup=>`<tr><td>${backup.revision}</td><td>${esc(auditDate(backup.createdAt))}</td><td>${esc(backup.name)}</td><td><button class="lk" data-a="downloadSnapshot" data-id="${backup.id}">${esc(uiT("access.69","Descargar"))}</button>${permission('ajustes',true)&&completeAccess(true)?` <button class="lk" data-a="restoreSnapshot" data-id="${backup.id}">${esc(uiT("access.68","Restaurar"))}</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<p class="mut">${esc(uiT("access.74","El primer cambio guardado crea la primera versión recuperable."))}</p>`;
  }catch(error){if(R==='ajustes'&&CO.id===companyId)$('#backup-history').innerHTML=`<p class="bad">${esc(error.message)}</p>`}
};
ACT.cfg=()=>modal(uiT("access.extra.4","Datos de la empresa"),`<label>${esc(uiT("access.75","Nombre"))}<input name="name" required maxlength="80" value="${esc(CO.name)}"></label><label>${esc(uiT("access.76","Descripción"))}<textarea name="description" rows="3" maxlength="2000">${esc(CO.description||'')}</textarea></label><label>${esc(uiT("access.77","RUC / identificación"))}<input name="ruc" value="${esc(S.cfg.ruc||'')}"></label><label>${esc(uiT("access.78","Símbolo de moneda"))}<input name="cur" value="${esc(S.cfg.cur||'C$')}"></label>`,async form=>{
  if(!CO.owner)return 'Solo el dueño modifica estos datos.';
  if(!await flush())return 'Guarda los cambios pendientes antes de modificar la empresa.';
  const result=await api('company','PUT',{id:CO.id,revision:REV,name:v(form,'name'),description:v(form,'description'),cfg:{ruc:v(form,'ruc'),cur:v(form,'cur')||'C$'}});
  REV=result.revision;S=result.data;rememberCloud();COS=result.companies;CO={...CO,...COS.find(company=>company.id===CO.id)};shell();view();
});
ACT.switch=()=>{
  menu(false);
  modal(U.worker?'Empresa asignada':'Mis empresas',(U.editor?`<button type="button" class="btn ghost full" style="margin-bottom:8px" data-a="home">${esc(uiT("access.79","Página principal de Acontec"))}</button>`:'')+COS.map(company=>`<button type="button" class="btn ${company.id===CO.id?'':'ghost'} full" style="margin-bottom:8px" data-a="opencomp" data-id="${company.id}">${esc(company.name)} · ${esc(company.role)}</button>`).join('')+(U.worker?`<p class="mut">${esc(uiT("access.80","El dueño administra tus accesos. Tu usuario no crea empresas."))}</p>`:`<label>${esc(uiT("access.81","Crear nueva empresa"))}<input name="name" maxlength="80" placeholder="Nombre de la empresa"></label><label>${esc(uiT("access.82","Descripción"))}<textarea name="description" rows="2" maxlength="2000"></textarea></label>`+businessTypeField()),async form=>{
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
  if(!saved)alert(uiT("access.extra.5","Se descargó una copia de recuperación con tus cambios pendientes. Esos cambios todavía no se han guardado en la nube."));
};
ACT.downloadSnapshot=async data=>{
  const {backup}=await api('backups?c='+CO.id+'&id='+data.id);
  downloadBackup(backupEnvelope(backup.data,{...CO,name:backup.name,description:backup.description,businessType:backup.businessType,businessCustomization:backup.businessCustomization},backup.revision),`respaldo-${safeFilename(backup.name)}-version-${backup.revision}.json`);
};
async function applyRestore(body){
  if(!permission('ajustes',true)||!completeAccess(true))throw new Error(uiT("access.extra.6","No tienes permiso para restaurar."));
  if(!await flush())throw new Error(uiT("access.extra.7","Guarda o descarga los cambios pendientes antes de restaurar."));
  const result=await api('backups?c='+CO.id,'POST',{...body,revision:REV});
  REV=result.revision;S=result.data;rememberCloud();saveVersion=0;savedVersion=0;COS=result.companies;const fresh=await api('data?c='+CO.id);CO=fresh.company;S=fresh.data;REV=fresh.revision;rememberCloud();shell();view();setSt('Respaldo restaurado en la nube');
}
async function restoreFile(file){
  if(file.size>25000000)throw new Error(uiT("access.extra.8","El archivo JSON supera el límite de lectura de 25 MB."));
  let envelope;try{envelope=JSON.parse(await file.text())}catch{throw new Error(uiT("access.extra.9","Archivo JSON inválido."))}
  const data=envelope.format==='acontec-backup'?envelope.data:envelope;
  if(envelope.company?.branchId && envelope.company.branchId!==CO.branchId)throw new Error(uiT("access.extra.10","Selecciona la sucursal de este respaldo antes de restaurarlo."));
  if(envelope.company?.id&&envelope.company.id!==CO.id)throw new Error(uiT("access.extra.11","Este respaldo pertenece a otra empresa."));
  if(!data||!Array.isArray(data.accounts)||!Array.isArray(data.entries)||!Array.isArray(data.products))throw new Error(uiT("access.extra.12","El archivo no es un respaldo contable válido."));
  if(confirm(uiT("access.extra.13","¿Restaurar este archivo? La versión actual se conserva en el historial antes de reemplazarla. Los adjuntos originales deben seguir disponibles en esta empresa.")))await applyRestore({data,...(envelope.company?.businessType?{profile:{businessType:envelope.company.businessType,businessCustomization:envelope.company.businessCustomization||{}}}:{})});
}
ACT.restore=()=>$('#rf').click();
ACT.restoreSnapshot=async data=>{if(confirm(uiT("access.extra.14","¿Restaurar esta versión? Los cambios posteriores dejan de ser la versión activa, pero el estado actual se respalda antes de continuar.")))await applyRestore({id:data.id})};

let exportBusy=false;
const libraryLoads=new Map();
function loadExportScript(src){if(!libraryLoads.has(src))libraryLoads.set(src,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{libraryLoads.delete(src);reject(new Error(uiT("access.extra.15","No se pudo cargar el generador de documentos.")))};document.head.append(script)}));return libraryLoads.get(src)}
const exportStatus=text=>{const target=$('#export-status');if(target)target.textContent=text};
async function runExport(operation){
  if(exportBusy)return;
  exportBusy=true;
  const companyId=CO.id;
  try{exportStatus('Preparando la descarga…');if(!await flush())throw new Error(uiT("access.extra.16","Hay cambios pendientes. Descarga primero el respaldo JSON de recuperación."));const current=await api('data?c='+companyId);await operation(companyId,current);exportStatus('Descarga preparada. Guarda una copia fuera de Acontec.')}
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
    if(!response.ok)throw new Error(uiT("access.extra.17","No se completó el respaldo: falta un adjunto o tu sesión venció. No se genera una copia incompleta."));
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

Object.assign(ACTION_MODULE,{newRole:'accesibilidad',editRole:'accesibilidad',deleteRole:'accesibilidad'});
const roleModuleLabel=module=>module==='panel'?'Panel':ACCESS_MODULES.find(([id])=>id===module)?.[1]||AcontecProfiles.capabilities?.[module]?.name||module.replaceAll('_',' ');
function emptyRolePolicy(){return {modules:Object.fromEntries(roleModuleList.map(module=>[module,{view:false,create:false,edit:false,delete:false}])),specials:Object.fromEntries(AcontecRoles.specials.map(key=>[key,false])),ownOperations:false}}
function roleCeiling(){return CO.rolePolicy||AcontecRoles.legacyPolicy(CO.role,CO.permissions,roleModuleList)}
function canManageRole(policy){return CO.owner||AcontecRoles.within(policy,roleCeiling())}
function rolePolicyFields(policy){
  const ceiling=roleCeiling(),labels={view:'Ver',create:'Crear',edit:'Editar',delete:'Borrar'};
  const groups=[['Operación',['panel','ventas','facturacion','compras','gastos','inventario','costos','proveedores','cajas']],['Contabilidad y reportes',['contabilidad','finanzas','personal','fiscal','auditoria','auditoria_revision']],['Administración',['ajustes','accesibilidad','diseno_factura']],['Otros módulos',roleModuleList.filter(m=>!['panel','ventas','facturacion','compras','gastos','inventario','costos','proveedores','cajas','contabilidad','finanzas','personal','fiscal','auditoria','auditoria_revision','ajustes','accesibilidad','diseno_factura'].includes(m))]];
  return groups.map(([group,modules])=>`<fieldset class="role-permission-group"><legend>${esc(group)}</legend>${modules.filter(m=>roleModuleList.includes(m)&&!['control_personal','decisiones'].includes(m)).map(module=>`<div class="role-permission-row"><b>${esc(roleModuleLabel(module))}</b><div class="role-permission-checks">${module==='accesibilidad'?`<label class="ck"><input type="checkbox" name="role_admin" ${policy.modules?.accesibilidad?.edit?'checked':''} ${!CO.owner&&!AcontecRoles.permits(ceiling,'accesibilidad','edit')?'disabled':''}>Administrar accesos</label>`:AcontecRoles.actions.filter(action=>module!=='panel'||action==='view').map(action=>`<label class="ck"><input type="checkbox" name="role_${module}_${action}" ${policy.modules?.[module]?.[action]?'checked':''} ${!CO.owner&&!AcontecRoles.permits(ceiling,module,action)?'disabled':''}>${labels[action]}</label>`).join('')}</div></div>`).join('')}</fieldset>`).join('')+`<fieldset class="role-permission-group"><legend>Permisos especiales y alcance</legend>${[['discounts','Autorizar descuentos (conserva la contraseña y los controles actuales)'],['corrections','Autorizar correcciones'],['salesAdmin','Administrar ventas y operar sin turno'],['cashAdmin','Administrar caja y fondos'],['allBranches','Acceder a todas las sucursales']].map(([key,label])=>`<label class="ck"><input type="checkbox" name="role_special_${key}" ${policy.specials?.[key]?'checked':''} ${!CO.owner&&!ceiling.specials?.[key]?'disabled':''}>${esc(label)}</label>`).join('')}<label class="ck"><input type="checkbox" name="role_ownOperations" ${policy.ownOperations?'checked':''} ${!CO.owner&&ceiling.ownOperations?'disabled':''}>Limitar las operaciones a los turnos y movimientos propios</label></fieldset><p class="mut">Crear, editar y borrar requieren Ver. Los permisos respetan el plan y las protecciones contables existentes. Borrar no habilita eliminar documentos protegidos ni cambia sus reglas de reversión. El dueño mantiene acceso completo.</p>`;
}
function readRolePolicy(form){
  const policy=emptyRolePolicy();
  for(const module of roleModuleList)for(const action of AcontecRoles.actions)policy.modules[module][action]=module==='accesibilidad'?form.elements.role_admin.checked:form.elements[`role_${module}_${action}`]?.checked===true;
  for(const [alias,module] of Object.entries({control_personal:'personal',decisiones:'finanzas'}))if(roleModuleList.includes(alias))policy.modules[alias]={...policy.modules[module]};
  for(const key of AcontecRoles.specials)policy.specials[key]=form.elements['role_special_'+key]?.checked===true;
  policy.ownOperations=form.elements.role_ownOperations.checked;
  return policy;
}
function roleCards(){return `<section class="card role-directory"><div class="ph"><div><h3>Cargos y permisos</h3><p class="mut">Configuración exclusiva de esta empresa. Las excepciones individuales se conservan.</p></div><button class="btn ghost" data-a="newRole">+ Nuevo cargo</button></div><div class="member-grid">${companyRoleList.map(role=>{
  const count=memberList.filter(m=>m.roleId===role.id||!m.roleId&&m.role.toLowerCase()===(role.key||role.name.toLowerCase())).length;
  return `<article class="member-card role-card"><h4>${esc(role.name)}</h4><p>${esc(role.description||'Sin descripción')}</p><p class="mut">${count} acceso${count===1?'':'s'} asignado${count===1?'':'s'}${role.key?' · Cargo inicial':''}</p>${canManageRole(role.policy)?`<div class="accounting-actions"><button class="btn ghost" data-a="editRole" data-id="${esc(role.id)}">Editar cargo</button>${!role.key?`<button class="lk" data-a="deleteRole" data-id="${esc(role.id)}">Borrar cargo</button>`:''}</div>`:''}</article>`;
}).join('')}</div></section>`}
function roleForm(role){
  if(!permission('accesibilidad',true))return;
  modal(role?'Editar cargo':'Nuevo cargo',`<label>Nombre del cargo<input name="name" required maxlength="80" value="${esc(role?.name||'')}"></label><label>Descripción corta<textarea name="description" maxlength="300" rows="2">${esc(role?.description||'')}</textarea></label>${rolePolicyFields(role?.policy||emptyRolePolicy())}`,async form=>{
    if(!confirm(role?'¿Guardar los cambios de este cargo? Se aplican a quienes usan sus permisos; se conservan las excepciones individuales.':'¿Crear este cargo con los permisos seleccionados?'))return 'Cambio sin confirmar.';
    await api('roles?c='+CO.id,role?'PUT':'POST',{id:role?.id,version:role?.version,name:v(form,'name'),description:v(form,'description'),policy:readRolePolicy(form),confirmed:true});await V.accesibilidad();
  },role?'Guardar cargo':'Crear cargo');
}
ACT.newRole=()=>roleForm();
ACT.editRole=data=>{const role=companyRoleList.find(r=>r.id===data.id);if(role)roleForm(role)};
ACT.deleteRole=data=>{
  const role=companyRoleList.find(r=>r.id===data.id);if(!role||role.key)return;
  const assigned=memberList.filter(m=>m.roleId===role.id||!m.roleId&&m.role.toLowerCase()===(role.key||role.name.toLowerCase())),alternatives=companyRoleList.filter(r=>r.id!==role.id&&canManageRole(r.policy));
  modal('Borrar cargo',`<p>¿Borrar el cargo <b>${esc(role.name)}</b>?</p>${assigned.length?`<p>${assigned.length} acceso(s) requieren reasignación. La reasignación aplica los permisos del nuevo cargo y cierra sus sesiones.</p><label>Reasignar a<select name="target" required><option value="">Selecciona otro cargo</option>${alternatives.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label>`:'<p>No tiene accesos asignados.</p>'}`,async form=>{
    if(!confirm('¿Confirmar el borrado del cargo y la reasignación indicada?'))return 'Cambio sin confirmar.';
    await api('roles?c='+CO.id,'DELETE',{id:role.id,version:role.version,reassignRoleId:form.elements.target?.value||null,confirmed:true});await V.accesibilidad();
  },'Confirmar borrado');
};
