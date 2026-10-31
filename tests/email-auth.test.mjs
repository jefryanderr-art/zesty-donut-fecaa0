import { RECOVERY_ERROR, RESET_ERROR, missingIdentityUser, accessMailError, attemptScopes } from '../netlify/lib/email-auth.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AuthError, MissingIdentityError } from '@netlify/identity';
import { UNCONFIRMED_MESSAGE, RESEND_MESSAGE, identityStatus, isUnconfirmed, loginFailure, resendConfirmation } from '../netlify/lib/email-auth.mjs';

const providerError = (message, status) => AuthError.from(Object.assign(new Error(message), { status }));
test('reconoce correo sin confirmar antes de clasificar credenciales, incluido AuthError con cause', () => {
  for (const message of ['invalid_grant: Email not confirmed', 'Email address not yet verified', 'email_not_confirmed', 'Correo no confirmado', 'Please confirm your email', 'Email has not been confirmed', 'email_confirmation_required']) {
    for (const status of [400, 401, 422]) {
      const error = providerError(message, status);
      assert.equal(identityStatus(error), status);
      assert.equal(isUnconfirmed(error), true);
      assert.deepEqual(loginFailure(error), { error: UNCONFIRMED_MESSAGE, status: 403, code: 'EMAIL_UNCONFIRMED' });
    }
  }
});
test('solo errores explícitos de credenciales muestran contraseña incorrecta; no filtra errores internos', () => {
  for (const message of ['invalid_grant: No user found with that email, or password invalid.', 'Invalid login credentials', 'Incorrect password']) {
    assert.deepEqual(loginFailure(providerError(message, 400)), { error: 'Correo o contraseña incorrectos', status: 401 });
  }
  for (const error of [providerError('SMTP unavailable', 500), providerError('upstream unavailable', 401), new Error('network failure')]) {
    const result = loginFailure(error);
    assert.notEqual(result.error, 'Correo o contraseña incorrectos');
    assert.ok(!/SMTP|upstream|network/.test(result.error));
  }
  assert.equal(loginFailure(providerError('rate limited', 429)).status, 429);
});

const source = await readFile(new URL('../netlify/functions/api.mjs', import.meta.url), 'utf8');
const routeSource = source.slice(source.indexOf('const handleRequest ='), source.indexOf('\nexport default async'));
function fixture(overrides = {}) {
  const calls = { audit: 0, adminSessions: 0, signup: [], sessions: 0, accounts: 0, consume: 0 };
  const json = (value, status = 200) => Response.json(value, { status });
  const dependencies = {
    process: { env: {} }, DEFAULT_GOOGLE_CLIENT_ID: '', configuredAdminEmail: () => '', adminPasswordLogin: () => true, cleanEmail: value => String(value || '').trim().toLowerCase(), companyName: value => String(value || '').trim(), validateProfile: () => ({businessType:'comercio'}),
    json, fail: (message, status = 400) => json({ error: message }, status), AuthError, MissingIdentityError,
    UNCONFIRMED_MESSAGE, RESEND_MESSAGE, identityStatus, loginFailure, resendConfirmation, RECOVERY_ERROR, RESET_ERROR, missingIdentityUser, accessMailError, attemptScopes,
    recordAccessMailError: async () => {}, requestPasswordRecovery: async () => {}, recoverPassword: async () => ({email:"confirmed@example.invalid",confirmedAt:"now"}),
    authenticateIdentity: operation => operation(), limitAttempts: async () => true,
    confirmationAttempt: async () => true,
    same: (a,b) => a === b,
    users: {}, customerEvents: {},
    db: { insert: () => ({ values: () => { calls.audit++; return {onConflictDoNothing: async () => {}}; } }) },
    consumeConfirmationGrant: async (email, grant) => { calls.consume++; return email === 'pending@example.invalid' && grant === 'valid-grant'; },
    unconfirmedLogin: async () => json({ error: UNCONFIRMED_MESSAGE, code: 'EMAIL_UNCONFIRMED', confirmationGrant: 'valid-grant' }, 403),
    login: async () => { throw providerError('invalid_grant: Email not confirmed', 400); },
    signup: async (...args) => { calls.signup.push(args); return { email: args[0] }; },
    getSettings: async () => ({ disableSignup: false, autoconfirm: false }),
    confirmEmail: async () => ({ email: 'confirmed@example.invalid', confirmedAt: '2026-10-30T12:00:00Z' }),
    ensureAccount: async () => { calls.accounts++; },
    issueSession: async (email, admin) => { calls.sessions++; if(admin)calls.adminSessions++; return json({ ok: true }); },
    ...overrides,
  };
  const route = new Function(...Object.keys(dependencies), routeSource + ';return handleRequest')(...Object.values(dependencies));
  return { calls, request: (path, body, headers = {}) => route(new Request('https://example.invalid/api/' + path, { method: 'POST', headers: { origin: 'https://example.invalid', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }), { cookies: { delete() {} } }, {}) };
}
test('login entrega el aviso y permiso de reenvío sin crear cuenta ni sesión', async () => {
  const { request, calls } = fixture();
  const response = await request('login', { email: 'pending@example.invalid', password: 'example-password' });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: UNCONFIRMED_MESSAGE, code: 'EMAIL_UNCONFIRMED', confirmationGrant: 'valid-grant' });
  assert.equal(calls.accounts, 0); assert.equal(calls.sessions, 0);
});
test('login confirmado conserva la emisión normal de sesión y la inicialización existente', async () => {
  const { request, calls } = fixture({ login: async () => ({ email: 'confirmed@example.invalid', confirmedAt: 'now' }) });
  assert.equal((await request('login', { email: 'confirmed@example.invalid', password: 'example-password' })).status, 200);
  assert.equal(calls.sessions, 1); assert.equal(calls.accounts, 1);
});
test('confirmación devuelve el correo validado y no escribe cuentas ni sesiones de clientes', async () => {
  const { request, calls } = fixture();
  const response = await request('confirm', { token: 'example-confirmation' });
  assert.deepEqual(await response.json(), { ok: true, confirmed: true, email: 'confirmed@example.invalid' });
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(calls.sessions, 0); assert.equal(calls.accounts, 0);
});
test('confirmación no anuncia éxito si Identity no confirmó o el enlace caducó', async () => {
  for (const confirmEmail of [async () => ({ email: 'pending@example.invalid' }), async () => { throw providerError('Token expired', 422); }]) {
    const { request, calls } = fixture({ confirmEmail });
    const response = await request('confirm', { token: 'example-expired' });
    assert.ok([400, 403].includes(response.status));
    assert.equal((await response.json()).confirmed, undefined);
    assert.equal(calls.accounts, 0); assert.equal(calls.sessions, 0);
  }
});
test('reenvío responde igual con permiso válido, inexistente, caducado y fallo del proveedor', async () => {
  for (const [email, grant, overrides] of [
    ['pending@example.invalid', 'valid-grant', {}],
    ['unknown@example.invalid', 'valid-grant', {}],
    ['pending@example.invalid', 'expired-grant', {}],
    ['pending@example.invalid', 'valid-grant', { signup: async () => { throw providerError('delivery failure', 500); } }],
  ]) {
    const { request, calls } = fixture(overrides);
    const response = await request('resend-confirmation', { email, grant, password: 'example-password' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, message: RESEND_MESSAGE });
    if (email === 'unknown@example.invalid' || grant !== 'valid-grant') assert.equal(calls.signup.length, 0);
    assert.equal(calls.accounts, 0); assert.equal(calls.sessions, 0);
  }
});
test('reenvío no cambia metadatos y no opera con registro cerrado, autoconfirmación o límite agotado', async () => {
  const normal = fixture();
  await normal.request('resend-confirmation', { email: 'pending@example.invalid', grant: 'valid-grant', password: 'example-password' });
  assert.deepEqual(normal.calls.signup, [['pending@example.invalid', 'example-password', {}]]);
  for (const config of [{ disableSignup: true }, { autoconfirm: true }]) {
    const { request, calls } = fixture({ getSettings: async () => config });
    await request('resend-confirmation', { email: 'pending@example.invalid', grant: 'valid-grant', password: 'example-password' });
    assert.equal(calls.signup.length, 0);
  }
  const limited = fixture({ limitAttempts: async () => false });
  assert.equal((await limited.request('resend-confirmation', { email: 'pending@example.invalid', grant: 'valid-grant', password: 'example-password' })).status, 429);
  assert.equal(limited.calls.consume, 0); assert.equal(limited.calls.signup.length, 0);
});
test('reenvío rechaza origen ajeno y contenido no JSON antes de tocar Identity', async () => {
  for (const [headers, status] of [[{ origin: 'https://other.invalid' }, 403], [{ 'content-type': 'text/plain' }, 415]]) {
    const { request, calls } = fixture();
    assert.equal((await request('resend-confirmation', {}, headers)).status, status);
    assert.equal(calls.signup.length, 0); assert.equal(calls.consume, 0);
  }
});

// Executes the existing browser script with only DOM/network boundaries mocked.
const { default: vm } = await import('node:vm');
const browserSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function browserFixture(confirmResult = { confirmed: true, email: 'confirmed@example.invalid' }) {
  const status = { textContent: '', dataset: {} }, email = { value: '' }, password = { value: 'example-password' }, resend = { hidden: false };
  const nodes = { '#auth-status': status, '#resend-confirmation': resend, '#af [name=em]': email, '#af [name=pw]': password };
  const calls = [];
  const location = { pathname: '/', search: '?source=email', hash: '#confirmation_token=example-token' };
  const context = vm.createContext({
    document: { querySelector: selector => nodes[selector], addEventListener() {} },
    window: { addEventListener() {} }, localStorage: { removeItem() {}, getItem() { throw new Error('Unexpected panel navigation'); } },
    setInterval() {}, URLSearchParams, location, history: { replaceState: (...args) => { calls.push(['clean-url', args[2]]); location.hash = ''; } },
    apiStub: async path => {
      calls.push([path]);
      if (path === 'confirm') { if (confirmResult instanceof Error) throw confirmResult; return confirmResult; }
      if (path === 'config') return { site: {} };
      throw new Error('No active application session');
    },
  });
  vm.runInContext(browserSource, context);
  vm.runInContext("api=apiStub;authView=()=>{};applyTheme=()=>{};ACT.tab=data=>{AM=data.m;clearAuthStatus()}", context);
  return { context, status, email, password, resend, calls };
}
test('enlace confirmado limpia el token antes de enviarlo, muestra éxito y abre Ingresar con correo', async () => {
  const fixture = browserFixture();
  await vm.runInContext('boot()', fixture.context);
  assert.deepEqual(fixture.calls, [['clean-url', '/?source=email'], ['confirm'], ['config']]);
  assert.equal(fixture.status.textContent, 'Correo confirmado. Ya puedes ingresar');
  assert.equal(fixture.status.dataset.tone, 'success');
  assert.equal(fixture.email.value, 'confirmed@example.invalid');
  assert.equal(vm.runInContext('AM', fixture.context), 'login');
});
test('registro pendiente muestra éxito en el mismo lugar y limpieza oculta reenvío y su permiso', async () => {
  const fixture = browserFixture();
  await vm.runInContext('session({confirmationRequired:true})', fixture.context);
  assert.match(fixture.status.textContent, /^Cuenta creada\. Revisa tu correo/);
  assert.equal(fixture.status.dataset.tone, 'success');
  assert.equal(fixture.password.value, '');
  vm.runInContext("confirmationResend={grant:'example-grant'};clearAuthStatus()", fixture.context);
  assert.equal(fixture.status.textContent, '');
  assert.equal(fixture.resend.hidden, true);
  assert.equal(vm.runInContext('confirmationResend', fixture.context), null);
});
test('enlace fallido conserva error en el mismo lugar sin anunciar confirmación', async () => {
  const fixture = browserFixture(new Error('El enlace de confirmación no es válido o ha caducado.'));
  await vm.runInContext('boot()', fixture.context);
  assert.match(fixture.status.textContent, /ha caducado/);
  assert.equal(fixture.status.dataset.tone, 'error');
  assert.equal(fixture.email.value, '');
});

const adminAddress = 'admin@example.invalid';
test('administrador sin credenciales, sin confirmación o con correo distinto no recibe sesión', async () => {
  for (const login of [async () => {throw new Error('invalid');}, async () => ({email:adminAddress}), async () => ({email:'other@example.invalid',confirmedAt:'now'})]) {
    const {request,calls} = fixture({configuredAdminEmail:()=>adminAddress, login});
    assert.equal((await request('login',{email:adminAddress,password:String(Date.now())})).status,401);
    assert.equal(calls.sessions,0);
    assert.ok(calls.audit > 0);
  }
});
test('registro administrativo se rechaza antes de Identity y no emite sesión',async()=>{
  const {request,calls}=fixture({configuredAdminEmail:()=>adminAddress});
  assert.equal((await request('register',{email:adminAddress,password:String(Date.now()),company:'Ejemplo'})).status,403);
  assert.equal(calls.signup.length,0);assert.equal(calls.sessions,0);
});
test('modo solo Google rechaza contraseña válida y el límite bloquea nuevas verificaciones',async()=>{
  for(const overrides of [{adminPasswordLogin:()=>false},{confirmationAttempt:async()=>false}]) {
    let verified=0;
    const {request,calls}=fixture({configuredAdminEmail:()=>adminAddress,login:async()=>{verified++;return {email:adminAddress,confirmedAt:'now'};},...overrides});
    assert.ok([401,429].includes((await request('login',{email:adminAddress,password:String(Date.now())})).status));
    assert.equal(verified,0);assert.equal(calls.sessions,0);
  }
});
test('confirmar el correo de administrador nunca entrega sesión',async()=>{
 const {request,calls}=fixture({configuredAdminEmail:()=>adminAddress,confirmEmail:async()=>({email:adminAddress,confirmedAt:'now'})});
 assert.equal((await request('confirm',{token:'test-confirmation'})).status,200);
 assert.equal(calls.sessions,0);assert.equal(calls.accounts,0);
});

test('registro ordinario confirmado solo crea sesión sin privilegios',async()=>{
 const previous=globalThis.AcontecInvoiceDesign;
 globalThis.AcontecInvoiceDesign={country:value=>value};
 try {
  const {request,calls}=fixture({configuredAdminEmail:()=>adminAddress,signup:async(email)=>({email,confirmedAt:'now'})});
  const response=await request('register',{email:'customer@example.invalid',password:String(Date.now()),company:'Ejemplo',admin:true,platformAdmin:true});
  assert.equal(response.status,200);assert.equal(calls.sessions,1);assert.equal(calls.adminSessions,0);
 }finally{globalThis.AcontecInvoiceDesign=previous;}
});

test('recuperación distingue usuario ausente de fallos sin crear cuentas', async () => {
 for (const [message,status,expected] of [['User not found',404,200],['SMTP failed',500,503],['rate limited',429,429],['endpoint not found',404,503]]) {
  const entries=[];
  const f=fixture({requestPasswordRecovery:async()=>{throw providerError(message,status)},recordAccessMailError:async(action,error)=>entries.push(accessMailError(action,error))});
  const response=await f.request('forgot-password',{email:'customer@example.invalid'});
  assert.equal(response.status,expected);
  const body=await response.json();
  if(expected!==200){assert.equal(body.error,RECOVERY_ERROR);assert.equal(entries.length,1)}else assert.equal(entries.length,0);
  assert.equal(f.calls.signup.length,0);assert.equal(f.calls.accounts,0);assert.equal(f.calls.sessions,0);
 }
});
test('restablecimiento oculta mensajes del proveedor',async()=>{
 const f=fixture({recoverPassword:async()=>{throw providerError('private provider response',422)}});
 const response=await f.request('reset-password',{token:'expired',password:'new-password'});
 assert.equal(response.status,400);assert.equal((await response.json()).error,RESET_ERROR);assert.equal(f.calls.sessions,0);
});
test('registro, correo, confirmación e ingreso conservan la secuencia',async()=>{
 let confirmed=false;const sent=[];
 const f=fixture({signup:async email=>{sent.push('confirmation');return {email}},confirmEmail:async()=>{confirmed=true;return {email:'confirmed@example.invalid',confirmedAt:'now'}},login:async()=>{if(!confirmed)throw providerError('Email not confirmed',400);return {email:'confirmed@example.invalid',confirmedAt:'now'}}});
 const previous=globalThis.AcontecInvoiceDesign;globalThis.AcontecInvoiceDesign={country:x=>x};
 try {
  const result=await f.request('register',{email:'confirmed@example.invalid',password:'password-before',company:'Ejemplo'});
  assert.equal((await result.json()).confirmationRequired,true);assert.deepEqual(sent,['confirmation']);assert.equal(f.calls.sessions,0);
  assert.equal((await f.request('confirm',{token:'confirmation-link'})).status,200);assert.equal(f.calls.sessions,0);
  assert.equal((await f.request('login',{email:'confirmed@example.invalid',password:'password-before'})).status,200);assert.equal(f.calls.sessions,1);
 }finally{globalThis.AcontecInvoiceDesign=previous}
});
test('recuperación, enlace, nueva contraseña e ingreso',async()=>{
 let password='password-before',link=false;
 const f=fixture({requestPasswordRecovery:async()=>{link=true},recoverPassword:async(token,next)=>{assert.ok(link);assert.equal(token,'recovery-link');password=next;return {email:'confirmed@example.invalid',confirmedAt:'now'}},login:async(email,candidate)=>{if(candidate!==password)throw providerError('Invalid login credentials',400);return {email,confirmedAt:'now'}}});
 assert.equal((await f.request('forgot-password',{email:'confirmed@example.invalid'})).status,200);
 assert.equal((await f.request('reset-password',{token:'recovery-link',password:'password-after'})).status,200);
 assert.equal((await f.request('login',{email:'confirmed@example.invalid',password:'password-before'})).status,401);
 assert.equal((await f.request('login',{email:'confirmed@example.invalid',password:'password-after'})).status,200);
});
test('cuotas separan acción y cuenta sin dirección unknown compartida',()=>{
 const request=new Request('https://example.invalid');
 const a=attemptScopes(request,{ip:'192.0.2.1'},'login',{email:'a@example.invalid'});
 const b=attemptScopes(request,{ip:'192.0.2.1'},'login',{email:'b@example.invalid'});
 assert.notDeepEqual(a,b);assert.equal(a.maximum,30);
 assert.equal(attemptScopes(request,{},'forgot-password',{email:'a@example.invalid'}).address,'');
 assert.equal(attemptScopes(request,{},'forgot-password',{}).maximum,5);
});
test('errores técnicos nunca incorporan el mensaje ni código arbitrario',()=>{
 const result=accessMailError('forgot-password',{status:500,code:'private@example.invalid',message:'private password'});
 assert.deepEqual(result,{action:'forgot-password',status:500,code:'SERVICE_UNAVAILABLE'});
});

test('cuotas reales conservan aislamiento por acción, IP y usuario y límite total',async()=>{
 const start=source.indexOf('async function limitAttempts('),end=source.indexOf('async function recordAccessMailError(',start);
 const counts=new Map();
 const limit=new Function('attemptScopes','confirmationAttempt',source.slice(start,end)+';return limitAttempts')(attemptScopes,async(scope,value,max)=>{const key=scope+':'+value;const count=(counts.get(key)||0)+1;counts.set(key,count);return count<=max});
 const request=new Request('https://example.invalid');const context={ip:'192.0.2.1'};
 for(let i=0;i<30;i++)assert.equal(await limit(request,context,'worker-login',{username:'worker-a'}),true);
 assert.equal(await limit(request,context,'worker-login',{username:'worker-a'}),false);
 assert.equal(await limit(request,context,'worker-login',{username:'worker-b'}),true);
 assert.equal(await limit(request,context,'forgot-password',{email:'worker-a@example.invalid'}),true);
 for(let i=0;i<267;i++)await limit(request,context,'login',{email:'unique-'+i+'@example.invalid'});
 assert.equal(await limit(request,context,'login',{email:'another@example.invalid'}),false);
 assert.equal(await limit(request,{ip:'192.0.2.2'},'login',{email:'another@example.invalid'}),true);
});
