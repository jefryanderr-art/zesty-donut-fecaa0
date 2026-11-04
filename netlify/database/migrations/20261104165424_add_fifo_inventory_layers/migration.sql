CREATE TABLE "acontec_inventory_layers" (
	"company_id" uuid,
	"id" text,
	"position" integer NOT NULL,
	"date" text,
	"extra" jsonb NOT NULL,
	"product_id" text,
	"branch_id" text,
	"epoch" text,
	"entry_id" text,
	"source_layer_id" text,
	"unit_cost_cents" bigint,
	"value_cents" bigint,
	"original_value_cents" bigint,
	"q" numeric,
	"original_quantity" numeric,
	CONSTRAINT "acontec_inventory_layers_pkey" PRIMARY KEY("company_id","id")
);
--> statement-breakpoint
ALTER TABLE "acontec_inventory_layers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_inventory_layers_company_date_idx" ON "acontec_inventory_layers" ("company_id","date");--> statement-breakpoint
ALTER TABLE "acontec_inventory_layers" ADD CONSTRAINT "acontec_inventory_layers_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_inventory_layers" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));