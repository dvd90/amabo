CREATE TABLE "letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"from_creature" uuid NOT NULL,
	"to_creature" uuid NOT NULL,
	"at" double precision NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "letters_owner_idx" ON "letters" USING btree ("owner_id","at");