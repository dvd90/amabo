CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_idx" ON "auth_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
-- Backfill: every existing account already has exactly one sign-in method (its own
-- oauth_provider/oauth_subject); make that explicit as an identity row so login keeps
-- resolving to the SAME account. New sign-in methods linked from here on (e.g. a magic
-- link to an email that already has a Google account) merge into the existing account
-- instead of creating a duplicate.
INSERT INTO "auth_identities" ("user_id", "provider", "subject")
SELECT "id", "oauth_provider", "oauth_subject" FROM "users"
ON CONFLICT ("provider", "subject") DO NOTHING;