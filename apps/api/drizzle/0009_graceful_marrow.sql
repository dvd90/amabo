CREATE TABLE "telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"anon_id" text,
	"user_id" uuid,
	"at" double precision NOT NULL,
	"props" jsonb
);
--> statement-breakpoint
CREATE INDEX "telemetry_name_at_idx" ON "telemetry" USING btree ("name","at");