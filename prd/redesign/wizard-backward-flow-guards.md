# New Event Wizard — Backward / Negative-Flow Guards

Owner: Rusydani
Status: **SHIPPED 2026-08-30** (gaps 1–5), **SHIPPED 2026-08-30** (gaps 6–9)
Created: 2026-08-30
Relates to: `guest-wizard-and-auth-redesign.md`, `wizard-completion-and-post-generate-flow.md`,
`import-data-and-draft-persistence.md`

## Problem

The wizard was built around the forward path. The destructive *deletes* were guarded
(`delete{Sport,Category,Venue,Court,Player}Action` each `payload.count` downstream rows
and refuse with a `*_in_use` error), and group→KO has `undoPromoteToKnockoutAction`.
But the backward *edits* had no equivalent guards, so a correction after later steps
were done silently corrupted data — and the one rebuild affordance ("Re-generate") was
a no-op (`generateMatchesAction` only fills gaps by `generation_key`).

## Shipped (high-impact set)

1. **`updateCategoryAction`** — refuses a `format_type` change once the category has any
   stage/match (`wizardError=category_format_locked`). Name/roster/ruleset edits still allowed.
2. **`clearCategoryFixturesAction`** (new, `generateActions.ts`) — the backward counterpart
   to `generateMatchesAction`. Deletes match-sets → matches → brackets → stages for a
   category and resets its status `locked → open`. Refuses (`fixtures_in_play`) if any
   match is past `CLEARABLE_FIXTURE_STATUSES` (`draft` / `ready_for_scheduling` /
   `scheduled`), has a `winner_entry_id`, or has recorded match-sets. `group_stage_to_knockout`
   is routed to the Groups panel (`use_groups_panel`).
   - GenerateStep: the misleading **Re-generate** button is replaced by **Clear & rebuild**
     (`ConfirmSubmitButton`), hidden and shown as "Fixtures locked" once a match has started.
3. **`withdrawEntryAction`** — refuses (`entry_has_fixtures`) if the entry appears in any
   match as participant A/B or winner.
4. **`saveSeedOrderAction`** — refuses (`seed_locked`) if the category already has matches
   (re-seeding an existing bracket does nothing — clear & regenerate instead).
5. **Clubs / teams / pairs edit + delete in the wizard** — new
   `updateClubAction` / `deleteClubAction` / `updateTeamAction` / `deleteTeamAction`
   (mirror `deletePlayerAction`; `club_in_use` / `team_in_use` guards; team delete cascades
   its roster rows since a pair's roster is just membership). Row-level Edit modal
   (`CrudFormModal`, `?editClub=` / `?editTeam=`) + Delete on the Clubs and Teams tabs.
   Pairs surface in the Teams tab, so they're covered too.

New helper: `summarizeCategoryFixtures` + `CLEARABLE_FIXTURE_STATUSES` in `wizardShared.ts`
(unit-tested in `wizardShared.test.ts`).

## Shipped — second pass (gaps 6–9)

6. **Discard an event** — `discardEventAction` (`details/detailsActions.ts`) + a "Discard this
   event" danger-zone card on the Event Details page (type-the-name confirm). An event with no
   sports/categories/participants/venues/matches/registrations is hard-deleted (its
   `event-memberships` rows and logo media cleared first so FKs don't block); anything further
   along is **archived** (`status` + `visibility` = `archived`). The active-event cookie is
   cleared either way. `listEventsForSwitcher` and `getActiveEvent`'s fallback now exclude
   `status: archived`, so a discarded event stops cluttering the switcher. Landing page shows an
   `?eventDiscarded=deleted|archived` banner.
7. **`updateCategoryStatusAction`** — refuses a *backward* status move
   (`category_status_downgrade_blocked`) while the category has confirmed entries or matches.
   Archiving / un-archiving and every forward move stay allowed.
8. **Stale-fixtures banner** — GenerateStep compares the current confirmed-entry set for a
   category against the entries actually wired into its matches; on a mismatch (an entry
   withdrawn, or a new one confirmed, after generation) it shows
   _"Entry list changed since these fixtures were generated — Clear & rebuild to apply it"_.
9. **`updateEventDetailsAction`** — refuses (`schedule_outside_window`) to narrow the event
   start/end window under any match that already has a `scheduled_start_at` outside it.

### Polish (same pass)

- `clearCategoryFixturesAction` also deletes the category's `standings` rows and resets a
  `published` category (not just `locked`) back to `open`.
- `discardEventAction`'s "is it empty?" check covers `rulesets` / `sponsors` / `announcements` /
  `articles` too, so those fall to the safe archive path rather than an FK error.
- RegistrationStep: once a category has fixtures, the "Registered" list shows a locked notice and
  the per-row **Remove** buttons become "Locked".
- DrawStep + `SeedOrderTable` (new `locked` prop): once a category has fixtures, seeding renders
  read-only, the Shuffle button is hidden, and `shuffleSeedsAction` gained the same `seed_locked`
  guard as `saveSeedOrderAction`.

## Verification

- `npm run typecheck` — clean.
- `npm test` (`wizardShared.test.ts` covers `summarizeCategoryFixtures`). NOTE: vitest 4
  needs Node ≥ 20; run in the Docker image / a Node 20+ shell.
- Manual: create event → single-elim category → 4 entries → Generate.
  - GenerateStep shows **Clear & rebuild**, not Re-generate.
  - Categories step: change the category format → `category_format_locked`.
  - Registration: withdraw a confirmed entry → `entry_has_fixtures`.
  - Draw: save seed order → `seed_locked`.
  - Clear & rebuild → stage/matches/bracket gone, status back to `open`, "Generate Matches"
    returns, stepper < 100 %, Event Admin landing shows "Resume Setup" again.
  - Publish one result, submit clear directly → `fixtures_in_play`.
  - group→KO category → `use_groups_panel`.
  - Participants: rename a club via Edit; delete a club with a team on it → `club_in_use`;
    delete the team then the club → succeeds. `/events/<slug>` pages still render.
