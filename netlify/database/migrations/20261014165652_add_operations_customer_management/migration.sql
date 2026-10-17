CREATE TABLE "acontec_customer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_customer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"date" text NOT NULL,
	"reference" text NOT NULL,
	"method" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"version" text NOT NULL,
	"content_hash" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_users" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_users" ADD COLUMN "last_access_at" timestamp;--> statement-breakpoint
ALTER TABLE "acontec_users" ADD COLUMN "platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_users" ADD COLUMN "profile" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_users" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "acontec_customer_events_email_date_idx" ON "acontec_customer_events" ("email","created_at");--> statement-breakpoint
CREATE INDEX "acontec_customer_payments_email_idx" ON "acontec_customer_payments" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_legal_acceptance_version_idx" ON "acontec_legal_acceptances" ("email","version");--> statement-breakpoint
ALTER TABLE "acontec_customer_events" ADD CONSTRAINT "acontec_customer_events_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD CONSTRAINT "acontec_customer_payments_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_legal_acceptances" ADD CONSTRAINT "acontec_legal_acceptances_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");