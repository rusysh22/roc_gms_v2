# ROC GMS V2 - Implementation Plan

Owner: Rusydani  
Project: `roc_gms_v2`  
Status: Access and role hardening complete after Phase 8; ready for Phase 8 hardening or Phase 9 planning  
Last updated: 2026-07-03  
Source of truth: `prd/README.md`

## 1. Purpose

This document converts the PRD into small implementation phases that can be executed safely through Vibe Coding sessions.

Every session should:

1. Read `prd/README.md`.
2. Read this implementation plan.
3. Read `prd/session-handoff.md`.
4. Inspect the repository state.
5. Continue from the next unfinished task.
6. Update `prd/session-handoff.md` before ending.

## 2. Current Recommended Stack

Default technical direction:

- Next.js
- Payload CMS
- PostgreSQL
- Docker Compose
- Redis
- Mailpit
- FullCalendar
- Payload Lexical rich text first
- Realtime live score through WebSocket or Server-Sent Events in a later phase

This stack can be changed only if the decision is recorded in `prd/decision-log.md`.

## 3. Development Rules

- Use English naming for code, routes, database, enums, collections, and modules.
- Prioritize mobile-first screens for public portal and match officer flow.
- Do not build generic CRUD as the main admin experience.
- Use custom operational workspaces for Event Admin, Scheduler, Match Officer, and Content Admin.
- Keep Payload Admin as backoffice/fallback.
- Add audit logs for sensitive operations.
- Update docs when major decisions change.
- Keep phases small enough to verify.

## 4. Phase 0 - Foundation

Goal:

Create the project foundation and make it runnable locally with Docker.

Tasks:

- [x] Initialize app structure.
- [x] Add Docker Compose.
- [x] Add PostgreSQL service.
- [x] Add Redis service.
- [x] Add Mailpit service.
- [x] Add app service.
- [x] Configure environment variables.
- [x] Install Payload CMS.
- [x] Configure Payload with PostgreSQL.
- [x] Add admin authentication.
- [x] Add base app layout.
- [x] Add basic health route or landing route.
- [x] Add project README with local run instructions.
- [x] Add initial seed command or seed placeholder.

Acceptance criteria:

- [x] App runs locally through Docker.
- [x] Admin login page is accessible.
- [x] Database persists between restarts.
- [x] Mailpit is reachable for local email testing.
- [x] README explains how to start and stop the system.

Suggested commit:

`phase-0-foundation`

## 5. Phase 1 - Core Event Structure

Goal:

Implement the core data model for event setup.

Tasks:

- [x] Add `SiteConfig`.
- [x] Add `Event`.
- [x] Add `Sport`.
- [x] Add `CompetitionCategory`.
- [x] Add `Club`.
- [x] Add `Player`.
- [x] Add `Team`.
- [x] Add `Roster`.
- [x] Add `CompetitionEntry`.
- [x] Add `Venue`.
- [x] Add `Court`.
- [x] Add basic permissions.
- [x] Add demo seed for `ROC Olympic 2026`.

Acceptance criteria:

- [x] Event Admin can create event structure.
- [x] Badminton and Futsal examples can be represented.
- [x] Player roster can be optional.
- [x] Category participant mode can be individual, pair, team, club, or open.

Suggested commit:

`phase-1-event-structure`

## 6. Phase 2 - Ruleset, Stage, Match, and Schedule

Goal:

Create the competition structure and scheduling foundation.

Tasks:

- [x] Add `Ruleset`.
- [x] Add ruleset templates for Badminton and Futsal.
- [x] Add `Stage`.
- [x] Add `Group`.
- [x] Add `Match`.
- [x] Add `MatchSet`.
- [x] Add schedule fields.
- [x] Add match lifecycle statuses.
- [x] Add basic match generation for round robin/group stage.
- [x] Add basic match generation for single elimination.
- [x] Add schedule list view.
- [x] Add public schedule page.
- [x] Add minimal scheduled/unscheduled match queue foundation.

Acceptance criteria:

- [x] Admin can create matches.
- [ ] Public can view schedule after visibility opens.
- [x] Match status lifecycle is available.
- [x] Badminton/Futsal demo matches can be scheduled.

Suggested commit:

`phase-2-schedule-foundation`

## 7. Phase 3 - Operational Workspaces

Goal:

Build the first custom admin workspaces.

Tasks:

- [x] Event Admin Workspace with readiness checklist.
- [x] Scheduler Workspace with match queue.
- [x] Scheduler calendar/list lane foundation.
- [x] Scheduler conflict warning foundation.
- [x] Match Officer Workspace for mobile.
- [x] Content Admin Workspace shell.

Acceptance criteria:

- [x] Event Admin can see event setup progress.
- [x] Scheduler can see scheduled and unscheduled matches.
- [x] Match Officer can open assigned match list on mobile.
- [x] Workspaces are more visual than generic CRUD.

Suggested commit:

`phase-3-operational-workspaces`

## 8. Phase 4 - Match Operations

Goal:

Support match day operations.

Tasks:

- [x] Match detail public page.
- [x] Match detail admin panel.
- [x] Score input.
- [x] Match result confirmation.
- [x] Match documentation upload.
- [x] Internal comments.
- [x] Match audit log.
- [ ] Reschedule reason workflow.

Acceptance criteria:

- [x] Match Officer can start and finish a match.
- [x] Match Officer can input score.
- [x] Match Officer can upload documentation.
- [x] Score/result changes are audited.
- [x] Match detail page is shareable.

Suggested commit:

`phase-4-match-operations`

## 9. Phase 5 - Standings and Brackets

Goal:

Show competitive results clearly.

Tasks:

- [x] Add `Standing`.
- [x] Calculate standings from match results.
- [x] Add group standing public view.
- [x] Recalculate standings after relevant match result mutations.
- [ ] Add standing admin override with reason.
- [x] Add `Bracket`.
- [x] Add single elimination bracket view.
- [x] Recalculate bracket cache after relevant match result mutations.
- [x] Add single elimination winner advancement foundation.
- [x] Add champion display foundation.
- [x] Add standing and bracket impact panels to match detail pages.

Acceptance criteria:

- [x] Group stage standings update after result confirmation.
- [x] Public can read standings on mobile.
- [x] Bracket links to match detail.
- [x] Winner advances in single elimination bracket when a deterministic safe target exists.
- [x] Champion display shows decided or pending state from single-elimination bracket cache.
- [x] Match detail pages show relevant standing or bracket impact context.

Suggested commit:

`phase-5-standings-brackets`

## 10. Phase 6 - Content, Announcements, and Sharing

Goal:

Make event information publishable and shareable.

Execution note:

Use `prd/phase-6-content-sharing.md` as the detailed execution guide. Phase 6 should be split into
small sessions so schema, public pages, and communication helpers are not mixed in one large change.

Recommended sequence:

- Phase 6A: Content schema and editor foundation.
- Phase 6B: Public content pages and sharing.
- Phase 6C: Email template and calendar export foundation.

Tasks:

- [x] Add `Article`.
- [x] Add rich text editor.
- [x] Add article public page.
- [x] Add `Announcement`.
- [x] Add announcement feed/banner.
- [x] Add share metadata fields.
- [x] Add WhatsApp share link.
- [x] Add Teams share link.
- [x] Add email share.
- [x] Add basic email template.
- [x] Add `.ics` calendar export foundation.

Acceptance criteria:

- [ ] Content Admin can publish article.
- [x] Article has clean public mobile reading layout.
- [x] Links preview well in share contexts.
- [x] Announcement can target event/sport/category/match.

Suggested commit:

`phase-6-content-sharing`

## 11. Phase 7 - Public Edit Mode

Goal:

Let admins edit selected content from public visual context.

Tasks:

- [x] Add admin preview mode foundation.
- [x] Add edit mode toggle on selected public pages.
- [x] Add editable region markers.
- [x] Add side panel editor foundation.
- [x] Add draft/publish controls for selected content fields.
- [x] Add audit logging for public edit mutations.

Acceptance criteria:

- [x] Authorized admin can edit event description from public page foundation.
- [x] Authorized admin can edit article/announcement header fields in context.
- [x] Public users never see edit affordances.

Completion notes (2026-07-03):

- Added an authenticated public preview/edit-mode foundation using `?preview=1` and `?edit=1`.
- Only `super_admin`, `event_admin`, and `content_admin` can see the preview toolbar, editable
  region outlines, or edit forms. Anonymous visitors see no controls, even if query flags are present.
- Selected editable areas now include the homepage event intro, article title/excerpt/share/status
  fields, and announcement title/summary/body/share/status fields.
- Saves write audit rows and revalidate the affected public pages.
- Rich article body editing remains in Payload Admin through the full-editor link; no broad auth
  redesign, Microsoft Graph, bulk notifications, or live score work was added.

Suggested commit:

`phase-7-public-edit-mode`

## 12. Phase 8 - Live Score

Goal:

Add full-screen live score for Match Officer.

Tasks:

- [x] Add live score route.
- [x] Add full-screen mobile UI foundation.
- [x] Add participant selection.
- [x] Add tap-to-increment foundation.
- [x] Add decrement/undo action zone foundation.
- [x] Add set support foundation.
- [x] Add score action audit through existing match-set score update audit path.
- [x] Add finish match and publish-result confirmation controls.
- [ ] Add public live update through polling first.
- [ ] Add WebSocket or SSE later if needed.

Acceptance criteria:

- [x] Match Officer can update score from mobile with large tap areas.
- [x] Score can be corrected safely with decrement/undo foundation.
- [x] Final score publish requires confirmation.
- [ ] Public page can show live score updates.

Completion notes (2026-07-03):

- Added `/workspaces/matches/[matchNumber]/live-score` as a full-screen Match Officer live-score
  route.
- The route uses large mobile-first participant panels, selected-participant state, a primary
  add-point action, and a left undo/decrement action zone.
- Added set creation from the live score screen and a set summary rail.
- Reused existing audited match-set score updates and lifecycle Server Actions, with safe `returnTo`
  support so live score writes return to the full-screen route.
- Added quick lifecycle controls for start/resume, pause, finish match, and confirmed result publish.
- Added entry links from Match Officer Workspace and workspace match detail.
- Did not add WebSocket/SSE, public polling, offline mode, Microsoft Graph, or broad auth redesign.

Suggested commit:

`phase-8-live-score`

## 12.1 Access and Role Hardening

Goal:

Protect custom operational workspaces and mutation paths before adding more features.

Tasks:

- [x] Add shared workspace auth/role guard helper.
- [x] Protect Event Admin Workspace.
- [x] Protect Scheduler Workspace.
- [x] Protect Match Officer Workspace.
- [x] Protect Content Admin Workspace.
- [x] Protect Brackets Workspace.
- [x] Protect Standings Workspace.
- [x] Protect workspace match detail.
- [x] Protect live score route.
- [x] Add explicit role checks to match Server Actions.
- [x] Add explicit role checks to documentation Server Actions.
- [x] Add explicit role checks to comment Server Actions.
- [x] Add explicit role checks to standings/bracket recalculation Server Actions.
- [x] Keep public pages open.

Acceptance criteria:

- [x] Anonymous users are redirected to `/admin/login` from protected workspace routes.
- [x] Wrong-role authenticated users receive an unauthorized workspace state.
- [x] Server Actions reject anonymous or unauthorized mutation attempts before writes.
- [x] Public pages remain accessible without login.

Completion notes (2026-07-03):

- Added `src/app/(frontend)/workspaces/workspaceAuth.tsx` with shared route and Server Action guards.
- Role hydration loads the authenticated user through Payload Local API with `overrideAccess` so
  non-super-admin role checks do not depend on whether the `roles` field is present in
  `payload.auth()` output.
- Workspace page permissions:
  - Event Admin: `super_admin`, `event_admin`
  - Scheduler: `super_admin`, `event_admin`, `scheduler`
  - Match Officer, match detail, live score: `super_admin`, `event_admin`, `match_officer`
  - Content Admin: `super_admin`, `event_admin`, `content_admin`
  - Brackets and Standings: `super_admin`, `event_admin`
- Anonymous workspace requests redirect to `/admin/login?redirect=<workspace path>`.
- Public pages remain open.

## 13. Phase 9 - Advanced Features

Goal:

Add improvements after MVP is stable.

Tasks:

- [ ] Double elimination.
- [ ] Swiss format.
- [ ] Advanced seeding and draw.
- [ ] Advanced conflict detection.
- [ ] Player login.
- [ ] Public comment moderation queue.
- [ ] Advanced email targeting.
- [ ] Microsoft Graph integration.
- [ ] MinIO/object storage.
- [ ] Offline-tolerant live score.
- [ ] Advanced import/export.

Acceptance criteria:

- [ ] Advanced features do not break MVP workflows.
- [ ] Each feature has tests or manual verification notes.

## 14. Demo Data Requirements

The project should keep demo seed data for fast verification:

- Event: `ROC Olympic 2026`
- Sports: Badminton, Futsal
- Categories:
  - Badminton Men Single
  - Badminton Mixed Double
  - Futsal Men
- Clubs:
  - IT Club
  - Finance
  - HR
  - Marketing
- Venues:
  - Main Hall
  - Futsal Field
- Courts:
  - Court 1
  - Court 2
  - Futsal Field

## 15. Suggested Next Prompt

Use this prompt for the first build session:

```text
Read prd/README.md, prd/implementation-plan.md, prd/decision-log.md, and prd/session-handoff.md first. Start Phase 0 for ROC GMS V2 using Next.js, Payload CMS, PostgreSQL, Redis, Mailpit, and Docker Compose. Keep English naming. Do not implement tournament features yet. Make the app runnable locally, add basic admin auth, add project README run instructions, and update prd/session-handoff.md when finished.
```
# 2026-07-11 implementation update

- Completed: centralized named capabilities, role-aware workspace navigation, public collection hardening for matches/documentation, score-set ownership validation, documentation file validation, production secret checks, and the first guided Clubs and Scheduler workflows.
- Deferred: modal/route-intercepted presentation, archived clubs, full participant/facility CRUD, schedule generation/draw, content-desk CRUD, and a dedicated reschedule history UI.
