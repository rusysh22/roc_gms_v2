-- Scope competition-category slug uniqueness to (event, sport) instead of event-wide.
-- Safe: verified there are currently no (event_id_id, sport_id_id, slug) duplicates.
-- Run against the production DB (roc-gms-postgres):
--   docker exec -i roc-gms-postgres psql -U roc_gms -d roc_gms -f - < scripts/2026-08-30-category-slug-per-sport.sql

BEGIN;

-- guard: abort if any real duplicate exists under the new key
DO $$
DECLARE dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT 1 FROM competition_categories
    GROUP BY event_id_id, sport_id_id, slug
    HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'aborting: % (event, sport, slug) duplicate group(s) exist', dupes;
  END IF;
END $$;

DROP INDEX IF EXISTS event_id_slug_2_idx;

CREATE UNIQUE INDEX IF NOT EXISTS event_id_sport_id_slug_idx
  ON public.competition_categories USING btree (event_id_id, sport_id_id, slug);

COMMIT;

-- verify
-- select indexname, indexdef from pg_indexes
--   where tablename = 'competition_categories' and indexdef ilike '%unique%';
