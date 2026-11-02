CREATE TABLE "acontec_billing_channels" (
	"email" text PRIMARY KEY,
	"channel" text DEFAULT 'unassigned' NOT NULL,
	"permit" text,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "acontec_channel_value" CHECK ("channel" IN ('unassigned','pagadito','transfer'))
);
--> statement-breakpoint
ALTER TABLE "acontec_billing_channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "acontec_transfer_requests" (
	"code" text PRIMARY KEY,
	"email" text NOT NULL,
	"plan" text NOT NULL,
	"interval" text NOT NULL,
	"currency" text NOT NULL,
	"expected_cents" bigint NOT NULL,
	"usd_cents" bigint NOT NULL,
	"environment" text NOT NULL,
	"exchange" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"payment_id" uuid,
	"version" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "acontec_transfer_money" CHECK ("expected_cents">0 AND "usd_cents">0)
);
--> statement-breakpoint
ALTER TABLE "acontec_transfer_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "acontec_transfer_queue_idx" ON "acontec_transfer_requests" ("state","expires_at");--> statement-breakpoint
CREATE INDEX "acontec_transfer_email_idx" ON "acontec_transfer_requests" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "acontec_transfer_open_idx" ON "acontec_transfer_requests" ("email") WHERE "state"='pending';--> statement-breakpoint
ALTER TABLE "acontec_billing_channels" ADD CONSTRAINT "acontec_billing_channels_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_transfer_requests" ADD CONSTRAINT "acontec_transfer_requests_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email");--> statement-breakpoint
ALTER TABLE "acontec_transfer_requests" ADD CONSTRAINT "acontec_transfer_requests_pJ5a3ftIG6S8_fkey" FOREIGN KEY ("payment_id") REFERENCES "acontec_customer_payments"("id");--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_billing_channels" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));--> statement-breakpoint
CREATE POLICY "acontec_solo_servidor" ON "acontec_transfer_requests" AS PERMISSIVE FOR ALL TO public USING (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE')) WITH CHECK (current_user NOT IN ('anon', 'authenticated') AND has_table_privilege(current_user, 'public.acontec_companies', 'UPDATE'));