CREATE TABLE "acontec_fixed_assets" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"entry_id" text,
	"account" text,
	"method" text,
	"branch_id" text,
	"cost_cents" bigint,
	"residual_cents" bigint,
	"accumulated_cents" bigint,
	"life_months" numeric,
	CONSTRAINT "acontec_fixed_assets_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_fixed_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_attendance" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"employee_id" text,
	"status" text,
	"branch_id" text,
	CONSTRAINT "acontec_attendance_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_budgets" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"month" text,
	"account" text,
	"branch_id" text,
	"total_cents" bigint,
	CONSTRAINT "acontec_budgets_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_employee_advances" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"employee_id" text,
	"entry_id" text,
	"branch_id" text,
	"total_cents" bigint,
	"months" numeric,
	CONSTRAINT "acontec_employee_advances_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_employee_advances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_exchange_rates" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"currency" text,
	"source" text,
	"rate" numeric,
	CONSTRAINT "acontec_exchange_rates_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_exchange_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_foreign_documents" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"currency" text,
	"side" text,
	"entry_id" text,
	"branch_id" text,
	"foreign_amount_cents" bigint,
	"base_total_cents" bigint,
	"exchange_rate" numeric,
	CONSTRAINT "acontec_foreign_documents_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_foreign_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_loans" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"entry_id" text,
	"account" text,
	"branch_id" text,
	"principal_cents" bigint,
	"annual_rate" numeric,
	"months" numeric,
	CONSTRAINT "acontec_loans_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_purchase_orders" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"status" text,
	"branch_id" text,
	"total_cents" bigint,
	CONSTRAINT "acontec_purchase_orders_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_quotations" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"status" text,
	"branch_id" text,
	"total_cents" bigint,
	CONSTRAINT "acontec_quotations_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_quotations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_recurring_entries" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"branch_id" text,
	CONSTRAINT "acontec_recurring_entries_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_recurring_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_vacation_requests" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"employee_id" text,
	"from" text,
	"to" text,
	"branch_id" text,
	"days" numeric,
	CONSTRAINT "acontec_vacation_requests_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_vacation_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_fixed_assets_company_date_idx" ON "acontec_fixed_assets" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_attendance_company_date_idx" ON "acontec_attendance" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_budgets_company_date_idx" ON "acontec_budgets" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_employee_advances_company_date_idx" ON "acontec_employee_advances" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_exchange_rates_company_date_idx" ON "acontec_exchange_rates" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_foreign_documents_company_date_idx" ON "acontec_foreign_documents" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_loans_company_date_idx" ON "acontec_loans" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_purchase_orders_company_date_idx" ON "acontec_purchase_orders" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_quotations_company_date_idx" ON "acontec_quotations" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_recurring_entries_company_date_idx" ON "acontec_recurring_entries" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_vacation_requests_company_date_idx" ON "acontec_vacation_requests" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_fixed_assets" ADD CONSTRAINT "acontec_fixed_assets_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_attendance" ADD CONSTRAINT "acontec_attendance_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_budgets" ADD CONSTRAINT "acontec_budgets_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_employee_advances" ADD CONSTRAINT "acontec_employee_advances_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_exchange_rates" ADD CONSTRAINT "acontec_exchange_rates_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_foreign_documents" ADD CONSTRAINT "acontec_foreign_documents_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_loans" ADD CONSTRAINT "acontec_loans_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_purchase_orders" ADD CONSTRAINT "acontec_purchase_orders_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_quotations" ADD CONSTRAINT "acontec_quotations_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_recurring_entries" ADD CONSTRAINT "acontec_recurring_entries_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_vacation_requests" ADD CONSTRAINT "acontec_vacation_requests_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_fixed_assets" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_attendance" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_budgets" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_employee_advances" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_exchange_rates" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_foreign_documents" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_loans" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_purchase_orders" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_quotations" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_recurring_entries" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_vacation_requests" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));