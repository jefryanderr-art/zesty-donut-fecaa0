CREATE TABLE "acontec_instruments" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"kind" text,
	"status" text,
	"reference" text,
	"due" text,
	"invoice_id" text,
	"entry_id" text,
	"branch_id" text,
	"total_cents" bigint,
	CONSTRAINT "acontec_instruments_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_instruments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_partners" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"branch_id" text,
	CONSTRAINT "acontec_partners_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_partners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_withholdings" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"side" text,
	"reference" text,
	"invoice_id" text,
	"entry_id" text,
	"branch_id" text,
	"base_cents" bigint,
	"total_cents" bigint,
	"rate" numeric,
	CONSTRAINT "acontec_withholdings_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_withholdings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_instruments_company_date_idx" ON "acontec_instruments" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_partners_company_date_idx" ON "acontec_partners" ("company_id","date");--> statement-breakpoint
CREATE INDEX "acontec_withholdings_company_date_idx" ON "acontec_withholdings" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_instruments" ADD CONSTRAINT "acontec_instruments_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_partners" ADD CONSTRAINT "acontec_partners_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_withholdings" ADD CONSTRAINT "acontec_withholdings_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_instruments" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_partners" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_withholdings" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));