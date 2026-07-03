# ROC GMS V2 - Phase 6 Content, Announcements, and Sharing

Owner: Rusydani
Status: Phase 6C complete
Last updated: 2026-07-03
Source of truth: `prd/README.md`, `prd/implementation-plan.md`, `prd/session-handoff.md`

## 1. Goal

Phase 6 makes ROC GMS publishable and shareable:

- Content Admin can create articles and announcements.
- Public users can read articles and announcements on mobile.
- Public links preview well when shared to WhatsApp, Teams, email, and browser native share.
- Schedule/match/event information has a basic email and calendar export foundation.

Keep the implementation lightweight. Build on Payload Lexical first. Do not introduce Tiptap, Graph,
or a heavy notification engine unless a later decision changes the scope.

## 2. Scope Split

### Phase 6A - Content Schema and Editor Foundation

Build the CMS foundation only.

Tasks:

- [x] Add a general upload collection for article/announcement images, recommended slug: `media`.
- [x] Add `Article` collection.
- [x] Add `Announcement` collection.
- [x] Register both collections in `payload.config.ts`.
- [x] Use Payload Lexical rich text for article content.
- [x] Add relationships to event, sport, category, and match where useful.
- [x] Add share metadata fields:
  - `share_title`
  - `share_description`
  - `share_image`
- [x] Add status fields and publish windows:
  - `draft`
  - `review`
  - `published`
  - `archived`
  - `published_at`
  - optional `expires_at` for announcements
- [x] Add duplicate-safe seed examples:
  - one event article
  - one match recap article
  - one urgent announcement
  - one category announcement
- [x] Update Content Admin Workspace so it shows content readiness and links to CMS editing areas.

Acceptance:

- [x] Payload Admin can create/edit/publish articles and announcements.
- [x] Rich text editor is available for articles.
- [x] Announcement can target event/sport/category/match.
- [x] Seed can run repeatedly without duplicate content.

Completion notes (2026-07-03):

- Added `media`, `articles`, and `announcements` Payload collections under the Content admin group.
- `articles` uses Payload Lexical rich text for `content`, plus cover/share image relationships,
  event/sport/category/match relationships, status, `published_at`, and comment toggle fields.
- `announcements` includes urgency, display mode, target scope, event/sport/category/match
  relationships, status, `published_at`, optional `expires_at`, CTA fields, and share metadata.
- Seed now upserts two articles and two announcements by slug. Re-running the seed leaves counts at
  2 articles and 2 announcements.
- Content Admin Workspace now shows content readiness and links to `/admin/collections/articles`,
  `/admin/collections/announcements`, and `/admin/collections/media`.
- Public article pages, public announcement pages, feeds/banners, email, ICS export, Tiptap,
  Microsoft Graph, and bulk notification workflows remain out of scope until Phase 6B/6C.

### Phase 6B - Public Content Pages and Sharing

Build public reading and sharing surfaces.

Tasks:

- [x] Add `/articles`.
- [x] Add `/articles/[slug]`.
- [x] Add `/announcements`.
- [x] Add announcement banner/feed surfaces on:
  - homepage
  - sport category detail
  - match detail
- [x] Add reusable metadata helpers for OpenGraph/Twitter metadata.
- [x] Reuse/extend `ShareButtons` for WhatsApp, Teams, email, browser native share, and copy link.
- [x] Add related content sections:
  - match detail can show related articles/announcements
  - category detail can show targeted announcements
- [x] Add public visibility filtering:
  - only `published`
  - respect `published_at`
  - respect announcement `expires_at`

Acceptance:

- [x] Public article page has clean mobile reading layout.
- [x] Article links have usable share metadata.
- [x] Announcement feed/banner is visible only when relevant.
- [x] WhatsApp/Teams/email/share/copy actions work from article pages.

Completion notes (2026-07-03):

- Added `/articles`, `/articles/[slug]`, and `/announcements` public routes using the public
  redesign system.
- Added reusable content data helpers that enforce `status = published`, `published_at <= now`, and
  announcement `expires_at` windows before public rendering.
- Added reusable OpenGraph/Twitter metadata helpers and wired article detail metadata to share title,
  share description, canonical URL, and share/cover image fields.
- Extended `ShareButtons` to support explicit URL/description while preserving match-detail browser
  URL behavior.
- Added announcement surfaces to the homepage, sport category detail, and match detail. Added related
  article sections to category and match detail pages.
- Updated the demo seed so one published article and one urgent announcement are visible as of
  2026-07-03, while review content remains hidden.
- Email sending, ICS export, Tiptap, Microsoft Graph, and bulk notification workflows remain out of
  scope until Phase 6C or later.

### Phase 6C - Email Template and Calendar Export Foundation

Build the non-invasive communication foundation.

Tasks:

- [x] Add basic HTML email template helpers for:
  - schedule email
  - match reminder
  - announcement email
- [x] Add `.ics` generation helper for matches.
- [x] Add `.ics` download route for match detail, recommended:
  - `/matches/[matchNumber]/calendar.ics`
- [ ] Optionally add event/category schedule `.ics` only if simple and safe.
- [x] Log or preview outgoing email content only through Mailpit/local helper; do not build bulk sending
  or Microsoft Graph integration yet.

Acceptance:

- [x] A match can be downloaded as an Outlook-friendly `.ics`.
- [x] Email template helpers render readable HTML.
- [x] No real external email/Teams integration is introduced yet.

Completion notes (2026-07-03):

- Added local-only HTML email template helpers for schedule emails, match reminders, and
  announcements in `src/lib/emailTemplates.ts`.
- Added `buildMatchIcs` in `src/lib/calendar.ts` with Outlook-friendly `VCALENDAR` / `VEVENT`
  output, UTC timestamps, escaped text, folded lines, and a 30-minute display reminder.
- Added `/matches/[matchNumber]/calendar.ics` as a public match calendar download route. The route
  returns 404 for missing, non-public, or unscheduled matches.
- Verified `/matches/ROC-BMS-001/calendar.ics` returns HTTP 200 with `text/calendar; charset=utf-8`,
  `Content-Disposition: attachment; filename="ROC-BMS-001.ics"`, and `BEGIN:VCALENDAR` content.
- No bulk sending, Microsoft Graph, external email delivery, or public edit mode was introduced.

## 3. Design Rules

- Follow `prd/redesign/README.md` design tokens and public visual system.
- Public pages must be mobile-first and readable.
- Do not make a marketing landing page for articles; build the actual content index.
- Keep public copy friendly and non-technical.
- Internal code/routes/collections remain English.

## 4. Data Model Notes

Recommended `Article` fields:

- `title`
- `slug`
- `excerpt`
- `cover_image`
- `content`
- `author_user_id`
- `status`
- `published_at`
- `event_id`
- `sport_id`
- `category_id`
- `match_id`
- `share_title`
- `share_description`
- `share_image`
- `comments_enabled`

Recommended `Announcement` fields:

- `title`
- `slug`
- `summary`
- `body`
- `urgency`
- `display_mode`
- `status`
- `published_at`
- `expires_at`
- `target_scope`
- `event_id`
- `sport_id`
- `category_id`
- `match_id`
- `cta_label`
- `cta_url`
- `share_title`
- `share_description`
- `share_image`

## 5. Recommended First Prompt

```text
Continue ROC GMS V2 from the latest handoff. Read prd/README.md,
prd/implementation-plan.md, prd/decision-log.md, prd/redesign/README.md,
prd/session-handoff.md, and prd/phase-6-content-sharing.md first, then inspect
the repository and git status.

Start Phase 6A only: Content Schema and Editor Foundation. Add a lightweight
Payload CMS foundation for content and announcements: create a general `media`
upload collection, create `articles` and `announcements` collections using
Payload Lexical rich text for article content, register them in payload.config.ts,
add relationships to event/sport/category/match, add status/published_at fields,
add announcement target/display fields, add share metadata fields, and add
duplicate-safe seed examples. Update the Content Admin Workspace so it shows
content readiness and links to the CMS editing areas.

Do not build public article pages, announcement public pages, email sending, ICS
export, Tiptap, Microsoft Graph, or bulk notification workflows yet. Keep all
internal names/routes/collections in English. Follow the existing access-control
patterns and the public redesign design system. Run typecheck and build, verify
Payload Admin loads and seed remains duplicate-safe, then update
prd/session-handoff.md and this Phase 6 document with what was completed.
```
