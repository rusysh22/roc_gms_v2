# ROC Game Management System V2 - Product Requirements Document

Owner: Rusydani  
Project: `roc_gms_v2`  
Document status: Draft v1  
Last updated: 2026-07-02  
Primary language for system structure: English-first

---

## Documents in `prd/`

This file is the master PRD. The rest of the folder:

| File | Purpose |
|---|---|
| `implementation-plan.md` | Phased build plan |
| `decision-log.md` | Running log of design decisions and their rationale |
| `session-handoff.md` | State carried between AI-assisted / Vibe Coding sessions |
| `vibe-coding-guide.md` | How to continue this project across chat sessions |
| `phase-6-content-sharing.md` | Phase 6 (content + sharing) spec |
| `redesign/` | Active redesign specs (`import-data-and-draft-persistence.md`, …) |
| `design/` | Long-form design docs — `PRODUCT_FLOW_BLUEPRINT_ROC_GMS_V2.md`, `NOVICE_ADMIN_FLOW_UX_REDESIGN.md`, `MULTI_SPORT_GAMES_ENHANCEMENTS_DESIGN.md` |
| `audits/` | Audit reports — `AUDIT_E2E_ROC_GMS_V2.md`, `AUDIT_UI_UX_CSS_ROC_GMS_V2.md` |
| `runbooks/` | Operational walkthroughs — `ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md` |

The `design/` and `audits/` documents were moved here from the repository root. Inline code
comments still reference them by bare filename (`NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 5`,
`AUDIT_E2E MAT-05`, `AUDIT_UI_UX_CSS CSS-11`) — searching the filename or audit code finds them.

---

## 1. Executive Summary

ROC Game Management System V2 is a web-based event operating system for managing an internal office olympiad. The product is not only a CMS and not only a tournament bracket app. It is designed as a complete operational cockpit for event committees, schedulers, match officers, content admins, and public participants.

The system must help organizers create events, sports, competition categories, participants, clubs, teams, schedules, match results, standings, brackets, live scores, announcements, articles, comments, documentation, and shareable event information.

The product must be lightweight, Docker-friendly, mobile-first for public users and match officers, and easy to continue through AI-assisted or Vibe Coding sessions even when daily limits or chat sessions end.

## 2. Product Vision

Build a clear, interactive, and practical web system that lets an office committee run an olympiad from planning to archive:

- Before the event: prepare structure, categories, participants, rules, schedules, content, and public visibility.
- During the event: manage schedule changes, live score, match status, documentation, comments, and announcements.
- After the event: publish winners, standings, bracket results, articles, galleries, history, and event archive.

The core product idea is:

> A tournament and event command center, supported by CMS capabilities.

This means the main experience should not feel like a generic admin panel. It should feel like a purpose-built tool for running matches.

## 3. Product Principles

1. Mobile-first public experience.
2. Operational cockpit for admins, not generic CRUD screens.
3. Schedule and match lifecycle are the center of the system.
4. Club, team, pair, and individual participation must all be supported.
5. Roster/player details are optional where the event does not need them.
6. Public information must be easy to read, share, and trust.
7. Admin edits should happen close to the visual context whenever possible.
8. All important changes must have history and audit trail.
9. The system should be simple enough for a small committee but structured enough for complex event flows.
10. Internal structure, code naming, database naming, enums, routes, and modules must be English-first.

## 4. Recommended Technical Direction

Recommended stack:

- App framework: Next.js
- CMS/backend foundation: Payload CMS
- Database: PostgreSQL
- Cache/queue/realtime helper: Redis
- Rich text: Payload Lexical editor by default, with Tiptap as an optional custom editor path if the CMS writing experience needs more tailored blocks
- Calendar: FullCalendar
- Containerization: Docker Compose
- Local email preview: Mailpit
- Local object storage, optional: MinIO
- Realtime live score: WebSocket or Server-Sent Events

Rationale:

- Next.js provides public pages, custom admin workspaces, interactive mobile views, API routes, and deploy flexibility.
- Payload provides CMS, auth, collections, admin foundation, upload/media handling, and rich text capability.
- PostgreSQL is reliable for relational tournament data.
- Docker Compose makes the project easier to resume across sessions and machines.

Important architectural rule:

Payload Admin can exist as a backoffice fallback, but the main role pages should be custom workspaces, not generic Payload CRUD screens.

## 5. Product Areas

### 5.1 Public Event Portal

Audience:

- Employees
- Players
- Club members
- Viewers
- Management

Main purpose:

- Read event information quickly.
- See today's matches.
- Check personal/team schedules.
- View standings, brackets, scores, winners, documentation, articles, and announcements.
- Share links through WhatsApp, Teams, email, and browser.

Default mobile layout:

- Live/next matches
- My schedule search
- Announcements
- Sports/categories
- Calendar agenda
- Brackets and standings
- Articles and highlights
- Winners

### 5.2 Operational Cockpit

Audience:

- Event Admin
- Scheduler
- Match Officer
- Content Admin
- Super Admin

Main purpose:

- Run the event through visual, workflow-oriented pages.
- Reduce confusion during setup and match day.
- Let admins edit in context whenever possible.

### 5.3 Backoffice CMS

Audience:

- Super Admin
- Technical Owner
- Advanced Admin

Main purpose:

- Manage raw collections, fallback editing, site config, roles, permissions, audit logs, and data recovery.

This area can use Payload Admin more directly.

## 6. Roles and Permissions

### 6.1 Super Admin

Can:

- Manage all system settings.
- Manage roles and users.
- Access every event.
- Configure site-wide defaults.
- View audit logs.
- Override locked states.

### 6.2 Event Admin

Can:

- Create and configure events.
- Create sports and competition categories.
- Configure formats, rulesets, groups, brackets, and participants.
- Manage clubs, players, teams, and rosters.
- Publish event structure.
- Review event readiness checklist.

### 6.3 Scheduler

Can:

- Create and manage match schedules.
- Assign venue, court, date, and time.
- Drag unscheduled matches into calendar slots.
- Handle reschedules.
- See conflict warnings.
- Publish schedule updates.

### 6.4 Match Officer

Can:

- View assigned matches.
- Start, pause, resume, finish, postpone, cancel, or mark walkover.
- Input score.
- Use live score mode.
- Upload match documentation.
- Add official notes.
- Submit result for review or publish result, depending on permission.

### 6.5 Content Admin

Can:

- Create and publish articles.
- Create announcements.
- Manage share previews.
- Send email/notification campaigns.
- Moderate public comments.
- Build post-match recaps and winner announcements.

### 6.6 Public Viewer

Can:

- View public event content after visibility unlock.
- View schedules, results, standings, brackets, articles, and announcements.
- Share public links.
- Comment only when comments are enabled and moderation rules allow it.

### 6.7 Player

Optional authenticated or unauthenticated role.

Can:

- View assigned schedule.
- View club/team/player profile.
- Receive email/calendar invite.
- Comment if enabled.
- Confirm attendance/check-in if the feature is enabled.

## 7. Event Visibility and Time Window

Each event must have configurable time fields:

- `event_start_at`
- `event_end_at`
- `public_open_at`
- `registration_open_at`
- `registration_close_at`
- `schedule_publish_at`
- `archive_at`

Default rule:

- If `public_open_at` is empty, public access opens at H-7 from `event_start_at`.
- Before public open date, the public portal shows "Coming Soon".
- Admins can still access preview mode.

Public "Coming Soon" page should show:

- Event logo/name
- Countdown
- Short teaser
- Contact/committee info if enabled
- Optional social/share disabled state

Event lifecycle states:

- `draft`
- `setup`
- `coming_soon`
- `live`
- `completed`
- `archived`

Public visibility states:

- `hidden`
- `coming_soon`
- `preview_only`
- `published`
- `archived`

## 8. Core Domain Model

All entity names should use English.

### 8.1 SiteConfig

Purpose:

- Store global identity and behavior.

Fields:

- `site_name`
- `site_logo`
- `primary_color`
- `secondary_color`
- `timezone`
- `default_language`
- `contact_email`
- `contact_phone`
- `public_domain`
- `maintenance_mode`
- `default_share_image`

### 8.2 Event

Purpose:

- Top-level olympiad/event container.

Fields:

- `name`
- `slug`
- `description`
- `banner_image`
- `event_start_at`
- `event_end_at`
- `public_open_at`
- `schedule_publish_at`
- `status`
- `visibility`
- `location`
- `organizer_name`
- `rules_summary`
- `theme_config`

### 8.3 Sport

Purpose:

- Represents a sport or competition branch.

Examples:

- Badminton
- Futsal
- Table Tennis
- Chess
- E-Sport
- Running
- Tug of War

Fields:

- `event_id`
- `name`
- `slug`
- `description`
- `icon`
- `sport_type`
- `default_ruleset_id`
- `is_active`

### 8.4 CompetitionCategory

Purpose:

- Represents a specific competition number/category under a sport.

Examples:

- Badminton Men Single
- Badminton Women Single
- Badminton Mixed Double
- Futsal Men
- E-Sport Squad

Fields:

- `event_id`
- `sport_id`
- `name`
- `slug`
- `participant_mode`
- `roster_required`
- `min_roster_size`
- `max_roster_size`
- `ruleset_id`
- `format_type`
- `status`

Participant modes:

- `individual`
- `pair`
- `team`
- `club`
- `open`

### 8.5 Club

Purpose:

- Represents a department, office unit, community, or club.

Examples:

- IT Club
- Finance
- HR
- Marketing

Fields:

- `event_id`
- `name`
- `slug`
- `logo`
- `description`
- `contact_person`
- `contact_email`

### 8.6 Player

Purpose:

- Represents an individual person.

Fields:

- `event_id`
- `club_id`
- `name`
- `employee_id`
- `email`
- `phone`
- `photo`
- `bio`
- `gender`
- `metadata`

Player data is optional for team/club-based competitions.

### 8.7 Team

Purpose:

- Represents a competition team, squad, or pair.

Fields:

- `event_id`
- `club_id`
- `name`
- `slug`
- `logo`
- `description`
- `captain_player_id`
- `contact_email`

### 8.8 Roster

Purpose:

- Connects players to teams/categories.

Fields:

- `team_id`
- `player_id`
- `category_id`
- `role`
- `status`

Roster is optional unless the category requires it.

### 8.9 CompetitionEntry

Purpose:

- Represents the actual participant entry in a category.

An entry can point to:

- A player
- A pair/team
- A club
- A placeholder/TBD

Fields:

- `event_id`
- `category_id`
- `entry_type`
- `club_id`
- `team_id`
- `player_id`
- `display_name`
- `seed_number`
- `status`

Entry types:

- `individual`
- `pair`
- `team`
- `club`
- `tbd`

### 8.10 Venue

Purpose:

- Represents physical or virtual location.

Fields:

- `event_id`
- `name`
- `address`
- `map_url`
- `description`
- `is_virtual`
- `virtual_url`

### 8.11 Court

Purpose:

- Represents a field, court, room, table, or station inside a venue.

Examples:

- Court 1
- Court 2
- Futsal Field
- Meeting Room A
- Table 3

Fields:

- `venue_id`
- `name`
- `sport_id`
- `capacity`
- `is_active`

### 8.12 Stage

Purpose:

- Represents phase of a category.

Examples:

- Group Stage
- Quarter Final
- Semi Final
- Final
- Bronze Match

Fields:

- `category_id`
- `name`
- `stage_type`
- `order`
- `status`

Stage types:

- `group_stage`
- `round_robin`
- `single_elimination`
- `double_elimination`
- `swiss`
- `league`
- `final_only`
- `friendly`
- `time_trial`
- `score_ranking`

### 8.13 Group

Purpose:

- Represents group inside group stage.

Fields:

- `stage_id`
- `name`
- `order`

Examples:

- Group A
- Group B

### 8.14 Match

Purpose:

- Represents an actual match.

Fields:

- `event_id`
- `sport_id`
- `category_id`
- `stage_id`
- `group_id`
- `round_name`
- `match_number`
- `participant_a_entry_id`
- `participant_b_entry_id`
- `scheduled_start_at`
- `scheduled_end_at`
- `actual_start_at`
- `actual_end_at`
- `venue_id`
- `court_id`
- `status`
- `winner_entry_id`
- `score_summary`
- `is_public`
- `documentation_status`

Match statuses:

- `draft`
- `ready_for_scheduling`
- `scheduled`
- `published`
- `check_in_open`
- `ready_to_start`
- `ongoing`
- `paused`
- `under_review`
- `finished`
- `result_published`
- `postponed`
- `cancelled`
- `walkover`
- `disputed`

### 8.15 MatchSet

Purpose:

- Stores detailed score per set/game/round.

Fields:

- `match_id`
- `set_number`
- `participant_a_score`
- `participant_b_score`
- `winner_entry_id`
- `notes`

Examples:

- Badminton set 1: 21-18
- Badminton set 2: 18-21
- Badminton set 3: 21-19
- Futsal final score can use one set or period-based sets.

### 8.16 Standing

Purpose:

- Stores computed or cached group/league ranking.

Fields:

- `event_id`
- `category_id`
- `stage_id`
- `group_id`
- `entry_id`
- `rank`
- `played`
- `won`
- `drawn`
- `lost`
- `points`
- `score_for`
- `score_against`
- `score_difference`
- `set_for`
- `set_against`
- `set_difference`
- `qualified_status`

Standing should be recalculated from match results but may be cached for fast public display.

### 8.17 Bracket

Purpose:

- Represents bracket structure for elimination stages.

Fields:

- `category_id`
- `stage_id`
- `format`
- `seed_config`
- `bracket_data`
- `status`

### 8.18 Article

Purpose:

- CMS article for news, guides, recaps, and highlights.

Fields:

- `event_id`
- `title`
- `slug`
- `excerpt`
- `cover_image`
- `content_json`
- `content_html`
- `author_id`
- `status`
- `published_at`
- `share_title`
- `share_description`
- `share_image`
- `comments_enabled`

### 8.19 Announcement

Purpose:

- Short important update.

Fields:

- `event_id`
- `title`
- `message`
- `severity`
- `target_scope`
- `target_sport_id`
- `target_category_id`
- `target_match_id`
- `status`
- `published_at`

Severity:

- `info`
- `warning`
- `urgent`
- `result`
- `schedule_change`

### 8.20 Comment

Purpose:

- Supports discussion, public comment, internal note, and moderation.

Fields:

- `entity_type`
- `entity_id`
- `comment_type`
- `author_name`
- `author_user_id`
- `body`
- `status`
- `is_pinned`
- `resolved_at`
- `parent_comment_id`

Comment types:

- `public`
- `internal`
- `official_note`

Comment statuses:

- `pending`
- `approved`
- `hidden`
- `resolved`
- `deleted`

### 8.21 DocumentationAsset

Purpose:

- Stores match documentation assets.

Fields:

- `event_id`
- `match_id`
- `uploaded_by`
- `asset_type`
- `file`
- `caption`
- `visibility`
- `created_at`

Asset types:

- `photo`
- `video`
- `file`
- `score_sheet`
- `other`

### 8.22 Notification

Purpose:

- Logs outgoing messages and notification state.

Fields:

- `event_id`
- `channel`
- `recipient_type`
- `recipient_email`
- `subject`
- `body`
- `status`
- `sent_at`
- `related_entity_type`
- `related_entity_id`

Channels:

- `email`
- `teams_share`
- `whatsapp_share`
- `calendar_invite`
- `system`

### 8.23 AuditLog

Purpose:

- Records important system changes.

Fields:

- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `before_snapshot`
- `after_snapshot`
- `ip_address`
- `user_agent`
- `created_at`

## 9. Competition Format Requirements

The system must support these format types:

### 9.1 Single Elimination

Use cases:

- Badminton knockout
- Table tennis knockout
- E-sport playoff

Requirements:

- Seeded or random draw.
- Bracket view.
- Winner advances automatically.
- Bronze match optional.

### 9.2 Double Elimination

Use cases:

- E-sport or small tournament where second chance is desired.

Requirements:

- Winner bracket and loser bracket.
- Grand final handling.
- Reset final optional.

### 9.3 Round Robin

Use cases:

- Small group where everyone plays everyone.

Requirements:

- Auto-generate all pairings.
- Standing table.
- Configurable points and tie-breakers.

### 9.4 Group Stage to Knockout

Use cases:

- Futsal, badminton, e-sport.

Requirements:

- Groups A/B/C/etc.
- Standing per group.
- Qualified entries move to knockout.
- Manual override for qualified entries.

### 9.5 League

Use cases:

- Longer event with repeated matches.

Requirements:

- Standing table.
- Home/away optional.
- Configurable rounds.

### 9.6 Friendly/Exhibition

Use cases:

- Non-competitive matches.

Requirements:

- No bracket requirement.
- Optional score.
- Public schedule and documentation still available.

### 9.7 Time Trial / Score Ranking

Use cases:

- Running, challenge games, skill competitions.

Requirements:

- Ranking by time, score, or judge points.
- Multiple attempts optional.

## 10. Sport and Category Examples

### 10.1 Badminton

Sport:

- `Badminton`

Possible categories:

- `Men Single`
- `Women Single`
- `Men Double`
- `Women Double`
- `Mixed Double`

Default ruleset:

- Participant mode: `individual` for single, `pair` for double.
- Best of 3 sets.
- Set target score: 21.
- Deuce enabled.
- Match winner determined by set wins.

Supported formats:

- Group stage to knockout
- Single elimination
- Round robin

### 10.2 Futsal

Sport:

- `Futsal`

Possible categories:

- `Futsal Men`
- `Futsal Women`
- `Futsal Mixed`

Default ruleset:

- Participant mode: `team` or `club`.
- Roster optional by default.
- Match duration configurable.
- Draw allowed in group stage.
- Knockout may require penalty shootout field.

Standing metrics:

- Points
- Goal difference
- Goals for
- Goals against
- Head-to-head optional

### 10.3 E-Sport

Default ruleset:

- Participant mode: `individual`, `team`, or `squad`.
- Best of 1 / Best of 3 / Best of 5.
- Map/round details optional.

### 10.4 Table Tennis

Default ruleset:

- Participant mode: `individual`, `pair`, or `team`.
- Best of configurable games.
- Point target configurable.

### 10.5 Chess

Default ruleset:

- Participant mode: `individual` or `team`.
- Round robin, swiss, or knockout.
- Result: win, draw, loss.
- Points: 1, 0.5, 0.

## 11. Ruleset and Scoring Engine

Ruleset must be configurable per category.

Core fields:

- `score_type`
- `allow_draw`
- `points_win`
- `points_draw`
- `points_loss`
- `set_based`
- `best_of`
- `target_score`
- `deuce_enabled`
- `max_score`
- `timer_enabled`
- `period_count`
- `period_duration`
- `overtime_enabled`
- `penalty_enabled`
- `tie_breakers`

Tie-breaker examples:

- Points
- Head-to-head
- Score difference
- Score for
- Set difference
- Set for
- Fewest penalties
- Manual decision

The UI should show only fields relevant to the selected sport/category.

## 12. Standing Table Requirements

For any group stage, round robin, league, or swiss-like format, the public view must show a standing table.

Default columns:

- Rank
- Entry
- Played
- Won
- Drawn
- Lost
- Points
- Score For
- Score Against
- Score Difference
- Status

Sport-specific labels:

- Futsal: goals
- Badminton: sets/games/points
- Chess: points
- E-sport: maps/rounds

Standing status:

- `qualified`
- `eliminated`
- `pending`
- `champion`
- `runner_up`

Admin requirements:

- Recalculate standings after match result update.
- Allow manual override with audit log.
- Show explanation for ranking order when possible.

## 13. Bracket Requirements

Public bracket view must:

- Be readable on mobile.
- Support horizontal and vertical modes.
- Allow zoom/pan on small screens.
- Show match status and score.
- Link each match to match detail page.
- Highlight champion path.

Admin bracket view must:

- Generate bracket from entries/seeds.
- Allow manual seed editing before publish.
- Lock bracket after publish unless admin unlocks.
- Support TBD placeholders.
- Update next round after result confirmation.

## 14. Schedule and Calendar Requirements

### 14.1 Public Schedule

Public users should be able to view schedule by:

- Today
- Tomorrow
- This week
- Sport
- Category
- Venue
- Club/team/player
- Status

Mobile default:

- Agenda/list view.

Desktop options:

- Month calendar
- Week calendar
- Day calendar
- Agenda/list

Each schedule item should show:

- Sport/category
- Participants
- Time
- Venue/court
- Match status
- Score/result if available
- Link to detail

### 14.2 Scheduler Workspace

Scheduler must have:

- Calendar view.
- Unscheduled match queue.
- Drag-and-drop assignment.
- Venue/court filter.
- Sport/category filter.
- Conflict warnings.
- Publish schedule button.
- Reschedule reason form.

Conflict detection:

- Same player in overlapping matches.
- Same team/club in overlapping matches.
- Same venue/court overlapping.
- Same match officer overlapping.
- Too little rest time between matches.
- Category-specific constraints.

### 14.3 Calendar Export

The system should support:

- `.ics` export per event.
- `.ics` export per player/team/club.
- Email with calendar invite.
- Outlook-friendly schedule email.

## 15. Match Detail and Documentation

Every match must have a detail page.

Public match detail should show:

- Sport/category
- Stage/group/round
- Participants
- Schedule
- Venue/court
- Status
- Score
- Set/round details
- Standing/bracket impact
- Documentation gallery if public
- Related announcement/article
- Share buttons

Admin match detail should show:

- Editable schedule fields if permitted.
- Score input.
- Live score launch button.
- Match notes.
- Documentation upload.
- Internal comments.
- Audit history.
- Reschedule history.
- Result review state.

Documentation requirements:

- Upload photo/video/file.
- Mark asset public/internal.
- Add caption.
- Link assets to match.
- Include score sheet photo if needed.

## 16. Live Score Feature

Live score should be included as a planned feature.

### 16.1 Purpose

Give Match Officer a full-screen, touch-friendly scoring interface for mobile, tablet, and desktop. It should reduce input friction during live matches and optionally broadcast score updates to public viewers.

### 16.2 Modes

Supported modes:

- `generic_counter`
- `set_based_score`
- `timer_score`
- `period_score`
- `judge_score`

Examples:

- Badminton: set-based score.
- Futsal: timer score with goal count.
- Chess: result selector and clock optional.
- Time trial: time/score entry.

### 16.3 Mobile Full-Screen Interaction

Recommended interaction model:

- Full screen shows Participant A, Participant B, current score, match status, and timer if enabled.
- A selected participant is highlighted.
- Tap the bottom action zone to add score to the selected participant.
- Tap the left rail/action zone to reduce score or undo last score action.
- Tap participant panel to switch selected participant.
- Long press can open correction menu.
- Shake/accidental touch protection should be considered optional.

Alternative split mode:

- Tap lower-left area to add score for Participant A.
- Tap lower-right area to add score for Participant B.
- Left rail opens undo/decrease controls.
- Confirmation required before publishing final result.

Desktop controls:

- Keyboard shortcuts for score increment/decrement.
- Mouse click on participant score panel.
- Undo button.
- Finish set/match button.

### 16.4 Live Score Requirements

Must support:

- Start match.
- Pause/resume match.
- Add score.
- Reduce score.
- Undo last action.
- Add note.
- Finish set/period.
- Finish match.
- Submit for review.
- Publish result.

Realtime:

- Public match detail can receive live updates through WebSocket or SSE.
- If realtime is not active, public page can poll periodically.

Safety:

- Score changes must be logged.
- Final result requires confirmation.
- Published result changes require reason.
- Offline fallback should keep local temporary state if possible.

Audit:

- Every score action should record actor, timestamp, participant, previous value, new value, and action type.

## 17. Comment Feature

Comment system should support:

- Public comments.
- Internal admin comments.
- Official notes.
- Threaded replies.
- Moderation.
- Pinning.
- Resolve status for internal coordination.

Comment targets:

- Article
- Announcement
- Match
- DocumentationAsset
- Event

Public comment rules:

- Disabled by default for sensitive content.
- Can be enabled per article/announcement/match.
- Moderation can be required before public display.

Internal comment rules:

- Visible only to authorized roles.
- Useful for schedule discussion, match dispute, documentation notes, and content review.

## 18. Article and Announcement Requirements

Article editor should support:

- Heading
- Paragraph
- Bold/italic
- Lists
- Image
- Link
- Quote
- Table
- Divider
- Callout
- Embed optional
- Related match/category/event references

Article public view should support:

- Fast mobile reading.
- Share to WhatsApp.
- Share to Teams.
- Email share.
- OpenGraph metadata.
- Clean excerpt.
- Cover image.

Announcement requirements:

- Short, clear, and high-visibility.
- Can target whole event, sport, category, club/team/player, or match.
- Can be displayed as banner, feed item, or urgent alert.

Email requirements:

- Schedule email.
- Match reminder email.
- Announcement email.
- Winner announcement email.
- Outlook-friendly formatting.
- Optional `.ics` attachment.

## 19. Public Edit Mode

Admins should be able to edit selected public pages in context.

Behavior:

- Admin opens public page.
- Admin enables `Edit Mode`.
- Editable areas show subtle edit affordance.
- Clicking an area opens a side panel editor.
- Admin can preview before publish.

Editable examples:

- Event description.
- Sport/category detail.
- Match schedule.
- Match score.
- Article content.
- Announcement content.
- Share metadata.

Safety:

- Role permissions still apply.
- Draft/publish workflow still applies.
- Audit log must record changes.

## 20. Workspaces

### 20.1 Event Admin Workspace

Purpose:

- Configure event from zero to publish-ready.

Main UI:

- Event readiness checklist.
- Setup wizard.
- Sport/category builder.
- Participant manager.
- Club/team/player manager.
- Format/ruleset selector.
- Draw/seeding tool.
- Publish preview.

Readiness checklist:

- Site config complete.
- Event information complete.
- Sports created.
- Categories created.
- Rulesets configured.
- Participants added.
- Venues/courts configured.
- Schedule created.
- Public content ready.
- Visibility date configured.

### 20.2 Scheduler Workspace

Purpose:

- Plan, adjust, and publish match schedule.

Main UI:

- Calendar.
- Unscheduled match queue.
- Conflict panel.
- Venue/court lanes.
- Filter bar.
- Reschedule workflow.
- Publish changes.

### 20.3 Match Officer Workspace

Purpose:

- Run match day from mobile.

Main UI:

- Today's assigned matches.
- Venue/court tabs.
- Large status buttons.
- Start match.
- Live score.
- Score input.
- Documentation upload.
- Official notes.
- Submit result.

Mobile priority:

- One-hand operation.
- Large tap targets.
- Low typing.
- Offline-tolerant where possible.

### 20.4 Content Admin Workspace

Purpose:

- Publish articles, announcements, recaps, and shareable updates.

Main UI:

- Rich editor.
- Content calendar.
- Draft/review/publish states.
- WhatsApp/Teams/email preview.
- Target audience selector.
- Related event/match picker.
- Comment moderation.

### 20.5 Super Admin Workspace

Purpose:

- Manage system-level settings.

Main UI:

- Users and roles.
- Site config.
- Audit logs.
- System health.
- Data export/import.
- Maintenance mode.

## 21. User Experience and Design System Direction

### 21.1 General UI Direction

The UI should feel:

- Clear
- Operational
- Mobile-friendly
- Fast to scan
- Visual but not decorative
- Useful under event-day pressure

Avoid:

- Generic CRUD-heavy pages as the primary workflow.
- Overly decorative landing-page sections.
- Complex forms when a wizard or visual builder is better.
- Hiding important state in small text.

### 21.2 Public Portal UI

Public users need:

- Quick answer: what is happening now?
- Quick answer: when do I play?
- Quick answer: where is the match?
- Quick answer: what is the result?
- Quick answer: who won?

Recommended public navigation:

- Home
- Schedule
- Sports
- Standings
- Brackets
- Announcements
- Articles
- Winners

### 21.3 Admin UI

Admin users need:

- Visual hierarchy.
- Clear status.
- Fast actions.
- Filtered work queues.
- Audit confidence.
- Low-friction edits.

Use:

- Tabs for views.
- Calendar for schedules.
- Timelines for history.
- Tables for standings and lists.
- Cards only for repeated items.
- Side panels for contextual editing.
- Full-screen mode for live score.

### 21.4 Mobile Design

Mobile must be treated as a primary device.

Priority mobile screens:

- Public event home.
- Public schedule.
- Public match detail.
- Public standings.
- Public bracket.
- Match Officer dashboard.
- Live score.
- Documentation upload.

## 22. Notifications and Sharing

Share targets:

- WhatsApp
- Microsoft Teams
- Email
- Browser native share
- Copy link

Share metadata:

- `share_title`
- `share_description`
- `share_image`
- `canonical_url`

Notification triggers:

- Schedule published.
- Schedule changed.
- Match reminder.
- Match started.
- Match result published.
- Winner announced.
- Urgent announcement.

Email log must track:

- Recipient
- Subject
- Status
- Error message
- Sent timestamp

## 23. Import and Export

Import:

- Clubs from CSV/Excel.
- Players from CSV/Excel.
- Teams from CSV/Excel.
- Participants/entries from CSV/Excel.
- Venues/courts from CSV/Excel.

Export:

- Schedule CSV/Excel.
- Standings CSV/Excel.
- Results CSV/Excel.
- Participants CSV/Excel.
- Match documentation archive.
- Calendar `.ics`.

## 24. Security and Audit

Authentication:

- Admin login required.
- Public access does not require login by default.
- Player login optional for future phase.

Authorization:

- Role-based permissions.
- Event-scoped access.
- Field/action-level restrictions for sensitive operations.

Sensitive operations requiring audit:

- Schedule publish.
- Schedule reschedule.
- Score update.
- Result publish.
- Bracket unlock.
- Standing manual override.
- Article publish.
- Announcement publish.
- Site config update.
- Role/user permission update.

## 25. Non-Functional Requirements

Performance:

- Public mobile pages should load quickly.
- Schedule and match list should support filtering without heavy reloads.
- Realtime score should degrade gracefully to polling.

Reliability:

- Important operations should be transactional.
- Score/result publishing should avoid partial updates.
- Docker setup should be reproducible.

Usability:

- Admin screens must be easy to understand without reading documentation.
- Match day flow must minimize typing.
- Public pages must be readable on small phones.

Maintainability:

- Use English naming consistently.
- Keep domain logic separated from UI components.
- Keep format/ruleset logic modular.
- Keep generated schedules and standings reproducible.

Accessibility:

- Sufficient color contrast.
- Large tap targets.
- Keyboard support for desktop admin controls.
- Do not rely only on color for match status.

## 26. MVP Scope

MVP should include:

- Docker Compose setup.
- Auth and roles.
- Site config.
- Event management.
- Sport management.
- Category management.
- Club/player/team/entry management.
- Venue/court management.
- Basic ruleset templates.
- Match creation.
- Schedule calendar and agenda.
- Public portal with Coming Soon lock.
- Public schedule.
- Match detail page.
- Score input.
- Standing table for group stage.
- Basic single elimination bracket.
- Article and announcement CMS.
- Share metadata.
- Internal comments.
- Match documentation upload.
- Audit log for critical actions.

MVP can defer:

- Double elimination.
- Swiss format.
- Advanced email automation.
- Player login.
- Offline live score.
- Advanced public comment moderation.
- AI content assistance.

## 27. Product Phases

### Phase 0 - Foundation

- Project setup.
- Docker Compose.
- Database.
- Auth.
- Role model.
- Site config.
- Base layout.

### Phase 1 - Event Structure

- Event.
- Sport.
- Category.
- Ruleset.
- Venue/court.
- Club/player/team/entry.

### Phase 2 - Scheduling

- Match generation.
- Match list.
- Calendar.
- Unscheduled queue.
- Conflict detection.
- Public schedule.

### Phase 3 - Match Operations

- Match detail.
- Match lifecycle.
- Score input.
- Match documentation.
- Internal comments.
- Audit log.

### Phase 4 - Competition Results

- Standing table.
- Bracket view.
- Winner advancement.
- Winner announcement.
- Archive/history.

### Phase 5 - Content and Communication

- Article editor.
- Announcement.
- Share preview.
- Email templates.
- Calendar invites.
- Public comments/moderation.

### Phase 6 - Live Score and Advanced Interaction

- Full-screen live score.
- Realtime public updates.
- Timer/period support.
- Score action audit.
- Optional offline fallback.

### Phase 7 - Advanced Formats and Automation

- Double elimination.
- Swiss.
- Advanced draw/seeding.
- Advanced notification targeting.
- Data import/export improvements.

## 28. Acceptance Criteria

### 28.1 Public Portal

- Public users can open event home on mobile and see key information clearly.
- Before H-7 or `public_open_at`, public users see Coming Soon.
- Admins can preview unpublished public views.
- Public schedule can be filtered by sport/category/club/team/player.
- Public match detail has shareable URL and metadata.

### 28.2 Event Admin

- Event Admin can create an event, sport, category, ruleset, venue, court, and entries.
- Event Admin can configure Badminton Men Single and Futsal Team examples without code changes.
- Event Admin can choose participant mode per category.
- Event Admin can make roster optional or required per category.

### 28.3 Scheduler

- Scheduler can create/publish schedules.
- Scheduler can see unscheduled matches.
- Scheduler gets warnings for conflicts.
- Scheduler can reschedule a match with reason.
- Reschedule action is audited.

### 28.4 Match Officer

- Match Officer can see assigned matches on mobile.
- Match Officer can start a match.
- Match Officer can input score.
- Match Officer can upload match documentation.
- Match Officer can submit/publish result based on permission.
- Score/result changes are audited.

### 28.5 Group Stage

- Group stage shows standing table.
- Standing updates after result confirmation.
- Tie-breaker configuration is respected.
- Admin can manually override standing with reason and audit.

### 28.6 Bracket

- Bracket can be generated from entries.
- Bracket is readable on mobile.
- Match result advances winner.
- Bracket links to match detail.

### 28.7 Content

- Content Admin can write article with rich text.
- Article has share preview.
- Announcement can target event/sport/category/match.
- Comments can be enabled/disabled.
- Public comments can be moderated.

### 28.8 Live Score

- Match Officer can open full-screen live score mode.
- Tap bottom zone can increase selected participant score.
- Tap left rail/action zone can decrease or undo score action.
- Score updates are logged.
- Final result requires confirmation.
- Public live updates work through realtime or polling fallback.

## 29. Vibe Coding Continuation Strategy

This project must be friendly for long-running AI-assisted development.

### 29.1 Source of Truth

The main source of truth is:

- `prd/README.md`

Future recommended docs:

- `prd/implementation-plan.md`
- `prd/data-model.md`
- `prd/session-handoff.md`
- `prd/decision-log.md`

Do not rely only on chat memory. When important decisions are made, update PRD or decision log.

### 29.2 Session Start Checklist

At the start of any new Vibe Coding session, the agent/developer should:

1. Read `prd/README.md`.
2. Inspect current repository structure.
3. Inspect git status.
4. Identify latest implemented phase.
5. Continue from the next unchecked task.
6. Avoid rewriting existing work unless explicitly requested.

### 29.3 Session End Checklist

Before a session ends, update a handoff note with:

- What was completed.
- What files changed.
- What decisions were made.
- What is still pending.
- Known blockers.
- Commands/tests that passed or failed.
- Recommended next prompt.

### 29.4 Suggested Handoff Template

Use this template at the end of each coding session:

```md
# Session Handoff

Date:
Branch:
Current phase:

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

### 29.5 Development Best Practice

Recommended workflow:

- Build phase by phase.
- Keep changes small and testable.
- Use feature branches.
- Commit after stable milestones.
- Keep seed data for demo events.
- Add example event: `ROC Olympic 2026`.
- Add example sports: Badminton and Futsal first.
- Add sample categories: Badminton Men Single, Badminton Mixed Double, Futsal Men.
- Add sample entries with club/team/player variants.

### 29.6 AI Coding Guardrails

Any AI coding agent should:

- Preserve English naming for code/database/routes/enums.
- Prioritize mobile UX for public and match officer screens.
- Avoid turning operational workspaces into generic CRUD tables.
- Add audit logs for sensitive changes.
- Keep public visibility rules intact.
- Use Docker for reproducible local setup.
- Update docs when decisions change.

## 30. Initial Demo Scenario

Create demo event:

- Event: `ROC Olympic 2026`
- Public open rule: H-7 from event start
- Sports:
  - Badminton
  - Futsal
- Clubs:
  - IT Club
  - Finance
  - HR
  - Marketing
- Categories:
  - Badminton Men Single
  - Badminton Mixed Double
  - Futsal Men
- Formats:
  - Badminton Men Single: single elimination
  - Badminton Mixed Double: group stage to knockout
  - Futsal Men: group stage
- Venues:
  - Main Hall
  - Futsal Field
- Courts:
  - Court 1
  - Court 2
  - Futsal Field

This demo scenario should be used to validate:

- Club/team/player flexibility.
- Group standings.
- Bracket rendering.
- Schedule calendar.
- Match detail.
- Documentation upload.
- Live score behavior.
- Public share links.

## 31. Open Decisions

These decisions can be made during implementation:

- Whether public comments require login.
- Whether players need accounts in MVP.
- Whether live score should be realtime in MVP or phase 6.
- Whether Payload Lexical is enough or Tiptap is needed for custom article blocks.
- Whether object storage uses local filesystem first or MinIO from day one.
- Whether Teams integration starts as share link or Microsoft Graph integration.

Recommended defaults:

- Public comments do not require login but require moderation when enabled.
- Players do not need accounts in MVP.
- Live score can be built after basic match result flow is stable.
- Start with Payload Lexical; switch/add Tiptap only if content UX needs it.
- Start with local file storage; add MinIO if uploads become important early.
- Start with Teams share link; add Microsoft Graph later.

## 32. Final Product Shape

The desired product should feel like:

- A clear mobile event portal for employees.
- A visual operations cockpit for committee members.
- A CMS for articles, announcements, and documentation.
- A scheduling and competition engine for matches.
- A historical archive after the event ends.

The main success metric:

> A committee member can run an office olympiad confidently from setup to winner announcement without needing spreadsheet chaos.

