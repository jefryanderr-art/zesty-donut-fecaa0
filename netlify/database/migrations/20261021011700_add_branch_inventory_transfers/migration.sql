CREATE TABLE "acontec_stock_transfers" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"source_id" text,
	"destination_id" text,
	"status" text,
	"branch_id" text,
	"entry_id" text,
	"total_cents" bigint,
	CONSTRAINT "acontec_stock_transfers_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_stock_transfers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_stock_transfers_company_date_idx" ON "acontec_stock_transfers" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_stock_transfers" ADD CONSTRAINT "acontec_stock_transfers_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_stock_transfers" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));