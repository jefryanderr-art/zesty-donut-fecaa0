'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
const r2=n=>Math.round((+n||0)*100)/100;
// Solo para nuevas líneas; los saldos e históricos conservan su precisión.
const inputQuantity=value=>{const q=Number(value);if(!Number.isFinite(q)||q<0.001)throw new Error(uiT("app.extra.1","La cantidad mínima es 0.001."));return Math.round(q*1000)/1000};
const formatQuantity=value=>{const q=Math.round(Number(value)*1000)/1000;return Number.isFinite(q)?String(q):'—'};
document.addEventListener('wheel',event=>{if(event.target.matches('input[name="posQuantity"]'))event.preventDefault()},{passive:false});
function normalizeDecimal(text){let point=false;return String(text).replace(/,/g,'.').replace(/[^0-9.]/g,'').replace(/\./g,()=>{if(point)return '';point=true;return '.'})}
document.addEventListener('input',event=>{const input=event.target;if(!input.matches('input[data-decimal]'))return;const normalized=normalizeDecimal(input.value);if(input.value!==normalized)input.value=normalized},true);
const quantityRound=n=>Math.round((+n||0)*1000000)/1000000;
const iso=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);
const today=()=>iso(new Date());
const byCode=(a,b)=>String(a.code).localeCompare(String(b.code));
const DEF={brand:'Acontec',eyebrow:'Administración contable tecnológica',title:'Tu negocio, en orden.',sub:'Ventas, inventario y finanzas en un mismo lugar. Menos tiempo entre números. Más claridad para decidir.',hero:'',green:'#234e40',gold:'#c7a76b',note:'Un espacio para cada empresa',caption:'La tecnología se encarga del orden.\nTú te encargas de tu negocio.',tagline:'Administración contable tecnológica',footer:'Hecho para llevar tu negocio con claridad.',logo:'',gallery:[]};
// code, nombre, tipo, naturaleza, sub (ef=efectivo, fijo=activo fijo, fin=financiamiento)
const ACC=[['1101','Caja general','activo','D','ef'],['1102','Bancos','activo','D','ef'],['1201','Cuentas por cobrar','activo','D',''],['1301','Inventario de mercadería','activo','D',''],['1401','Mobiliario y equipo','activo','D','fijo'],['1402','Vehículos','activo','D','fijo'],['1403','Depreciación acumulada','activo','C','fijo'],
['2101','Cuentas por pagar','pasivo','C',''],['2102','Impuestos por pagar','pasivo','C',''],['2103','Sueldos por pagar','pasivo','C',''],['2201','Préstamos bancarios largo plazo','pasivo','C','fin'],
['3101','Capital social','patrimonio','C','fin'],['3102','Utilidades acumuladas','patrimonio','C',''],['3103','Retiros del propietario','patrimonio','D','fin'],
['4101','Ventas','ingreso','C',''],['4102','Otros ingresos','ingreso','C',''],['5101','Costo de ventas','costo','D',''],
['6101','Sueldos y salarios','gasto','D',''],['6102','Alquiler','gasto','D',''],['6103','Servicios básicos','gasto','D',''],['6104','Transporte','gasto','D',''],['6105','Publicidad','gasto','D',''],['6106','Depreciación','gasto','D',''],['6107','Otros gastos y mermas','gasto','D','']];
const PROT=['1101','1102','1201','1301','2101','3101','4101','4102','5101','6107'];
const NAT={activo:'D',gasto:'D',costo:'D',pasivo:'C',patrimonio:'C',ingreso:'C'};
const PAY={'1101':'Contado (caja)','1102':'Contado (banco)','1201':'Crédito','2101':'Crédito'};
let U=null,COS=[],CO=null,S=null,SITE={...DEF},GID='',R='panel',AM='login',MAY='1101',REV=0,googleScript=null,HOME=false;
localStorage.removeItem('tk');
const isAcontecCompany=()=>!!CO?.owner&&CO.name.trim().toLowerCase()==='acontec';
const P={k:'mes',from:today().slice(0,8)+'01',to:today()};
const moneyValue=n=>{const value=r2(n);return value===0?0:value};
const money=(n,cur=S?.cfg?.cur||'C$')=>{const value=moneyValue(n);return (value<0?'-':'')+cur+' '+Math.abs(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})};
const money2=n=>{const value=moneyValue(n);return `<span data-money="${value}"${value<0?' class="negative-value"':''}>${esc(money(value))}</span>`};
const financialPdfCell=cell=>{if(cell.section==='body'&&/^-[^\d]*\d/.test(String(cell.cell.raw)))cell.cell.styles.textColor=[190,63,63]};
const tshow=t=>t>'9000'?today():t;

async function api(path,method='GET',body){
  if(path.startsWith('customers-admin')&&CO)path+=(path.includes('?')?'&':'?')+'c='+encodeURIComponent(CO.id);
  const headers={'content-type':'application/json'};
  let payload=body?JSON.stringify(body):undefined;
  if(((path.startsWith('data?')&&method==='PUT')||(path.startsWith('operations?')&&method==='POST'))&&payload){
    const bytes=new TextEncoder().encode(payload);
    cloudSizeNotice=bytes.length>3850000?' · Aviso: el envío supera el 70% del límite.':'';
    if(bytes.length>3850000)setSt('Guardando · El envío supera el 70% del límite. Reduce los archivos o divide la operación.');
    if(bytes.length>5500000){const error=new Error(uiT("app.extra.2","El contenido supera el límite de envío. Divide la operación."));error.status=413;throw error}
    if(bytes.length>16384&&typeof CompressionStream!=='undefined'){
      payload=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).blob();headers['content-encoding']='gzip';
    }
  }
  const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers,body:payload,signal:AbortSignal.timeout(45000)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j){const error=new Error(j?.error||'No se pudo confirmar la operación. Intenta guardar de nuevo.');error.status=r.ok?0:r.status;error.supportCode=j?.supportCode;error.code=j?.code;error.confirmationGrant=j?.confirmationGrant;throw error}
  return j;
}
let st,saveVersion=0,savedVersion=0,saving=null,receiptMutation=null,retryCount=0,saveStatus='Guardado en la nube';
let cloudBase=null,pendingSave=null,cloudConflict=null,sessionExpired=false,cloudSupportCode='',cloudSizeNotice='';
let pendingCloudOperation=null,operationInFlight=null;
const copyCloud=value=>AcontecSync.clone(value);
function rememberCloud(){cloudBase=copyCloud(S);pendingSave=null}
const setSt=text=>{
  saveStatus=text;
  if(saveVersion===savedVersion&&text==='Guardado en la nube'&&S)rememberCloud();
  for(const status of [$('#st'),$('.home-save-status')].filter(Boolean)){
    status.textContent=text+(text.startsWith('Sin guardar')&&cloudSupportCode?' · Soporte: '+cloudSupportCode:'')+cloudSizeNotice;
    if((saveVersion>savedVersion||sessionExpired||pendingCloudOperation)&&!saving&&!operationInFlight){
      const retry=document.createElement('button');retry.type='button';retry.className='lk';retry.textContent=sessionExpired?' · Volver a ingresar':cloudConflict?' · Resolver conflicto':' · Reintentar';
      retry.onclick=()=>{retryCount=0;if(sessionExpired)reconnectCloud();else if(cloudConflict)resolveCloud();else if(pendingCloudOperation)retryCloudOperation();else flush()};status.append(retry);
    }
  }
};
function save(){if(typeof canSave==='function'&&!canSave())return;saveVersion++;retryCount=0;cloudSupportCode='';setSt('Sin guardar · Cambios pendientes');clearTimeout(st);st=setTimeout(flush,1200)}
function exportPending(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='acontec-cambios-pendientes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function reconnectCloud(){
  const email=U.email;
  const recoveryForm=modal(uiT("app.extra.3","La sesión venció"),`<p>${esc(uiT("app.1","Los cambios pendientes siguen en esta pestaña. Ingresa con la misma cuenta para guardarlos. No cierres la pestaña."))}</p><label>${esc(uiT("app.2","Correo"))}<input name="email" type="${U.worker?'text':'email'}" value="${esc(email)}" required></label><label>${esc(uiT("app.3","Contraseña"))}<input name="password" type="password" autocomplete="current-password" required></label>`,async form=>{
    if(v(form,'email').trim().toLowerCase()!==email)return 'Usa la misma cuenta para conservar el acceso a esta empresa.';
    await api(U.worker?'worker-login':'login','POST',U.worker?{username:email,password:v(form,'password')}:{email,password:v(form,'password')});
    const account=await api('me');if(account.user.email!==email)throw new Error(uiT("app.extra.4","Ingresa con la misma cuenta."));
    await api('branch-select','POST',{companyId:CO.id,branchId:CO.branchId||'all'});
    sessionExpired=false;retryCount=0;setTimeout(()=>pendingCloudOperation?retryCloudOperation():flush(),0);
  },'Ingresar y reintentar');
  if(!U.worker&&GID){
    const target=document.createElement('div');recoveryForm.querySelector('.mb').append(target);
    loadGoogle().then(()=>{
      if(!document.contains(target))return;
      google.accounts.id.initialize({client_id:GID,callback:async result=>{
        try{
          await api('google','POST',{credential:result.credential});
          const account=await api('me');
          if(account.user.email!==email)throw new Error(uiT("app.extra.5","Selecciona la misma cuenta para guardar tus cambios."));
          await api('branch-select','POST',{companyId:CO.id,branchId:CO.branchId||'all'});
          sessionExpired=false;retryCount=0;$('#modal').innerHTML='';pendingCloudOperation?retryCloudOperation():flush();
        }catch(error){recoveryForm.querySelector('.err').textContent=error.message}
      }});
      google.accounts.id.renderButton(target,{theme:'outline',size:'large',text:'continue_with',width:280});
    }).catch(()=>{recoveryForm.querySelector('.err').textContent=uiT("app.extra.6","No se pudo cargar Google. Reintenta con tu contraseña.")});
  }
}

function resolveCloud(){
  if(!cloudConflict)return;
  modal(uiT("app.extra.7","Cambios en otra pestaña"),`<p>${esc(uiT("app.4","Otra persona o pestaña modificó los mismos registros. Tu trabajo sigue aquí. Puedes conservar tus registros modificados o descargar una copia antes de usar la versión de la nube."))}</p><label>${esc(uiT("app.5","Cómo continuar"))}<select name="choice"><option value="mine">${esc(uiT("app.6","Conservar mis registros modificados"))}</option><option value="remote">${esc(uiT("app.7","Descargar mi copia y usar la nube"))}</option></select></label>`,async form=>{
    const remote=cloudConflict;
    if(v(form,'choice')==='remote'){exportPending();S=copyCloud(remote.data);savedVersion=saveVersion}
    else S=AcontecSync.apply(remote.data,AcontecSync.diff(cloudBase,S),true).data;
    REV=remote.revision;cloudBase=copyCloud(remote.data);pendingSave=null;cloudConflict=null;retryCount=0;
    if(savedVersion===saveVersion)rememberCloud();shell();view();setTimeout(()=>{if(pendingCloudOperation)setSt('Sin guardar · Reintenta la operación pendiente.');else flush()},0);
  },'Aplicar decisión');
}
async function rebaseCloud(){
  const remote=await api('data?c='+CO.id);
  const applied=AcontecSync.apply(remote.data,AcontecSync.diff(cloudBase,S));
  if(applied.conflicts.length){cloudConflict=remote;setSt('Sin guardar · Los mismos registros cambiaron en otra pestaña. Pulsa Resolver conflicto.');return false}
  S=applied.data;REV=remote.revision;cloudBase=copyCloud(remote.data);pendingSave=null;if(!HOME)view();return true;
}
async function flush(){
  clearTimeout(st);
  if(receiptMutation)await receiptMutation;
  if(saving)return saving;
  if(sessionExpired||cloudConflict||pendingCloudOperation)return false;
  saving=(async()=>{
    while(savedVersion<saveVersion){
      try{
        if(!navigator.onLine){setSt('Sin guardar · Sin conexión. Se reintenta al volver internet.');return false}
        if(!pendingSave){
          const snapshot=copyCloud(S);
          pendingSave={version:saveVersion,snapshot,body:{operationId:crypto.randomUUID(),revision:REV,...(cloudBase?{changes:AcontecSync.diff(cloudBase,snapshot)}:{data:snapshot})}};
        }
        const attempt=pendingSave;
        setSt('Guardando…');
        const result=await api('data?c='+CO.id,'PUT',attempt.body);
        if(!Number.isInteger(result.revision))throw new Error(uiT("app.extra.8","El servidor no confirmó el guardado."));
        const previouslySaved=savedVersion;
        REV=result.revision;savedVersion=attempt.version;cloudBase=copyCloud(attempt.snapshot);pendingSave=null;retryCount=0;cloudSupportCode='';
        if(result.replayed){
          // A newer revision may exist after an acknowledgement was lost.
          try{if(!await rebaseCloud())return false}catch(error){savedVersion=previouslySaved;pendingSave=attempt;throw error}
        }else if(result.data){
          const changes=AcontecSync.diff(attempt.snapshot,S),merged=AcontecSync.apply(result.data,changes);
          if(merged.conflicts.length){cloudConflict={data:result.data,revision:REV};savedVersion=Math.min(savedVersion,saveVersion-1);setSt('Sin guardar · Los mismos registros cambiaron. Pulsa Resolver conflicto.');return false}
          S=merged.data;cloudBase=copyCloud(result.data);
        }
        setSt(savedVersion===saveVersion?'Guardado en la nube':'Sin guardar · Cambios pendientes');
      }catch(error){
        cloudSupportCode=error.supportCode||'';
        if(error.status===409){
          try{if(await rebaseCloud()){if(++retryCount<=6)continue;setSt('Sin guardar · Hay mucha actividad. Pulsa Reintentar.')} }catch(problem){setSt('Sin guardar · No se pudo descargar la versión actual. Reintenta.');st=setTimeout(flush,10000)}
          return false;
        }
        if(error.status===401){sessionExpired=true;setSt('Sin guardar · La sesión venció. Vuelve a ingresar; tus cambios siguen en esta pestaña.');return false}
        if([400,403,413,422].includes(error.status))pendingSave=null;
        setSt('Sin guardar · '+(!navigator.onLine?'Sin conexión.':error.message));
        if((!error.status||[408,429,500,502,503,504].includes(error.status))&&retryCount<6&&navigator.onLine){st=setTimeout(flush,Math.min(60000,1500*2**retryCount++)+Math.random()*1000)}
        return false;
      }
    }
    setSt('Guardado en la nube');
    return true;
  })();
  try{return await saving}finally{saving=null;setSt(saveStatus)}
}

// ---------- tema y arranque ----------
function applyTheme(){const r=document.documentElement.style;r.setProperty('--g',SITE.green||DEF.green);r.setProperty('--gold',SITE.gold||DEF.gold);document.title=SITE.brand||DEF.brand}
let SITE_REV=null;
function contactSection(){
  const contacts=SITE.contacts||{},links=[];
  for(const [key,label] of [['whatsapp','WhatsApp'],['phone','Llamar'],['email','Correo electrónico'],['facebook','Facebook'],['instagram','Instagram'],['website','Sitio web']]){
    const value=contacts[key];if(typeof value!=='string'||!value)continue;
    let href='';
    if(['whatsapp','phone'].includes(key)){
      const digits=value.replace(/\D/g,'');if(!/^[+\d\s().-]+$/.test(value)||!/^\d{7,15}$/.test(digits))continue;
      href=key==='whatsapp'?'https://wa.me/'+digits:'tel:+'+digits;
    }else if(key==='email'){
      if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))continue;href='mailto:'+encodeURIComponent(value);
    }else{
      let link;try{link=new URL(value)}catch{continue}
      if(link.protocol!=='https:'||link.username||link.password||link.port)continue;
      const domain=key==='facebook'?'facebook.com':key==='instagram'?'instagram.com':'';
      if(domain&&link.hostname!==domain&&!link.hostname.endsWith('.'+domain))continue;href=link.href;
    }
    links.push(`<a class="contact-link contact-${key}" href="${esc(href)}" ${href.startsWith('https:')?'target="_blank" rel="noopener noreferrer"':''}>${esc(label)}<span aria-hidden="true">↗</span></a>`);
  }
  return links.length?`<section class="public-contacts" aria-labelledby="contact-heading"><div><span class="access-kicker">${esc(uiT("app.8","HABLEMOS DE TU NEGOCIO"))}</span><h2 id="contact-heading">Contacta con ${esc(SITE.brand)}</h2><p>${esc(uiT("app.9","Estamos a un mensaje de distancia."))}</p></div><nav class="contact-links" aria-label="Canales de contacto">${links.join('')}</nav></section>`:'';
}
function promptResetPassword(token){
  modal(uiT("app.extra.9","Restablecer contraseña"),`<p class="mut">${esc(uiT("app.10","Escribe tu nueva contraseña para ingresar a tu cuenta de Acontec."))}</p><label>${esc(uiT("app.11","Nueva contraseña"))}<input type="password" name="pw1" required minlength="8" maxlength="256" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label><label>${esc(uiT("app.12","Confirmar nueva contraseña"))}<input type="password" name="pw2" required minlength="8" maxlength="256" autocomplete="new-password" placeholder="Repite la contraseña"></label>`,async form=>{
    const p1=v(form,'pw1'),p2=v(form,'pw2');
    if(p1!==p2)return 'Las contraseñas no coinciden.';
    if(p1.length<8)return 'La contraseña debe tener al menos 8 caracteres.';
    const res=await api('reset-password','POST',{token,password:p1});
    await session(res);
  },'Actualizar contraseña');
}
async function boot(){
  let configError='',confirmedEmail='';
  const confirmation=new URLSearchParams(location.hash.slice(1)).get('confirmation_token');
  if(confirmation){history.replaceState(null,'',location.pathname+location.search);try{const result=await api('confirm','POST',{token:confirmation});if(result.confirmed)confirmedEmail=result.email}catch(error){configError=error.message}}
  const hashParams=new URLSearchParams(location.hash.slice(1));
  const searchParams=new URLSearchParams(location.search);
  const recovery=hashParams.get('recovery_token')||searchParams.get('recovery_token')||(hashParams.get('type')==='recovery'?hashParams.get('access_token'):null);
  if(recovery)history.replaceState(null,'',location.pathname);
  try{const config=await api('config');SITE={...DEF,...config.site};SITE_REV=config.siteRevision;UI_CONTENT=config.editor||{texts:{}};window.PUBLIC_PLANS=config.publicPlans||[];GID=config.googleClientId}catch(error){configError='No se pudo conectar con el servicio. Recarga la página para volver a intentar.'}
  applyTheme();
  if(confirmedEmail){U=null;authView();ACT.tab({m:'login'});$('#af [name=em]').value=confirmedEmail;authStatus('Correo confirmado. Ya puedes ingresar','success');return}
  try{const result=await api('me');U=result.user;COS=result.companies;return await openCompany(localStorage.getItem('co')||COS[0]?.id)}catch(error){if(U&&error.status!==401){$('#app').innerHTML=`<main class="auth"><section class="card"><h2>No se pudo abrir tu empresa</h2><p>${esc(error.message)}</p><button class="btn" id="retry-company-open">Reintentar</button></section></main>`;$('#retry-company-open').onclick=()=>boot();return}U=null}
  authView();
  if(configError)authStatus(configError);
  if(recovery)setTimeout(()=>promptResetPassword(recovery),50);
}
let confirmationResend = null,authNoticeVersion=0;
function authStatus(message='',tone='error') {
  const target=$('#auth-status');if(!target)return;
  target.textContent=message;target.dataset.tone=tone;
}
function clearAuthStatus(){authNoticeVersion++;authStatus();confirmationResend=null;const button=$('#resend-confirmation');if(button)button.hidden=true}
async function session(result){if(result.confirmationRequired){ACT.tab({m:'login'});$('#af [name=pw]').value='';authStatus('Cuenta creada. Revisa tu correo (también spam) y abre el enlace de confirmación para ingresar.','success');return}const account=await api('me');U=account.user;COS=account.companies;await openCompany((U.isPlatformAdmin===true&&!U.worker?COS.find(company=>company.owner&&company.isPlatformCompany===true):null)?.id||COS[0]?.id);if(sessionStorage.getItem('edit')){sessionStorage.removeItem('edit');if(U.editor){authView();ACT.gear()}}}
async function openCompany(id){
  if(CO&&!await flush())throw new Error(uiT("app.extra.10","Guarda los cambios pendientes antes de cambiar de empresa."));
  const company=COS.find(item=>item.id==id)||COS[0];
  if(!company){CO=null;S=null;return companyOnboarding();}
  const r=await api('data?c='+company.id);if(!r.data)throw new Error('La empresa no tiene información inicial disponible. El dueño debe abrirla para completar su preparación; después puedes reintentar.');CO=r.company||company;REV=r.revision;saveVersion=0;savedVersion=0;retryCount=0;saveStatus='Guardado en la nube';localStorage.setItem('co',CO.id);
  cloudBase=copyCloud(r.data);pendingSave=null;cloudConflict=null;sessionExpired=false;S=r.data;S.cfg=S.cfg||{cur:'C$'};S.entries=S.entries||[];S.products=S.products||[];S.customers=S.customers||[];
  if(CO.owner&&S.cfg.profilePending)return companyOnboarding(true);
  HOME=false;R=typeof firstAllowedRoute==='function'?firstAllowedRoute():'panel';shell();view();

}
function loadGoogle(){
  if(window.google?.accounts?.id)return Promise.resolve();
  if(!googleScript)googleScript=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=resolve;
    script.onerror=()=>{googleScript=null;script.remove();reject(new Error(uiT("app.extra.12","No se pudo cargar Google. Intenta otra vez o ingresa con tu correo.")))};
    document.head.appendChild(script);
  });
  return googleScript;
}
async function renderGoogle(){
  const form=$('#af'),target=$('#gbtn');
  if(target&&!$('#login-legal-note'))target.insertAdjacentHTML('afterend',`<p id="login-legal-note" class="mut">${esc(uiT("app.13","Al ingresar aceptas los"))} <a href="/terminos" target="_blank" rel="noopener">${esc(uiT("app.14","Términos y Condiciones"))}</a> ${esc(uiT("app.15","y la"))} <a href="/privacidad" target="_blank" rel="noopener">${esc(uiT("app.16","Política de Privacidad"))}</a>.</p>`);
  if(!GID||!form||!target)return;
  try{
    await loadGoogle();
    if(!document.contains(form))return;
    window.google.accounts.id.initialize({client_id:GID,callback:async result=>{
      if(!document.contains(form))return;
      const error=form.querySelector('.err'),button=form.querySelector('#submit-auth');
      error.textContent=uiT("app.extra.13","Conectando con Google…");button.disabled=true;
      try{await session(await api('google','POST',{credential:result.credential}))}
      catch(problem){error.textContent=problem.message}
      finally{if(document.contains(button))button.disabled=false}
    }});
    window.google.accounts.id.renderButton(target,{theme:'outline',size:'large',text:'continue_with',width:280});
  }catch(problem){if(document.contains(form))form.querySelector('.err').textContent=problem.message}
}
function authView(){
  AM='login';HOME=!!U;document.title=SITE.brand||DEF.brand;scrollTo(0,0);const lines=t=>esc(t).replace(/\n/g,'<br>');
  $('#app').innerHTML=`<div class="auth-page"><header class="auth-header"><a class="auth-wordmark" href="/" aria-label="Acontec, inicio"><span class="brand-mark">${SITE.logo?`<img src="${esc(SITE.logo)}" alt="">`:'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 26 15 6h3l9 20M10 18h13M16 6v20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</span>${esc(SITE.brand)}<span class="wordmark-dot">.</span></a><span class="header-note">${esc(SITE.note)}</span></header>
  <main class="auth"><section class="hero-a"><div class="auth-eyebrow"><span></span>${esc(SITE.eyebrow)}</div><h1>${esc(SITE.title||'Tu negocio, en orden.')}</h1><p>${esc(SITE.sub)}</p>
  ${SITE.hero?`<img class="auth-cover" src="${esc(SITE.hero)}" alt="${esc(SITE.brand)}" loading="lazy">`:''}<div class="ledger-art" aria-hidden="true"><div class="ledger-head"><span>${esc(uiT("app.45","CLARIDAD EN CADA MOVIMIENTO"))}</span><svg viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4 8-9" stroke="currentColor" stroke-width="2"/></svg></div><div class="ledger-row"><span>01</span><b>${esc(uiT("app.46","Todo conectado"))}</b><small>${esc(uiT("app.47","Ventas · Compras · Inventario"))}</small></div><div class="ledger-row"><span>02</span><b>${esc(uiT("app.48","Tu propia empresa"))}</b><small>${esc(uiT("app.49","Un espacio privado y organizado"))}</small></div><div class="ledger-row"><span>03</span><b>${esc(uiT("app.50","Siempre disponible"))}</b><small>${esc(uiT("app.51","Tus datos, guardados en la nube"))}</small></div><div class="ledger-foot"><span>${esc(uiT("app.52","CONTABILIDAD CON PERSPECTIVA"))}</span><svg viewBox="0 0 180 42" fill="none"><path d="M1 35 25 31 43 34 64 19 84 23 105 9 127 15 149 5 178 2" stroke="currentColor" stroke-width="2"/></svg></div></div>
  ${SITE.gallery?.length?`<div class="auth-gallery">${SITE.gallery.map(src=>`<img src="${esc(src)}" alt="" loading="lazy">`).join('')}</div>`:''}<div class="auth-caption"><span class="caption-line"></span>${lines(SITE.caption)}</div></section>
  ${U?`<section class="access"><div class="access-heading"><span class="access-kicker">${esc(uiT("app.18","SESIÓN INICIADA"))}</span><h2>${esc(uiT("app.19","Página principal"))}</h2><p>${esc(U.email)}</p></div><div class="card">${COS.map(c=>`<button type="button" class="btn ghost full" style="margin-bottom:8px" data-a="opencomp" data-id="${esc(c.id)}">🏢 ${esc(c.name)}${c.testPlan?` <small>· Prueba interna · ${esc(c.testPlan)}</small>`:''}</button>`).join('')}${U.editor?`<button type="button" class="btn full home-edit" data-a="gear">${esc(uiT("app.17","✏️ Editar página principal"))}</button>`:''}${CO?`<button type="button" class="btn full" data-a="accountingPanel">Volver al panel de contabilidad de ${esc(CO.name)}</button>`:''}<p class="mut home-save-status" role="status" aria-live="polite"></p><button type="button" class="btn ghost full" style="margin-top:8px" data-a="logout">${esc(uiT("app.20","🚪 Salir"))}</button></div></section>`:`<section class="access"><div class="access-heading"><span class="access-kicker">${esc(uiT("app.24","TU ESPACIO CONTABLE"))}</span><h2>${esc(uiT("app.25","Qué bueno verte."))}</h2><p>${esc(uiT("app.26","Ingresa y continúa donde lo dejaste."))}</p></div><form id="af" class="card"><div class="tabs"><button type="button" data-a="tab" data-m="login" class="on">${esc(uiT("app.27","Ingresar"))}</button><button type="button" data-a="tab" data-m="reg">${esc(uiT("app.28","Crear cuenta"))}</button></div>
  <p id="auth-help" class="mut">${esc(uiT("app.29","¿Es tu primer acceso?"))} <button type="button" class="lk" data-a="tab" data-m="reg">${esc(uiT("app.30","Crea tu cuenta de cliente"))}</button> ${esc(uiT("app.31","antes de ingresar."))}</p>
  <label>${esc(uiT("app.32","Correo electrónico"))}<input type="email" name="em" required autocomplete="email" placeholder="tu@empresa.com"></label>
  <label>${esc(uiT("app.33","Contraseña"))}<input type="password" name="pw" required minlength="1" maxlength="256" autocomplete="current-password" placeholder="Tu contraseña"></label>
  <div id="auth-forgot" class="auth-forgot"><button type="button" class="lk" data-a="forgotPassword">${esc(uiT("app.34","¿Olvidaste tu contraseña?"))}</button></div>
  <div class="reg" hidden>${companyFields()}</div>
  <div id="auth-status" class="err" role="status" aria-live="polite" aria-atomic="true"></div><button type="button" class="lk auth-resend" id="resend-confirmation" data-a="resendConfirmation" hidden>${esc(uiT("app.39","Reenviar correo de confirmación"))}</button><button type="submit" class="btn full" id="submit-auth" aria-describedby="auth-status">${esc(uiT("app.40","Ingresar"))} <span aria-hidden="true">→</span></button><div class="or">${esc(uiT("app.41","o continúa con"))}</div><div id="gbtn"><button type="button" class="btn ghost full" data-a="google" ${GID?'':'disabled aria-describedby="google-help"'}><b class="google-letter">${esc(uiT("app.42","G"))}</b> ${esc(uiT("app.43","Continuar con Google"))}</button></div>${GID?'':`<p id="google-help" class="mut">${esc(uiT("app.21","Google requiere autorizar este sitio una sola vez."))} <a href="/configurar-google.html">${esc(uiT("app.22","Guía paso a paso para activarlo"))}</a>${esc(uiT("app.23",". Mientras tanto, puedes crear tu cuenta con correo y contraseña."))}</p>`}</form><p class="access-note"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.5"/></svg> ${esc(uiT("app.44","Tu información es privada. Solo tú accedes a tu empresa."))}</p></section>`}</main>${contactSection()}<footer class="auth-footer"><span>${esc(SITE.brand)} · ${esc(SITE.tagline)}</span><span>${esc(SITE.footer)}</span>${U?.editor?`<button type="button" class="footer-settings" data-a="gear" aria-label="Editar página principal de Acontec" title="Editar textos, información, imágenes y logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 3-.7 2.1-2.1 1.2-2.2-.4-2 3.4 1.5 1.7v2L2 14.7l2 3.4 2.2-.4 2.1 1.2L9 21h4l.7-2.1 2.1-1.2 2.2.4 2-3.4-1.5-1.7v-2L20 9.3l-2-3.4-2.2.4-2.1-1.2L13 3Z"/><circle cx="11" cy="12" r="3"/></svg></button>`:''}</footer></div>`;
  if(U)return;
  clearAuthStatus();
  $('#af').addEventListener('input',clearAuthStatus);
  $('#af').addEventListener('invalid',event=>{authStatus(event.target.validationMessage)},true);
  $('#af').onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget,fields=form.elements,button=form.querySelector('#submit-auth'),mode=AM;
    if(button.disabled||!form.reportValidity())return;
    clearAuthStatus();const noticeVersion=authNoticeVersion;button.disabled=true;form.setAttribute('aria-busy','true');
    const controls=[...form.querySelectorAll('[data-a="tab"]')];controls.forEach(control=>control.disabled=true);
    button.textContent=mode==='reg'?'Creando cuenta…':'Ingresando…';
    try{
      const result=await api(mode==='login'?'login':'register','POST',{email:fields.em.value,password:fields.pw.value,company:fields.co.value,cur:fields.cur.value,ruc:fields.ruc.value,description:fields.description?.value||'',country:fields.country?.value||'Nicaragua',businessType:fields.businessType?.value||'comercio'});
      form.removeAttribute('aria-busy');
      if(result.confirmationRequired&&noticeVersion!==authNoticeVersion)return;
      await session(result);
    }catch(problem){
      if(noticeVersion!==authNoticeVersion)return;
      authStatus(problem.status?problem.message:(mode==='reg'?'No se pudo crear la cuenta. Revisa tu conexión e inténtalo de nuevo.':'No se pudo ingresar. Revisa tu conexión e inténtalo de nuevo.'));
      if(mode==='login'&&problem.code==='EMAIL_UNCONFIRMED'&&problem.confirmationGrant){confirmationResend={email:fields.em.value,grant:problem.confirmationGrant};$('#resend-confirmation').hidden=false}
    }finally{
      button.disabled=false;form.removeAttribute('aria-busy');controls.forEach(control=>control.disabled=false);
      button.innerHTML=(AM==='login'?'Ingresar':'Crear cuenta')+' <span aria-hidden="true">→</span>';
    }
  };
  if(GID)renderGoogle();
}

function companyFields(existing={}){
 return `<label>Nombre de tu empresa<input name="co" value="${esc(existing.name||'')}" maxlength="80" autocomplete="organization"></label><label>Modelo de negocio<select name="businessType">${AcontecProfiles.profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===existing.businessType?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>País<input name="country" value="${esc(existing.country||'')}" maxlength="80"></label><label>Moneda<input name="cur" value="${esc(existing.cur||'C$')}" maxlength="20"></label><label>RUC / identificación<input name="ruc" value="${esc(existing.ruc||'')}" maxlength="100"></label>`;
}
function companyOnboarding(pending=false){
 HOME=false;const current=pending?{name:CO.name,businessType:CO.businessType,country:S.cfg.invoiceCountry,cur:S.cfg.cur,ruc:S.cfg.ruc}:{};
 $('#app').innerHTML=`<main class="auth"><section class="access"><h2>Completa tu empresa</h2><p>${esc(U.name||U.email)}</p><p>Confirma los datos para empezar. ${pending?'Los datos existentes se conservan.':'Tu empresa se crea al confirmar.'}</p><form id="company-onboarding" class="card">${companyFields(current)}<p class="err" role="alert"></p><button class="btn" type="submit">Confirmar empresa</button></form></section></main>`;
 const form=$('#company-onboarding');for(const key of ['co','businessType','country','cur'])form.elements[key].required=true;
 form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
 const body={name:v(form,'co'),businessType:v(form,'businessType'),country:v(form,'country'),cur:v(form,'cur'),ruc:v(form,'ruc')};
 try{if(pending){await operate('completeProfile',{...body,confirmed:true});if(S.cfg.profileChartPreserved)alert('El modelo se guardó. Se conservó el plan de cuentas porque hay movimientos o registros. Verifica con tu contador.');}
 else{const result=await api('first-company','POST',body);COS=result.companies;}
 await openCompany(CO?.id||COS[0]?.id);
 }catch(error){form.querySelector('.err').textContent=error.message+' Puedes reintentar de forma segura.';button.disabled=false;}};
}

// ---------- estructura ----------
const MENU=[['Principal',[['panel','🏠',uiT("app.extra.14","Panel")],['ventas','🛒',uiT("app.extra.15","Ventas")],['compras','📦',uiT("app.extra.16","Compras")],['gastos','💸',uiT("app.extra.17","Gastos")],['productos','🏷️',uiT("app.extra.18","Productos e inventario")]]],
['Contabilidad',[['apertura','📘',uiT("app.extra.19","Asiento de apertura")],['diario','📒',uiT("app.extra.20","Libro diario")],['mayor','📑',uiT("app.extra.21","Libro mayor")],['cuentas','🗂️',uiT("app.extra.22","Catálogo de cuentas")]]],
['Estados financieros',[['balanza','⚖️',uiT("app.extra.23","Balanza de comprobación")],['resultados','📈',uiT("app.extra.24","Estado de resultados")],['balance','🧾',uiT("app.extra.25","Balance general")],['flujo','💧',uiT("app.extra.26","Flujo de efectivo")]]],
['Cuenta',[['ajustes','⚙️',uiT("app.extra.27","Ajustes y respaldo")]]]];
function shell(){document.title=CO.name+' · Contabilidad';
  $('#app').innerHTML=`<header class="top"><button class="ib" data-a="menu" aria-label="Menú">☰</button><div class="brand"><span class="logo">${esc((CO.name.trim().charAt(0)||'C').toUpperCase())}</span><b>${esc(CO.name)}</b></div><div class="co">${esc(U.name||U.email)} · ${esc(CO.role||'Dueño')}<br><span id="st" class="st"></span></div></header>
  <nav id="drawer" class="drawer"></nav><div id="ov" class="ov" data-a="menu"></div><main id="main"></main><nav id="bnav" class="bnav"></nav>`;
  $('#st').setAttribute('role','status');$('#st').setAttribute('aria-live','polite');setSt(saveStatus);
}
function chrome(){
  $('#drawer').innerHTML=MENU.map(([g,l])=>[g,l.filter(([route])=>typeof routeAllowed!=='function'||routeAllowed(route))]).filter(([,list])=>list.length).map(([g,l])=>`<h4>${g}</h4>`+l.map(([r,i,n])=>`<button data-a="nav" data-r="${r}" class="${R==r?'on':''}"><span>${i}</span>${esc(SITE.moduleLabels?.[r]||n)}</button>`).join('')).join('')+
   (U.admin&&CO.isPlatformCompany?`<h4>${esc(uiT("app.54","Acontec"))}</h4>${isAcontecCompany()?`<button data-a="home"><span>🌐</span>${esc(uiT("app.53","Página principal de Acontec"))}</button>`:''}<button data-a="nav" data-r="administracion" class="${R=='administracion'?'on':''}"><span>👤</span>${esc(uiT("app.55","Administración de clientes"))}</button>`:'')+
   `<div class="bot">${R=='pagina'?`<button data-a="nav" data-r="panel"><span>🏢</span>${esc(uiT("app.56","Volver a mi negocio"))}</button>`:''}<button data-a="switch"><span>🏢</span>${esc(uiT("app.57","Cambiar o crear empresa"))}</button><button class="out" data-a="logout"><span>🚪</span>${esc(uiT("app.58","Salir"))}</button></div>`;
  $('#bnav').innerHTML=[['panel','🏠',uiT("app.extra.28","Panel")],['ventas','🛒',uiT("app.extra.29","Ventas")],['compras','📦',uiT("app.extra.30","Compras")],['productos','🏷️',uiT("app.extra.31","Productos")]].filter(([route])=>typeof routeAllowed!=='function'||routeAllowed(route)).map(([r,i,n])=>`<button data-a="nav" data-r="${r}" class="${R==r?'on':''}"><span>${i}</span>${esc(SITE.moduleLabels?.[r]||n)}</button>`).join('')+`<button data-a="menu"><span>☰</span>${esc(uiT("app.59","Menú"))}</button>`;
}
const main=h=>{$('#main').innerHTML=h};
const V={};
function view(){if(typeof routeAllowed==='function'&&!routeAllowed(R))R=firstAllowedRoute();if(typeof prepareAccounting==='function')prepareAccounting();chrome();V[R]();if(typeof enforceAccessUI==='function')enforceAccessUI()}
const menu=o=>{$('#drawer').classList.toggle('open',o);$('#ov').classList.toggle('show',o)};

// ---------- periodos ----------
function rg(){const n=new Date(),y=n.getFullYear(),m=n.getMonth();
  switch(P.k){case'dia':return[today(),today()];
  case'sem':{const a=new Date(n);a.setDate(n.getDate()-((n.getDay()+6)%7));const b=new Date(a);b.setDate(a.getDate()+6);return[iso(a),iso(b)]}
  case'mes':return[iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];
  case'anio':return[y+'-01-01',y+'-12-31'];
  case'todo':return['0000-01-01','9999-12-31'];
  default:return[P.from||'0000-01-01',P.to||'9999-12-31']}}
const pbar=()=>`<div class="seg noprint">${[['dia','Diario'],['sem','Semanal'],['mes','Mensual'],['anio','Anual'],['todo','Todo'],['rango','Rango']].map(([k,l])=>`<button data-a="per" data-k="${k}" class="${P.k==k?'on':''}">${l}</button>`).join('')}</div>${P.k=='rango'?`<div class="rg noprint"><input type="date" id="pf" value="${P.from}"><input type="date" id="pt" value="${P.to}"></div>`:''}`;
const plabel=()=>{const[f,t]=rg();return P.k=='todo'?'Todo el historial':`Del ${f} al ${t}`};
const rh=(t,sub)=>`<div class="rh"><h2>${esc(S.cfg.name||CO.name)}</h2><b>${t}</b><p>${sub}</p>${S.cfg.ruc?`<p>RUC: ${esc(S.cfg.ruc)}</p>`:''}</div>`;
const pbtn=()=>`<button class="btn ghost noprint" data-a="print">${esc(uiT("app.60","🖨️ Imprimir / PDF"))}</button>`;

// ---------- cálculos ----------
function bal(f,t,excludeClosing=false){const r={};S.accounts.forEach(a=>r[a.code]={...a,d:0,c:0});
  AcontecAnnualLedger.select(S.entries,t).forEach(e=>{if(e.date>t||e.date<f||(excludeClosing&&['cierre','cierre-anual','reapertura-anual'].includes(e.type)))return;e.lines.forEach(l=>{const a=r[l.a];if(a){a.d+=+l.d||0;a.c+=+l.c||0}})});
  Object.values(r).forEach(a=>a.s=a.nat=='D'?a.d-a.c:a.c-a.d);return r}
const sg=a=>a.nat==NAT[a.tipo]?a.s:-a.s;
const tot=(B,tipo)=>Object.values(B).filter(a=>a.tipo==tipo).reduce((s,a)=>s+sg(a),0);
const accName=c=>{const a=S.accounts.find(x=>x.code==c);return a?`${a.code} · ${a.name}`:c};
const prod=id=>S.products.find(p=>p.id==id);
function flujo(f,t){
  const cash=new Set(S.accounts.filter(a=>a.sub=='ef').map(a=>a.code));let ini=0;const sec={op:{},inv:{},fin:{}};
  AcontecAnnualLedger.select(S.entries,t).forEach(e=>{const cl=e.lines.filter(l=>cash.has(l.a));if(!cl.length||e.date>t)return;
    const net=cl.reduce((s,l)=>s+(+l.d||0)-(+l.c||0),0);
    if(['apertura','apertura-importada','anula-apertura','apertura-anual'].includes(e.type)||e.date<f){ini+=net;return}
    e.lines.filter(l=>!cash.has(l.a)).forEach(l=>{const a=S.accounts.find(x=>x.code==l.a);if(!a)return;
      const k=a.sub=='fijo'?'inv':(a.sub=='fin'||a.tipo=='patrimonio')?'fin':'op';
      const eff=(+l.c||0)-(+l.d||0);sec[k][a.name]=(sec[k][a.name]||0)+eff})});
  return{ini,sec}}

// ---------- utilidades UI ----------
function modal(title,body,ok,label='Guardar'){
  $('#modal').innerHTML=`<div class="mo"><form class="md" autocomplete="off"><div class="mh"><h3>${title}</h3><button type="button" class="ib" data-a="close">✕</button></div><div class="mb">${body}</div><div class="err"></div><div class="mf"><button type="button" class="btn ghost" data-a="close">${esc(uiT("app.61","Cancelar"))}</button><button class="btn">${label}</button></div></form></div>`;
  const f=$('#modal form');
  f.onsubmit=async ev=>{ev.preventDefault();const button=f.querySelector('.mf button:last-child');if(button.disabled)return;button.disabled=true;try{const er=await ok(f);if(er){f.querySelector('.err').textContent=er;return}$('#modal').innerHTML=''}catch(x){f.querySelector('.err').textContent=x.message}finally{button.disabled=false}};
  return f}
const v=(f,n)=>f.elements[n].value;
const accOpts=(sel,flt=()=>true)=>S.accounts.filter(flt).sort(byCode).map(a=>`<option value="${esc(a.code)}" ${a.code==sel?'selected':''}>${esc(a.code)} · ${esc(a.name)}</option>`).join('');
const payOpts=cr=>`<option value="1101">${esc(uiT("app.62","Contado - Caja"))}</option><option value="1102">${esc(uiT("app.63","Contado - Banco"))}</option><option value="${cr}">${esc(uiT("app.64","Crédito"))}</option>`;
const itemRow=(item={},removable=false)=>`<div class="row item"><select name="p" aria-label="Producto" required><option value="">${esc(uiT("app.66","Producto…"))}</option>${S.products.map(p=>`<option value="${esc(p.id)}" data-pr="${esc(p.price)}" data-co="${esc(p.cost)}" data-vat="${esc(p.vatRate||0)}" ${p.id==item.p?'selected':''}>${esc(p.name)} · ${esc(p.unit||'unidad')} (${p.stock})</option>`).join('')}</select><input name="q" aria-label="Cantidad" type="text" inputmode="decimal" data-decimal autocomplete="off" required placeholder="Cantidad" value="${esc(item.q??'')}"><input name="u" aria-label="Precio sin IVA" type="number" step="0.01" min="0" required placeholder="Precio sin IVA" value="${esc(item.u??'')}"><label class="ck"><input name="taxed" type="checkbox" ${item.vatRate?'checked':''}> ${esc(uiT("app.67","IVA"))}</label><input name="vatRate" aria-label="IVA %" type="number" step="0.01" min="0" max="100" value="${esc(item.vatRate??S.cfg.print?.fiscalProfile?.taxRate??S.cfg.fiscal?.vatRate??AcontecInvoiceDesign.profile(S.cfg.invoiceCountry).taxRate)}">${removable?`<button type="button" class="lk" data-a="removeItem">${esc(uiT("app.65","Quitar producto"))}</button>`:''}</div>`;
function printRcpt(e){const rows=(e.items||[]).map(i=>`<tr><td>${esc(prod(i.p)?.name||'Producto')}</td><td class="n">${esc(formatQuantity(i.q))}</td><td class="n">${money(i.u)}</td><td class="n">${money(r2(i.q*i.u))}</td></tr>`).join('');
  document.querySelector('#rcpt')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="rcpt">${rh('Comprobante de venta',esc(e.date))}<p><b>${esc(uiT("app.68","Cliente:"))}</b> ${esc(e.party||'Cliente general')}<br><b>${esc(uiT("app.69","Forma de pago:"))}</b> ${esc(PAY[e.pay]||'')}</p><table><thead><tr><th>${esc(uiT("app.70","Producto"))}</th><th class="n">${esc(uiT("app.71","Cant."))}</th><th class="n">${esc(uiT("app.72","Precio"))}</th><th class="n">${esc(uiT("app.73","Importe"))}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">${esc(uiT("app.74","Total"))}</th><th class="n">${money(e.total)}</th></tr></tfoot></table><p class="mut">${esc(uiT("app.75","Gracias por su compra"))}</p></div>`);
  document.body.classList.add('rc');const done=()=>{document.body.classList.remove('rc');document.querySelector('#rcpt')?.remove();removeEventListener('afterprint',done)};addEventListener('afterprint',done);print()}
const readItems=f=>$$('#modal .item').map(r=>({p:r.querySelector('[name=p]').value,unit:prod(r.querySelector('[name=p]').value)?.unit||'unidad',q:inputQuantity(r.querySelector('[name=q]').value),u:+r.querySelector('[name=u]').value,vatRate:r.querySelector('[name=taxed]')?.checked?+r.querySelector('[name=vatRate]').value:0}));
const lineRow=(l={})=>`<div class="row ln"><select name="a"><option value="">${esc(uiT("app.76","Cuenta…"))}</option>${accOpts(l.a)}</select><input name="d" type="number" step="0.01" min="0" placeholder="Debe" value="${l.d||''}"><input name="c" type="number" step="0.01" min="0" placeholder="Haber" value="${l.c||''}"></div>`;
const readLines=()=>$$('#modal .ln').map(r=>({a:r.querySelector('[name=a]').value,d:r2(r.querySelector('[name=d]').value),c:r2(r.querySelector('[name=c]').value)})).filter(l=>l.a&&(l.d||l.c));
function sumTot(){const t=$('#modal .tot');if(!t)return;const L=readLines(),D=r2(L.reduce((s,l)=>s+l.d,0)),C=r2(L.reduce((s,l)=>s+l.c,0));t.innerHTML=`Debe: <b>${money(D)}</b> ${esc(uiT("app.77","· Haber:"))} <b>${money(C)}</b> · <span class="${D==C&&D>0?'ok':'bad'}">${D==C&&D>0?'Cuadrado ✓':'Diferencia '+money(Math.abs(D-C))}</span>`}
function addEntry(e){e.id=uid();S.entries.push(e);(e.stock||[]).forEach(s=>{const p=prod(s.pid);if(p)p.stock=quantityRound(p.stock+s.q)});save()}
function delEntry(id){const e=S.entries.find(x=>x.id==id);if(!e)return;(e.stock||[]).forEach(s=>{const p=prod(s.pid);if(p)p.stock=quantityRound(p.stock-s.q)});S.entries=S.entries.filter(x=>x.id!=id);save()}

// ---------- vistas ----------
V.panel=()=>{const[f,t]=rg(),B=bal(f,t),C=bal('0000',t);
  const acontec=COS.find(company=>company.owner&&company.name.trim().toLowerCase()==='acontec'&&company.id!==CO.id);
  const comp=S.entries.filter(e=>e.type=='compra'&&e.date>=f&&e.date<=t).reduce((s,e)=>s+(e.total||0),0);
  const ing=tot(B,'ingreso'),cos=tot(B,'costo'),gas=tot(B,'gasto');
  const efe=Object.values(C).filter(a=>a.sub=='ef').reduce((s,a)=>s+sg(a),0);
  const k=(l,x,c='')=>`<div class="card kpi"><small>${l}</small><b class="${c}">${money(x)}</b></div>`;
  const low=S.products.filter(p=>p.stock<=p.min);
  main(`<section class="hero" ${SITE.hero?`style="background-image:url('${SITE.hero.replace(/'/g,'%27')}')"`:''}><small>${esc(SITE.eyebrow)}</small><h1>${esc(CO.name)}</h1>${(SITE.panelTitle??SITE.title)?`<h3>${esc(SITE.panelTitle??SITE.title)}</h3>`:''}<p>${esc(SITE.panelDescription??SITE.sub)}</p><button class="btn gold" data-a="venta">${esc(uiT("app.80","Registrar venta →"))}</button> <button class="btn ghost" data-a="nav" data-r="resultados">${esc(uiT("app.81","Ver estados financieros"))}</button>${isAcontecCompany()?`<button type="button" class="btn ghost" data-a="home">${esc(uiT("app.78","Página principal de Acontec →"))}</button>`:''}${U.worker?'':` <button type="button" class="btn ghost" data-a="${acontec?'opencomp':'switch'}"${acontec?` data-id="${esc(acontec.id)}"`:''}>🏢 ${acontec?'Intercambiar a Acontec':'Intercambiar empresa'}</button>`}</section>
  <h2 style="margin-bottom:10px">${esc(uiT("app.82","Resumen del periodo"))}</h2>${pbar()}
  <div class="grid">${k('Ventas',tot(B,'ingreso')&&B['4101']?sg(B['4101']):0)}${k('Compras',comp)}${k('Gastos',gas)}${k('Utilidad neta',ing-cos-gas,ing-cos-gas<0?'bad':'ok')}${k('Efectivo disponible',efe)}${k('Inventario',C['1301']?sg(C['1301']):0)}${k('Por cobrar',C['1201']?sg(C['1201']):0)}${k('Por pagar',C['2101']?sg(C['2101']):0)}</div>
  ${low.length?`<div class="card"><b>${esc(uiT("app.79","⚠️ Stock bajo"))}</b><p class="mut" style="margin:6px 0 0">${low.map(p=>`${esc(p.name)} · ${esc(p.unit||'unidad')} (${p.stock})`).join(' · ')}</p></div>`:''}
  <div class="grid" style="margin-top:14px"><button class="btn" data-a="compra">${esc(uiT("app.83","+ Compra"))}</button><button class="btn" data-a="gasto">${esc(uiT("app.84","+ Gasto"))}</button><button class="btn" data-a="manual">${esc(uiT("app.85","+ Asiento"))}</button><button class="btn ghost" data-a="newprod">${esc(uiT("app.86","+ Producto"))}</button></div>`)};

function listV(type,title,cta,act,extra=''){const[f,t]=rg(),L=S.entries.filter(e=>e.type==type&&e.date>=f&&e.date<=t).sort((a,b)=>b.date.localeCompare(a.date));
  main(`<div class="ph"><h2>${title}</h2><button class="btn" data-a="${act}">${cta}</button></div>${extra}${pbar()}<div class="card"><div class="tw"><table><thead><tr><th>${esc(uiT("app.91","Fecha"))}</th><th>${esc(uiT("app.92","Detalle"))}</th><th>${esc(uiT("app.93","Pago"))}</th><th class="n">${esc(uiT("app.94","Total"))}</th><th></th></tr></thead><tbody>${L.map(e=>`<tr><td>${e.date}</td><td>${esc(e.party||e.desc)}</td><td>${PAY[e.pay]||''}</td><td class="n">${money(e.total)}</td><td>${type=='venta'&&e.items?.length?`<button class="lk" data-a="printEntry" data-id="${e.id}">${esc(uiT("app.87","Imprimir"))}</button> `:''}${entryCorrectionButton(e)}</td></tr>`).join('')||`<tr><td colspan="5" class="mut">${esc(uiT("app.90","Sin registros en el periodo"))}</td></tr>`}</tbody></table></div><p class="tt">${esc(uiT("app.95","Total:"))} <b>${money(L.reduce((s,e)=>s+(e.total||0),0))}</b></p></div>`)}
V.ventas=()=>listV('venta','Ventas','+ Nueva venta','venta',`<p><button class="lk" data-a="cobro">${esc(uiT("app.96","Registrar cobro de cliente"))}</button></p>`);
V.compras=()=>listV('compra','Compras','+ Nueva compra','compra',`<p><button class="lk" data-a="pago">${esc(uiT("app.97","Registrar pago a proveedor"))}</button></p>`);
V.gastos=()=>listV('gasto','Gastos','+ Nuevo gasto','gasto');

V.productos=()=>{main(`<div class="ph"><h2>${esc(uiT("app.102","Productos e inventario"))}</h2><button class="btn" data-a="newprod">${esc(uiT("app.103","+ Producto"))}</button></div><div class="card"><div class="tw"><table><thead><tr><th>${esc(uiT("app.104","Código"))}</th><th>${esc(uiT("app.105","Producto"))}</th><th>${esc(uiT("app.106","Unidad"))}</th><th class="n">${esc(uiT("app.107","Costo"))}</th><th class="n">${esc(uiT("app.108","Precio"))}</th><th class="n">${esc(uiT("app.109","Existencia"))}</th><th class="n">${esc(uiT("app.110","Valor"))}</th><th></th></tr></thead><tbody>${S.products.map(p=>`<tr><td>${esc(p.code)}</td><td>${esc(p.name)}${p.stock<=p.min?' ⚠️':''}</td><td>${esc(p.unit||'unidad')}</td><td class="n">${money(p.cost)}</td><td class="n">${money(p.price)}</td><td class="n">${p.stock}</td><td class="n">${money(p.stock*p.cost)}</td><td><button class="lk" data-a="editprod" data-id="${p.id}">${esc(uiT("app.98","Editar"))}</button> <button class="lk" data-a="ajuste" data-id="${p.id}">${esc(uiT("app.99","Ajustar"))}</button> <button class="lk" data-a="delprod" data-id="${p.id}">${esc(uiT("app.100","Borrar"))}</button></td></tr>`).join('')||`<tr><td colspan="8" class="mut">${esc(uiT("app.101","Aún no hay productos"))}</td></tr>`}</tbody><tfoot><tr><th colspan="6">${esc(uiT("app.111","Inventario valorizado"))}</th><th class="n">${money(S.products.reduce((s,p)=>s+p.stock*p.cost,0))}</th><th></th></tr></tfoot></table></div></div>`)};

const entryIsAnnulled=e=>S.entries.some(r=>r.reversalOf===e.id);
const entryCorrectionStatus=e=>entryIsAnnulled(e)?uiT('corrections.statusAnnulled','Anulado'):e.correctionOf?uiT('corrections.statusCorrected','Corregido'):uiT('corrections.statusRegistered','Registrada');
function entryCorrectionButton(e){
 const reversal=S.entries.find(r=>r.reversalOf===e.id),corrected=S.entries.find(r=>r.correctionOf===e.id);
 if(reversal||e.reversalOf){
  const related=`<button class="lk correction-target" data-a="correctionDetail" data-id="${esc(corrected?.id||reversal?.id||e.reversalOf)}">${esc(corrected?uiT("corrections.corrected","Corregido / ver asiento relacionado"):uiT("corrections.related","Anulado / ver asiento relacionado"))}</button>`;
  const again=typeof canRegisterAgain==='function'&&canRegisterAgain(e);
  const reason=!corrected&&!again&&typeof correctionBlockReason==='function'?(correctionBlockReason(e,{again:true})||(!['gasto','compra','manual','abono'].includes(e.type)?uiT('corrections.origin','Anula y registra de nuevo desde el módulo de origen.') :'')):'';
  return related+(again?` <button class="lk correction-target" data-a="registerAgain" data-id="${esc(e.id)}">${esc(uiT('corrections.again','Registrar de nuevo'))}</button>`:reason?`<small class="ledger-sub">${esc(reason)}</small>`:'');
 }
 const reason=typeof correctionBlockReason==='function'?correctionBlockReason(e):'';
 if(reason)return `<small class="ledger-sub">${esc(reason)}</small>`;
 return `<button class="btn ghost correction-target" data-a="correctEntry" data-id="${esc(e.id)}">${esc(uiT("corrections.correct","Corregir / Anular"))}</button>`;
}
const entryCard=(e,del)=>`<div class="card ${entryIsAnnulled(e)?'entry-annulled':''}"><div class="entry-card-heading"><div><b>${esc(e.date)}</b> · ${esc(e.desc)}<small class="ledger-sub">${esc(entryCorrectionStatus(e))} · Sucursal: ${esc((CO.branches||[]).find(b=>b.id===(e.branchId||'principal'))?.name||'Principal')}</small></div><div class="entry-correction-actions">${del||typeof canRegisterAgain==='function'&&canRegisterAgain(e)?entryCorrectionButton(e):''}</div></div><div class="tw"><table><tbody>${e.lines.map(l=>`<tr><td>${esc(accName(l.a))}</td><td class="n">${l.d?money(l.d):''}</td><td class="n">${l.c?money(l.c):''}</td></tr>`).join('')}</tbody></table></div></div>`;
V.apertura=()=>{const e=S.entries.find(x=>['apertura','apertura-importada'].includes(x.type)&&!S.entries.some(r=>r.reversalOf===x.id))||S.entries.filter(x=>['apertura','apertura-importada'].includes(x.type)).at(-1);main(`<div class="ph"><h2>${esc(uiT("app.114","Asiento de apertura"))}</h2>${e&&!entryIsAnnulled(e)?entryCorrectionButton(e):`${e?entryCorrectionButton(e):''}<button class="btn" data-a="apertura">${esc(uiT("corrections.createOpening","Crear apertura"))}</button>`}</div><p class="mut">${esc(uiT("app.115","Registra los saldos con los que inicia tu contabilidad (efectivo, bancos, activos, deudas y capital). El inventario inicial se registra desde Productos con su existencia inicial."))}</p>${e?entryCard(e,false):`<div class="card mut">${esc(uiT("app.113","Aún no hay asiento de apertura."))}</div>`}`)};
V.diario=()=>{const[f,t]=rg(),L=S.entries.filter(e=>e.date>=f&&e.date<=t).sort((a,b)=>b.date.localeCompare(a.date));main(`<div class="ph"><h2>${esc(uiT("app.117","Libro diario"))}</h2><button class="btn" data-a="manual">${esc(uiT("app.118","+ Asiento"))}</button></div>${pbar()}${L.map(e=>entryCard(e,true)).join('')||`<div class="card mut">${esc(uiT("app.116","Sin asientos en el periodo"))}</div>`}`)};
V.mayor=()=>{const[f,t]=rg(),a=S.accounts.find(x=>x.code==MAY)||S.accounts[0],k=a.nat=='D'?1:-1;let run=0;const rows=[];
  AcontecAnnualLedger.select(S.entries,t).slice().sort((x,y)=>x.date.localeCompare(y.date)).forEach(e=>e.lines.forEach(l=>{if(l.a!=a.code||e.date>t)return;run+=((+l.d||0)-(+l.c||0))*k;if(e.date>=f)rows.push(`<tr><td>${e.date}</td><td>${esc(e.desc)}</td><td class="n">${l.d?money2(l.d):''}</td><td class="n">${l.c?money2(l.c):''}</td><td class="n">${money2(run)}</td></tr>`)}));
  main(`<div class="ph"><h2>${esc(uiT("app.120","Libro mayor"))}</h2>${pbtn()}</div><label class="noprint">${esc(uiT("app.121","Cuenta"))}<select id="msel">${accOpts(a.code)}</select></label>${pbar()}<div class="card">${rh('Libro mayor · '+esc(a.name),plabel())}<div class="tw"><table><thead><tr><th>${esc(uiT("app.122","Fecha"))}</th><th>${esc(uiT("app.123","Descripción"))}</th><th class="n">${esc(uiT("app.124","Debe"))}</th><th class="n">${esc(uiT("app.125","Haber"))}</th><th class="n">${esc(uiT("app.126","Saldo"))}</th></tr></thead><tbody>${rows.join('')||`<tr><td colspan="5" class="mut">${esc(uiT("app.119","Sin movimientos"))}</td></tr>`}</tbody></table></div></div>`)};
V.cuentas=()=>{main(`<div class="ph"><h2>${esc(uiT("app.128","Catálogo de cuentas"))}</h2><button class="btn" data-a="newacc">${esc(uiT("app.129","+ Cuenta"))}</button></div><div class="card"><div class="tw"><table><thead><tr><th>${esc(uiT("app.130","Código"))}</th><th>${esc(uiT("app.131","Nombre"))}</th><th>${esc(uiT("app.132","Tipo"))}</th><th></th></tr></thead><tbody>${S.accounts.slice().sort(byCode).map(a=>`<tr><td>${a.code}</td><td>${esc(a.name)}</td><td>${a.tipo}${a.nat!=NAT[a.tipo]?' (contra)':''}</td><td>${PROT.includes(a.code)?'':`<button class="lk" data-a="delacc" data-c="${a.code}">${esc(uiT("app.127","Borrar"))}</button>`}</td></tr>`).join('')}</tbody></table></div></div>`)};

V.balanza=()=>{const[,t]=rg(),B=Object.values(bal('0000',t)).filter(a=>a.d||a.c).sort(byCode);let D=0,C=0,SD=0,SA=0;
  const rows=B.map(a=>{const n=a.d-a.c,sd=n>0?n:0,sa=n<0?-n:0;D+=a.d;C+=a.c;SD+=sd;SA+=sa;return`<tr><td>${a.code}</td><td>${esc(a.name)}</td><td class="n">${money2(a.d)}</td><td class="n">${money2(a.c)}</td><td class="n">${sd?money2(sd):''}</td><td class="n">${sa?money2(sa):''}</td></tr>`}).join('');
  main(`<div class="ph"><h2>${esc(uiT("app.134","Balanza de comprobación"))}</h2>${pbtn()}</div>${pbar()}<div class="card">${rh('Balanza de comprobación','Al '+tshow(t))}<div class="tw"><table><thead><tr><th>${esc(uiT("app.135","Código"))}</th><th>${esc(uiT("app.136","Cuenta"))}</th><th class="n">${esc(uiT("app.137","Débitos"))}</th><th class="n">${esc(uiT("app.138","Créditos"))}</th><th class="n">${esc(uiT("app.139","Saldo deudor"))}</th><th class="n">${esc(uiT("app.140","Saldo acreedor"))}</th></tr></thead><tbody>${rows||`<tr><td colspan="6" class="mut">${esc(uiT("app.133","Sin movimientos"))}</td></tr>`}</tbody><tfoot><tr><th colspan="2">${esc(uiT("app.141","Totales"))}</th><th class="n">${money2(D)}</th><th class="n">${money2(C)}</th><th class="n">${money2(SD)}</th><th class="n">${money2(SA)}</th></tr></tfoot></table></div><p class="${Math.abs(SD-SA)<.01?'ok':'bad'}">${Math.abs(SD-SA)<.01?'La balanza está cuadrada ✓':'La balanza no cuadra'}</p></div>`)};
function secRows(B,tipo){return Object.values(B).filter(a=>a.tipo==tipo&&(a.d||a.c)).sort(byCode).map(a=>`<tr><td>${esc(a.name)}</td><td class="n">${money2(sg(a))}</td></tr>`).join('')}
V.resultados=()=>{const[f,t]=rg(),B=bal(f,t,true),ing=tot(B,'ingreso'),cos=tot(B,'costo'),gas=tot(B,'gasto');
  main(`<div class="ph"><h2>${esc(uiT("app.142","Estado de resultados"))}</h2>${pbtn()}</div>${pbar()}<div class="card">${rh('Estado de resultados',plabel())}<div class="tw"><table><tbody><tr class="sec"><td colspan="2">${esc(uiT("app.143","Ingresos"))}</td></tr>${secRows(B,'ingreso')}<tr class="t"><td>${esc(uiT("app.144","Total ingresos"))}</td><td class="n">${money2(ing)}</td></tr><tr class="sec"><td colspan="2">${esc(uiT("app.145","Costo de ventas"))}</td></tr>${secRows(B,'costo')}<tr class="t"><td>${esc(uiT("app.146","Utilidad bruta"))}</td><td class="n">${money2(ing-cos)}</td></tr><tr class="sec"><td colspan="2">${esc(uiT("app.147","Gastos de operación"))}</td></tr>${secRows(B,'gasto')}<tr class="t"><td>${esc(uiT("app.148","Total gastos"))}</td><td class="n">${money2(gas)}</td></tr><tr class="t"><td>${esc(uiT("app.149","UTILIDAD (PÉRDIDA) NETA"))}</td><td class="n">${money2(ing-cos-gas)}</td></tr></tbody></table></div></div>`)};
V.balance=()=>{const[,t]=rg(),B=bal('0000',t),act=tot(B,'activo'),pas=tot(B,'pasivo'),pat=tot(B,'patrimonio'),res=tot(B,'ingreso')-tot(B,'costo')-tot(B,'gasto');
  main(`<div class="ph"><h2>${esc(uiT("app.150","Balance general"))}</h2>${pbtn()}</div>${pbar()}<div class="card">${rh('Balance general (estado de situación)','Al '+tshow(t))}<div class="tw"><table><tbody><tr class="sec"><td colspan="2">${esc(uiT("app.151","Activos"))}</td></tr>${secRows(B,'activo')}<tr class="t"><td>${esc(uiT("app.152","Total activos"))}</td><td class="n">${money2(act)}</td></tr><tr class="sec"><td colspan="2">${esc(uiT("app.153","Pasivos"))}</td></tr>${secRows(B,'pasivo')}<tr class="t"><td>${esc(uiT("app.154","Total pasivos"))}</td><td class="n">${money2(pas)}</td></tr><tr class="sec"><td colspan="2">${esc(uiT("app.155","Patrimonio"))}</td></tr>${secRows(B,'patrimonio')}<tr><td>${esc(uiT("app.156","Resultado acumulado del ejercicio"))}</td><td class="n">${money2(res)}</td></tr><tr class="t"><td>${esc(uiT("app.157","Total patrimonio"))}</td><td class="n">${money2(pat+res)}</td></tr><tr class="t"><td>${esc(uiT("app.158","PASIVO + PATRIMONIO"))}</td><td class="n">${money2(pas+pat+res)}</td></tr></tbody></table></div><p class="${Math.abs(act-pas-pat-res)<.01?'ok':'bad'}">${Math.abs(act-pas-pat-res)<.01?'Activos = Pasivos + Patrimonio ✓':'El balance no cuadra'}</p></div>`)};
V.flujo=()=>{const[f,t]=rg(),{ini,sec}=flujo(f,t);const blk=(k,l)=>{const e=Object.entries(sec[k]).filter(x=>Math.abs(x[1])>.004),s=e.reduce((a,x)=>a+x[1],0);return{s,h:`<tr class="sec"><td colspan="2">${l}</td></tr>${e.map(([n,x])=>`<tr><td>${esc(n)}</td><td class="n">${money2(x)}</td></tr>`).join('')||`<tr><td class="mut" colspan="2">${esc(uiT("app.159","Sin movimientos"))}</td></tr>`}<tr class="t"><td>${esc(uiT("app.160","Flujo neto"))}</td><td class="n">${money2(s)}</td></tr>`}};
  const o=blk('op','Actividades de operación'),i=blk('inv','Actividades de inversión'),fi=blk('fin','Actividades de financiamiento'),net=o.s+i.s+fi.s;
  main(`<div class="ph"><h2>${esc(uiT("app.161","Flujo de efectivo"))}</h2>${pbtn()}</div>${pbar()}<div class="card">${rh('Estado de flujo de efectivo (método directo)',plabel())}<div class="tw"><table><tbody>${o.h}${i.h}${fi.h}<tr class="t"><td>${esc(uiT("app.162","Aumento (disminución) neto de efectivo"))}</td><td class="n">${money2(net)}</td></tr><tr><td>${esc(uiT("app.163","Efectivo al inicio"))}</td><td class="n">${money2(ini)}</td></tr><tr class="t"><td>${esc(uiT("app.164","EFECTIVO AL FINAL"))}</td><td class="n">${money2(ini+net)}</td></tr></tbody></table></div><p class="mut">${esc(uiT("app.165","Se calcula con los movimientos de las cuentas de efectivo (caja y bancos)."))}</p></div>`)};
V.ajustes=()=>{main(`<div class="ph"><h2>${esc(uiT("app.166","Ajustes y respaldo"))}</h2></div><div class="card"><b>${esc(CO.name)}</b><p class="mut">Cuenta: ${esc(U.email)}${U.admin?' · Administrador':''}${U.editor&&!U.admin?' · Editor de la página':''}</p><div class="grid" style="grid-template-columns:1fr"><button class="btn" data-a="cfg">${esc(uiT("app.167","Datos de la empresa"))}</button><button class="btn ghost" data-a="backup">${esc(uiT("app.168","Descargar respaldo (JSON)"))}</button><button class="btn ghost" data-a="restore">${esc(uiT("app.169","Restaurar respaldo"))}</button></div><input type="file" id="rf" accept=".json" hidden></div>`)};

V.pagina=()=>{main(`<div class="ph"><h2>${esc(uiT("app.170","Página principal de Acontec"))}</h2><button class="btn ghost" data-a="nav" data-r="panel">${esc(uiT("app.171","🏢 Volver a mi negocio"))}</button></div><p class="mut">${esc(uiT("app.172","Vista previa de cómo ven los visitantes la pantalla de ingreso. Guarda para publicar los cambios para todos."))}</p><div class="card" style="padding:0;overflow:hidden"><div class="auth-preview" style="padding:26px 20px;background:linear-gradient(135deg,#16372a,${SITE.green||DEF.green})${SITE.hero?`;background-image:url('${SITE.hero.replace(/'/g,'%27')}')`:''};background-size:cover;background-position:center;color:#fff"><small style="letter-spacing:.2em;text-transform:uppercase;color:${SITE.gold||DEF.gold}">${esc(SITE.eyebrow)}</small><h1 style="font-size:30px;margin:8px 0">${esc(SITE.brand)}</h1><h3 style="font-weight:400;margin:0 0 6px">${esc(SITE.title||'')}</h3><p style="margin:0;opacity:.92;line-height:1.5;font-size:14px">${esc(SITE.sub)}</p></div></div><div class="grid" style="grid-template-columns:1fr"><button class="btn" data-a="gear">${esc(uiT("app.173","⚙️ Editar página de Acontec"))}</button></div>`)};

// ---------- acciones ----------
const ACT={
 nav:(d)=>{R=d.r;menu(false);view();scrollTo(0,0)},menu:()=>menu(!$('#drawer').classList.contains('open')),close:()=>{$('#modal').innerHTML=''},
 google:()=>{if(GID)renderGoogle();else location.href='/configurar-google.html'},
 tab:(data)=>{if($('#af')?.getAttribute('aria-busy')==='true')return;AM=data.m;$$('.tabs button').forEach(button=>button.classList.toggle('on',button.dataset.m==AM));$('.reg').hidden=AM=='login';const forgot=$('#auth-forgot');if(forgot)forgot.hidden=AM!='login';for(const key of ['co','country','cur','businessType'])$('#af').elements[key].required=AM!='login';$('#af [name=pw]').minLength=AM=='login'?1:8;$('#af [name=pw]').autocomplete=AM=='login'?'current-password':'new-password';$('#auth-help').innerHTML=AM=='login'?`¿Es tu primer acceso? <button type="button" class="lk" data-a="tab" data-m="reg">${esc(uiT("app.174","Crea tu cuenta de cliente"))}</button> antes de ingresar.`:'Escribe tu correo, una contraseña de al menos 8 caracteres y el nombre de tu empresa. Después, confirma el correo que recibas para acceder.';$('#submit-auth').innerHTML=(AM=='login'?'Ingresar':'Crear cuenta')+' <span aria-hidden="true">→</span>';clearAuthStatus()},
 resendConfirmation:async(data,button)=>{
   const form=$('#af'),pending=confirmationResend;if(!pending||button.disabled||form.getAttribute('aria-busy')==='true')return;
   const email=form.elements.em.value,password=form.elements.pw.value;
   if(email!==pending.email){clearAuthStatus();return}
   button.disabled=true;form.setAttribute('aria-busy','true');$('#submit-auth').disabled=true;
   try{const result=await api('resend-confirmation','POST',{email,password,grant:pending.grant});if(confirmationResend===pending)authStatus(result.message,'success')}
   catch(error){if(confirmationResend===pending)authStatus(error.status?error.message:'No se pudo solicitar otro correo. Revisa tu conexión e inténtalo de nuevo.')}
   finally{button.disabled=false;form.removeAttribute('aria-busy');$('#submit-auth').disabled=false}
 },
 forgotPassword:()=>{
   const em=$('#af [name=em]')?.value||'';
   modal(uiT("app.extra.32","Recuperar contraseña"),`<p class="mut">${esc(uiT("app.175","Escribe tu correo electrónico registrado. Si el correo está registrado en el acceso por contraseña, recibirás un enlace para cambiarla."))}</p><p class="mut">${esc(uiT("app.176","Si tu cuenta se creó con Google: Esta cuenta ingresa con Google. Usa 'Continuar con Google'."))}</p><label>${esc(uiT("app.177","Correo electrónico"))}<input type="email" name="em" required autocomplete="email" placeholder="correo@ejemplo.com" value="${esc(em)}"></label>`,async form=>{
     const email=v(form,'em').trim();
     if(!email)return 'Escribe un correo electrónico.';
     const res=await api('forgot-password','POST',{email});
     alert(res.message||'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también tu bandeja de spam.');
   },'Enviar enlace');
 },
 logout:async()=>{if(!await flush()){alert(uiT("app.extra.33","Hay cambios sin guardar. Descarga un respaldo e intenta guardar de nuevo antes de salir."));return}await api('logout','POST',{});localStorage.removeItem('co');for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('acontec.catalog.'))localStorage.removeItem(key)}location.reload()},print:()=>choosePrintOptions(options=>printWithOptions(options)),
 per:(d)=>{P.k=d.k;view()},
 delentry:(d)=>{if(confirm(uiT("app.extra.34","¿Eliminar este registro? Se revertirá el inventario si aplica."))){delEntry(d.id);view()}},
 printSale:(d,b)=>{const ff=b.closest('form'),items=readItems();if(!items.length){ff.querySelector('.err').textContent=uiT("app.extra.35","Agrega al menos un producto para imprimir");return}
   printRcpt({date:v(ff,'dt'),party:v(ff,'cl')||'Cliente general',pay:v(ff,'py'),items,total:r2(items.reduce((s,i)=>s+i.q*i.u,0))})},
 printEntry:(d)=>{const e=S.entries.find(x=>x.id==d.id);if(e)printRcpt(e)},
 addItem:(d,b)=>{const form=b.closest('form');form.querySelector('.items').insertAdjacentHTML('beforeend',itemRow({},form.dataset.k=='editcompra'))},
 removeItem:(d,b)=>b.closest('.item').remove(),
 addLine:(d,b)=>{b.closest('form').querySelector('.lines').insertAdjacentHTML('beforeend',lineRow())},
 venta:()=>{const f=modal(uiT("app.extra.36","Nueva venta"),`<label>${esc(uiT("app.178","Fecha"))}<input type="date" name="dt" value="${today()}" required></label><label>${esc(uiT("app.179","Cliente"))}<input name="cl" placeholder="Cliente"></label><label>${esc(uiT("app.180","Forma de pago"))}<select name="py">${payOpts('1201')}</select></label><div class="items">${itemRow()}</div><button type="button" class="lk" data-a="addItem">${esc(uiT("app.181","+ Agregar producto"))}</button> <button type="button" class="lk" data-a="printSale">${esc(uiT("app.182","🖨️ Imprimir venta"))}</button>`,ff=>{
   const items=readItems(),py=v(ff,'py');if(!items.length)return 'Agrega al menos un producto';let T=0,cost=0;const stk=[];
   for(const it of items){const p=prod(it.p);if(p.stock<it.q)return `Existencia insuficiente de ${p.name} (${p.stock})`;T+=it.q*it.u;cost+=it.q*p.cost;stk.push({pid:p.id,q:-it.q})}
   T=r2(T);cost=r2(cost);const L=[{a:py,d:T,c:0},{a:'4101',d:0,c:T}];if(cost>0)L.push({a:'5101',d:cost,c:0},{a:'1301',d:0,c:cost});
   const cl=v(ff,'cl')||'Cliente general';addEntry({date:v(ff,'dt'),desc:'Venta - '+cl,party:cl,type:'venta',lines:L,stock:stk,items,total:T,pay:py});view()})},
 compra:()=>purchaseModal(),
 editcompra:(d)=>{const entry=S.entries.find(e=>e.id==d.id&&e.type=='compra');if(entry)purchaseModal(entry)},
 gasto:()=>{modal(uiT("app.extra.37","Nuevo gasto"),`<label>${esc(uiT("app.183","Fecha"))}<input type="date" name="dt" value="${today()}" required></label><label>${esc(uiT("app.184","Cuenta de gasto"))}<select name="ac">${accOpts('6103',a=>a.tipo=='gasto')}</select></label><label>${esc(uiT("app.185","Descripción"))}<input name="ds"></label><label>${esc(uiT("app.186","Monto"))}<input name="mt" type="number" step="0.01" min="0.01" required></label><label>${esc(uiT("app.187","Forma de pago"))}<select name="py">${payOpts('2101')}</select></label>`,ff=>{
   const m=r2(v(ff,'mt')),a=v(ff,'ac');if(m<=0)return 'Monto inválido';const ds=v(ff,'ds')||S.accounts.find(x=>x.code==a).name;
   addEntry({date:v(ff,'dt'),desc:'Gasto - '+ds,party:ds,type:'gasto',lines:[{a,d:m,c:0},{a:v(ff,'py'),d:0,c:m}],total:m,pay:v(ff,'py')});view()})},
 cobro:()=>settle('Cobro de cliente','1201',true),pago:()=>settle('Pago a proveedor','2101',false),
 manual:()=>entryModal('manual'),apertura:()=>{const e=S.entries.find(x=>['apertura','apertura-importada'].includes(x.type)&&!S.entries.some(r=>r.reversalOf===x.id));return e?ACT.correctEntry({id:e.id}):entryModal('apertura')},
 newprod:()=>{modal(uiT("app.extra.38","Nuevo producto"),`<label>${esc(uiT("app.188","Código"))}<input name="cd"></label><label>${esc(uiT("app.189","Nombre"))}<input name="nm" required></label><label>${esc(uiT("app.190","Costo unitario"))}<input name="co" type="number" step="0.01" min="0" value="0"></label><label>${esc(uiT("app.191","Precio de venta"))}<input name="pr" type="number" step="0.01" min="0" value="0"></label><label>${esc(uiT("app.192","Existencia inicial"))}<input name="st" type="number" step="any" min="0" value="0"></label><label>${esc(uiT("app.193","Stock mínimo"))}<input name="mn" type="number" step="any" min="0" value="0"></label>`,ff=>{
   const p={id:uid(),code:v(ff,'cd'),name:v(ff,'nm').trim(),cost:r2(v(ff,'co')),price:r2(v(ff,'pr')),stock:0,min:+v(ff,'mn')||0},q=+v(ff,'st')||0;S.products.push(p);
   const amt=r2(q*p.cost);if(q>0&&amt>0)addEntry({date:today(),desc:'Inventario inicial - '+p.name,type:'invini',lines:[{a:'1301',d:amt,c:0},{a:'3101',d:0,c:amt}],stock:[{pid:p.id,q}],total:amt});else{p.stock=q;save()}view()})},
 editprod:(d)=>{const p=prod(d.id);modal(uiT("app.extra.39","Editar producto"),`<label>${esc(uiT("app.194","Código"))}<input name="cd" value="${esc(p.code)}"></label><label>${esc(uiT("app.195","Nombre"))}<input name="nm" value="${esc(p.name)}" required></label><label>${esc(uiT("app.196","Precio de venta"))}<input name="pr" type="number" step="0.01" value="${p.price}"></label><label>${esc(uiT("app.197","Stock mínimo"))}<input name="mn" type="number" step="any" value="${p.min}"></label>`,ff=>{p.code=v(ff,'cd');p.name=v(ff,'nm');p.price=r2(v(ff,'pr'));p.min=+v(ff,'mn')||0;save();view()})},
 ajuste:(d)=>{const p=prod(d.id);modal('Ajustar existencia: '+esc(p.name),`<p class="mut">Existencia actual: ${p.stock}. Usa un número positivo para sumar o negativo para restar (merma, pérdida, conteo físico).</p><label>${esc(uiT("app.198","Cantidad"))}<input name="q" type="number" step="any" required></label><label>${esc(uiT("app.199","Motivo"))}<input name="m" value="Ajuste de inventario"></label>`,ff=>{
   const q=+v(ff,'q');if(!q)return 'Indica una cantidad';if(p.stock+q<0)return 'No puede quedar existencia negativa';const amt=r2(Math.abs(q)*p.cost);
   addEntry({date:today(),desc:v(ff,'m')+' - '+p.name,type:'ajuste',lines:amt>0?(q>0?[{a:'1301',d:amt,c:0},{a:'4102',d:0,c:amt}]:[{a:'6107',d:amt,c:0},{a:'1301',d:0,c:amt}]):[],stock:[{pid:p.id,q}],total:amt});view()})},
 delprod:(d)=>{if(S.entries.some(e=>(e.stock||[]).some(s=>s.pid==d.id)))return alert(uiT("app.extra.40","Este producto tiene movimientos. Ajusta su existencia a 0 en lugar de borrarlo."));if(confirm(uiT("app.extra.41","¿Borrar producto?"))){S.products=S.products.filter(p=>p.id!=d.id);save();view()}},
 newacc:()=>{modal(uiT("app.extra.42","Nueva cuenta"),`<label>${esc(uiT("app.200","Código"))}<input name="cd" required></label><label>${esc(uiT("app.201","Nombre"))}<input name="nm" required></label><label>${esc(uiT("app.202","Tipo"))}<select name="tp"><option value="activo">${esc(uiT("app.203","activo"))}</option><option value="pasivo">${esc(uiT("app.204","pasivo"))}</option><option value="patrimonio">${esc(uiT("app.205","patrimonio"))}</option><option value="ingreso">${esc(uiT("app.206","ingreso"))}</option><option value="costo">${esc(uiT("app.207","costo"))}</option><option value="gasto">${esc(uiT("app.208","gasto"))}</option></select></label><label>${esc(uiT("app.209","Clasificación en flujo de efectivo"))}<select name="sb"><option value="">${esc(uiT("app.210","Normal / operación"))}</option><option value="ef">${esc(uiT("app.211","Efectivo y equivalentes"))}</option><option value="fijo">${esc(uiT("app.212","Activo fijo (inversión)"))}</option><option value="fin">${esc(uiT("app.213","Financiamiento"))}</option></select></label><label class="ck"><input type="checkbox" name="ct"> ${esc(uiT("app.214","Cuenta de naturaleza contraria (ej. depreciación acumulada)"))}</label>`,ff=>{
   const cd=v(ff,'cd').trim();if(S.accounts.some(a=>a.code==cd))return 'Ese código ya existe';const tp=v(ff,'tp'),n=NAT[tp];
   S.accounts.push({code:cd,name:v(ff,'nm').trim(),tipo:tp,nat:ff.elements.ct.checked?(n=='D'?'C':'D'):n,sub:v(ff,'sb')});save();view()})},
 delacc:(d)=>{if(S.entries.some(e=>e.lines.some(l=>l.a==d.c)))return alert(uiT("app.extra.43","La cuenta tiene movimientos y no se puede borrar."));S.accounts=S.accounts.filter(a=>a.code!=d.c);save();view()},
 cfg:()=>{modal(uiT("app.extra.44","Datos de la empresa"),`<label>${esc(uiT("app.215","Nombre en reportes"))}<input name="nm" value="${esc(S.cfg.name||CO.name)}"></label><label>${esc(uiT("app.216","RUC / identificación"))}<input name="ru" value="${esc(S.cfg.ruc||'')}"></label><label>${esc(uiT("app.217","Símbolo de moneda"))}<input name="cu" value="${esc(S.cfg.cur||'C$')}"></label>`,async ff=>{
   S.cfg.name=v(ff,'nm');S.cfg.ruc=v(ff,'ru');S.cfg.cur=v(ff,'cu')||'C$';const r=await api('company','PUT',{id:CO.id,name:S.cfg.name});COS=r.companies;CO=COS.find(c=>c.id==CO.id);save();shell();view()})},
 backup:()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:'application/json'}));a.download=`respaldo-${CO.name}-${today()}.json`;a.click()},
 restore:()=>$('#rf').click(),
 switch:()=>{menu(false);modal(uiT("app.extra.45","Mis empresas"),(isAcontecCompany()?`<button type="button" class="btn ghost full" style="margin-bottom:8px" data-a="home">${esc(uiT("app.218","🌐 Página principal de Acontec"))}</button>`:'')+COS.map(c=>`<button type="button" class="btn ${c.id==CO.id?'':'ghost'} full" style="margin-bottom:8px" data-a="opencomp" data-id="${c.id}">${esc(c.name)}${c.testPlan?` <small>· Prueba interna · ${esc(c.testPlan)}</small>`:''}</button>`).join('')+`<label style="margin-top:14px">${esc(uiT("app.219","Crear nueva empresa"))}<input name="nm" placeholder="Nombre de la empresa"></label><label>${esc(uiT("app.220","País de la empresa"))}<input name="country" value="Nicaragua" maxlength="80" required></label><p class="mut">${esc(uiT("app.221","Otros países usan Genérico (otro país)."))}</p>`,async ff=>{const n=v(ff,'nm').trim();if(!n)return 'Escribe un nombre o elige una empresa';const r=await api('company','POST',{name:n,country:v(ff,'country')});COS=r.companies;await openCompany(r.id)},'Crear')},
 home:async()=>{if(!isAcontecCompany())throw new Error(uiT("app.extra.46","Esta opción solo está disponible en Acontec."));if(!await flush())throw new Error(uiT("app.extra.47","Guarda los cambios pendientes antes de continuar."));ACT.close();authView()},
 accountingPanel:()=>{if(!CO||!HOME)return;ACT.close();HOME=false;R=typeof firstAllowedRoute==='function'?firstAllowedRoute():'panel';shell();view();scrollTo(0,0)},
 editsite:()=>{if(U?.editor)return ACT.gear();sessionStorage.setItem('edit','1');const e=$('#af .err');if(e)e.textContent=U?'Tu cuenta no está autorizada para editar la página.':'Ingresa con tu cuenta de editor para modificar la página.';$('#af [name=em]')?.focus()},
 opencomp:async(d)=>{ACT.close();await openCompany(d.id)},
 gear:()=>{if(!U?.editor)throw new Error(uiT("app.extra.48","La edición está reservada a la cuenta autorizada de Acontec."));const g=SITE.gallery||[],contacts=SITE.contacts||{},revision=SITE_REV;modal(uiT("app.extra.49","Editar página principal de Acontec"),`<label>${esc(uiT("app.226","Nombre de la plataforma"))}<input name="b" value="${esc(SITE.brand)}"></label><label>${esc(uiT("app.227","Logo (PNG, JPG o WebP)"))}<input type="file" name="lg" accept="image/jpeg,image/png,image/webp"></label>${SITE.logo?`<label class="ck"><input type="checkbox" name="rl"> ${esc(uiT("app.222","Quitar logo y usar el símbolo de Acontec"))}</label>`:''}<label>${esc(uiT("app.228","Nota del encabezado"))}<input name="n" value="${esc(SITE.note)}"></label><label>${esc(uiT("app.229","Frase superior"))}<input name="e" value="${esc(SITE.eyebrow)}"></label><label>${esc(uiT("app.230","Título editorial (no sustituye el nombre de cada empresa)"))}<input name="t" value="${esc(SITE.title)}"></label><label>${esc(uiT("app.231","Descripción"))}<textarea name="s" rows="3">${esc(SITE.sub)}</textarea></label><label>${esc(uiT("app.232","Frase final"))}<textarea name="c" rows="2">${esc(SITE.caption)}</textarea></label><label>${esc(uiT("app.233","Imagen de portada"))}<input type="file" name="im" accept="image/jpeg,image/png,image/webp"></label>${SITE.hero?`<label class="ck"><input type="checkbox" name="rm"> ${esc(uiT("app.223","Quitar imagen de portada"))}</label>`:''}<p class="mut" style="margin:10px 0 4px">${esc(uiT("app.234","Galería (hasta 6 imágenes). Marca las que quieras quitar."))}</p><div class="ed-gallery">${g.map((src,i)=>`<label><img src="${esc(src)}" alt=""><span><input type="checkbox" name="gx" value="${i}"> ${esc(uiT("app.224","Quitar"))}</span></label>`).join('')||`<span class="mut">${esc(uiT("app.225","Sin imágenes todavía."))}</span>`}</div><label>${esc(uiT("app.235","Agregar imágenes"))}<input type="file" name="ga" accept="image/jpeg,image/png,image/webp" multiple></label><h4 class="editor-section-heading">${esc(uiT("app.236","Contactos públicos"))}</h4><p class="mut editor-help">${esc(uiT("app.237","Se muestran en la página principal para que tus clientes puedan contactarte. Deja vacío cualquier canal que no quieras publicar."))}</p><label>${esc(uiT("app.238","WhatsApp (número con código de país)"))}<input type="tel" name="whatsapp" maxlength="30" value="${esc(contacts.whatsapp||'')}" placeholder="Código de país + número" aria-describedby="contact-phone-help"></label><p id="contact-phone-help" class="mut editor-help">${esc(uiT("app.239","Incluye el código internacional, sin el cero inicial nacional. Escribe el número, no un enlace."))}</p><label>${esc(uiT("app.240","Teléfono (con código de país)"))}<input type="tel" name="phone" maxlength="30" value="${esc(contacts.phone||'')}" placeholder="Código de país + número"></label><label>${esc(uiT("app.241","Correo de contacto"))}<input type="email" name="email" maxlength="254" value="${esc(contacts.email||'')}" placeholder="contacto@tuempresa.com"></label><label>${esc(uiT("app.242","Facebook"))}<input type="url" name="facebook" maxlength="500" value="${esc(contacts.facebook||'')}" placeholder="https://www.facebook.com/tupagina"></label><label>${esc(uiT("app.243","Instagram"))}<input type="url" name="instagram" maxlength="500" value="${esc(contacts.instagram||'')}" placeholder="https://www.instagram.com/tucuenta"></label><label>${esc(uiT("app.244","Otro sitio web"))}<input type="url" name="website" maxlength="500" value="${esc(contacts.website||'')}" placeholder="https://tuempresa.com"></label><h4 class="editor-section-heading">${esc(uiT("app.245","Panel de los clientes"))}</h4><p class="mut">${esc(uiT("app.246","Estos textos se publican para todos. El nombre de cada empresa conserva su lugar en el encabezado."))}</p><label>${esc(uiT("app.247","Título del panel"))}<input name="panelTitle" maxlength="2000" value="${esc(SITE.panelTitle??SITE.title)}"></label><label>${esc(uiT("app.248","Descripción del panel"))}<textarea name="panelDescription" maxlength="2000">${esc(SITE.panelDescription??SITE.sub)}</textarea></label><label>${esc(uiT("app.249","Aviso de cookies"))}<textarea name="cookieNotice" maxlength="2000">${esc(SITE.cookieNotice||'Usamos cookies técnicas y de sesión y almacenamiento local para tus preferencias. Sin cookies publicitarias.')}</textarea></label><details><summary>${esc(uiT("app.250","Nombres de los módulos del menú"))}</summary><p class="mut">${esc(uiT("app.251","Deja vacío para usar el nombre original. Los permisos y las operaciones conservan su funcionamiento."))}</p>${MENU.flatMap(([,items])=>items).map(([route,,label])=>`<label>${esc(label)}<input name="module_${esc(route)}" maxlength="80" value="${esc(SITE.moduleLabels?.[route]||'')}" placeholder="${esc(label)}"></label>`).join('')}</details><h4 class="editor-section-heading">${esc(uiT("app.252","Pie de página y colores"))}</h4><label>${esc(uiT("app.253","Lema del pie"))}<input name="tg" value="${esc(SITE.tagline)}"></label><label>${esc(uiT("app.254","Texto del pie"))}<input name="f" value="${esc(SITE.footer)}"></label><label>${esc(uiT("app.255","Color principal"))}<input type="color" name="g" value="${SITE.green||DEF.green}"></label><label>${esc(uiT("app.256","Color dorado"))}<input type="color" name="o" value="${SITE.gold||DEF.gold}"></label>`,async ff=>{
   const E=ff.elements;let hero=SITE.hero||'',logo=SITE.logo||'';if(E.im.files[0])hero=await shrink(E.im.files[0]);if(E.rm?.checked)hero='';if(E.lg.files[0])logo=await shrink(E.lg.files[0],256);if(E.rl?.checked)logo='';
   const drop=new Set($$('#modal [name=gx]:checked').map(x=>+x.value)),gallery=g.filter((_,i)=>!drop.has(i));
   if(gallery.length+E.ga.files.length>6)return 'La galería admite hasta 6 imágenes. Quita alguna antes de agregar más.';for(const file of E.ga.files)gallery.push(await shrink(file,1200));
   const n={revision,policyNotes:SITE.policyNotes||{},moduleLabels:Object.fromEntries(MENU.flatMap(([,items])=>items).map(([route])=>[route,v(ff,'module_'+route)])),panelTitle:v(ff,'panelTitle'),panelDescription:v(ff,'panelDescription'),cookieNotice:v(ff,'cookieNotice'),contacts:Object.fromEntries(['whatsapp','phone','email','facebook','instagram','website'].map(key=>[key,v(ff,key)])),brand:v(ff,'b'),note:v(ff,'n'),eyebrow:v(ff,'e'),title:v(ff,'t'),sub:v(ff,'s'),caption:v(ff,'c'),tagline:v(ff,'tg'),footer:v(ff,'f'),hero,logo,gallery,green:v(ff,'g'),gold:v(ff,'o')};const result=await api('site','PUT',n);SITE={...DEF,...result.site};SITE_REV=result.siteRevision;applyTheme();if(HOME){authView();const status=$('.home-save-status');if(status)status.textContent=uiT("app.extra.50","Textos, imágenes y contactos guardados y publicados.");return}shell();view();setSt('Página publicada para todos los visitantes')})}
};
function settle(title,acc,cobro){modal(title,`<label>${esc(uiT("app.257","Fecha"))}<input type="date" name="dt" value="${today()}" required></label><label>${esc(uiT("app.258","Concepto"))}<input name="ds"></label><label>${esc(uiT("app.259","Monto"))}<input name="mt" type="number" step="0.01" min="0.01" required></label><label>${cobro?'Recibido en':'Pagado desde'}<select name="py"><option value="1101">${esc(uiT("app.260","Caja"))}</option><option value="1102">${esc(uiT("app.261","Banco"))}</option></select></label>`,ff=>{
  const m=r2(v(ff,'mt')),py=v(ff,'py');if(m<=0)return 'Monto inválido';
  addEntry({date:v(ff,'dt'),desc:title+(v(ff,'ds')?' - '+v(ff,'ds'):''),type:'manual',lines:cobro?[{a:py,d:m,c:0},{a:acc,d:0,c:m}]:[{a:acc,d:m,c:0},{a:py,d:0,c:m}],total:m});view()})}
function purchaseModal(ex){
  const form=modal(ex?'Editar compra':'Nueva compra',`<label>${esc(uiT("app.262","Fecha"))}<input type="date" name="dt" value="${esc(ex?.date||today())}" required></label><label>${esc(uiT("app.263","Proveedor"))}<input name="pv" value="${esc(ex?.party||'')}"></label><label>${esc(uiT("app.264","Forma de pago"))}<select name="py">${payOpts('2101')}</select></label><div class="items">${ex?.items?.length?ex.items.map(item=>itemRow(item,true)).join(''):''}</div><button type="button" class="lk" data-a="purchaseProducts">+ Agregar productos</button>`,ff=>{
    const items=readItems(),py=v(ff,'py');if(!items.length)return 'Agrega al menos un producto';
    if(items.some(item=>!prod(item.p)||!Number.isFinite(item.q)||!Number.isFinite(item.u)||item.u<0))return 'Revisa los productos, cantidades y precios';
    const total=r2(items.reduce((sum,item)=>sum+item.q*item.u,0));if(!Number.isFinite(total))return 'El total de la compra no es válido';
    const stock=items.map(item=>({pid:item.p,q:item.q})),party=v(ff,'pv')||'Proveedor';
    const entry={date:v(ff,'dt'),desc:'Compra - '+party,party,type:'compra',lines:[{a:'1301',d:total,c:0},{a:py,d:0,c:total}],stock,items,total,pay:py};
    if(ex){
      const changes=new Map();
      const changeFor=id=>{if(!changes.has(id))changes.set(id,{quantity:0,value:0});return changes.get(id)};
      (ex.stock||[]).forEach(movement=>{changeFor(movement.pid).quantity-=movement.q});
      (ex.items||[]).forEach(item=>{changeFor(item.p).value-=item.q*item.u});
      items.forEach(item=>{const change=changeFor(item.p);change.quantity+=item.q;change.value+=item.q*item.u});
      const updates=[];
      for(const [id,change] of changes){
        const product=prod(id);if(!product)return 'Uno de los productos de la compra ya no existe';
        const quantity=r2(product.stock+change.quantity);
        if(quantity<0)return `No puedes reducir esta compra: la existencia de ${product.name} quedaría negativa (${quantity})`;
        const cost=quantity>0&&(change.quantity||Math.abs(change.value)>0.000001)?r2(Math.max(0,product.stock*product.cost+change.value)/quantity):product.cost;
        updates.push({product,quantity,cost});
      }
      updates.forEach(update=>{update.product.stock=update.quantity;update.product.cost=update.cost});
      Object.assign(ex,entry);save();
    }else{
      items.forEach(item=>{const product=prod(item.p),quantity=Math.max(product.stock,0);product.cost=r2((quantity*product.cost+item.q*item.u)/(quantity+item.q))});
      addEntry(entry);
    }
    view();
  },ex?'Guardar cambios':'Guardar');
  form.querySelectorAll('.item').forEach(preparePurchaseProductRow);
  form.dataset.k=ex?'editcompra':'compra';if(ex)form.elements.py.value=ex.pay;
}
function entryModal(type,ex,correction=false,again=false){
  const f=modal(correction?uiT('corrections.correct','Corregir / Anular'):type=='apertura'?'Asiento de apertura':'Nuevo asiento',`<label>${esc(uiT("app.266","Fecha"))}<input type="date" name="dt" value="${esc(ex?.date||today())}" required></label><label>${esc(uiT("app.267","Descripción"))}<input name="ds" value="${esc(ex?.desc||(type=='apertura'?'Asiento de apertura':''))}" required></label>${again?field('reference',uiT('corrections.reference','Comprobante o referencia'),ex.reference||''):''}<div class="lines">${(ex?ex.lines:[{},{}]).map(lineRow).join('')}</div><button type="button" class="lk" data-a="addLine">${esc(uiT("app.268","+ Agregar línea"))}</button><div class="tot"></div>`+(correction?field('reason',uiT('corrections.reason','Motivo de la corrección'),'','text','required minlength="3" maxlength="500"')+field('reference',uiT('corrections.reference','Comprobante o referencia'),ex.reference||'','text','required maxlength="200"')+correctionChoice(!!ex.stock?.length||['fiscal-pago','invini'].includes(ex.type))+notice(uiT('corrections.help','La corrección conserva el original y registra su inverso. Verifica con tu contador.')):''),async ff=>{
    const L=readLines();if(L.length<2)return 'Se necesitan al menos 2 líneas';if(L.some(l=>l.d&&l.c))return 'Cada línea va al Debe o al Haber, no ambos';
    const D=r2(L.reduce((s,l)=>s+l.d,0)),C=r2(L.reduce((s,l)=>s+l.c,0));if(D!=C||D<=0)return 'El asiento no cuadra: Debe y Haber deben ser iguales';
    if(correction){await operate('correctEntry',{id:ex.id,date:v(ff,'dt'),reason:v(ff,'reason'),reference:v(ff,'reference'),...(correctionAnnulOnly(ff)?{}:{replacement:{desc:v(ff,'ds'),lines:L}})});view();return;}
    if(again){await submitRegisterAgain(ex,v(ff,'dt'),{desc:v(ff,'ds'),reference:v(ff,'reference'),lines:L});view();return;}
    if(type==='apertura'&&S.entries.some(e=>['apertura','apertura-importada'].includes(e.type)&&!S.entries.some(r=>r.reversalOf===e.id)))return uiT('corrections.use','Usa Corregir apertura para conservar el historial.');
    addEntry({date:v(ff,'dt'),desc:v(ff,'ds'),type,lines:L,total:D});view()});if(correction)f.classList.add('correction-form');sumTot()}
function shrink(file,max=1400){return new Promise((resolve,reject)=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)return reject(new Error(uiT("app.extra.51","Elige una imagen JPG, PNG o WebP de hasta 10 MB.")));const reader=new FileReader();reader.onerror=()=>reject(new Error(uiT("app.extra.52","No se pudo leer la imagen")));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error(uiT("app.extra.53","Imagen inválida")));image.onload=()=>{const scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/webp',.78))};image.src=reader.result};reader.readAsDataURL(file)})}

document.addEventListener('click',event=>{const button=event.target.closest('[data-a]');if(!button)return;const action=ACT[button.dataset.a];if(action){event.preventDefault();if(typeof actionAllowed==='function'&&!actionAllowed(button.dataset.a,button.dataset))return;Promise.resolve().then(()=>action(button.dataset,button)).catch(error=>{if($('#modal .err'))$('#modal .err').textContent=error.message;else alert(error.message)})}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.name=='p'){const o=t.selectedOptions[0],r=t.closest('.item'),isV=!!document.querySelector('#modal h3')?.textContent.includes('venta');r.querySelector('[name=u]').value=o.value?(isV?o.dataset.pr:o.dataset.co):''}
  if(t.id=='pf'||t.id=='pt'){P.from=$('#pf').value;P.to=$('#pt').value;view()}
  if(t.id=='msel'){MAY=t.value;view()}
  if(t.id=='rf'&&t.files[0]){restoreFile(t.files[0]).catch(error=>alert(error.message));t.value=''}});
document.addEventListener('input',e=>{if(e.target.closest('.ln'))sumTot()});
window.addEventListener('beforeunload',event=>{if(receiptMutation||pendingCloudOperation||saveVersion>savedVersion){event.preventDefault();event.returnValue=''}});
window.addEventListener('online',()=>{if(pendingCloudOperation&&!sessionExpired)retryCloudOperation();else if(CO&&saveVersion>savedVersion)flush()});
document.addEventListener('DOMContentLoaded',boot,{once:true});

// Keep active sessions alive without polling while the person is away.
let lastCloudActivity=Date.now();
for(const name of ['pointerdown','keydown'])window.addEventListener(name,()=>{lastCloudActivity=Date.now()},{passive:true});
setInterval(async()=>{
  if(!U||document.hidden||sessionExpired||Date.now()-lastCloudActivity>900000)return;
  try{await api('session','POST',{})}catch(error){if(error.status===401){sessionExpired=true;setSt('Sin guardar · La sesión venció. Vuelve a ingresar antes de continuar.')}}
},900000);
