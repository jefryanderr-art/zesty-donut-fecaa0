CREATE TABLE "acontec_invoice_drafts" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"status" text,
	"branch_id" text,
	"customer_id" text,
	"entry_id" text,
	"total_cents" bigint,
	CONSTRAINT "acontec_invoice_drafts_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_invoice_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_invoice_drafts_company_date_idx" ON "acontec_invoice_drafts" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_invoice_drafts" ADD CONSTRAINT "acontec_invoice_drafts_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_invoice_drafts" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));