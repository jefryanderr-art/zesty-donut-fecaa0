CREATE TABLE "acontec_save_failures" (
	"code" text PRIMARY KEY,
	"company_id" text,
	"status" integer NOT NULL,
	"reason" text NOT NULL,
	"bytes" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_save_failures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_save_operations" (
	"company_id" uuid,
	"operation_id" uuid,
	"actor" text NOT NULL,
	"payload_hash" text NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "acontec_save_operations_pkey" PRIMARY KEY("company_id","operation_id")
);
--> statement-breakpoint
ALTER TABLE "acontec_save_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_save_failure_date_idx" ON "acontec_save_failures" ("created_at");--> statement-breakpoint
ALTER TABLE "acontec_save_operations" ADD CONSTRAINT "acontec_save_operations_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id");--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_save_failures" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_save_operations" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));