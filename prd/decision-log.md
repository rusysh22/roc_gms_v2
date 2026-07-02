# ROC GMS V2 - Decision Log

Owner: Rusydani  
Project: `roc_gms_v2`  
Status: Active  
Last updated: 2026-07-02

## 1. Purpose

This file records important product and technical decisions so the project can continue cleanly across Vibe Coding sessions.

Decision format:

- Date
- Decision
- Status
- Reason
- Impact

Statuses:

- `proposed`
- `accepted`
- `changed`
- `rejected`

## 2. Decisions

### D001 - English-first internal structure

Date: 2026-07-02  
Status: accepted

Decision:

Use English for code, routes, database names, enums, modules, collections, and system structure.

Reason:

English naming makes the codebase easier to maintain, easier for AI coding tools to understand, and easier to integrate with libraries.

Impact:

User-facing content can still be Indonesian or bilingual later, but internal structure stays English.

### D002 - Recommended stack

Date: 2026-07-02  
Status: accepted

Decision:

Use Next.js, Payload CMS, PostgreSQL, Redis, Mailpit, and Docker Compose.

Reason:

This stack supports custom public pages, custom role workspaces, CMS features, relational tournament data, local email testing, and reproducible setup.

Impact:

Payload Admin can be used as a CMS/backoffice foundation, while custom workspaces provide the actual operational UX.

Implementation note:

Phase 0 uses Next.js 16, Payload CMS 3, PostgreSQL, Redis, Mailpit, and Docker Compose. Payload is mounted inside the Next.js app with PostgreSQL through `@payloadcms/db-postgres`.

### D003 - Custom operational workspaces

Date: 2026-07-02  
Status: accepted

Decision:

Event Admin, Scheduler, Match Officer, and Content Admin should use custom visual workspaces instead of generic CRUD admin pages.

Reason:

The product goal is to make event operations easier to read, understand, and execute.

Impact:

Implementation must allocate frontend effort for role-specific pages.

### D004 - Public Coming Soon lock

Date: 2026-07-02  
Status: accepted

Decision:

Public portal should show `Coming Soon` before `public_open_at`. If `public_open_at` is empty, default opening is H-7 from `event_start_at`.

Reason:

The committee needs time to prepare information before public release.

Impact:

Public visibility logic must be part of the event model and routing guard.

### D005 - Flexible participant model

Date: 2026-07-02  
Status: accepted

Decision:

Participants must support club, team, pair, individual player, and TBD entries. Player roster is optional unless category rules require it.

Reason:

Different sports use different participant shapes, such as futsal clubs/teams and badminton singles/doubles.

Impact:

The data model must separate `Club`, `Player`, `Team`, `Roster`, and `CompetitionEntry`.

### D006 - Group standings are required

Date: 2026-07-02  
Status: accepted

Decision:

Any group stage, round robin, league, or similar format must show standings and points.

Reason:

Public users and admins need clear ranking visibility during the event.

Impact:

Standing calculation must be implemented after score/result flow.

### D007 - Match documentation is required

Date: 2026-07-02  
Status: accepted

Decision:

Each match should support documentation assets such as photos, videos, files, score sheets, notes, and public/internal visibility.

Reason:

The event needs history, proof, recap material, and archive value.

Impact:

Match detail must include documentation upload and gallery.

### D008 - Live score is planned

Date: 2026-07-02  
Status: accepted

Decision:

Live score should be implemented as a dedicated feature with full-screen mobile scoring, tap-to-add score, decrement/undo action, and audit logging.

Reason:

Match officers need fast scoring during live matches.

Impact:

Live score should come after basic match lifecycle and score input are stable.

### D009 - Payload Lexical first, Tiptap optional

Date: 2026-07-02  
Status: proposed

Decision:

Start with Payload's rich text capability first. Add or switch to Tiptap if article editing requires a more custom block-based writing experience.

Reason:

Payload Lexical is simpler to start with if Payload CMS is selected.

Impact:

Avoid overengineering the editor in MVP.

### D010 - Scheduler conflict warnings are advisory-only in the foundation phase

Date: 2026-07-02  
Status: accepted

Decision:

The Scheduler Workspace conflict warning foundation checks venue/court overlap, participant
(entry/player/team/club) overlap, missing venue/court/time on scheduled-like matches, and inverted
schedule end/start times. Conflicts are computed across all matches regardless of the active filter
bar, but are shown only as warnings and never block scheduling actions.

Reason:

The PRD documents conflict detection as required for the Scheduler Workspace, but drag-and-drop
scheduling and a real scheduling mutation workflow are out of scope for this phase, so there is no
write action to block yet. Computing conflicts across the full dataset (not just the filtered view)
avoids hiding real conflicts behind an active filter.

Impact:

A later phase must decide whether conflicts should block publish/reschedule actions once a
scheduling mutation workflow exists, and whether advanced constraints (match officer overlap, rest
time, category-specific rules) are added to the same detector or a new one.

### D011 - Match detail routes use `match_number` as the URL identifier

Date: 2026-07-02  
Status: accepted

Decision:

Public match detail lives at `/matches/[matchNumber]` and the admin-oriented panel lives at
`/workspaces/matches/[matchNumber]`, both keyed by the unique, indexed `match_number` field (e.g.
`ROC-BMS-001`) rather than the internal Payload document id. The public route calls Next.js
`notFound()` (HTTP 404) when the match does not exist or `is_public` is not `true`; the admin route
has no visibility gating and shows any match by number. Both routes share one data loader
(`src/app/(frontend)/matchDetailData.ts`) so match + match-set fetching logic is not duplicated.

Reason:

`match_number` is human-readable, unique, and already indexed, which makes for a cleaner shareable
URL than a raw database id (PRD section 15 requires match detail to be shareable). Gating the public
route on `is_public` keeps it consistent with the existing public schedule filter
(`src/app/(frontend)/schedule/page.tsx`), so a match that is not yet public cannot be discovered
through a guessed or shared link.

Impact:

Any future feature that creates or renumbers matches must keep `match_number` unique and URL-safe.
The admin match detail route currently has no authentication/authorization gate, consistent with
every other workspace page added so far in this project — a future phase must decide when to add
session-based access control across all workspace routes at once rather than piecemeal per page.

## 3. Pending Decisions

- Decide whether public comments require login.
- Decide whether player accounts are needed in MVP.
- Decide whether MinIO should be included from day one or later.
- Decide whether live score realtime uses polling first, WebSocket, or Server-Sent Events.
- Decide whether Teams integration starts as share link or Microsoft Graph integration.
