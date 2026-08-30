---
title: "Participants & Registration"
description: "Clubs, teams, players, rosters, entries, and public self-registration."
sidebar:
  order: 4
---


InTourney separates two ideas that are easy to confuse:

| Term | Meaning |
|---|---|
| **Directory** (Clubs, Teams, Players) | Everyone who *could* take part in the event. Shared across the whole event. |
| **Entry** | Someone *officially registered* into one specific category. This is what a bracket and schedule are built from. |

Adding a person to the directory does **not** enter them into anything. Registration is the step that
turns a directory record into an entry.

You can manage all of this inside the wizard (steps 5–6) or from the dedicated workspace pages under
the **Registration** sidebar group. They act on the same data.

---

## The directory

### Clubs — `/workspaces/event-admin/clubs`

Contingents that compete as a group: departments, schools, chapters, regional delegations. Fields:
name, contact person, contact email. Only needed if a category's mode is **Club**, or to record
which contingent a person represents.

This page also has **Copy participants from a previous event** — reuse the clubs/teams/players you
already built for an earlier event instead of re-entering them.

### Participants — `/workspaces/event-admin/participants`

"Players, Teams, and Rosters." Here you:

- Add **players** — every individual person. Optional: club, email, phone, gender, ID number, photo
  URL.
- Add **teams** — a squad for a team sport, optionally tied to a club.
- Build **rosters** — assign players to a team. A team category can require a roster and enforce
  minimum/maximum size.

Every change is validated (relationships must belong to the same event) and written to the event's
History.

### Entries — `/workspaces/event-admin/entries`

"Competition Entries." A flat view of every entry across the event by name and category, for quick
creation and maintenance outside the wizard's per-category view.

---

## Registration (staff)

In the wizard's **Registration** step, or the pages above:

1. Choose a **category**.
2. Add entries to it — pick a player, pair, team, or club from the directory.
3. Or use **Bulk assign across sports** to tick a grid of clubs/teams against many team/pair/club
   categories and submit them all at once.

Each entry gets a **seed number** immediately; you adjust the draw order in the wizard's
**Draw & Seeding** step.

An entry can be **withdrawn** later — it stays on record (with the reason) but is dropped from the
bracket.

> **Example** — the futsal category has only two teams this year (Finance FC, IT All-Stars). Instead
> of adding entries one at a time, the organizer opens **Bulk assign across sports**, ticks both
> teams against *Futsal → Open*, and submits once. For the chess category she adds the 6 individual
> players one by one from the form above. Full walkthrough:
> [Worked Example, step 5](/worked-example/#5-registration-and-the-draw-wizard-steps-67).

---

## Public self-registration

If you want participants to register themselves, InTourney publishes a public form at
`/events/<event-slug>/register`. Link participants to it, or send them to the event page where it is
linked once registration is open.

### What a participant sees

- The list of **open** categories for the event.
- A form asking for the participant/team name, the people involved (one for individual, exactly two
  for a pair, or a roster within the size limits for a team), an optional club they represent, and
  **contact details** (name, email, phone) plus optional notes.

Submissions are rate-limited per connection to prevent spam. A submission does **not** create an
entry directly — it goes into a review queue.

### Controlling when it is open

- The event must be past its **registration open** time and before it closes.
- A category must have status **open** to accept submissions for it.

---

## The Approval Queue — `/workspaces/event-admin/registrations`

Every public submission lands here for a staff member (role **Registration**, **Event Admin**, or
**Super Admin**) to review. The page shows counts of **Pending review**, **Approved**, and
**Rejected**, and one card per pending submission with the participant, roster, club, contact
details, and notes.

For each submission:

- **Approve** — InTourney automatically creates the club (if named and new), the team or player
  records, the roster, and a **confirmed entry** in the chosen category. Nothing is typed twice.
- **Reject** — records the decision (and why); no records are created.

Both actions are written to the event's History.

---

## Where this fits in the flow

```
Directory (Clubs / Teams / Players)          ← wizard step 5, or Clubs / Participants pages
        │
        ├── staff registration                ← wizard step 6, or Entries page
        │
        └── public self-registration          ← /events/<slug>/register
                    │
                    └── Approval Queue → approve → confirmed entry
```

Once every publishable category has its entries, move on to
[Draw & Match Generation](/draw-and-match-generation/).
