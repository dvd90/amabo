CREATE TABLE "creatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"seed" double precision NOT NULL,
	"stage" text NOT NULL,
	"disposition" double precision NOT NULL,
	"age_minutes" double precision NOT NULL,
	"stats" jsonb NOT NULL,
	"asleep" boolean NOT NULL,
	"ill" boolean NOT NULL,
	"uncanny" boolean NOT NULL,
	"alive" boolean NOT NULL,
	"mortality" text NOT NULL,
	"traits" jsonb NOT NULL,
	"care_history" jsonb NOT NULL,
	"last_tick_at" double precision NOT NULL,
	"graduated_at" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creature_id" uuid NOT NULL,
	"at" double precision NOT NULL,
	"kind" text NOT NULL,
	"source" text DEFAULT 'sim' NOT NULL,
	"stat_deltas" jsonb NOT NULL,
	"disposition_delta" double precision NOT NULL,
	"salience" double precision NOT NULL,
	"tag" text,
	"text" text
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creature_id" uuid NOT NULL,
	"at" double precision NOT NULL,
	"action" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creature_id" uuid NOT NULL,
	"at" double precision NOT NULL,
	"salience" double precision NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creature_id" uuid NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"born_at" double precision NOT NULL,
	"graduated_at" double precision NOT NULL,
	"final_traits" jsonb NOT NULL,
	"constellation_pos" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_creature_id_creatures_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_creature_id_creatures_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_creature_id_creatures_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creatures_owner_idx" ON "creatures" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "events_creature_idx" ON "events" USING btree ("creature_id","at");