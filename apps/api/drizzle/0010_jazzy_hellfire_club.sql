CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "entitlements" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;