CREATE TABLE "keepsakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"creature_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"at" double precision NOT NULL
);
--> statement-breakpoint
CREATE INDEX "keepsakes_owner_idx" ON "keepsakes" USING btree ("owner_id","at");