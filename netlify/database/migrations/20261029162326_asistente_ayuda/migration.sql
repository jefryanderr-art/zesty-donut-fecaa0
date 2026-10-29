CREATE TABLE "acontec_assistant_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"day" text NOT NULL,
	"user_slot" integer NOT NULL,
	"company_slot" integer NOT NULL,
	"sections" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "acontec_assistant_user_limit" CHECK ("user_slot" BETWEEN 1 AND 20),
	CONSTRAINT "acontec_assistant_company_limit" CHECK ("company_slot" BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "acontec_assistant_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "assistant_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "assistant_time_zone" text DEFAULT 'America/Managua' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_assistant_user_day_slot_idx" ON "acontec_assistant_usage" ("actor","day","user_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_assistant_company_day_slot_idx" ON "acontec_assistant_usage" ("company_id","day","company_slot");--> statement-breakpoint
ALTER TABLE "acontec_assistant_usage" ADD CONSTRAINT "acontec_assistant_usage_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id");--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_assistant_usage" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));