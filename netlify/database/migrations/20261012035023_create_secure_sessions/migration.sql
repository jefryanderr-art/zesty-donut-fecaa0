CREATE TABLE "acontec_sessions" (
	"token_hash" text PRIMARY KEY,
	"email" text NOT NULL,
	"admin" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "acontec_sessions_expires_at_idx" ON "acontec_sessions" ("expires_at");--> statement-breakpoint
ALTER TABLE "acontec_sessions" ADD CONSTRAINT "acontec_sessions_email_acontec_users_email_fkey" FOREIGN KEY ("email") REFERENCES "acontec_users"("email") ON DELETE CASCADE;