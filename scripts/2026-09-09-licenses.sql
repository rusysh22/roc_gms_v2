-- Licenses collection (Berlanggan subscription gating for /workspaces).
-- Prod DB schema is manual (no migration runner); apply this by hand:
--   docker exec -i roc-gms-postgres psql -U roc_gms -d roc_gms -f - < scripts/2026-09-09-licenses.sql
-- Generated from `payload migrate:create` (src/collections/Licenses.ts).

BEGIN;

DO $$ BEGIN
  CREATE TYPE "public"."enum_licenses_effective_status" AS ENUM('active', 'grace', 'expired', 'revoked', 'suspended', 'not_activated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id_id" integer NOT NULL,
	"license_key" varchar NOT NULL,
	"fingerprint" varchar NOT NULL,
	"token" varchar,
	"token_expires_at" timestamp(3) with time zone,
	"license_expires_at" timestamp(3) with time zone,
	"effective_status" "enum_licenses_effective_status" DEFAULT 'not_activated' NOT NULL,
	"entitlements" jsonb,
	"last_validated_at" timestamp(3) with time zone,
	"last_error" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "licenses" DROP CONSTRAINT IF EXISTS "licenses_user_id_id_users_id_fk";
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_id_users_id_fk"
	FOREIGN KEY ("user_id_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "licenses_user_id_idx" ON "licenses" USING btree ("user_id_id");
CREATE INDEX IF NOT EXISTS "licenses_effective_status_idx" ON "licenses" USING btree ("effective_status");
CREATE INDEX IF NOT EXISTS "licenses_updated_at_idx" ON "licenses" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "licenses_created_at_idx" ON "licenses" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "user_id_idx" ON "licenses" USING btree ("user_id_id");

-- Payload admin "locked documents" polymorphic relation needs a column for the new collection.
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "licenses_id" integer;

ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_licenses_fk";
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_licenses_fk"
	FOREIGN KEY ("licenses_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_licenses_id_idx" ON "payload_locked_documents_rels" USING btree ("licenses_id");

COMMIT;
