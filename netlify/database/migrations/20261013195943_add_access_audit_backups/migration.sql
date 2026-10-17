CREATE TABLE "acontec_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb NOT NULL,
	"revision" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_company_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"data" jsonb,
	"revision" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_company_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"company_id" uuid NOT NULL,
	"email" text,
	"username" text UNIQUE,
	"password_hash" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_sessions" ADD COLUMN "member_id" uuid;--> statement-breakpoint
CREATE INDEX "acontec_audit_company_date_idx" ON "acontec_audit_events" ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_backup_company_revision_idx" ON "acontec_company_backups" ("company_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_member_company_email_idx" ON "acontec_company_members" ("company_id","email");--> statement-breakpoint
ALTER TABLE "acontec_audit_events" ADD CONSTRAINT "acontec_audit_events_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_company_backups" ADD CONSTRAINT "acontec_company_backups_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_company_members" ADD CONSTRAINT "acontec_company_members_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "acontec_sessions" ADD CONSTRAINT "acontec_sessions_member_id_acontec_company_members_id_fkey" FOREIGN KEY ("member_id") REFERENCES "acontec_company_members"("id") ON DELETE CASCADE;