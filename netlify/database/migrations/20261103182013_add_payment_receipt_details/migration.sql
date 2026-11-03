ALTER TABLE "acontec_customer_payments" ADD COLUMN "receipt_details" jsonb;--> statement-breakpoint
ALTER TABLE "acontec_customer_payments" ADD COLUMN "notified_at" timestamp;--> statement-breakpoint
ALTER TABLE "acontec_service_messages" ADD COLUMN "last_error" text;