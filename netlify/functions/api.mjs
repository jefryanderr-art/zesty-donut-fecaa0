import { discountRoute } from '../lib/discounts.mjs';
import '../../public/cloud-sync.js';
import {deliverMessages} from '../lib/service-mail.mjs';
import {serviceReceipt} from '../lib/service-receipts.mjs';
import {plans, billingRoute, subscription, requireBilling} from '../lib/billing.mjs';
import {ensurePlanTestCompany,testCompaniesRoute,requirePlatform,platformSummary,platformAction,supportAction} from '../lib/platform.mjs';
import { gunzipSync } from 'node:zlib';
import { statement } from '../lib/reporting.mjs';
import { integrityReport } from '../lib/accounting-engine.mjs';
import { scopeBranch } from '../lib/branches.mjs';
import { retainedCompanyData } from '../lib/accounting-storage.mjs';
import { getStore } from '@netlify/blobs';
import { login, signup, confirmEmail, requestPasswordRecovery, recoverPassword, AuthError, MissingIdentityError } from '@netlify/identity';
import { OAuth2Client } from 'google-auth-library';
import { timingSafeEqual, createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, lt, or, sql, isNull } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, companies, siteContent, loginAttempts, sessions, companyMembers, auditEvents, companyBackups, saveFailures } from '../../db/schema.ts';
import { createOwnedCompany, MODULES, allowed, requireModule, allData, equal, accessError, accessibleCompanies, companyAccess, projectData, mergeData, safeMember, manageMember, verifyPassword, updateCompany, audit, migrateAccountingStorage } from '../lib/access.mjs';
import { runOperation, guardLedgerMutation } from '../lib/operations.mjs';
import { PLATFORM_OWNER, receiptRecords, cashAdministrator, operatorId } from '../lib/policies.mjs';
import { customerAdmin, isPlatformAdmin, ensureAcontecCompany, legalDocument, legalState, acceptLegal } from '../lib/customer-admin.mjs';

export const config = { path: '/api/*' };

const SESSION = 'acontec_session';
const DEFAULT_GOOGLE_CLIENT_ID = '855439443676-ol5h9lalerke769mdaqb0u4rdbpcrjh1.apps.googleusercontent.com';
const IMAGE = /^\/api\/image\?key=[a-f0-9-]+\.webp$/;
const siteRevision = content => content ? createHash('sha256').update(JSON.stringify(content)).digest('hex') : null;

function siteContacts(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Los contactos deben tener un formato válido.');
  const contacts = {};
  for (const key of ['whatsapp', 'phone', 'email', 'facebook', 'instagram', 'website']) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!value) { contacts[key] = ''; continue; }
    if (value.length > 500) throw new Error('El contacto es demasiado largo.');
    if (['whatsapp', 'phone'].includes(key)) {
      const digits = value.replace(/\D/g, '');
      if (!/^[+\d\s().-]+$/.test(value) || !/^\d{7,15}$/.test(digits)) throw new Error('Escribe un teléfono válido con código de país, sin enlaces.');
      contacts[key] = key === 'whatsapp' ? digits : value;
    } else if (key === 'email') {
      if (value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) throw new Error('Escribe un correo de contacto válido.');
      contacts[key] = value;
    } else {
      let link;
      try { link = new URL(value); } catch { throw new Error('Escribe los enlaces completos, comenzando con https://.'); }
      if (link.protocol !== 'https:' || !link.hostname.includes('.') || link.username || link.password || link.port) throw new Error('Utiliza un enlace público seguro que comience con https://.');
      const domain = key === 'facebook' ? 'facebook.com' : key === 'instagram' ? 'instagram.com' : '';
      if (domain && link.hostname !== domain && !link.hostname.endsWith('.' + domain)) throw new Error('El enlace debe pertenecer a ' + domain + '.');
      contacts[key] = link.href;
    }
  }
  return contacts;
}
async function storeImage(value, maxBytes = 1500000) {
  const text = String(value || '');
  if (!text) return '';
  if (IMAGE.test(text)) return text;
  if (!text.startsWith('data:image/webp;base64,')) throw new Error('image');
  const image = Buffer.from(text.slice('data:image/webp;base64,'.length), 'base64');
  if (image.length > maxBytes || image.toString('ascii', 0, 4) !== 'RIFF' || image.toString('ascii', 8, 12) !== 'WEBP') throw new Error('image');
  const key = randomUUID() + '.webp';
  await getStore({ name: 'acontec-images', consistency: 'strong' }).set(key, image);
  return '/api/image?key=' + key;
}
const same = (first, second) => timingSafeEqual(
  createHash('sha256').update(String(first)).digest(),
  createHash('sha256').update(String(second)).digest(),
);
const cleanEmail = value => String(value || '').trim().toLowerCase();
const companyName = value => String(value || '').trim().slice(0, 80);
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache, no-store, must-revalidate', ...headers },
});
const fail = (message, status = 400) => json({ error: message }, status);
const sessionToken = request => (request.headers.get('cookie') || '').split(';').map(part => part.trim())
  .find(part => part.startsWith(SESSION + '='))?.slice(SESSION.length + 1) || '';
const hashToken = token => createHash('sha256').update(token).digest('hex');
async function issueSession(email, admin, request, memberId = null) {
  const token = randomBytes(32).toString('hex');
  await db.insert(sessions).values({ tokenHash: hashToken(token), email, admin, memberId, expiresAt: new Date(Date.now() + 28800000) });
  await db.update(users).set({ lastAccessAt: new Date() }).where(eq(users.email, email));
  await db.delete(sessions).where(or(lt(sessions.expiresAt, new Date()), eq(sessions.tokenHash, hashToken(sessionToken(request)))));
  return json({ ok: true }, 200, { 'set-cookie': `${SESSION}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
}
async function readSession(request) {
  const token = sessionToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [session] = await db.select({ email: sessions.email, admin: sessions.admin, memberId: sessions.memberId, activeBranchId: sessions.activeBranchId, activeCompanyId:sessions.activeCompanyId, name: users.name, expiresAt: sessions.expiresAt }).from(sessions).innerJoin(users, eq(users.email, sessions.email))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  if (session?.memberId) {
    const [member] = await db.select().from(companyMembers).where(and(eq(companyMembers.id, session.memberId), eq(companyMembers.active, true)));
    if (!member?.username) return null;
    session.member = member;
  }
  // Renew at most once per hour while requests keep the session active.
  if (session && session.expiresAt.getTime() < Date.now() + 25200000) {
    await db.update(sessions).set({expiresAt: new Date(Date.now() + 28800000)}).where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
    globalThis.Netlify?.context?.cookies?.set({name: SESSION, value: token, path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 28800});
  }
  return session || null;
}
async function authenticateIdentity(operation) {
  const cookies = globalThis.Netlify?.context?.cookies;
  if (!cookies) return await operation();
  const originalSet = cookies.set;
  cookies.set = (cookie, value) => {
    const name = typeof cookie === 'string' ? cookie : cookie.name;
    if (!['nf_jwt', 'nf_refresh'].includes(name)) originalSet.call(cookies, cookie, value);
  };
  try { return await operation(); } finally { cookies.set = originalSet; }
}
async function ensureAccount(email, name, description = '', personName = '') {
  await db.insert(users).values({ email, profile: { state: 'sin_plan' } }).onConflictDoNothing();
  if (personName) await db.update(users).set({ name: String(personName).trim().slice(0, 200) }).where(eq(users.email, email));
  const owned = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerEmail, email)).limit(1);
  if (!owned.length) {
    const hash = createHash('sha256').update('acontec:' + email).digest('hex');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
    await db.insert(companies).values({ id, ownerEmail: email, name: companyName(name) || 'Mi empresa', description: String(description || '').trim().slice(0, 2000) }).onConflictDoNothing();
  }
}
async function limitAttempts(request, context) {
  const address = context?.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const window = Math.floor(Date.now() / 900000);
  const key = createHash('sha256').update(address + ':' + window).digest('hex');
  // Expired windows never authorize requests; cleanup need not run on every attempt.
  if (randomBytes(1)[0] < 8) await db.delete(loginAttempts).where(lt(loginAttempts.expiresAt, new Date()));
  const [attempt] = await db.insert(loginAttempts).values({ key, expiresAt: new Date((window + 1) * 900000) })
    .onConflictDoUpdate({ target: loginAttempts.key, set: { count: sql`${loginAttempts.count} + 1` } })
    .returning({ count: loginAttempts.count });
  return attempt.count <= 30;
}

const handleRequest = async (request, context, metrics) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const method = request.method;
  const adminEmail = cleanEmail(process.env.ADMIN_EMAIL) || PLATFORM_OWNER;
  const isAuthorizedAdminPassword = candidate => {
    if (process.env.ADMIN_PASSWORD && same(candidate, process.env.ADMIN_PASSWORD)) return true;
    return false;
  };
  const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim() || DEFAULT_GOOGLE_CLIENT_ID;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return fail('Método no permitido', 405);
  if (method !== 'GET') {
    if (request.headers.get('origin') !== url.origin) return fail('Origen no autorizado', 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return fail('Se requiere JSON', 415);
  }
  try {
    if (path === 'config' && method === 'GET') {
      const [site] = await db.select().from(siteContent).where(eq(siteContent.id, 'public'));
      return json({ googleClientId, site: site?.content || {}, siteRevision: siteRevision(site?.content) });
    }
    if(path==='plans'&&method==='GET')return json({plans:(await plans()).filter(p=>p.active)});
    if (path === 'legal' && method === 'GET') return json(await legalDocument());
    if (path === 'image' && method === 'GET') {
      const key = url.searchParams.get('key') || '';
      if (!/^[a-f0-9-]+\.webp$/.test(key)) return fail('Imagen no encontrada', 404);
      const image = await getStore({ name: 'acontec-images', consistency: 'strong' }).get(key, { type: 'arrayBuffer' });
      return image ? new Response(image, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } }) : fail('Imagen no encontrada', 404);
    }
    let rawBody = '';
    if (method !== 'GET') {
      const bytes = Buffer.from(await request.arrayBuffer());
      metrics.bytes = bytes.length;
      if (bytes.length > 5500000) return fail('El contenido supera el límite de envío.', 413);
      try {
        rawBody = request.headers.get('content-encoding') === 'gzip'
          ? gunzipSync(bytes, {maxOutputLength: 5500001}).toString('utf8') : bytes.toString('utf8');
      } catch { return fail('No se pudo leer la solicitud comprimida o supera el límite.', 413); }
    }
    if (Buffer.byteLength(rawBody) > 5500000) return fail('El contenido supera el límite de 5 MB', 413);
    let body = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } catch { return fail('JSON inválido'); }
      if (!body || Array.isArray(body) || typeof body !== 'object') return fail('JSON inválido');
    }
    if (path === 'forgot-password' && method === 'POST') {
      if (!await limitAttempts(request, context)) return fail('Demasiados intentos. Espera 15 minutos.', 429);
      const email = cleanEmail(body.email);
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Escribe un correo electrónico válido');
      try {
        await authenticateIdentity(() => requestPasswordRecovery(email));
      } catch (error) {
        if (error?.status === 404 || error?.message?.includes('not found')) {
          const [existingUser] = await db.select().from(users).where(eq(users.email, email));
          if (existingUser) {
            try {
              const tempPw = randomBytes(16).toString('hex') + 'A1!';
              await authenticateIdentity(() => signup(email, tempPw, { company: 'Mi empresa' }));
              await authenticateIdentity(() => requestPasswordRecovery(email));
            } catch {
              // Ignore fallback error
            }
          }
        }
      }
      return json({ ok: true, message: 'Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también tu bandeja de spam.' });
    }
    if (path === 'reset-password' && method === 'POST') {
      if (!await limitAttempts(request, context)) return fail('Demasiados intentos. Espera 15 minutos.', 429);
      const token = String(body.token || '').trim();
      const newPassword = String(body.password || '');
      if (!token) return fail('Falta el token de recuperación');
      if (newPassword.length < 8 || newPassword.length > 256) return fail('La contraseña debe tener al menos 8 caracteres');
      let identityUser;
      try {
        identityUser = await authenticateIdentity(() => recoverPassword(token, newPassword));
      } catch (err) {
        return fail(err?.message || 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.', 400);
      }
      const email = cleanEmail(identityUser?.email);
      if (!email) return fail('No se pudo restablecer la contraseña', 400);
      const isOwnerAdmin = email === adminEmail || email === PLATFORM_OWNER;
      await ensureAccount(email, isOwnerAdmin ? 'Acontec' : identityUser.userMetadata?.company);
      if (isOwnerAdmin) {
        await db.update(users).set({ platformAdmin: true }).where(eq(users.email, email));
        await ensureAcontecCompany(email);
      }
      return await issueSession(email, isOwnerAdmin, request);
    }
    if (path === 'confirm' && method === 'POST') {
      if (!await limitAttempts(request, context)) return fail('Demasiados intentos. Espera 15 minutos.', 429);
      const identityUser = await authenticateIdentity(() => confirmEmail(String(body.token || '')));
      const email = cleanEmail(identityUser.email);
      if (!email || !identityUser.confirmedAt) return fail('No se pudo confirmar la cuenta', 403);
      const isOwnerAdmin = email === adminEmail || email === PLATFORM_OWNER;
      await ensureAccount(email, isOwnerAdmin ? 'Acontec' : identityUser.userMetadata?.company, identityUser.userMetadata?.description);
      if (isOwnerAdmin) {
        await db.update(users).set({ platformAdmin: true }).where(eq(users.email, email));
        await ensureAcontecCompany(email);
      }
      return await issueSession(email, isOwnerAdmin, request);
    }
    if (path === 'worker-login' && method === 'POST') {
      if (!await limitAttempts(request, context)) return fail('Demasiados intentos. Espera 15 minutos.', 429);
      const username = String(body.username || '').trim().toLowerCase();
      const [member] = /^[a-z][a-z0-9._-]{3,39}$/.test(username) ? await db.select().from(companyMembers).where(eq(companyMembers.username, username)) : [];
      const valid = await verifyPassword(body.password || '', member?.passwordHash);
      if (!valid || !member?.active) return fail('Usuario o contraseña incorrectos.', 401);
      const email = member.id + '@access.acontec.invalid';
      await db.insert(users).values({ email }).onConflictDoNothing();
      await audit(db, member.companyId, { email, member }, 'Ingreso de colaborador', []);
      return await issueSession(email, false, request, member.id);
    }
    if (['register', 'login', 'google'].includes(path) && method === 'POST') {
      if (!await limitAttempts(request, context)) return fail('Demasiados intentos. Espera 15 minutos.', 429);
      const email = cleanEmail(body.email);
      const password = String(body.password || '');
      if (path !== 'google' && (!/^\S+@\S+\.\S+$/.test(email) || password.length > 256)) return fail('Correo o contraseña inválidos');
      if (path !== 'google' && email.endsWith('@access.acontec.invalid')) return fail('Correo o contraseña inválidos');
      if (path === 'register') {
        if (password.length < 8) return fail('La contraseña debe tener al menos 8 caracteres');
        if (!companyName(body.company)) return fail('Escribe el nombre de tu empresa');
        const isOwnerAdmin = email === adminEmail || email === PLATFORM_OWNER;
        let identityUser;
        try {
          identityUser = await authenticateIdentity(() => signup(email, password, { company: companyName(body.company), description: String(body.description || '').trim().slice(0, 2000) }));
        } catch (error) {
          return fail(error?.message || 'No se pudo crear la cuenta', error?.status || 400);
        }
        await ensureAccount(email, isOwnerAdmin ? 'Acontec' : body.company, body.description);
        if (isOwnerAdmin) {
          await db.update(users).set({ platformAdmin: true }).where(eq(users.email, email));
          await ensureAcontecCompany(email);
        }
        if (!identityUser?.confirmedAt) return json({ confirmationRequired: true });
        return await issueSession(email, isOwnerAdmin, request);
      }
      if (path === 'login') {
        const isOwnerAdmin = email === adminEmail || email === PLATFORM_OWNER;
        if (isOwnerAdmin) {
          let verified = isAuthorizedAdminPassword(password);
          if (!verified) {
            try {
              const identityUser = await authenticateIdentity(() => login(email, password));
              if (identityUser?.email) verified = true;
            } catch {
              // Not verified via Identity either
            }
          }
          if (!verified) return fail('Correo o contraseña incorrectos', 401);
          await ensureAccount(email, 'Acontec');
          await db.update(users).set({ platformAdmin: true }).where(eq(users.email, email));
          await ensureAcontecCompany(email);
          return await issueSession(email, true, request);
        }
        let identityUser;
        try {
          identityUser = await authenticateIdentity(() => login(email, password));
        } catch (error) {
          if (error?.status === 401 || error?.status === 400 || error?.status === 422) {
            return fail('Correo o contraseña incorrectos', 401);
          }
          return fail(error?.message || 'Error al iniciar sesión', error?.status || 400);
        }
        if (!identityUser.confirmedAt) return fail('Confirma tu correo antes de ingresar', 403);
        await ensureAccount(email, identityUser.userMetadata?.company);
        return await issueSession(email, false, request);
      }
      if (!googleClientId) return fail('Falta autorizar este sitio en Google. Consulta la guía de activación de Google.', 503);
      let googleUser;
      try {
        const ticket = await new OAuth2Client(googleClientId).verifyIdToken({ idToken: String(body.credential || ''), audience: googleClientId });
        googleUser = ticket.getPayload();
      } catch { return fail('No se pudo validar tu cuenta de Google', 401); }
      if (!googleUser?.email_verified || !googleUser.email) return fail('Google no confirmó tu correo', 401);
      const googleEmail = cleanEmail(googleUser.email);
      const isOwnerAdmin = googleEmail === adminEmail || googleEmail === PLATFORM_OWNER;
      await ensureAccount(googleEmail, isOwnerAdmin ? 'Acontec' : body.company, '', googleUser.name);
      if (isOwnerAdmin) {
        await db.update(users).set({ platformAdmin: true }).where(eq(users.email, googleEmail));
        await ensureAcontecCompany(googleEmail);
      }
      return await issueSession(googleEmail, isOwnerAdmin, request);
    }
    if (path === 'logout' && method === 'POST') {
      await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(sessionToken(request))));
      context.cookies.delete('nf_jwt');
      context.cookies.delete('nf_refresh');
      return json({ ok: true }, 200, { 'set-cookie': `${SESSION}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }
    const session = await readSession(request);
    if (!session) return fail('Sesión vencida. Ingresa de nuevo.', 401);
    if (path === 'session' && method === 'POST') return json({ok:true});
    if (path === 'me' && method === 'GET' && !session.member && (session.email === PLATFORM_OWNER || session.email === adminEmail)) await ensureAcontecCompany(session.email);
    if(path==='me'&&method==='GET')await ensurePlanTestCompany(session);
    // List summaries only on routes that actually return or need the full list.
    const owned = ['me', 'company'].includes(path) ? await accessibleCompanies(session) : [];
    const isAdmin = await isPlatformAdmin(session);
    const canEditSite = isAdmin;
    const consent = await legalState(session);
    if (path === 'legal/accept' && method === 'POST') return json(await acceptLegal(session, body));
    if(['billing/me','checkout','billing/confirm','cancel'].includes(path))return json(await billingRoute(path,method,body,session,request,isAdmin));
    if(path==='support-grant')return json(await supportAction(session,url.searchParams.get('c'),method,body));
    if(path==='service-receipt'){await requirePlatform(session,url.searchParams.get('c'));return json(await serviceReceipt(method,url.searchParams.get('id'),body,session));}
    if(path==='platform/test-companies'||path.startsWith('platform/test-companies/'))return json(await testCompaniesRoute(session,method,path.split('/')[2]||body.operation,body));
    if(path==='platform'){await requirePlatform(session,url.searchParams.get('c'));if(method==='GET')return json(await platformSummary(url));if(method==='POST'){const result=await platformAction(session,body);if(['message','verifyPayment'].includes(body.operation))context.waitUntil(deliverMessages(20));return json(result);}return fail('Método no permitido.',405);}
    if (path === 'customers-admin') {await requirePlatform(session,url.searchParams.get('c'));return json(await customerAdmin(method, body, url, session));}
    if (consent.required && !isAdmin && path !== 'me') return fail('Debes aceptar los términos de uso y la política de privacidad vigentes.', 428);
    if(['branch-comparison','consolidated'].includes(path)&&method==='GET'){
      const from=url.searchParams.get('from')||'2000-01-01',to=url.searchParams.get('to')||new Date().toISOString().slice(0,10);
      if(![from,to].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d)))||to<from)return fail('Período inválido.');
      return await db.transaction(async client=>{
        if(path==='branch-comparison'){
          const access=await companyAccess(client,url.searchParams.get('c'),session,true);
          requireModule(access,'finanzas');requireModule(access,'sucursales');if(!access.unrestrictedBranches)accessError('Solo dueño o contador con acceso financiero compara sucursales.');
          return json({branches:access.branches.map(branch=>({id:branch.id,name:branch.name,...statement(scopeBranch(access.company.data,{...access,branchId:branch.id}),from,to)}))});
        }
        const ids=[...new Set((url.searchParams.get('ids')||'').split(',').filter(Boolean))].sort();if(!ids.length||ids.length>20)accessError('Selecciona de 1 a 20 empresas.',400);
        const results=[];for(const id of ids){const access=await companyAccess(client,id,session,true);requireModule(access,'finanzas');if(!access.unrestrictedBranches)accessError('Sin acceso financiero completo a una de las empresas.');results.push({id,name:access.company.name,currency:access.company.data?.cfg?.cur||'C$',...statement(access.company.data||{},from,to)})}
        if(new Set(results.map(r=>r.currency)).size>1)accessError('La consolidación requiere la misma moneda base. Convierte y concilia las empresas antes de consolidar.',400);
        const rows=new Map();for(const result of results)for(const row of result.rows){const key=[row.code,row.name,row.tipo,row.nat].join('|'),old=rows.get(key);if(old)for(const field of ['balance','periodBalance'])old[field]=Math.round((old[field]+row[field])*100)/100;else rows.set(key,{...row})}
        const totals=Object.fromEntries(['assets','liabilities','equity','revenue','cost','expense','profit','inventory'].map(key=>[key,Math.round(results.reduce((s,r)=>s+r[key],0)*100)/100]));
        return json({companies:results.map(({rows,...rest})=>rest),rows:[...rows.values()],totals,currency:results[0].currency});
      });
    }
    if(path==='integrity' && method==='GET'){return await db.transaction(async client=>{const access=await companyAccess(client,url.searchParams.get('c'),session,true);requireModule(access,'contabilidad');return json(integrityReport(projectData(access.company.data,access)||{}));});}
    if (path === 'storage-migration' && method === 'POST') return json(await migrateAccountingStorage(url.searchParams.get('c'), session, body));
    if (path === 'discounts' && ['GET','POST'].includes(method)) return json(await discountRoute(url.searchParams.get('c'),session,method,body));
    if (path === 'operations' && method === 'POST') return json(await runOperation(url.searchParams.get('c'), session, body));
    if (path === 'company-logo' && method === 'POST') {
      const access = await companyAccess(db, url.searchParams.get('c'), session);
      requireModule(access,'ajustes',true);
      if (!access.owner) return fail('Solo el dueño configura el logo.', 403);
      if (body.revision !== access.company.revision) return fail('La empresa cambió. Recarga antes de subir el logo.', 409);
      try { return json({ logo: await storeImage(body.image, 300000) }); } catch { return fail('El logo debe ser una imagen WebP válida de hasta 300 KB.'); }
    }
    if (path === 'operation-receipt' && method === 'GET') {
      const companyId = url.searchParams.get('c');
      const access = await companyAccess(db, companyId, session);
      const id = url.searchParams.get('id');
      let source = access.company.data;
      const backupId = url.searchParams.get('backup');
      if (backupId) {
        if (!access.owner || !/^[a-f0-9-]{36}$/.test(backupId)) return fail('Sin permiso para descargar esta versión.', 403);
        const [backup] = await db.select({ data: companyBackups.data }).from(companyBackups).where(and(eq(companyBackups.id, backupId), eq(companyBackups.companyId, companyId)));
        source = backup?.data;
      }
      for(const [name,module] of Object.entries({taxes:'fiscal',pettyVouchers:'cajas',cashMovements:'cajas',costs:'costos'}))if(source?.[name]?.some(record=>record.id===id))requireModule(access,module);
      const data = projectData(source, access);
      const record = receiptRecords(data).find(item => item.id === id);
      if (!record?.receipt?.key?.startsWith(companyId + '/')) return fail('Comprobante no encontrado.', 404);
      const ownFund = access.company.data?.pettyFunds?.some(fund => fund.id === record.fundId && fund.responsible === operatorId(access, session));
      if (!access.owner && !cashAdministrator(access) && record.operatorId !== operatorId(access, session) && !ownFund) return fail('Sin permiso para este comprobante.', 403);
      const file = await getStore({ name: 'acontec-private-receipts', consistency: 'strong' }).get(record.receipt.key, { type: 'arrayBuffer' });
      if (!file) return fail('Comprobante no encontrado.', 404);
      return new Response(file, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': "attachment; filename=comprobante; filename*=UTF-8''" + encodeURIComponent(record.receipt.name), 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
    }
    if (path === 'members') {
      const companyId = url.searchParams.get('c');
      const access = await companyAccess(db, companyId, session);
      requireModule(access,'accesibilidad');
      if (method === 'GET') {
        const members = await db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId)).orderBy(companyMembers.createdAt);
        return json({ owner: access.company.ownerEmail, members: members.map(safeMember), modules: MODULES });
      }
      if (['POST', 'PUT'].includes(method)) {
        if (!allowed(access, 'accesibilidad', true)) return fail('Sin permiso para administrar los accesos.', 403);
        return json({ member: await manageMember(companyId, session, body) });
      }
    }
    if (path === 'audit' && method === 'GET') {
      const companyId = url.searchParams.get('c');
      const access = await companyAccess(db, companyId, session);
      requireModule(access,'auditoria');
      const offset = Number(url.searchParams.get('offset') || 0);
      if (!Number.isSafeInteger(offset) || offset < 0) return fail('Página inválida.', 400);
      const from = url.searchParams.get('from'), to = url.searchParams.get('to');
      if ([from, to].some(value => value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))))) return fail('Fecha de búsqueda inválida.', 400);
      const filters = [eq(auditEvents.companyId, companyId)];
      if(access.branchId)filters.push(access.branchId==='principal'?or(eq(auditEvents.branchId,'principal'),isNull(auditEvents.branchId)):eq(auditEvents.branchId,access.branchId));
      if (from) filters.push(sql`${auditEvents.createdAt} >= ${from}::date`);
      if (to) filters.push(sql`${auditEvents.createdAt} < ${to}::date + interval '1 day'`);
      const start = url.searchParams.get('start'), end = url.searchParams.get('end');
      for (const instant of [start, end]) if (instant && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(instant) || Number.isNaN(Date.parse(instant)))) return fail('Intervalo de búsqueda inválido.', 400);
      if (start) filters.push(sql`${auditEvents.createdAt} >= (${start}::timestamptz AT TIME ZONE 'UTC')`);
      if (end) filters.push(sql`${auditEvents.createdAt} < (${end}::timestamptz AT TIME ZONE 'UTC')`);
      const events = await db.select().from(auditEvents).where(and(...filters)).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(51).offset(offset);
      return json({ events: events.slice(0, 50).map(event=>allData(access)?event:{...event,changes:[]}), more: events.length > 50 });
    }
    if (path === 'backups') {
      const companyId = url.searchParams.get('c');
      const access = await companyAccess(db, companyId, session);
      requireModule(access,'ajustes');
      if (!allData(access)) return fail('Tu acceso o plan no incluye respaldos de todos los módulos.', 403);
      if (method === 'GET') {
        const id = url.searchParams.get('id');
        if (id) {
          if (!/^[a-f0-9-]{36}$/.test(id)) return fail('Respaldo no encontrado.', 404);
          const [backup] = await db.select().from(companyBackups).where(and(eq(companyBackups.id, id), eq(companyBackups.companyId, companyId)));
          return backup ? json({ backup: { ...backup, data: projectData(backup.data, access) } }) : fail('Respaldo no encontrado.', 404);
        }
        const backups = await db.select({ id: companyBackups.id, revision: companyBackups.revision, name: companyBackups.name, createdAt: companyBackups.createdAt }).from(companyBackups).where(eq(companyBackups.companyId, companyId)).orderBy(desc(companyBackups.revision)).limit(30);
        return json({ backups });
      }
      if (method === 'POST') {
        const result = await updateCompany(companyId, session, body.revision, async (company, currentAccess, client) => {
          if (!allowed(currentAccess, 'ajustes', true) || !allData(currentAccess, true)) accessError('Sin permiso para restaurar respaldos.');
          let data = body.data, name = company.name, description = company.description;
          if (body.id) {
            if (!/^[a-f0-9-]{36}$/.test(body.id)) accessError('Respaldo no encontrado.', 404);
            const [backup] = await client.select().from(companyBackups).where(and(eq(companyBackups.id, body.id), eq(companyBackups.companyId, companyId)));
            if (!backup?.data) accessError('Respaldo vacío o no encontrado.', 404);
            data = scopeBranch(backup.data, currentAccess); name = backup.name; description = backup.description;
          }
          mergeData(company.data, data, { owner: true });
          guardLedgerMutation(company.data, data, currentAccess);
          if (!currentAccess.owner && ((company.data?.taxes || []).some(tax => tax.receipt) || (data.taxes || []).some(tax => tax.receipt))) accessError('Cuando hay comprobantes privados, solo el dueño puede restaurar la empresa.');
          const historical = await retainedCompanyData(client, companyId);
          const trustedReceipts = new Map([company.data, ...historical.map(backup => backup.data)].flatMap(document => receiptRecords(document).map(tax => [tax.receipt.key, { id: tax.id, receipt: tax.receipt }])));
          for (const tax of receiptRecords(data)) if (tax.receipt) {
            if (!currentAccess.owner || !tax.receipt.key?.startsWith(companyId + '/')) accessError('El respaldo contiene comprobantes no autorizados.', 400);
            const trusted = trustedReceipts.get(tax.receipt.key);
            if (!trusted || trusted.id !== tax.id || !equal(trusted.receipt, tax.receipt)) accessError('El comprobante no pertenece a una versión recuperable de esta obligación.', 400);
            const file = await getStore({ name: 'acontec-private-receipts', consistency: 'strong' }).getMetadata(tax.receipt.key);
            if (!file) accessError('Falta un comprobante del respaldo. No se modificaron los datos.', 400);
          }
          return { data, name, description };
        }, 'Respaldo restaurado');
        return json({ ...result, companies: await accessibleCompanies(session) });
      }
    }
    if (path === 'receipt' && ['GET', 'POST', 'DELETE'].includes(method)) {
      const companyId = url.searchParams.get('c');
      const taxId = url.searchParams.get('tax');
      const receiptAccess=await companyAccess(db,companyId,session);requireModule(receiptAccess,'fiscal',method!=='GET');
      if (session.member) return fail('Solo el dueño accede a los comprobantes privados.', 403);
      if (!/^[a-z0-9-]{1,80}$/.test(taxId || '')) return fail('Obligación no encontrada', 404);
      const condition = and(eq(companies.id, companyId), eq(companies.ownerEmail, session.email),isNull(companies.archivedAt));
      const company = receiptAccess.owner?receiptAccess.company:null;
      if (!company) return fail('Solo el dueño accede a los comprobantes privados.', 403);
      const backupId = url.searchParams.get('backup');
      let source = company.data;
      if (method === 'GET' && backupId) {
        if (!/^[a-f0-9-]{36}$/.test(backupId)) return fail('Respaldo no encontrado', 404);
        const [backup] = await db.select().from(companyBackups).where(and(eq(companyBackups.id, backupId), eq(companyBackups.companyId, companyId)));
        source = backup?.data;
      }
      const requestedRevision = url.searchParams.get('revision');
      if (method === 'GET' && !backupId && requestedRevision !== null && Number(requestedRevision) !== company.revision) {
        if (!/^\d+$/.test(requestedRevision)) return fail('Versión inválida', 400);
        const [backup] = await db.select().from(companyBackups).where(and(eq(companyBackups.companyId, companyId), eq(companyBackups.revision, Number(requestedRevision))));
        source = backup?.data;
      }
      const tax = source?.taxes?.find(record => record.id === taxId);
      if (!tax) return fail('Obligación no encontrada', 404);
      const store = getStore({ name: 'acontec-private-receipts', consistency: 'strong' });
      if (method === 'GET') {
        if (!tax.receipt?.key?.startsWith(companyId + '/')) return fail('Comprobante no encontrado', 404);
        const document = await store.get(tax.receipt.key, { type: 'arrayBuffer' });
        if (!document) return fail('Comprobante no encontrado', 404);
        return new Response(document, { headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': "attachment; filename=\"comprobante\"; filename*=UTF-8''" + encodeURIComponent(tax.receipt.name),
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; sandbox",
        } });
      }
      if (!Number.isInteger(body.revision) || body.revision !== company.revision) return fail('Los datos cambiaron. Recarga antes de adjuntar o quitar archivos.', 409);
      if (method === 'DELETE') {
        const key = tax.receipt?.key;
        if (!key?.startsWith(companyId + '/')) return fail('Comprobante no encontrado', 404);
        const updated = await updateCompany(companyId, session, body.revision, current => {
          const data = structuredClone(current.data);
          delete data.taxes.find(record => record.id === taxId).receipt;
          return { data };
        }, 'Comprobante retirado (conservado en respaldo)');
        return json({ revision: updated.revision, receipt: null });
      }
      if (tax.receipt) return fail('Quita el archivo anterior antes de adjuntar otro.');
      if (!company.data.entries.some(entry => entry.taxId === taxId && entry.type === 'fiscal-pago')) return fail('Registra el pago antes de adjuntar su comprobante.');
      if (typeof body.file !== 'string' || body.file.length > 1400000) return fail('El comprobante debe pesar como máximo 1 MB.', 413);
      const file = Buffer.from(body.file, 'base64');
      if (!file.length || file.length > 1048576 || file.toString('base64') !== body.file) return fail('Archivo inválido o superior a 1 MB.');
      const valid = (body.mime === 'application/pdf' && file.toString('ascii', 0, 5) === '%PDF-')
        || (body.mime === 'image/jpeg' && file[0] === 255 && file[1] === 216 && file[2] === 255)
        || (body.mime === 'image/png' && file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        || (body.mime === 'image/webp' && file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP');
      if (!valid) return fail('Usa un PDF, JPG, PNG o WebP válido.');
      const historical = await retainedCompanyData(db, companyId);
      const receipts = [...new Map([company.data, ...historical.map(backup => backup.data)].flatMap(data => receiptRecords(data).map(record => [record.receipt.key, record.receipt]))).values()];
      if (receipts.length >= 100 || receipts.reduce((total,receipt) => total + receipt.size, 0) + file.length > 52428800) return fail('Límite de comprobantes alcanzado: 100 archivos o 50 MB por empresa.');
      const key = companyId + '/' + randomUUID();
      const extensions = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
      const name = String(body.name || 'comprobante').replace(/[\x00-\x1f\x7f/\\]/g, '').slice(0, 150).replace(/\.[^.]*$/, '') + extensions[body.mime];
      const receipt = { key, name, size: file.length, mime: body.mime };
      await store.set(key, file);
      let updated;
      try {
        updated = await updateCompany(companyId, session, body.revision, current => {
          const data = structuredClone(current.data);
          data.taxes.find(record => record.id === taxId).receipt = receipt;
          return { data };
        }, 'Comprobante adjuntado');
      } catch (error) {
        await store.delete(key);
        throw error;
      }
      return json({ revision: updated.revision, receipt });
    }
    if (path === 'me' && method === 'GET') return json({ user: { email: session.member?.username || session.email, name: session.member?.name || session.name, worker: !!session.member, admin: isAdmin, editor: canEditSite, consentRequired: consent.required, legal: consent.document }, companies: owned });
    if (path === 'company' && method === 'POST') {
      if (session.member) return fail('Los colaboradores no pueden crear empresas.', 403);
      const billing=await requireBilling(session.email,isAdmin);
      const companyLimit=isAdmin?null:billing.plan?.limits?.companies;
      if(companyLimit!=null&&owned.filter(c=>c.owner).length>=companyLimit)return fail('Se alcanzó el límite de empresas del plan.',403);
      if (!companyName(body.name)) return fail('Escribe un nombre de empresa');
      const company = await db.transaction(client => createOwnedCompany(client,session,{name:body.name,description:body.description,companyLimit}));
      return json({ id: company.id, companies: await accessibleCompanies(session) });
    }
    if (path === 'company' && method === 'DELETE') {
      if(session.member || session.email !== PLATFORM_OWNER) return fail('Solo el administrador de Acontec puede borrar empresas.',403);
      await db.transaction(async client => {
        const access=await companyAccess(client,body.id,session,true),company=access.company;
        if(!access.owner) accessError('Solo puedes borrar tus propias empresas.');
        if(company.isPlatformCompany||company.name.trim().toLowerCase()==='acontec') accessError('Acontec es la empresa principal y no se puede borrar.');
        if(body.confirmName!==company.name || body.revision!==company.revision) accessError('Confirma el nombre y la revisión vigente de la empresa.',409);
        await audit(client,company.id,session,'Empresa archivada por el administrador',[{area:'empresa',before:company.name,after:'Archivada; datos y respaldos conservados'}],company.revision);
        await client.update(companies).set({archivedAt:new Date(),revision:company.revision+1}).where(eq(companies.id,company.id));
        const members=await client.select().from(companyMembers).where(eq(companyMembers.companyId,company.id));
        for(const member of members)await client.delete(sessions).where(or(eq(sessions.memberId,member.id),...(member.email?[eq(sessions.email,member.email)]:[])));
      });
      return json({companies:await accessibleCompanies(session)});
    }
    if(path==='branch-limits' && method==='GET'){
      const [row]=await db.select().from(siteContent).where(eq(siteContent.id,'branch-limits'));
      return json({limit:row?.content?.limit||5});
    }
    if(path==='branch-limits' && method==='PUT'){
      if(session.member||session.email!==PLATFORM_OWNER)return fail('Solo el dueño de Acontec configura este límite.',403);
      if(!Number.isInteger(body.limit)||body.limit<1||body.limit>100)return fail('El límite debe estar entre 1 y 100.');
      await db.transaction(async client=>{
        const [ownerCompany]=await client.select().from(companies).where(and(eq(companies.ownerEmail,PLATFORM_OWNER),isNull(companies.archivedAt))).limit(1);
        await client.insert(siteContent).values({id:'branch-limits',content:{limit:body.limit}}).onConflictDoUpdate({target:siteContent.id,set:{content:{limit:body.limit},updatedAt:new Date()}});
        if(ownerCompany)await audit(client,ownerCompany.id,session,'Límite de sucursales actualizado',[{area:'limiteSucursales',after:body.limit}]);
      });return json({ok:true});
    }
    if(path==='branch-select' && method==='POST'){
      const access=await companyAccess(db,body.companyId,session);requireModule(access,'sucursales');
      if(body.branchId==='all' ? !access.unrestrictedBranches : !access.branches.some(b=>b.id===body.branchId))return fail('Sucursal no autorizada.',403);
      await db.update(sessions).set({activeBranchId:body.branchId}).where(eq(sessions.tokenHash,hashToken(sessionToken(request))));
      return json({ok:true});
    }
    if (path === 'company' && method === 'PUT') {
      if (!owned.some(company => company.id === body.id && company.owner)) return fail('Solo el dueño modifica la empresa.', 403);
      if (!companyName(body.name)) return fail('Escribe un nombre de empresa');
      if(owned.find(c=>c.id===body.id)?.name.trim().toLowerCase()==='acontec' && companyName(body.name).toLowerCase()!=='acontec') return fail('La empresa principal conserva el nombre Acontec.',403);
      if (/[<>&"'`]/.test(String(body.cfg?.cur || 'C$'))) return fail('Usa un símbolo o código de moneda, sin contenido HTML.');
      const result = await updateCompany(body.id, session, body.revision, (company,access) => {requireModule(access,'ajustes',true);return ({ name: companyName(body.name), description: String(body.description || '').trim().slice(0, 2000), data: { ...company.data, cfg: { ...company.data?.cfg, ruc: String(body.cfg?.ruc || '').slice(0, 100), cur: String(body.cfg?.cur || 'C$').slice(0, 20), name: companyName(body.name) } } })}, 'Empresa actualizada');
      return json({ ...result, companies: await accessibleCompanies(session) });
    }
    if (path === 'data') {
      const companyId = url.searchParams.get('c');
      if (method === 'GET') {
        try{return await db.transaction(async client => {
          const access = await companyAccess(client, companyId, session, true);
          const { id, name, description } = access.company;
          await client.update(sessions).set({activeCompanyId:id}).where(eq(sessions.tokenHash,hashToken(sessionToken(request))));
          const company = { testPlan:access.company.testPlan, internalTestPlan:access.internalTestPlan, isPlatformCompany:access.company.isPlatformCompany, billingPlan:access.billingPlan, entitlement:access.entitlement, readOnlyLimit:access.readOnlyLimit, support:access.support||false,supportExpiresAt:access.supportExpiresAt, id, name, description, owner: access.owner, permissions: access.permissions, memberId: access.member?.id, role: access.owner ? 'Dueño' : access.member?.role, branches: access.branches, branchId: access.branchId, unrestrictedBranches: access.unrestrictedBranches };
          return json({ data: projectData(access.company.data, access), revision: access.company.revision, company });
        });}catch(error){
          // companyAccess checks ownership/membership before checking the owner's plan.
          // Preserve that selection even when expired access rolls back the data transaction.
          if(error.status===402)await db.update(sessions).set({activeCompanyId:companyId}).where(eq(sessions.tokenHash,hashToken(sessionToken(request))));
          throw error;
        }
      }
      if (method === 'PUT') {
        if (body.operationId && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.operationId)) return fail('Identificador de guardado inválido.', 400);
        const operation = body.operationId ? {id: body.operationId, actor: session.email + ':' + (session.memberId || ''), hash: createHash('sha256').update(JSON.stringify(body)).digest('hex')} : null;
        let returnData = false;
        const result = await updateCompany(companyId, session, body.revision, (current, currentAccess) => {
          returnData = !currentAccess.owner||!!currentAccess.billingPlan?.blockedModules?.length;
          let incoming = body.data;
          if (body.changes) {
            let applied;
            try { applied = globalThis.AcontecSync.apply(projectData(current.data, currentAccess), body.changes); }
            catch { accessError('El formato de los cambios no es válido.', 400); }
            if (applied.conflicts.length) accessError('Algunos registros cambiaron. Revisa los cambios pendientes.', 409);
            incoming = applied.data;
          }
          const data = mergeData(current.data, incoming, currentAccess);
          guardLedgerMutation(current.data, data, currentAccess);
          const existing = (current.data?.taxes || []).filter(tax => tax.receipt);
          const incomingReceipts = (data.taxes || []).filter(tax => tax.receipt);
          if (existing.length !== incomingReceipts.length || existing.some(tax => {
            const next = incomingReceipts.find(record => record.id === tax.id);
            return !next || JSON.stringify(next.receipt) !== JSON.stringify(tax.receipt);
          })) accessError('Los comprobantes solo se modifican desde adjuntar o quitar archivo.', 400);
          return { data };
        }, 'Datos contables actualizados', operation);
        if(result.timings) console.info('Cloud save stages', JSON.stringify(result.timings));
        return json({ ok: true, revision: result.revision, replayed: !!result.replayed, ...(returnData && result.data ? { data: result.data } : {}) });
      }
    }
    if (path === 'site' && method === 'PUT') {
      if (!canEditSite) return fail('Tu cuenta no está autorizada para editar la página', 403);
      const [previous] = await db.select().from(siteContent).where(eq(siteContent.id, 'public'));
      if (body.revision !== siteRevision(previous?.content)) return fail('La página cambió en otra pestaña. Recarga el sitio antes de editar de nuevo.', 409);
      const content = {};
      for (const key of ['brand', 'eyebrow', 'title', 'sub', 'note', 'caption', 'footer', 'tagline']) {
        if (typeof body[key] === 'string') content[key] = body[key].trim().slice(0, ['sub', 'caption'].includes(key) ? 2000 : 200);
      }
      content.policyNotes = {devoluciones: String(body.policyNotes?.devoluciones ?? previous?.content?.policyNotes?.devoluciones ?? '').trim().slice(0,10000)};
      content.moduleLabels = {};
      if (body.moduleLabels && (typeof body.moduleLabels !== 'object' || Array.isArray(body.moduleLabels))) return fail('Nombres de módulos inválidos');
      for (const [key, value] of Object.entries(body.moduleLabels || {}).slice(0, 100)) {
        if (!/^[a-z][a-z0-9-]{0,59}$/.test(key) || typeof value !== 'string' || value.length > 80) return fail('Nombre de módulo inválido');
        if (value.trim()) content.moduleLabels[key] = value.trim();
      }
      for (const key of ['panelTitle', 'panelDescription', 'cookieNotice']) {
        if (typeof body[key] === 'string') content[key] = body[key].trim().slice(0, 2000);
      }
      if (Object.values(content).some(value => /el\s+amanecer/i.test(value))) return fail('Utiliza la marca Acontec o el nombre de la empresa');
      try { content.contacts = siteContacts(body.contacts); } catch (error) { return fail(error.message); }
      for (const key of ['green', 'gold']) {
        if (!/^#[a-f0-9]{6}$/i.test(body[key] || '')) return fail('Color inválido');
        content[key] = body[key];
      }
      const gallery = Array.isArray(body.gallery) ? body.gallery : [];
      if (gallery.length > 6) return fail('Puedes publicar hasta 6 imágenes en la galería');
      try {
        content.hero = await storeImage(body.hero);
        content.logo = await storeImage(body.logo, 300000);
        content.gallery = (await Promise.all(gallery.map(item => storeImage(item)))).filter(Boolean);
      } catch { return fail('Imagen inválida, no autorizada o demasiado grande'); }
      const saved = previous
        ? await db.update(siteContent).set({ content, updatedAt: new Date() }).where(and(eq(siteContent.id, 'public'), sql`${siteContent.content} = ${JSON.stringify(previous.content)}::jsonb`)).returning({ content: siteContent.content })
        : await db.insert(siteContent).values({ id: 'public', content }).onConflictDoNothing().returning({ content: siteContent.content });
      if (!saved.length) return fail('La página cambió en otra pestaña. Recarga el sitio antes de editar de nuevo.', 409);
      return json({ ok: true, site: saved[0].content, siteRevision: siteRevision(saved[0].content) });
    }
    return fail('Ruta no encontrada', 404);
  } catch (error) {
    if (error.publicMessage) return fail(error.publicMessage, error.status);
    if (error instanceof MissingIdentityError) return fail('El servicio de acceso todavía no está activado', 503);
    if (error instanceof AuthError) {
      if (/email not confirmed/i.test(error.message)) return fail('Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada y la carpeta de spam.', 403);
      if (path === 'login' && [400, 401].includes(error.status)) return fail('Correo o contraseña incorrectos. Si es tu primer acceso, selecciona Crear cuenta y confirma tu correo.', 401);
      if (path === 'register' && error.status === 403) return fail('El registro por correo no está disponible. Contacta con la administración del sitio.', 403);
      if (path === 'register' && [400, 422].includes(error.status)) return fail('No se pudo crear la cuenta. Revisa los datos; si ya te registraste, confirma tu correo y selecciona Ingresar.', 400);
      if (path === 'confirm' && [400, 401, 403, 404, 422].includes(error.status)) return fail('El enlace de confirmación no es válido o ha caducado. Vuelve a Crear cuenta con los mismos datos para solicitar otro correo.', 400);
      return fail('El servicio de acceso no está disponible en este momento. Intenta de nuevo más tarde.', 503);
    }
    console.error('Acontec API:', error.code || error.name || 'Error');
    return fail('No se pudo completar la operación. Intenta de nuevo.', 500);
  } finally {
    if (method === 'POST' && ['register', 'login', 'confirm', 'google'].includes(path)) {
      context.cookies.delete('nf_jwt');
      context.cookies.delete('nf_refresh');
    }
  }
};


export default async (request, context) => {
  const started = performance.now(), metrics = {bytes: 0};
  const response = await handleRequest(request, context, metrics);
  if (!((request.method === 'PUT' && new URL(request.url).pathname === '/api/data') || (request.method === 'POST' && new URL(request.url).pathname === '/api/operations'))) return response;
  const durationMs = Math.round(performance.now() - started);
  response.headers.set('Server-Timing', `save;dur=${durationMs}`);
  if (response.status >= 400) {
    const code = randomBytes(5).toString('hex').toUpperCase();
    const companyId = new URL(request.url).searchParams.get('c');
    // Fixed categories only: never persist document content, tokens or raw exceptions.
    const reason = ({400:'invalid_request',401:'session_expired',403:'access_denied',409:'revision_conflict',413:'payload_limit',422:'operation_reused',429:'rate_limit'})[response.status] || 'server_error';
    try {
      await db.insert(saveFailures).values({code, companyId: /^[a-f0-9-]{36}$/i.test(companyId || '') ? companyId : null, status: response.status, reason, bytes: metrics.bytes, durationMs});
    } catch { console.error('Cloud save diagnostic unavailable', code, response.status, durationMs); }
    const payload = await response.json();
    return json({...payload, supportCode: code}, response.status, {'Server-Timing': `save;dur=${durationMs}`});
  }
  console.info('Cloud save', response.status, metrics.bytes, durationMs);
  return response;
};
