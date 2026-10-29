CREATE TABLE "acontec_business_records" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"module" text,
	"kind" text,
	"name" text,
	"status" text,
	"branch_id" text,
	"customer_id" text,
	"product_id" text,
	"entry_id" text,
	"resource" text,
	"due" text,
	"total_cents" bigint,
	"principal_cents" bigint,
	"interest_cents" bigint,
	"penalty_cents" bigint,
	"paid_cents" bigint,
	"deposit_cents" bigint,
	"valuation_cents" bigint,
	"cost_cents" bigint,
	"price_cents" bigint,
	"q" numeric,
	"rate" numeric,
	CONSTRAINT "acontec_business_records_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_business_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "business_type" text DEFAULT 'comercio' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "business_customization" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "onboarding_done" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_company_backups" ADD COLUMN "business_type" text DEFAULT 'comercio' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_company_backups" ADD COLUMN "business_customization" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_company_backups" ADD COLUMN "onboarding_done" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "acontec_business_records_company_date_idx" ON "acontec_business_records" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_business_records" ADD CONSTRAINT "acontec_business_records_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_business_records" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));