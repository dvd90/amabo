CREATE TABLE "chronicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"at" double precision NOT NULL,
	"a_id" uuid NOT NULL,
	"b_id" uuid NOT NULL,
	"valence" text NOT NULL,
	"tag" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"a" uuid NOT NULL,
	"b" uuid NOT NULL,
	"valence" text NOT NULL,
	"line" text NOT NULL,
	"updated_at" double precision NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chronicle_owner_idx" ON "chronicle" USING btree ("owner_id","at");--> statement-breakpoint
CREATE INDEX "standings_pair_idx" ON "standings" USING btree ("owner_id","a","b");