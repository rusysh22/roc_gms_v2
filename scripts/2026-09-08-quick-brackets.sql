-- Quick Bracket Tournament (no-login) — new isolated collection.
-- Prod DB schema is manual (no migration runner); apply this by hand:
--   psql "$DATABASE_URL" -f scripts/2026-09-08-quick-brackets.sql
-- Generated from `payload migrate:create` output, trimmed to the quick_brackets delta.

BEGIN;

CREATE TYPE "public"."enum_quick_brackets_format" AS ENUM('single_elimination', 'double_elimination');
CREATE TYPE "public"."enum_quick_brackets_bracket_size_mode" AS ENUM('from_participants', 'manual_size');
CREATE TYPE "public"."enum_quick_brackets_status" AS ENUM('active', 'claimed', 'expired');

CREATE TABLE "quick_brackets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"format" "enum_quick_brackets_format" NOT NULL,
	"third_place" boolean DEFAULT false,
	"split_participants" boolean DEFAULT false,
	"bracket_size_mode" "enum_quick_brackets_bracket_size_mode" NOT NULL,
	"bracket_size" numeric NOT NULL,
	"bracket_data" jsonb NOT NULL,
	"owner_token" varchar,
	"creator_ip" varchar,
	"status" "enum_quick_brackets_status" DEFAULT 'active' NOT NULL,
	"claimed_event_id_id" integer,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quick_brackets_participants" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"seed" numeric NOT NULL
);

ALTER TABLE "quick_brackets_participants" ADD CONSTRAINT "quick_brackets_participants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quick_brackets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quick_brackets" ADD CONSTRAINT "quick_brackets_claimed_event_id_id_events_id_fk" FOREIGN KEY ("claimed_event_id_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "quick_brackets_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quick_brackets_fk" FOREIGN KEY ("quick_brackets_id") REFERENCES "public"."quick_brackets"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "quick_brackets_participants_order_idx" ON "quick_brackets_participants" USING btree ("_order");
CREATE INDEX "quick_brackets_participants_parent_id_idx" ON "quick_brackets_participants" USING btree ("_parent_id");
CREATE UNIQUE INDEX "quick_brackets_slug_idx" ON "quick_brackets" USING btree ("slug");
CREATE INDEX "quick_brackets_owner_token_idx" ON "quick_brackets" USING btree ("owner_token");
CREATE INDEX "quick_brackets_status_idx" ON "quick_brackets" USING btree ("status");
CREATE INDEX "quick_brackets_claimed_event_id_idx" ON "quick_brackets" USING btree ("claimed_event_id_id");
CREATE INDEX "quick_brackets_expires_at_idx" ON "quick_brackets" USING btree ("expires_at");
CREATE INDEX "quick_brackets_updated_at_idx" ON "quick_brackets" USING btree ("updated_at");
CREATE INDEX "quick_brackets_created_at_idx" ON "quick_brackets" USING btree ("created_at");
CREATE INDEX "payload_locked_documents_rels_quick_brackets_id_idx" ON "payload_locked_documents_rels" USING btree ("quick_brackets_id");

COMMIT;
