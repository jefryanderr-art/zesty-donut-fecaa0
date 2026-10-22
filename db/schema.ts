import { sql } from 'drizzle-orm';
import { collections, children, snake } from './accounting-model.mjs';
import { pgTable, text, uuid, jsonb, timestamp, integer, boolean, index, uniqueIndex, bigint, numeric, primaryKey, foreignKey, check, pgPolicy } from 'drizzle-orm/pg-core';

const serverAccess = () => pgPolicy('acontec_solo_servidor', { for: 'all', to: 'public', using: sql`current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')`, withCheck: sql`current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')` });

export const users = pgTable('acontec_users', {
  email: text().primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  name: text().default('').notNull(),
  lastAccessAt: timestamp('last_access_at'),
  platformAdmin: boolean('platform_admin').default(false).notNull(),
  profile: jsonb().default({}).notNull(),
  version: integer().default(0).notNull(),
}, () => [serverAccess()]).enableRLS();

export const customerPayments = pgTable('acontec_customer_payments', {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().references(() => users.email),
  amountCents: integer('amount_cents').notNull(),
  currency: text().notNull(),
  status: text().default('confirmado').notNull(),
  plan: text(),
  interval: text().default('mensual').notNull(),
  providerKey: text('provider_key').unique(),
  receipt: jsonb(),
  journalId: text('journal_id'),
  version: integer().default(0).notNull(),
  date: text().notNull(),
  reference: text().notNull(),
  method: text().notNull(),
  actor: text().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), index('acontec_customer_payments_email_idx').on(table.email), index('acontec_service_payment_status_date_idx').on(table.status,table.date)]).enableRLS();

export const customerEvents = pgTable('acontec_customer_events', {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().references(() => users.email),
  actor: text().notNull(),
  action: text().notNull(),
  details: jsonb().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), index('acontec_customer_events_email_date_idx').on(table.email, table.createdAt)]).enableRLS();

export const legalAcceptances = pgTable('acontec_legal_acceptances', {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().references(() => users.email),
  version: text().notNull(),
  contentHash: text('content_hash').notNull(),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
}, table => [serverAccess(), uniqueIndex('acontec_legal_acceptance_version_idx').on(table.email, table.version)]).enableRLS();
export const companies = pgTable('acontec_companies', {
  id: uuid().defaultRandom().primaryKey(),
  archivedAt: timestamp('archived_at'),
  isPlatformCompany: boolean('is_platform_company').default(false).notNull(),
  ownerEmail: text('owner_email').notNull().references(() => users.email),
  name: text().notNull(),
  description: text().default('').notNull(),
  data: jsonb(),
  revision: integer().default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => [serverAccess(), uniqueIndex('acontec_one_platform_company_idx').on(table.isPlatformCompany).where(sql`${table.isPlatformCompany} = true`)]).enableRLS();
export const siteContent = pgTable('acontec_site_content', {
  id: text().primaryKey(),
  content: jsonb().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, () => [serverAccess()]).enableRLS();
export const loginAttempts = pgTable('acontec_login_attempts', {
  key: text().primaryKey(),
  count: integer().default(1).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, () => [serverAccess()]).enableRLS();
export const sessions = pgTable('acontec_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  email: text().notNull().references(() => users.email, { onDelete: 'cascade' }),
  admin: boolean().default(false).notNull(),
  activeBranchId: text('active_branch_id'),
  activeCompanyId: uuid('active_company_id'),
  memberId: uuid('member_id').references(() => companyMembers.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
}, table => [serverAccess(), index('acontec_sessions_expires_at_idx').on(table.expiresAt)]).enableRLS();

export const companyMembers = pgTable('acontec_company_members', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email: text(),
  username: text().unique(),
  passwordHash: text('password_hash'),
  name: text().notNull(),
  role: text().notNull(),
  branchIds: jsonb('branch_ids').default(['principal']).notNull(),
  permissions: jsonb().notNull(),
  active: boolean().default(true).notNull(),
  version: integer().default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), uniqueIndex('acontec_member_company_email_idx').on(table.companyId, table.email)]).enableRLS();

export const auditEvents = pgTable('acontec_audit_events', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: text('branch_id'),
  actor: text().notNull(),
  action: text().notNull(),
  changes: jsonb().notNull(),
  revision: integer(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), index('acontec_audit_company_date_idx').on(table.companyId, table.createdAt)]).enableRLS();

export const companyBackups = pgTable('acontec_company_backups', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text().notNull(),
  data: jsonb(),
  revision: integer().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), uniqueIndex('acontec_backup_company_revision_idx').on(table.companyId, table.revision)]).enableRLS();


// Identificadores históricos de texto; todas las claves incluyen la empresa.
function recordTable(definition: any, child = false) {
  const tableName = 'acontec_' + definition.table;
  const columns: any = {
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    position: integer('position').notNull(),
    date: text('date'),
    extra: jsonb('extra').notNull(),
  };
  if (child) columns.entryId = text('entry_id').notNull();
  for (const field of definition.text || []) columns[field] = text(snake(field));
  for (const field of definition.money || []) columns[field + 'Cents'] = bigint(snake(field) + '_cents', { mode: 'number' });
  for (const field of definition.numeric || []) columns[field] = numeric(snake(field));
  return pgTable(tableName, columns, (table: any) => [
    serverAccess(),
    primaryKey({ columns: [table.companyId, table.id] }),
    index(tableName + '_company_date_idx').on(table.companyId, table.date),
    ...(child ? [foreignKey({ columns: [table.companyId, table.entryId], foreignColumns: [journalEntries.companyId, journalEntries.id] }).onDelete('cascade')] : []),
    ...(definition.table === 'journal_lines' ? [check('acontec_line_nonnegative', sql`${table.dCents} >= 0 AND ${table.cCents} >= 0`)] : []),
  ]).enableRLS();
}
export const ledgerAccounts = recordTable(collections.accounts);
export const products = recordTable(collections.products);
export const customers = recordTable(collections.customers);
export const suppliers = recordTable(collections.suppliers);
export const employees = recordTable(collections.employees);
export const payrolls = recordTable(collections.payrolls);
export const settlements = recordTable(collections.settlements);
export const taxObligations = recordTable(collections.taxes);
export const properties = recordTable(collections.properties);
export const shifts = recordTable(collections.shifts);
export const cashMovements = recordTable(collections.cashMovements);
export const pettyFunds = recordTable(collections.pettyFunds);
export const pettyVouchers = recordTable(collections.pettyVouchers);
export const cashCounts = recordTable(collections.cashCounts);
export const costCatalog = recordTable(collections.costCatalog);
export const costs = recordTable(collections.costs);
export const journalEntries = recordTable(collections.entries);
export const journalLines = recordTable(children.lines, true);
export const invoiceItems = recordTable(children.items, true);
export const inventoryMovements = recordTable(children.stock, true);
export const invoicePayments = recordTable(children.payments, true);
export const invoices = recordTable({ table: 'invoices', text: ['type', 'reference', 'due', 'customerId', 'supplierId', 'pay'], money: ['subtotal', 'vat', 'total'] });
export const accountingStorage = pgTable('acontec_accounting_storage', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  mode: text('mode').notNull().default('relational'),
  documentExtra: jsonb('document_extra').notNull(),
  manifest: jsonb('manifest').notNull(),
  sourceHash: text('source_hash').notNull(),
  verifiedAt: timestamp('verified_at').defaultNow().notNull(),
}, () => [serverAccess(), check('acontec_storage_mode', sql`mode IN ('relational', 'legacy')`)]).enableRLS();
// Copia inicial independiente de la retención de las últimas 30 versiones.
export const accountingOrigins = pgTable('acontec_accounting_origins', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  data: jsonb('data'),
  sourceHash: text('source_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, () => [serverAccess()]).enableRLS();

export const branches = recordTable(collections.branches);
export const productBarcodes = pgTable('acontec_product_barcodes', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), uniqueIndex('acontec_barcode_company_code_idx').on(table.companyId, table.code)]).enableRLS();

export const assets = recordTable(collections.assets);
export const loans = recordTable(collections.loans);
export const recurringEntries = recordTable(collections.recurringEntries);
export const exchangeRates = recordTable(collections.exchangeRates);
export const foreignDocuments = recordTable(collections.foreignDocuments);
export const budgets = recordTable(collections.budgets);
export const quotations = recordTable(collections.quotations);
export const purchaseOrders = recordTable(collections.purchaseOrders);
export const attendance = recordTable(collections.attendance);
export const vacationRequests = recordTable(collections.vacationRequests);
export const employeeAdvances = recordTable(collections.employeeAdvances);

export const stockTransfers = recordTable(collections.stockTransfers);

export const withholdings = recordTable(collections.withholdings);

export const instruments = recordTable(collections.instruments);

export const partners = recordTable(collections.partners);

// Operation receipts are committed atomically with the company revision.
export const saveOperations = pgTable('acontec_save_operations', {
  companyId: uuid('company_id').notNull().references(() => companies.id),
  operationId: uuid('operation_id').notNull(),
  actor: text().notNull(),
  payloadHash: text('payload_hash').notNull(),
  resultId: text('result_id'),
  revision: integer().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), primaryKey({columns: [table.companyId, table.operationId]})]).enableRLS();
export const saveFailures = pgTable('acontec_save_failures', {
  code: text().primaryKey(),
  companyId: text('company_id'),
  status: integer().notNull(),
  reason: text().notNull(),
  bytes: integer().notNull(),
  durationMs: integer('duration_ms').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), index('acontec_save_failure_date_idx').on(table.createdAt)]).enableRLS();

// Datos comerciales de plataforma, separados de los documentos contables.
export const servicePlans = pgTable('acontec_service_plans', {
  id: text().primaryKey(), name: text().notNull(),
  monthlyCents: bigint('monthly_cents', {mode:'number'}).notNull(),
  annualCents: bigint('annual_cents', {mode:'number'}).notNull(),
  currency: text().default('USD').notNull(), active: boolean().default(true).notNull(),
  limits: jsonb().notNull(), blockedModules: jsonb('blocked_modules').default([]).notNull(),
  version: integer().default(0).notNull(),
}, () => [serverAccess()]).enableRLS();
export const subscriptions = pgTable('acontec_subscriptions', {
  email: text().primaryKey().references(() => users.email),
  plan: text(), interval: text().default('mensual').notNull(),
  state: text().default('prueba').notNull(), trialEndsAt: timestamp('trial_ends_at').notNull(),
  recurringCents: bigint('recurring_cents', {mode:'number'}),
  paidEnvironment: text('paid_environment'),
  paidUntil: timestamp('paid_until'), canceledAt: timestamp('canceled_at'),
  limits: jsonb().default({}).notNull(), version: integer().default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(),index('acontec_subscription_plan_paid_idx').on(table.plan,table.paidUntil)]).enableRLS();
export const billingCheckouts = pgTable('acontec_billing_checkouts', {
  id: text().primaryKey(), email: text().notNull().references(() => users.email),
  plan: text().notNull(), interval: text().notNull(), environment: text().notNull(),
  providerToken: text('provider_token'), paymentUrl: text('payment_url'),
  state: text().default('creating').notNull(), acceptedTerms: jsonb('accepted_terms').notNull(),
  charges: jsonb().notNull(), syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [serverAccess(), index('acontec_checkout_email_idx').on(table.email), index('acontec_checkout_sync_idx').on(table.state,table.environment,table.syncedAt), uniqueIndex('acontec_one_open_checkout_idx').on(table.email).where(sql`${table.state} in ('creating','pending','unknown')`)]).enableRLS();
export const supportGrants = pgTable('acontec_support_grants', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id),
  email: text().notNull(), grantedBy: text('granted_by').notNull(),
  expiresAt: timestamp('expires_at').notNull(), createdAt: timestamp('created_at').defaultNow().notNull(),
}, () => [serverAccess()]).enableRLS();
export const serviceMessages = pgTable('acontec_service_messages', {
  id: uuid().defaultRandom().primaryKey(), email: text().notNull().references(() => users.email),
  subject: text().notNull(), body: text().notNull(),
  state: text().default('pending').notNull(), dedupeKey: text('dedupe_key').unique(),
  actor: text().notNull(), attempts: integer().default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(), sentAt: timestamp('sent_at'),
}, table => [serverAccess(),index('acontec_service_message_queue_idx').on(table.state,table.createdAt)]).enableRLS();
