CREATE TABLE "acontec_billing_checkouts" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"plan" text NOT NULL,
	"interval" text NOT NULL,
	"environment" text NOT NULL,
	"provider_token" text,
	"payment_url" text,
	"state" text DEFAULT 'creating' NOT NULL,
	"accepted_terms" jsonb NOT NULL,
	"charges" jsonb NOT NULL,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_billing_checkouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_service_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"dedupe_key" text UNIQUE,
	"actor" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "acontec_service_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_service_plans" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"monthly_cents" bigint NOT NULL,
	"annual_cents" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"limits" jsonb NOT NULL,
	"blocked_modules" jsonb DEFAULT '[]' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_service_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_subscriptions" (
	"email" text PRIMARY KEY,
	"plan" text,
	"interval" text DEFAULT 'mensual' NOT NULL,
	"state" text DEFAULT 'prueba' NOT NULL,
	"trial_ends_at" timestamp NOT NULL,
	"recurring_cents" bigint,
	"paid_environment" text,
	"paid_until" timestamp,
	"canceled_at" timestamp,
	"limits" jsonb DEFAULT '{}' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_support_grants" (
	"company_id" uuid PRIMARY KEY,
	"email" text NOT NULL,
	"granted_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acontec_support_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acontec_companies" ADD COLUMN "is_platform_company" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "status" text DEFAULT 'confirmado' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "interval" text DEFAULT 'mensual' NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "provider_key" text;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "receipt" jsonb;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "journal_id" text;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "acontec_sessions" ADD COLUMN "active_company_id" uuid;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD CONSTRAINT "acontec_customer_payments_provider_key_key" UNIQUE("provider_key");--> statement-breakpoint
CREATE INDEX "acontec_checkout_email_idx" ON "acontec_billing_checkouts" ("email");--> statement-breakpoint
CREATE INDEX "acontec_checkout_sync_idx" ON "acontec_billing_checkouts" ("state","environment","synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_one_open_checkout_idx" ON "acontec_billing_checkouts" ("email") WHERE "state" in ('creating','pending','unknown');--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_one_platform_company_idx" ON "acontec_companies" ("is_platform_company") WHERE "is_platform_company" = true;--> statement-breakpoint
CREATE INDEX "acontec_service_payment_status_date_idx" ON "acontec_customer_payments" ("status","date");--> statement-breakpoint
CREATE INDEX "acontec_service_message_queue_idx" ON "acontec_service_messages" ("state","created_at");--> statement-breakpoint
CREATE INDEX "acontec_subscription_plan_paid_idx" ON "acontec_subscriptions" ("plan","paid_until");--> statement-breakpoint
ALTER TABLE "acontec_billing_checkouts" ADD CONSTRAINT "acontec_billing_checkouts_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_service_messages" ADD CONSTRAINT "acontec_service_messages_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_subscriptions" ADD CONSTRAINT "acontec_subscriptions_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_support_grants" ADD CONSTRAINT "acontec_support_grants_company_id_acontec_companies_id_fkey" FOREIGN KEY ("company_id") REFERENCES "acontec_companies"("id");--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_billing_checkouts" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_service_messages" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_service_plans" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_subscriptions" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_support_grants" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));