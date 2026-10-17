import { pgTable, text, uuid, jsonb, timestamp, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('acontec_users', {
  email: text().primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  name: text().default('').notNull(),
  lastAccessAt: timestamp('last_access_at'),
  platformAdmin: boolean('platform_admin').default(false).notNull(),
  profile: jsonb().default({}).notNull(),
  version: integer().default(0).notNull(),
});

export const customerPayments = pgTable('acontec_customer_payments', {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().references(() => users.email),
  amountCents: integer('amount_cents').notNull(),
  currency: text().notNull(),
  date: text().notNull(),
  reference: text().notNull(),
  method: text().notNull(),
  actor: text().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [index('acontec_customer_payments_email_idx').on(table.email)]);

export const customerEvents = pgTable('acontec_customer_events', {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().references(() => users.email),
  actor: text().notNull(),
  action: text().notNull(),
  details: jsonb().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [index('acontec_customer_events_email_date_idx').on(table.email, table.createdAt)]);

export const legalAcceptances = pgTable('acontec_legal_acceptances', {
  id: uuid().defaultRandom().primaryKey(),
  email: text().notNull().references(() => users.email),
  version: text().notNull(),
  contentHash: text('content_hash').notNull(),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
}, table => [uniqueIndex('acontec_legal_acceptance_version_idx').on(table.email, table.version)]);
export const companies = pgTable('acontec_companies', {
  id: uuid().defaultRandom().primaryKey(),
  ownerEmail: text('owner_email').notNull().references(() => users.email),
  name: text().notNull(),
  description: text().default('').notNull(),
  data: jsonb(),
  revision: integer().default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const siteContent = pgTable('acontec_site_content', {
  id: text().primaryKey(),
  content: jsonb().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const loginAttempts = pgTable('acontec_login_attempts', {
  key: text().primaryKey(),
  count: integer().default(1).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});
export const sessions = pgTable('acontec_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  email: text().notNull().references(() => users.email, { onDelete: 'cascade' }),
  admin: boolean().default(false).notNull(),
  memberId: uuid('member_id').references(() => companyMembers.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
}, table => [index('acontec_sessions_expires_at_idx').on(table.expiresAt)]);

export const companyMembers = pgTable('acontec_company_members', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email: text(),
  username: text().unique(),
  passwordHash: text('password_hash'),
  name: text().notNull(),
  role: text().notNull(),
  permissions: jsonb().notNull(),
  active: boolean().default(true).notNull(),
  version: integer().default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [uniqueIndex('acontec_member_company_email_idx').on(table.companyId, table.email)]);

export const auditEvents = pgTable('acontec_audit_events', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  actor: text().notNull(),
  action: text().notNull(),
  changes: jsonb().notNull(),
  revision: integer(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [index('acontec_audit_company_date_idx').on(table.companyId, table.createdAt)]);

export const companyBackups = pgTable('acontec_company_backups', {
  id: uuid().defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text().notNull(),
  data: jsonb(),
  revision: integer().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [uniqueIndex('acontec_backup_company_revision_idx').on(table.companyId, table.revision)]);
