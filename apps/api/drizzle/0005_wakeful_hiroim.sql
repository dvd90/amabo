CREATE TABLE "bonds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"creature_a" uuid NOT NULL,
	"creature_b" uuid NOT NULL,
	"strength" double precision NOT NULL,
	"met_count" double precision NOT NULL,
	"last_met_at" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gatherings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"at" double precision NOT NULL,
	"participant_ids" jsonb NOT NULL,
	"outline" jsonb NOT NULL,
	"transcript" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bonds_pair_idx" ON "bonds" USING btree ("owner_id","creature_a","creature_b");--> statement-breakpoint
CREATE INDEX "gatherings_owner_idx" ON "gatherings" USING btree ("owner_id","at");