---
title: "Running Match Day"
description: "The Scheduler, Command Center, Match Officer, live scoring, and results."
sidebar:
  order: 6
---


Four workspaces carry the operational load once matches exist: **Facilities & Venues**,
**Scheduler**, **Command Center**, and **Match Officer** (plus the full-screen **Live Score**
surface). This chapter walks through them in the order you use them.

---

## 1. Facilities & Venues — `/workspaces/event-admin/facilities`

Before anything can be scheduled, the event needs somewhere to play.

- A **venue** is a location (a sports hall, a school, a park).
- A **court** is a playable surface inside a venue (Court 1, Table 3, Pitch A). A court belongs to a
  venue and, optionally, to a sport.

Every save runs schedule-safe relationship validation. You cannot delete a venue or court that still
has matches assigned to it without dealing with those matches first.

---

## 2. Scheduler — `/workspaces/scheduler`

The "Schedule Command Queue." Roles: **Scheduler**, **Event Admin**, **Super Admin**.

### Creating a match by hand

For **League**, **Friendly**, and any ad-hoc match. The guided form asks for the sport, category,
the two participant entries, venue, court, and start/end time. On submit InTourney validates:

- every relationship belongs to this event and category,
- the end time is after the start,
- there is **no venue, court, or participant conflict** at that time,
- the match's lifecycle state allows the change.

### Rescheduling

Matches in **draft**, **ready for scheduling**, **scheduled**, **published**, or **postponed** can
be rescheduled. The form asks for the new time, venue, court, and a **reason** (which is recorded and
— for a published match — drives the public "schedule change" notice). Rescheduling a **postponed**
match automatically returns it to **scheduled**.

### Conflicts

The queue flags any venue/court or participant double-booking. Resolve them by rescheduling one of
the clashing matches.

> **Example** — the scheduler places three badminton first-round matches at 09:00, but Hall A only
> has Court 1 and Court 2. Trying to save the third on Court 1 at 09:00 is blocked: *"That time
> would create a venue or court conflict."* Moving it to 09:40 clears the flag.

---

## 3. Command Center — `/workspaces/command-center`

One screen for everything that needs attention **right now**. It surfaces:

- **Venue/court conflicts** — double-bookings to resolve.
- **Delay impact** — when one match runs late, which later matches on the same court are affected.
- Matches **awaiting a result**, results **under review**, and anything **disputed**.

If nothing is wrong, it simply says "Nothing needs attention right now."

---

## 4. Match Officer — `/workspaces/match-officer`

A mobile-first match list for officers on venue duty. Roles: **Match Officer**, **Event Admin**,
**Super Admin**.

It shows the match-day matches (published, scheduled, check-in open, ready to start, ongoing). For
the next match you get **quick status actions**, and two links per match:

- **Live Score** — the full-screen scoring surface (below).
- **Match Details** — documentation, internal comments, officer assignment, and the complete
  lifecycle action set.

---

## 5. Live Score — full-screen scoring

Opened from Match Officer or Match Details. Designed for a phone or tablet at the court:

- Big **Add point** and **Undo** buttons for the selected side.
- Switch the side you are scoring; move between sets.
- **Works offline** — points are queued and sync automatically when the connection returns. It tells
  you how many points are pending, syncing, or failed (a failure means the match/set state changed
  under you).
- The screen stays awake while it is open.

---

## The match lifecycle

Every match has a **status**. The transitions available at any moment depend on the current status.

### Normal flow

```
scheduled / published
        │  (match time arrives, officer takes the court)
        ▼
ready to start ──▶ ongoing ⇄ paused ──▶ finished ──▶ result published
                                              │              ▲
                                              └──▶ under review ┘
```

| Action | From → To | Notes |
|---|---|---|
| **Start Match** | ready to start → ongoing | Records the actual start time |
| **Pause Match** / **Resume Match** | ongoing ⇄ paused | |
| **Finish Match** | ongoing → finished | Result is still **provisional** |
| **Send for Review** | finished → under review | Optional check before publishing |
| **Confirm and Publish Result** | finished / under review → result published | Requires selecting the **winner**. This is the final, public result — it advances the bracket. |

### Side branches

| Action | From → To | Notes |
|---|---|---|
| **Mark Disputed** | finished / under review → disputed | Requires confirmation; raises an urgent alert |
| **Resume Review** | disputed → under review | After the dispute is addressed |
| **Postpone Match** | scheduled / published → postponed | Reschedule it later from the Scheduler |
| **Cancel Match** | scheduled / published → cancelled | |
| **Mark Walkover** | scheduled / published / ready to start → walkover | Requires selecting the winner; counts as a real result |

> **Example — one badminton match, start to finish**
>
> | Time | Officer action | Status | What else happens |
> |---|---|---|---|
> | 09:00 | **Start Match** | Ongoing | Actual start time recorded |
> | 09:00–09:35 | Tap **Add point** in Live Score; one mis-tap fixed with **Undo**; Wi-Fi drops, points queue offline and sync on reconnect | Ongoing | Live score visible on the public match page and the venue display board |
> | 09:35 | **Finish Match** (games 21–15, 19–21, 21–17) | Finished | Public page shows the score as **Provisional** |
> | 09:37 | **Confirm and Publish Result**, winner = Andi Pratama | Result Published | Bracket advances Andi to the quarter-final; "result published" posts to the public Match Updates feed |
>
> If a line call is contested at 09:36, the officer taps **Mark Disputed** instead — it appears on
> the Command Center as urgent, an Event Admin reviews it, then uses **Resume Review → Confirm and
> Publish Result** to close it.

### What the public sees

Only status changes a spectator cares about appear on the public **Match Updates** feed:
**postponed**, **cancelled**, **disputed**, **result published**, and **walkover**. Internal
operating states (ongoing, paused, finished-but-not-published) are not announced — a finished match
still shows as **Provisional** publicly until the result is published.

## Scores and documentation (Match Details)

On `/workspaces/matches/<match-number>` you can also:

- Enter **set scores** and add sets, or record a **ranking result** for time-trial / score-ranking
  categories.
- **Assign officials** to the match.
- Attach **documentation** (photos, score sheets, files — with a size and type allowlist).
- Leave **internal comments** for other staff (not public).
- Read the match's own **audit history**.

Revising an **already-published** result is restricted to **Event Admin** and **Super Admin**.

## Keeping the reports current

Publishing results keeps standings, brackets, and medals up to date automatically. After a bulk
correction you can force a refresh from **Reports → Standings / Brackets / Medal Tally** (see
[Draw & Match Generation](/draw-and-match-generation/#the-report-pages)).
