# ROC GMS V2 - Session Handoff

Last updated: 2026-07-02  
Branch: `codex/phase-0-1-baseline`  
Current phase: Phase 5A group standings foundation complete  
Current status: Group standings foundation is live. Payload has a `standings` collection, the
public `/standings` page shows cached standings in a mobile-readable table, seed data now includes a
published futsal group result, and standings can be recalculated from a command or the new
`/workspaces/standings` utility page. Brackets, winner advancement, group-to-knockout promotion,
manual standing overrides, live score, article CMS, announcement CMS, public edit mode, email/calendar
invite, and workspace authentication overhaul remain out of scope.
Source of truth: `prd/README.md`

## 1. How to Use This File

Update this file at the end of every Vibe Coding session.

The next session should read this file after reading:

1. `prd/README.md`
2. `prd/implementation-plan.md`
3. `prd/decision-log.md`

## 2. Latest Session Summary

Completed:

- Added `src/collections/Standings.ts` and registered it in `payload.config.ts`. The collection
  includes the required standing fields plus `standing_key` for deterministic duplicate-safe
  recalculation.
- Added `src/lib/standings.ts`, a reusable calculation and persistence module that reads only
  `finished` / `result_published` matches and `match-sets`, applies Ruleset points/draw settings,
  sorts deterministically, and writes only cached standing rows.
- Added `src/scripts/recalculateStandings.ts` and the `npm run standings:recalculate` command. It
  accepts `--category=...`, `--stage=...`, optional `--group=...`, and optional `--event=...`.
- Added `/standings` public page with grouped standing tables, empty states, and mobile horizontal
  scrolling.
- Added `/workspaces/standings` with a simple seeded-group recalculation form and links to public
  standings and Payload Admin standings.
- Added links to standings from home, public schedule, public match detail, admin match detail, and
  workspace navigation.
- Updated seed data so `ROC-FUT-GA-001` is a duplicate-safe seeded futsal result:
  `IT Futsal Squad 3-1 Finance Futsal Squad`, `result_published`, with IT as winner.
- Seed now recalculates the futsal Group A standing cache after creating/updating demo data.
- Updated `prd/implementation-plan.md` for Phase 5A progress.
- Added D015 to `prd/decision-log.md`.

Changed files:

- `src/collections/Standings.ts` (new)
- `src/lib/standings.ts` (new)
- `src/scripts/recalculateStandings.ts` (new)
- `src/app/(frontend)/standings/page.tsx` (new)
- `src/app/(frontend)/workspaces/standings/page.tsx` (new)
- `src/app/(frontend)/workspaces/standings/standingActions.ts` (new)
- `payload.config.ts`
- `package.json`
- `src/app/(frontend)/page.tsx`
- `src/app/(frontend)/schedule/page.tsx`
- `src/app/(frontend)/matches/[matchNumber]/page.tsx`
- `src/app/(frontend)/workspaces/matches/[matchNumber]/page.tsx`
- `src/app/(frontend)/workspaces/workspaceComponents.tsx`
- `src/app/(frontend)/styles.css`
- `src/seed/data/demoScenario.ts`
- `src/seed/index.ts`
- `prd/implementation-plan.md`
- `prd/decision-log.md`
- `prd/session-handoff.md`

Decisions:

- Recorded D015: standings are cached recalculations keyed by `standing_key`; Phase 5A supports
  Ruleset point fields and scalar tie-breakers first; head-to-head/manual/fewest-penalties tie
  breakers are deferred.

Tests / Verification:

- `npm.cmd run typecheck` passed.
- `npm.cmd run build` passed.
- `docker compose run --rm app npm run seed` passed twice after the standings changes, verifying
  duplicate-safe seed and standing cache updates.
- `docker compose run --rm app npm run standings:recalculate --category=3 --stage=3 --group=2`
  passed and printed two standing rows.
- Verified seeded futsal standings in PostgreSQL:
  `IT Futsal Squad` rank 1, played 1, won 1, points 3, score 3-1, difference +2;
  `Finance Futsal Squad` rank 2, played 1, lost 1, points 0, score 1-3, difference -2.
- `docker compose up -d` started the app. `docker compose up -d --build` was attempted but Windows
  blocked a locked generated `.next/dev` file while sending build context; the non-rebuild app start
  worked for route verification.
- HTTP 200 verified for `/`, `/schedule`, `/standings`, `/matches/ROC-BMS-001`,
  `/workspaces/matches/ROC-BMS-001`, and `/admin/collections/standings`.
- Verified Payload Admin can access the Standing collection via `/admin/collections/standings` (HTTP
  200).

Pending:

- Recalculate standings automatically from match result publish/update actions.
- Standing rank explanations and head-to-head/manual/fewest-penalties tie-breakers.
- Manual standing override UI with reason and audit log.
- Bracket collection, bracket renderer, winner advancement, and group-to-knockout promotion.
- Reschedule reason workflow / real scheduling mutation from the Scheduler Workspace.
- Full public comment submission and moderation workflow.
- Session/authentication gating for workspace routes and mutations.
- Match-set delete/reorder and documentation asset delete/edit from custom workspace pages.
- Collection-level public/private read hardening for public-facing data.
- Live score, article CMS, announcement CMS, public edit mode, email/calendar invite, MinIO/object
  storage remain intentionally out of scope.

Blockers:

- None. Note: Docker rebuild may need `.next` cleanup or closing processes on Windows if the locked
  generated file issue repeats.

Recommended next prompt:

```text
Continue ROC GMS V2 from the latest handoff. Read prd/README.md, prd/implementation-plan.md, prd/decision-log.md, and prd/session-handoff.md first. Inspect the repository and git status. Phase 5A group standings foundation is complete. Next, wire automatic standings recalculation after result publish/update actions, then add rank explanation/head-to-head planning or begin the Bracket collection foundation. Keep manual standing override UI, winner advancement, group-to-knockout promotion, double elimination, live score, article CMS, announcement CMS, public edit mode, email/calendar invite, and workspace authentication overhaul out of scope unless explicitly requested. Run typecheck, production build, seed duplicate-safety verification, relevant route checks, and update the handoff.
```

## 3. Session Handoff Template

Copy this template for future sessions:

```md
# Session Handoff

Date:
Branch:
Current phase:
Current status:

## Completed
- 

## Changed Files
- 

## Decisions
- 

## Tests / Verification
- 

## Pending
- 

## Blockers
- 

## Recommended Next Prompt
Continue ROC GMS V2 from the latest handoff. Read prd/README.md first, inspect the repository, then continue with: [task].
```
