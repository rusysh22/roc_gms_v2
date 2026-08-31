-- Anonymous "Create New Event" wizard: let logged-out visitors build a draft event that is
-- later claimed by the account they register/log in with.
--   * draft_claim_token  - random opaque token minted on anonymous create, matched against the
--                           visitor's `wizard_draft` cookie; set to NULL the moment the draft is
--                           claimed (and always NULL for events created by a logged-in user).
--   * draft_creator_ip   - client IP recorded at anonymous create, for behaviour analysis and
--                           abuse triage (mirrors registration_submissions.submitter_ip); cleared
--                           on claim.
-- Safe: both columns are nullable with no default, every existing row stays NULL (i.e. "not an
-- unclaimed anonymous draft"), no data is rewritten.
-- Run against the production DB (roc-gms-postgres):
--   docker exec -i roc-gms-postgres psql -U roc_gms -d roc_gms -f - < scripts/2026-08-31-events-anonymous-draft.sql

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS draft_claim_token varchar;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS draft_creator_ip varchar;

CREATE INDEX IF NOT EXISTS events_draft_claim_token_idx
  ON public.events USING btree (draft_claim_token);

COMMIT;

-- verify
-- select column_name, data_type, is_nullable from information_schema.columns
--   where table_name = 'events' and column_name in ('draft_claim_token', 'draft_creator_ip');
