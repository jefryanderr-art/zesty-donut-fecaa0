import {legalTemplates,legalHash} from './legal-templates.mjs';
import {providerConfig} from './billing-rules.mjs';
import { createHash,randomUUID } from 'node:crypto';
import { and, desc, eq, notLike, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, companies, companyMembers, customerPayments, customerEvents, legalAcceptances, siteContent } from '../../db/schema.ts';
import { accessError } from './access.mjs';
import { PLATFORM_OWNER } from './policies.mjs';

const clean = (value, maximum = 200) => String(value || '').trim().slice(0, maximum);
const states = ['sin_plan', 'prueba', 'activo', 'en_gracia', 'vencido', 'suspendido','cancelado'];
const legalDraft = {
  approved: false,
  revision: 0,
  version: 'borrador-1',
  ...legalTemplates,
};
export async function legalDocument(client = db) {
  const [row] = await client.select().from(siteContent).where(eq(siteContent.id, 'legal'));
  return row?.content?{...legalDraft,...row.content,refunds:row.content.refunds||legalTemplates.refunds,approved:row.content.approved===true&&!!row.content.refunds}:legalDraft;
}
export async function legalState(session) {
  const document = await legalDocument();
  if (!document.approved || session.member) return { document, required: false };
  const [accepted] = await db.select({ id: legalAcceptances.id }).from(legalAcceptances).where(and(eq(legalAcceptances.email, session.email), eq(legalAcceptances.version, document.version), eq(legalAcceptances.contentHash, legalHash(document))));
  return { document, required: !accepted };
}
export async function acceptLegal(session, body) {
  const document = await legalDocument();
  if (!document.approved || body.version !== document.version || body.accepted !== true) accessError('Lee y acepta la versión vigente de ambos documentos.', 400);
  await db.insert(legalAcceptances).values({ email: session.email, version: document.version, contentHash: legalHash(document) }).onConflictDoNothing();
  return { ok: true };
}
export async function isPlatformAdmin(session) {
  if (!session || session.member) return false;
  const [user] = await db.select({ platformAdmin: users.platformAdmin }).from(users).where(eq(users.email, session.email));
  return user?.platformAdmin === true;
}
export async function ensureAcontecCompany(email) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase() || PLATFORM_OWNER;
  if (email !== PLATFORM_OWNER && email !== adminEmail) return;
  const existing = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.ownerEmail, email));
  if (existing.some(company => company.name.trim().toLowerCase() === 'acontec')) {
    if(email===PLATFORM_OWNER) await db.update(companies).set({isPlatformCompany:true}).where(and(eq(companies.id,existing.find(c=>c.name.trim().toLowerCase()==='acontec').id),sql`NOT EXISTS (SELECT 1 FROM acontec_companies WHERE is_platform_company = true)`));
    return;
  }
  const hash = createHash('sha256').update('acontec-ledger:' + email).digest('hex');
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  await db.insert(companies).values({ id, ownerEmail: email, name: 'Acontec', description: 'Contabilidad propia de Acontec' }).onConflictDoNothing();
  if(email===PLATFORM_OWNER)await db.update(companies).set({isPlatformCompany:true}).where(and(eq(companies.id,id),sql`NOT EXISTS (SELECT 1 FROM acontec_companies WHERE is_platform_company = true)`));
}
export async function customerAdmin(method, body, url, session) {
  if (!await isPlatformAdmin(session)) accessError('Solo la administración autorizada accede a clientes.');
  if (!['GET', 'POST'].includes(method)) accessError('Método no permitido.', 405);
  if(method==='POST'&&(body.confirmed!==true||clean(body.reason,1000).length<3))accessError('Confirma la acción e indica el motivo.',400);
  const email = clean(body.email || url.searchParams.get('email'), 254).toLowerCase();
  if (method === 'GET') {
    const condition = and(notLike(users.email, '%@access.acontec.invalid'), sql`${users.email} <> ${PLATFORM_OWNER}`);
    if (email) return customerDetail(email, condition);
    const rows = await db.select({ email: users.email, name: users.name, createdAt: users.createdAt, lastAccessAt: users.lastAccessAt, profile: users.profile, version: users.version }).from(users).where(condition).orderBy(desc(users.createdAt)).limit(5001);
    const truncated = rows.length > 5000;
    const clients = rows.slice(0, 5000);
    const [totals] = await db.select({ total: sql`count(*)::int`, active: sql`count(*) filter (where ${users.profile}->>'state' = 'activo')::int`, expired: sql`count(*) filter (where ${users.profile}->>'state' = 'vencido')::int`, newMonth: sql`count(*) filter (where ${users.createdAt} >= date_trunc('month', now()))::int`, inactive: sql`count(*) filter (where coalesce(${users.lastAccessAt}, ${users.createdAt}) < now() - interval '30 days')::int`, expiring: sql`count(*) filter (where ${users.profile}->>'paidUntil' >= to_char(current_date, 'YYYY-MM-DD') and ${users.profile}->>'paidUntil' <= to_char(current_date + 7, 'YYYY-MM-DD'))::int` }).from(users).where(condition);
    const expected = await db.select({ currency: sql`coalesce(${users.profile}->>'currency', 'C$')`, amount: sql`sum(coalesce((${users.profile}->>'monthlyAmountCents')::numeric/100, (${users.profile}->>'monthlyAmount')::numeric, 0))` }).from(users).where(and(condition, sql`${users.profile}->>'state' in ('activo', 'en_gracia')`)).groupBy(sql`coalesce(${users.profile}->>'currency', 'C$')`);
    const churn = await db.select({ month: sql`to_char(${customerEvents.createdAt}, 'YYYY-MM')`, count: sql`count(distinct ${customerEvents.email})::int` }).from(customerEvents).where(sql`${customerEvents.action} = 'Estado cambiado' and ${customerEvents.details}->>'from' in ('activo', 'en_gracia', 'prueba') and ${customerEvents.details}->>'to' in ('vencido', 'suspendido')`).groupBy(sql`to_char(${customerEvents.createdAt}, 'YYYY-MM')`).orderBy(desc(sql`to_char(${customerEvents.createdAt}, 'YYYY-MM')`)).limit(12);
    return { clients, totals, expected, churn, truncated, legal: await legalDocument() };
  }
  if (body.operation === 'legal') {
    const document = { approved: body.approved === true, revision: 0, version: clean(body.version, 80), terms: clean(body.terms, 30000), privacy: clean(body.privacy, 30000), refunds:clean(body.refunds,30000), approvedAt: body.approved ? new Date().toISOString() : null, approvedBy: session.email };
    if (!document.version || !document.terms || !document.privacy || !document.refunds) accessError('Completa versión, términos y privacidad.', 400);
    await db.transaction(async client => {
      await client.insert(siteContent).values({ id: 'legal', content: legalDraft }).onConflictDoNothing();
      const [locked] = await client.select().from(siteContent).where(eq(siteContent.id, 'legal')).for('update');
      const previous = locked.content;
      if ((previous.revision || 0) !== body.revision) accessError('Los documentos cambiaron en otra pestaña. Recárgalos.', 409);
      if (previous.approved && document.version === previous.version && legalHash(previous) !== legalHash(document)) accessError('Publica una nueva versión al cambiar documentos ya aprobados.', 400);
      const used = await client.select({ id: legalAcceptances.id }).from(legalAcceptances).where(eq(legalAcceptances.version, document.version)).limit(1);
      if (used.length && legalHash(previous) !== legalHash(document)) accessError('Esa versión ya tiene aceptaciones; usa un identificador nuevo.', 400);
      document.revision = (previous.revision || 0) + 1;
      await client.insert(siteContent).values({ id: 'legal', content: document }).onConflictDoUpdate({ target: siteContent.id, set: { content: document, updatedAt: new Date() } });
      await client.insert(customerEvents).values({ email: session.email, actor: session.email, action: document.approved ? 'Documentos legales publicados' : 'Borradores legales guardados', details: { version: document.version, hash: legalHash(document),reason:clean(body.reason,1000) } });
    });
    return { ok: true };
  }
  return db.transaction(async client => {
    const [user] = await client.select().from(users).where(eq(users.email, email)).for('update');
    if (!user || email === PLATFORM_OWNER || email.endsWith('@access.acontec.invalid')) accessError('Cliente no encontrado.', 404);
    if (user.version !== body.version) accessError('La ficha cambió en otra pestaña. Recárgala.', 409);
    if (body.operation === 'profile') {
      if(body.plan!==String(user.profile?.plan||'')||body.state!==(user.profile?.state||'sin_plan')||body.paidUntil!==String(user.profile?.paidUntil||''))accessError('Ajusta el plan y su vigencia desde Suscripción en el Centro de control.',409);
      const profile = { ...user.profile, country:clean(body.country,80), phone: clean(body.phone, 80), notes: clean(body.notes, 4000), plan: clean(body.plan, 100), state: body.state, paidUntil: clean(body.paidUntil, 10), method: clean(body.method, 80), currency: clean(body.currency, 20) || 'C$', monthlyAmount: Number(body.monthlyAmount || 0) };
      if (!states.includes(profile.state) || !Number.isFinite(profile.monthlyAmount) || profile.monthlyAmount < 0 || profile.monthlyAmount > 9999999 || (profile.paidUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(profile.paidUntil) || Number.isNaN(Date.parse(profile.paidUntil))))) accessError('Revisa estado, importe y fecha pagado hasta.', 400);
      await client.update(users).set({ profile, version: user.version + 1 }).where(eq(users.email, email));
      await client.insert(customerEvents).values({ email, actor: session.email, action: 'Ficha actualizada', details: { before: user.profile, after: profile, reason: clean(body.reason,1000) } });
      if ((user.profile?.state || 'sin_plan') !== profile.state) await client.insert(customerEvents).values({ email, actor: session.email, action: 'Estado cambiado', details: { from: user.profile?.state || 'sin_plan', to: profile.state } });
    } else if (body.operation === 'payment') {
      const amount = Number(body.amount), date = clean(body.date, 10), reference = clean(body.reference), method = clean(body.method, 80), currency = clean(body.currency, 20);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || !reference || !method || !currency) accessError('Completa monto, fecha, moneda, método y referencia del pago.', 400);
      if(!['basico','estandar','pro'].includes(body.plan))accessError('Elige un plan para el pago.',400);
      if(currency!=='USD')accessError('Los nuevos pagos del servicio se registran en USD.',400);
      const [payment] = await client.insert(customerPayments).values({ email, amountCents: Math.round(amount * 100), currency, date, reference, method, providerKey:providerConfig().environment==='sandbox'?'sandbox:manual-'+randomUUID():null, status:'por_verificar', plan:clean(body.plan,40)||null, interval:body.interval==='anual'?'anual':'mensual', actor: session.email }).returning({ id: customerPayments.id });
      await client.update(users).set({ version: user.version + 1 }).where(eq(users.email, email));
      await client.insert(customerEvents).values({ email, actor: session.email, action: 'Pago registrado', details: { id: payment.id, amountCents:Math.round(amount*100), date, reference, currency, method,reason:clean(body.reason,1000) } });
    } else accessError('Operación no encontrada.', 404);
    return { ok: true };
  });
}

async function customerDetail(email, condition) {
  const [client] = await db.select({ email: users.email, name: users.name, createdAt: users.createdAt, lastAccessAt: users.lastAccessAt, profile: users.profile, version: users.version }).from(users).where(and(eq(users.email, email), condition));
  if (!client) accessError('Cliente no encontrado.', 404);
  const owned = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.ownerEmail, email));
  const memberships = await db.select({ id: companies.id, name: companies.name, role: companyMembers.role, active: companyMembers.active }).from(companyMembers).innerJoin(companies, eq(companies.id, companyMembers.companyId)).where(eq(companyMembers.email, email));
  const payments = await db.select().from(customerPayments).where(eq(customerPayments.email, email)).orderBy(desc(customerPayments.date)).limit(200);
  const events = await db.select().from(customerEvents).where(eq(customerEvents.email, email)).orderBy(desc(customerEvents.createdAt)).limit(100);
  const acceptances = await db.select({ version: legalAcceptances.version, acceptedAt: legalAcceptances.acceptedAt }).from(legalAcceptances).where(eq(legalAcceptances.email, email));
  return { client, companies: [...owned.map(company => ({ ...company, role: 'Dueño', active: true })), ...memberships], payments, events, acceptances };
}
