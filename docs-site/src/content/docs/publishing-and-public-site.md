---
title: "Publishing & the Public Site"
description: "Status and visibility, appearance, sponsors, and every public page."
sidebar:
  order: 7
---


## Status vs. visibility

Every event has two independent settings, editable from **Event Setup → Event Details**
(`/workspaces/event-admin/details`) or the wizard's Bracket step:

| Setting | Values | Meaning |
|---|---|---|
| **Status** | Draft, Coming Soon, Live, Completed, Archived | Where the event is in its lifecycle |
| **Visibility** | Hidden, Coming Soon, Published, Archived | How much of it the public can see |

The wizard's publish step bundles the common combinations into three choices:

| Publish choice | Status | Visibility | Result |
|---|---|---|---|
| **Save as draft** | Draft | Hidden | Nothing public |
| **Publish event info only** | Coming Soon | Published | Public event page: details, sports, sponsors — no schedule/results |
| **Publish event and schedule** | Live | Published | The full public site |

## Deleting an event

**Event Details** has a **Delete this event** section, shown only while the event is still a
**draft** with **no matches**. It permanently removes the event and everything under it (sports,
categories, entries, clubs, teams, players, venues, courts, rulesets, memberships, scoped content) —
you type the event name to confirm. Once real scheduling or scoring exists, an event is **archived**
(set status to Archived), never deleted.

## The event timeline

Also on Event Details. Start and end are required; the rest are optional rules — leave any blank to
skip it:

| Field | Controls |
|---|---|
| **Public opens** | When the public event page becomes reachable. If blank, it opens 7 days before the start. |
| **Registration opens** / **Registration closes** | The window the public self-registration form accepts submissions. |
| **Schedule publishes** | When schedule details become visible to the public. |
| **Archive at** | When the event moves to an archived, read-only state. |

All of these times are interpreted in the **event's timezone**.

## Appearance — `/workspaces/event-admin/appearance`

- **Event logo** — shown in the header of the public page and in the workspace.
- **Hero / banner image** — the large image at the top of the public event page.
- **Color theme** — one of the built-in presets (**Classic**, **Sunset**, **Ocean**). The preset
  recolors the public pages for this event only.

## Sponsors — `/workspaces/event-admin/sponsors`

Add sponsor logos and assign each a **tier**. They appear, grouped by tier, on the public event
page.

---

## The public event site

All public pages live under `/events/<event-slug>/`. They are recolored by the event's theme and
share a common header.

| Page | Path | Shows |
|---|---|---|
| **Home** | `/events/<slug>` | Hero, tagline, key dates, "what's next" matches, sports list, sponsors, latest announcements & articles, organizer contact |
| **Schedule** | `/events/<slug>/schedule` | Every match by day, with times, courts, and scores. A **Standings** tab (`?tab=standings`) shows group/round-robin tables. |
| **Sports & Categories** | `/events/<slug>/sports`, `.../sports/<sport>`, `.../sports/<sport>/<category>` | Per-sport and per-category pages with entries, fixtures, and results |
| **Brackets** | `/events/<slug>/brackets` | Single/double-elimination bracket diagrams |
| **Medals** | `/events/<slug>/medals` | The medal tally and contingent ranking (if enabled for the event) |
| **Champions** | `/events/<slug>/champions` | The winners of finished categories |
| **Match detail** | `/events/<slug>/matches/<match-number>` | One match: participants, schedule, score, updates feed. Includes an "add to calendar" link (`.../calendar.ics`). |
| **Announcements** | `/events/<slug>/announcements` | Published announcements |
| **Articles** | `/events/<slug>/articles`, `.../articles/<slug>` | Published articles |
| **Updates** | `/events/<slug>/updates` | Combined announcements + articles feed |
| **Register** | `/events/<slug>/register` | The public self-registration form (see [Participants & Registration](/participants-and-registration/)) |

### Special-purpose screens

| Screen | Path | Use |
|---|---|---|
| **Display board** | `/events/<slug>/display` | A big-screen dashboard of live matches and what's next, auto-refreshing. Put it on a TV or projector at the venue. |
| **Poster** | `/events/<slug>/poster` | A printable event poster. |
| **Broadcast overlay** | `/events/<slug>/matches/<match-number>/broadcast` | A minimal scorebug with no site chrome and a transparent background, for use as an OBS/vMix browser source in a livestream. |

### What is visible when

- With visibility **Published** and status **Coming Soon**, visitors see the home page, sports, and
  sponsors — but schedule, brackets, standings, and results are withheld until the event is **Live**
  (or the **schedule publishes** time passes).
- A match only contributes to public standings, brackets, medals, and champions once its result is
  **published** (see [Running Match Day](/running-match-day/#the-match-lifecycle)).
- A finished-but-unpublished match shows publicly as **Provisional**.

> **Example** — two weeks before the event the organizer chooses **Publish event info only**: the
> public page at `/events/bahari-nusantara-sports-day-2026` now shows the date, venue, sports, and
> sponsors, and the registration form is open, but the (still empty) schedule is hidden. On the
> morning of the event she switches to **Publish event and schedule**; the schedule, brackets, and
> live scores go public, and the venue display board at `/events/bahari-nusantara-sports-day-2026/display`
> starts showing live matches.
