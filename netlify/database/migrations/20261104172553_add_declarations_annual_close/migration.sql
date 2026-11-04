CREATE TABLE "acontec_fiscal_workflows" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"module" text,
	"kind" text,
	"branch_id" text,
	"period" text,
	"status" text,
	"parent_id" text,
	"amount_cents" bigint,
	"difference_cents" bigint,
	CONSTRAINT "acontec_fiscal_workflows_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_fiscal_workflows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_fiscal_workflows_company_date_idx" ON "acontec_fiscal_workflows" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_fiscal_workflows" ADD CONSTRAINT "acontec_fiscal_workflows_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_fiscal_workflows" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));