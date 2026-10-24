-- Quick Bracket Tournament — add owner_user_id relationship (persistent editor identity).
-- Prod DB schema is manual (no migration runner); apply this by hand:
--   psql "$DATABASE_URL" -f scripts/2026-09-08-quick-brackets-owner-user.sql
-- Delta on top of scripts/2026-09-08-quick-brackets.sql.

BEGIN;

ALTER TABLE "quick_brackets" ADD COLUMN IF NOT EXISTS "owner_user_id_id" integer;

ALTER TABLE "quick_brackets" DROP CONSTRAINT IF EXISTS "quick_brackets_owner_user_id_id_users_id_fk";
ALTER TABLE "quick_brackets" ADD CONSTRAINT "quick_brackets_owner_user_id_id_users_id_fk"
	FOREIGN KEY ("owner_user_id_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "quick_brackets_owner_user_id_idx" ON "quick_brackets" USING btree ("owner_user_id_id");

COMMIT;
