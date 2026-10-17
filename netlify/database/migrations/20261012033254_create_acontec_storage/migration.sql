CREATE TABLE "acontec_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_email" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_login_attempts" (
	"key" text PRIMARY KEY,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_site_content" (
	"id" text PRIMARY KEY,
	"content" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acontec_users" (
	"email" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD CONSTRAINT "acontec_companies_owner_email_acontec_users_email_fkey" FOREIGN KEY ("owner_email") REFERENCES "acontec_users"("email");