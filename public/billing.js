'use strict';
let BILLING=null,BILLING_PLANS=[],BILLING_INTERVAL='mensual',BILLING_LOCKED=false,BILLING_TIMER=null;
const usdCents=n=>'US$'+(Number(n||0)/100).toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2});
const billingModule=module=>({asistencia:'control_personal',simuladores:'decisiones',rentabilidad:'decisiones',pronostico:'decisiones',sucursales:'sucursales'}[module]||module);
function billingCan(module){return !CO?.billingPlan?.blockedModules?.includes(billingModule(module))}
async function refreshBilling(){
 if(!U)return;
 if(CO?.support){try{await api('data?c='+CO.id)}catch(error){if([402,403,404].includes(error.status)){const account=await api('me');COS=account.companies;CO=null;S=null;await openCompany(COS.find(c=>c.owner)?.id);return}throw error}}
 BILLING=await api('billing/me');
 billingTrialOffer();
 if(!BILLING.entitlement.access){BILLING_LOCKED=true;await showPlans(true);return}
 BILLING_LOCKED=false;
 if(CO){CO.billingPlan=BILLING.plan;CO.entitlement=BILLING.entitlement}
 const target=$('#billing-status');if(target)target.textContent=billingStatus();
}
function billingStatus(){const ent=BILLING?.entitlement||CO?.entitlement;if(!ent)return 'Mi suscripción';if(ent.state==='prueba'){const seconds=Math.max(0,Math.floor((Date.parse(ent.trialEndsAt)-Date.now())/1000));return `Prueba gratuita · quedan ${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}if(ent.state==='en_gracia')return 'Tu pago venció · regulariza tu suscripción';return ent.state==='admin'?'Administración de plataforma':`Plan ${BILLING?.plan?.name||ent.plan} · hasta ${shortDate(ent.paidUntil)}`}
function billingTrialOffer(){
 const ent=BILLING?.entitlement||CO?.entitlement;
 const visible=CO?.owner&&!CO.support&&ent?.state==='prueba';
 if(!visible){$('#billing-trial-offer')?.remove();return}
 if($('#billing-trial-offer'))return;
 $('#main')?.insertAdjacentHTML('beforebegin','<aside id="billing-trial-offer" class="access-status billing-trial-offer noprint" aria-label="Contratar un plan"><div><strong>Puedes contratar tu plan desde ahora</strong><p>No necesitas esperar a que termine tu prueba gratuita. Tu plan comienza cuando se confirma el pago.</p></div><button class="btn" data-a="mySubscription">Elegir plan y pagar</button></aside>');
}
async function showPlans(locked=false){
 BILLING_LOCKED=locked;
 if(!BILLING_PLANS.length)BILLING_PLANS=(await api('plans')).plans;
 let root=$('#billing-overlay');if(!root){root=document.createElement('section');root.id='billing-overlay';root.className='billing-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Planes y suscripción');document.body.append(root)}
 const annual=BILLING_INTERVAL==='anual';
 root.innerHTML=`<div class="billing-sheet"><div class="billing-heading"><span class="section-eyebrow">ACONTEC · TU SUSCRIPCIÓN</span><h1>Un plan a la medida de tu negocio.</h1><p>${locked?'Tu acceso está pendiente de renovación. Tus datos se conservan.':(BILLING?.entitlement||CO?.entitlement)?.state==='prueba'?'Puedes pagar ahora, sin esperar a que termine tu prueba gratuita. Tu plan comienza cuando se confirma el pago.':'Elige el plan que acompaña tu trabajo.'}</p><p class="billing-current">${esc(billingStatus())}</p><div class="billing-tabs" aria-label="Periodo de facturación"><button id="billing-month" aria-pressed="${!annual}" class="btn ${annual?'ghost':''}">Mensual</button><button id="billing-year" aria-pressed="${annual}" class="btn ${annual?'':'ghost'}">Anual</button></div><p>Precios en USD. Compara el pago mensual con el ahorro anual.</p></div><div class="billing-plans">${BILLING_PLANS.filter(p=>p.active!==false).map(p=>{return `<article class="card billing-plan"><span class="section-eyebrow">PLAN ${esc(p.name)}</span><h2>${usdCents(annual?p.annualCents:p.monthlyCents)}<small> / ${annual?'año':'mes'}</small></h2>${annual?`<p>Equivale a ${usdCents(Math.round(p.annualCents/12))}/mes<br>Ahorro anual: ${usdCents(p.monthlyCents*12-p.annualCents)}</p>`:''}<p>${p.limits.companies===null?'Empresas sin límite':esc(p.limits.companies)+' empresa'} · ${p.limits.branches===null?'Sucursales sin límite':'Sucursal principal'}</p><p>${p.blockedModules.includes('personal')?'No incluye Personal, Fiscal, Control del personal ni Decisiones del negocio.':p.blockedModules.includes('sucursales')?'Todos los módulos, excepto administración de sucursales.':'Todos los módulos incluidos.'}</p><button class="btn full" data-billing-plan="${esc(p.id)}">Elegir ${esc(p.name)}</button></article>`}).join('')}</div><div class="billing-footer"><a href="/terminos" target="_blank" rel="noopener">Términos</a> · <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a> · <a href="/reembolsos" target="_blank" rel="noopener">Reembolsos</a><p>No guardamos datos de tarjeta. El pago se realiza en Pagadito.</p><p id="billing-error" class="err" role="status"></p><button id="billing-check" class="btn ghost">Verificar mi pago</button> <button id="billing-cancel" class="btn ghost">Cancelar cobros futuros</button> ${locked?'<button id="billing-logout" class="btn ghost">Salir</button>':'<button id="billing-close" class="btn ghost">Volver a mi empresa</button>'}</div></div>`;
 root.querySelector('#billing-month').onclick=()=>{BILLING_INTERVAL='mensual';showPlans(locked)};root.querySelector('#billing-year').onclick=()=>{BILLING_INTERVAL='anual';showPlans(locked)};
 root.querySelectorAll('[data-billing-plan]').forEach(b=>b.onclick=()=>billingSummary(b.dataset.billingPlan,locked));
 root.querySelector('#billing-close')?.addEventListener('click',()=>root.remove());
 root.querySelector('#billing-logout')?.addEventListener('click',async()=>{await ACT.logout();root.remove()});
 root.querySelector('#billing-cancel').onclick=async()=>{if(!confirm('¿Cancelar los cobros futuros? Conservas el acceso hasta el fin del periodo pagado.'))return;try{await api('cancel','POST',{});await refreshBilling();root.querySelector('#billing-error').textContent='Pagadito confirmó la cancelación de los cobros futuros.'}catch(e){root.querySelector('#billing-error').textContent=e.message}};
 root.querySelector('#billing-check').onclick=async()=>{const b=root.querySelector('#billing-check');b.disabled=true;try{const result=await api('billing/confirm','POST',{});await refreshBilling();if(result.status==='active'){root.remove();await openCompany(CO?.id||COS[0]?.id);alert('¡Pago confirmado!')}else root.querySelector('#billing-error').textContent='El pago sigue en verificación.'}catch(e){root.querySelector('#billing-error').textContent=e.message}finally{b.disabled=false}};
}
function billingSummary(id,locked){
 const p=BILLING_PLANS.find(p=>p.id===id);if(!p)return;
 const interval=BILLING_INTERVAL,annual=interval==='anual',amount=annual?p.annualCents:p.monthlyCents,root=$('#billing-overlay');
 let details=null,busy=false;
 root.innerHTML=`<div class="billing-sheet billing-summary"><span class="section-eyebrow">ACONTEC / PAGO SEGURO</span><h1>Confirma tu suscripción</h1><p class="billing-intro">Puedes pagar aunque tu prueba gratuita siga vigente. Tu plan comienza cuando se confirma el pago. Revisa tu plan y continúa a Pagadito.</p><div class="billing-order"><div><span>Plan ${esc(p.name)}</span><strong>${annual?'Facturación anual':'Facturación mensual'}</strong></div><div class="billing-order-price"><strong>${usdCents(amount)}</strong><span>USD · total de hoy</span></div></div><p>El siguiente cobro se programa ${annual?'dentro de 12 meses':'dentro de un mes'}. Puedes cancelar las renovaciones desde Mi suscripción. No se prorratean periodos anteriores.</p><p id="billing-mode" class="billing-notice" role="status" aria-live="polite">Consultando disponibilidad del pago…</p><label class="billing-consent" for="billing-accepted"><input id="billing-accepted" type="checkbox"><span>He leído y acepto los <a href="/terminos" target="_blank" rel="noopener">Términos</a>, la <a href="/privacidad" target="_blank" rel="noopener">Privacidad</a> y los <a href="/reembolsos" target="_blank" rel="noopener">Reembolsos</a>, y autorizo los cobros recurrentes descritos.</span></label><p id="billing-pay-error" class="err" role="alert"></p><p id="billing-pay-hint" class="billing-hint" aria-live="polite"></p><div class="billing-pay-actions"><button id="billing-pay" class="btn" disabled aria-describedby="billing-pay-hint billing-mode">Continuar al pago seguro <span aria-hidden="true">→</span></button><button id="billing-back" class="btn ghost">Volver a los planes</button><button id="billing-retry" class="btn ghost" hidden>Consultar de nuevo</button></div><p class="billing-security">Pago procesado por Pagadito. Acontec no guarda los datos de tu tarjeta.</p></div>`;
 const sheet=root.querySelector('.billing-summary'),button=sheet.querySelector('#billing-pay'),accepted=sheet.querySelector('#billing-accepted'),error=sheet.querySelector('#billing-pay-error'),mode=sheet.querySelector('#billing-mode'),hint=sheet.querySelector('#billing-pay-hint'),retry=sheet.querySelector('#billing-retry');
 const current=()=>root.isConnected&&root.firstElementChild===sheet;
 const ready=()=>details?.checkoutReady===true&&!!details.legalVersion&&details.provider?.ready;
 function update(){button.disabled=busy||!ready()||!accepted.checked;hint.textContent=busy?'Preparando tu enlace de pago. Espera un momento…':!details?'Esperando la verificación del servicio de pagos.':!ready()?'El pago no está disponible todavía.':!accepted.checked?'Marca la casilla de aceptación para continuar.':'Todo listo para continuar a Pagadito.';button.textContent=busy?'Conectando con Pagadito…':'Continuar al pago seguro →'}
 async function load(){details=null;retry.hidden=true;error.textContent='';mode.textContent='Consultando disponibilidad del pago…';update();try{const data=await api('billing/me');if(!current())return;details=data;BILLING=data;const count=annual?data.billingYears:data.billingMonths;mode.textContent=ready()?`${data.provider.environment==='sandbox'?'Modo de pruebas: dinero ficticio.':'Pagos reales en USD.'} Se programan ${count} cobros de ${usdCents(amount)}, incluido el de hoy. Versión legal: ${data.legalVersion}.`:data.checkoutReason||'El pago no está habilitado. Contacta con Acontec.';retry.hidden=ready();update()}catch(e){if(!current())return;mode.textContent='No se pudo verificar la disponibilidad del pago.';error.textContent=e.message;retry.hidden=false;update()}}
 sheet.querySelector('#billing-back').onclick=()=>{if(!busy)showPlans(locked)};
 accepted.onchange=update;retry.onclick=load;
 button.onclick=async()=>{if(busy||!ready()||!accepted.checked)return;busy=true;error.textContent='';sheet.querySelector('#billing-back').disabled=true;update();try{const r=await api('checkout','POST',{plan:id,interval,accepted:true,planVersion:p.version,amountCents:amount,legalVersion:details.legalVersion});if(r.status==='active'){await refreshBilling();root.remove();await openCompany(CO?.id||COS[0]?.id);return}const url=new URL(r.url);if(url.protocol!=='https:'||!['sandbox-connect.pagadito.com','connect.pagadito.com'].includes(url.hostname)||url.username||url.password||url.port)throw new Error('Enlace de pago inválido');location.assign(url.href)}catch(e){if(!current())return;error.textContent=e.message;BILLING_PLANS=[];busy=false;sheet.querySelector('#billing-back').disabled=false;update()}};
 load();button.focus();
}
const billingOpenCompany=openCompany;
openCompany=async function(id){
 try{
  const params=new URLSearchParams(location.search);
  const returned=params.get('pago')==='retorno'||params.has('token')||params.has('ern');
  let result;
  if(returned){const payload=params.has('token')||params.has('ern')?{token:params.get('token'),ern:params.get('ern')}:{};history.replaceState(null,'',location.pathname);result=await api('billing/confirm','POST',payload)}
  await billingOpenCompany(id);await refreshBilling();
  if(returned&&result.status!=='active'){await showPlans(BILLING_LOCKED);const message=$('#billing-error');if(message)message.textContent=['failed','expired','abandoned'].includes(result.status)?'El intento terminó sin pago confirmado. Puedes iniciar otro pago.':'Pagadito todavía está procesando tu pago. La confirmación es automática.'}
 }catch(error){if(error.status===402){await refreshBilling();return}throw error}
};
const billingChrome=chrome;
chrome=function(){billingChrome();$('#drawer .bot')?.insertAdjacentHTML('afterbegin','<button data-a="mySubscription"><span>◷</span><span>Mi suscripción y pagos<br><small id="billing-status">'+esc(billingStatus())+'</small></span></button>');billingTrialOffer();if(CO.support)$('#main')?.insertAdjacentHTML('beforebegin',`<p class="access-status">Soporte temporal · solo lectura · vence ${esc(shortDate(CO.supportExpiresAt))}</p>`)};
READ_ACTIONS.add('mySubscription');ACT.mySubscription=()=>{menu(false);showPlans(BILLING_LOCKED)};
setInterval(()=>{if(!U)return;const status=$('#billing-status');if(status)status.textContent=billingStatus();const ent=BILLING?.entitlement||CO?.entitlement;if(ent?.state==='prueba'&&ent.trialEndsAt&&Date.now()>=Date.parse(ent.trialEndsAt)&&!BILLING_LOCKED){BILLING_LOCKED=true;refreshBilling().catch(()=>{});}},1000);
setInterval(()=>{if(U&&!document.hidden)refreshBilling().catch(()=>{})},240000);
document.addEventListener('visibilitychange',()=>{if(U&&!document.hidden)refreshBilling().catch(()=>{})});
