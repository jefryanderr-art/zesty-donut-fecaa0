CREATE TABLE "acontec_branches" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"name" text,
	"code" text,
	"address" text,
	"phone" text,
	CONSTRAINT "acontec_branches_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_product_barcodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_product_barcodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_audit_events" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_cash_counts" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_cash_movements" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "acontec_company_members" ADD COLUMN "branch_ids" jsonb DEFAULT '["principal"]' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_costs" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_employees" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_journal_entries" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_payrolls" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_petty_funds" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_petty_vouchers" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_sessions" ADD COLUMN "active_branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_settlements" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_shifts" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "acontec_tax_obligations" ADD COLUMN "branch_id" text;--> statement-breakpoint
CREATE INDEX "acontec_branches_company_date_idx" ON "acontec_branches" ("company_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_barcode_company_code_idx" ON "acontec_product_barcodes" ("company_id","code");--> statement-breakpoint
ALTER TABLE "acontec_branches" ADD CONSTRAINT "acontec_branches_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_product_barcodes" ADD CONSTRAINT "acontec_product_barcodes_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_branches" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_product_barcodes" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));