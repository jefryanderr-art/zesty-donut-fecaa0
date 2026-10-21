CREATE TABLE "acontec_accounting_origins" (
	"company_id" uuid PRIMARY KEY,
	"revision" integer NOT NULL,
	"data" jsonb,
	"source_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_accounting_origins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_accounting_storage" (
	"company_id" uuid PRIMARY KEY,
	"revision" integer NOT NULL,
	"mode" text DEFAULT 'relational' NOT NULL,
	"document_extra" jsonb NOT NULL,
	"manifest" jsonb NOT NULL,
	"source_hash" text NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "acontec_storage_mode" CHECK (mode IN ('relational', 'legacy'))
);
--> statement-breakpoint
ALTER TABLE "acontec_accounting_storage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_cash_counts" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"fund_id" text,
	"account" text,
	"expected_cents" bigint,
	"counted_cents" bigint,
	"vouchers_cents" bigint,
	"difference_cents" bigint,
	"authorized_fixed_amount_cents" bigint,
	CONSTRAINT "acontec_cash_counts_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_cash_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_cash_movements" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"entry_id" text,
	"currency" text,
	"debit" text,
	"credit" text,
	"method" text,
	"total_cents" bigint,
	"base_total_cents" bigint,
	CONSTRAINT "acontec_cash_movements_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_cash_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_cost_catalog" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"type" text,
	"account" text,
	"center" text,
	"amount_cents" bigint,
	CONSTRAINT "acontec_cost_catalog_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_cost_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_costs" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"entry_id" text,
	"catalog_id" text,
	"period" text,
	"pay" text,
	"base_cents" bigint,
	"vat_cents" bigint,
	"total_cents" bigint,
	CONSTRAINT "acontec_costs_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_costs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_customers" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"tax_id" text,
	"status" text,
	"credit_limit_cents" bigint,
	CONSTRAINT "acontec_customers_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_employees" (
	"company_id" uuid,
	"id" text,
	"position" text,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"start" text,
	"salary_cents" bigint,
	CONSTRAINT "acontec_employees_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_inventory_movements" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"entry_id" text NOT NULL,
	"pid" text,
	"unit" text,
	"unit_cost_cents" bigint,
	"q" numeric,
	CONSTRAINT "acontec_inventory_movements_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_inventory_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_invoice_items" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"entry_id" text NOT NULL,
	"p" text,
	"unit" text,
	"u_cents" bigint,
	"cost_cents" bigint,
	"q" numeric,
	CONSTRAINT "acontec_invoice_items_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_invoice_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_invoice_payments" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"entry_id" text NOT NULL,
	"method" text,
	"amount_cents" bigint,
	CONSTRAINT "acontec_invoice_payments_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_invoice_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_invoices" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"type" text,
	"reference" text,
	"due" text,
	"customer_id" text,
	"supplier_id" text,
	"pay" text,
	"subtotal_cents" bigint,
	"vat_cents" bigint,
	"total_cents" bigint,
	CONSTRAINT "acontec_invoices_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_journal_entries" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"type" text,
	"desc" text,
	"reference" text,
	"due" text,
	"party" text,
	"pay" text,
	"invoice_id" text,
	"customer_id" text,
	"supplier_id" text,
	"shift_id" text,
	"subtotal_cents" bigint,
	"vat_cents" bigint,
	"total_cents" bigint,
	CONSTRAINT "acontec_journal_entries_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_journal_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_journal_lines" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"entry_id" text NOT NULL,
	"a" text,
	"d_cents" bigint,
	"c_cents" bigint,
	CONSTRAINT "acontec_journal_lines_pkey" PRIMARY KEY("company_id","id"),
	CONSTRAINT "acontec_line_nonnegative" CHECK ("d_cents" >= 0 AND "c_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "acontec_journal_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_accounts" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"tipo" text,
	"nat" text,
	"sub" text,
	CONSTRAINT "acontec_accounts_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_payrolls" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"employee_id" text,
	"from" text,
	"to" text,
	"status" text,
	"entry_id" text,
	"base_cents" bigint,
	"overtime_cents" bigint,
	"bonus_cents" bigint,
	"commission_cents" bigint,
	"gross_cents" bigint,
	"tax_cents" bigint,
	"social_cents" bigint,
	"loan_cents" bigint,
	"net_cents" bigint,
	CONSTRAINT "acontec_payrolls_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_payrolls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_petty_funds" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"account" text,
	"responsible" text,
	"entry_id" text,
	"fixed_amount_cents" bigint,
	"authorized_amount_cents" bigint,
	"limit_cents" bigint,
	CONSTRAINT "acontec_petty_funds_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_petty_funds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_petty_vouchers" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"fund_id" text,
	"account" text,
	"accrued_entry_id" text,
	"base_cents" bigint,
	"vat_cents" bigint,
	"total_cents" bigint,
	CONSTRAINT "acontec_petty_vouchers_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_petty_vouchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_products" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"code" text,
	"unit" text,
	"cost_cents" bigint,
	"price_cents" bigint,
	"stock" numeric,
	"min" numeric,
	CONSTRAINT "acontec_products_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_properties" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"type" text,
	"cadastral" text,
	"value_cents" bigint,
	CONSTRAINT "acontec_properties_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_settlements" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"employee_id" text,
	"entry_id" text,
	"salary_cents" bigint,
	"vacations_cents" bigint,
	"severance_cents" bigint,
	"bonus_cents" bigint,
	"premium_cents" bigint,
	"total_cents" bigint,
	CONSTRAINT "acontec_settlements_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_shifts" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"operator_id" text,
	"series" text,
	"closed_at" text,
	"opening_cents" bigint,
	"expected_cents" bigint,
	"counted_cents" bigint,
	"difference_cents" bigint,
	CONSTRAINT "acontec_shifts_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_suppliers" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"tax_id" text,
	"currency" text,
	"credit_limit_cents" bigint,
	CONSTRAINT "acontec_suppliers_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_tax_obligations" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"due" text,
	"period" text,
	"source" text,
	"entry_id" text,
	"amount_cents" bigint,
	"base_cents" bigint,
	"credit_cents" bigint,
	"used_credit_cents" bigint,
	"paid_cents" bigint,
	"withholdings_cents" bigint,
	"gross_advance_cents" bigint,
	CONSTRAINT "acontec_tax_obligations_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_tax_obligations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_company_backups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_company_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_customer_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_legal_acceptances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_login_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_site_content" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_cash_counts_company_date_idx" ON "acontec_cash_counts" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_cash_movements_company_date_idx" ON "acontec_cash_movements" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_cost_catalog_company_date_idx" ON "acontec_cost_catalog" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_costs_company_date_idx" ON "acontec_costs" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_customers_company_date_idx" ON "acontec_customers" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_employees_company_date_idx" ON "acontec_employees" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_inventory_movements_company_date_idx" ON "acontec_inventory_movements" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_invoice_items_company_date_idx" ON "acontec_invoice_items" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_invoice_payments_company_date_idx" ON "acontec_invoice_payments" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_invoices_company_date_idx" ON "acontec_invoices" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_journal_entries_company_date_idx" ON "acontec_journal_entries" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_journal_lines_company_date_idx" ON "acontec_journal_lines" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_accounts_company_date_idx" ON "acontec_accounts" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_payrolls_company_date_idx" ON "acontec_payrolls" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_petty_funds_company_date_idx" ON "acontec_petty_funds" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_petty_vouchers_company_date_idx" ON "acontec_petty_vouchers" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_products_company_date_idx" ON "acontec_products" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_properties_company_date_idx" ON "acontec_properties" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_settlements_company_date_idx" ON "acontec_settlements" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_shifts_company_date_idx" ON "acontec_shifts" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_suppliers_company_date_idx" ON "acontec_suppliers" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_tax_obligations_company_date_idx" ON "acontec_tax_obligations" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_accounting_origins" ADD CONSTRAINT "acontec_accounting_origins_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_accounting_storage" ADD CONSTRAINT "acontec_accounting_storage_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_cash_counts" ADD CONSTRAINT "acontec_cash_counts_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_cash_movements" ADD CONSTRAINT "acontec_cash_movements_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_cost_catalog" ADD CONSTRAINT "acontec_cost_catalog_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_costs" ADD CONSTRAINT "acontec_costs_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_customers" ADD CONSTRAINT "acontec_customers_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_employees" ADD CONSTRAINT "acontec_employees_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_inventory_movements" ADD CONSTRAINT "acontec_inventory_movements_oPs6XDrvMv6N_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_inventory_movements" ADD CONSTRAINT "acontec_inventory_movements_0dySxWZe99Eh_fkey" FOREIGN KEY ("company_id","entry_id") REFERENCES "acontec_journal_entries"("company_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_invoice_items" ADD CONSTRAINT "acontec_invoice_items_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_invoice_items" ADD CONSTRAINT "acontec_invoice_items_3T0mnaWjFQo4_fkey" FOREIGN KEY ("company_id","entry_id") REFERENCES "acontec_journal_entries"("company_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_invoice_payments" ADD CONSTRAINT "acontec_invoice_payments_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_invoice_payments" ADD CONSTRAINT "acontec_invoice_payments_kf5tYOUM8KGf_fkey" FOREIGN KEY ("company_id","entry_id") REFERENCES "acontec_journal_entries"("company_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_invoices" ADD CONSTRAINT "acontec_invoices_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_journal_entries" ADD CONSTRAINT "acontec_journal_entries_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_journal_lines" ADD CONSTRAINT "acontec_journal_lines_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_journal_lines" ADD CONSTRAINT "acontec_journal_lines_DEBKMQu2kwCr_fkey" FOREIGN KEY ("company_id","entry_id") REFERENCES "acontec_journal_entries"("company_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_accounts" ADD CONSTRAINT "acontec_accounts_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_payrolls" ADD CONSTRAINT "acontec_payrolls_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_petty_funds" ADD CONSTRAINT "acontec_petty_funds_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_petty_vouchers" ADD CONSTRAINT "acontec_petty_vouchers_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_products" ADD CONSTRAINT "acontec_products_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_properties" ADD CONSTRAINT "acontec_properties_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_settlements" ADD CONSTRAINT "acontec_settlements_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_shifts" ADD CONSTRAINT "acontec_shifts_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_suppliers" ADD CONSTRAINT "acontec_suppliers_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_tax_obligations" ADD CONSTRAINT "acontec_tax_obligations_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_accounting_origins" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_accounting_storage" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_audit_events" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_cash_counts" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_cash_movements" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_companies" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_company_backups" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_company_members" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_cost_catalog" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_costs" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_customer_events" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_customer_payments" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_customers" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_employees" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_inventory_movements" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_invoice_items" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_invoice_payments" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_invoices" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_journal_entries" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_journal_lines" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_accounts" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_legal_acceptances" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_login_attempts" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_payrolls" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_petty_funds" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_petty_vouchers" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_products" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_properties" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_sessions" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_settlements" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_shifts" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_site_content" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_suppliers" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_tax_obligations" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_users" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));