CREATE TABLE "acontec_company_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"policy" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_company_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_company_members" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "acontec_company_members" ADD COLUMN "permission_exceptions" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_role_company_id_idx" ON "acontec_company_roles" ("company_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_role_company_key_idx" ON "acontec_company_roles" ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_role_company_name_idx" ON "acontec_company_roles" ("company_id","name");--> statement-breakpoint
ALTER TABLE "acontec_company_members" ADD CONSTRAINT "acontec_member_company_role_fk" FOREIGN KEY ("company_id","role_id") REFERENCES "acontec_company_roles"("company_id","id");--> statement-breakpoint
ALTER TABLE "acontec_company_roles" ADD CONSTRAINT "acontec_company_roles_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_company_roles" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));