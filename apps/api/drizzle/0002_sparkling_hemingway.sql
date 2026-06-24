CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"at" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creature_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"from_confirmed_at" double precision,
	"to_confirmed_at" double precision,
	"at" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"reason" text,
	"at" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creature_id" uuid NOT NULL,
	"owner_id" uuid,
	"kind" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" double precision NOT NULL,
	"revoked_at" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_creature_id_creatures_id_fk" FOREIGN KEY ("creature_id") REFERENCES "public"."creatures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_links_token_idx" ON "share_links" USING btree ("token");