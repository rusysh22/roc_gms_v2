---
title: "Creating an Event"
description: "The New Event Wizard, step by step, and how to resume a half-finished setup."
sidebar:
  order: 2
---


Events are created and set up in the **New Event Wizard** — a ten-step guided flow at
`/workspaces/event-admin/new-event`. Start it from **Event Setup → Create New Event** in the
sidebar, or the **Create New Event** button on the Event Admin dashboard.

You do **not** have to finish the wizard in one sitting. Once the event itself exists (step 2), all
your work is saved on the server as you go. See [Saving and resuming](#saving-and-resuming) below.

## The step bar

The wizard header shows a progress bar: a plain "Step N of 10" line on small screens, and the full
connected stepper on wide screens. A step is only marked **done** when its real work is actually
complete — for example, "Categories" turns green when at least one category exists, and
"Generate Matches" only when every publishable category has its matches. You can click any step in
the bar to jump straight to it.

The ten steps:

| # | Step | What it does |
|---|---|---|
| 1 | **Setup Assistant** | Optional questions that pre-fill later choices |
| 2 | **Event** | Creates the event: name, dates, timezone, location, logo |
| 3 | **Sports & Rulesets** | The games played, and optional scoring rules |
| 4 | **Categories** | The specific competitions within each sport |
| 5 | **Clubs / Teams / Players** | The people and organizations taking part |
| 6 | **Registration** | Who officially competes in each category (creates *entries*) |
| 7 | **Draw & Seeding** | The order entries are placed in the draw |
| 8 | **Generate Matches** | Creates the first round / fixtures |
| 9 | **Bracket** | Review fixtures, per-stage ruleset overrides, and publish |
| 10 | **History** | An audit log of every change to the event |

---

## Step 1 — Setup Assistant

A short questionnaire. Everything it asks is a **suggestion that pre-fills a later step**, never a
lock — you can change any of it afterwards. You can also click **Skip for now**.

It asks:

- **How big is your event?** — single-sport or multi-sport. This changes the wording of the next
  question.
- **What kind of tournament is this?** (single-sport) or **What format do you use most often?**
  (multi-sport) — single elimination, round robin, group stage to knockout, or league. Pre-fills the
  **Format** field when you add a category.
- **Where does your participant data live right now?** — entering people by hand, a spreadsheet, a
  public registration form, or copied from a previous event. If you choose spreadsheet, step 5 will
  point you straight at the bulk import.

---

## Step 2 — Event

This step **creates the event**. Fields:

| Field | Required | Notes |
|---|---|---|
| **Event name** | Yes | e.g. "Company Sports Day 2026" |
| **URL slug** | No (auto) | Auto-generated from the name; editable under *Advanced*. Must be unique — if it is taken, InTourney suggests a free alternative. |
| **Start** / **End** | Yes | Date and time. End must be after start. |
| **Timezone** | Yes | The event's own timezone. All times shown anywhere in InTourney for this event use it. |
| **Location** | No | Free text (city, venue name). |
| **Organizer name** | No | Shown on the public page. |
| **Logo** | No | JPG, PNG, or WebP. Appears on the public page and in the wizard header. |

When you submit, the event is created with status **Draft** and visibility **Hidden** (nothing is
public yet), it becomes your active event, and you move to step 3.

If the form has an error (missing field, end before start, taken slug), it comes back with
everything you typed still filled in — you never lose the form.

---

## Step 3 — Sports & Rulesets

A **sport** is a game played at your event (Badminton, Futsal, Chess…). A **ruleset** is an optional,
reusable set of scoring rules you can attach to a category.

Two ways to add sports:

- **Quick add from catalog** — pick a common sport, tick its standard events, and InTourney creates
  the sport, a starting ruleset, and one category per event you ticked. The fastest path for a
  standard sport.
- **Add a sport manually** — enter a name (and, under *Advanced*, a custom URL slug). You can then
  add rulesets for it: name, score type (points, goals, sets, time, result, custom), and options
  like best-of, target score, and whether draws are allowed.

Skip rulesets entirely to use each sport's default scoring.

---

## Step 4 — Categories

A **category** is a specific competition within a sport — "Badminton Singles Men", "Futsal Open",
"Chess U-15". This is the unit that participants register into and that a bracket or schedule is
generated for.

For each category you set:

- **Sport** — must already exist (step 3).
- **Category name** (and optional custom slug).
- **Who's competing in this category?** — the *participant mode*:

  | Mode | Meaning |
  |---|---|
  | **Individual** | One person per entry (singles) |
  | **Pair** | Two people per entry (doubles) |
  | **Team** | A squad with a roster |
  | **Club** | An organization is the entry itself (inter-school, inter-company) |
  | **Open** | Any participant type |
  | **To be decided** | Decide later |

- **Format** — how matches are produced:

  | Format | How matches are made |
  |---|---|
  | Single Elimination | Seeded first round generated automatically in step 8 |
  | Round Robin | Full round-robin generated automatically in step 8 |
  | Double Elimination | Automatic; needs a power-of-two entry count |
  | Time Trial / Score Ranking | One attempt per entry, ranked by result |
  | Group Stage to Knockout | Its own guided panel in step 8 |
  | League / Friendly | Matches are scheduled manually in the Scheduler workspace |

- Optional: **ruleset**, **status** (draft / open / locked / published / archived), roster size
  limits, group qualify count, third-place policy, result unit, and medal settings.

Categories can be edited and duplicated. To delete one, use **Delete** (for an empty category) or
**Delete + all data** — which also removes its entries, groups, matches, and cached bracket /
standings. Deleting is blocked once any match in the category has started. The same applies to a
**Sport** (**Delete + all data** removes its categories and rulesets; its courts are detached, not
deleted). A **draft** category does not block wizard progress and is not publishable yet.

> **Example** — a company sports day with three sports:
>
> | Category | Sport | Mode | Format |
> |---|---|---|---|
> | Men's Singles | Badminton | Individual | Single Elimination |
> | Mixed Doubles | Badminton | Pair | Single Elimination |
> | Open | Futsal | Team | Group Stage to Knockout |
> | Open | Chess | Individual | Round Robin |
>
> See the full walkthrough in [Worked Example](/worked-example/).

---

## Step 5 — Clubs / Teams / Players

Everyone and every organization taking part in the event. These are **shared across the whole
event** — you choose which of them compete in each category in step 6.

- **Club** — a contingent that competes as a group: a department, a school, a chapter, a regional
  delegation. Only needed if a category's mode is **Club**, or to record which contingent a person
  represents.
- **Team** — a squad for a **team** sport (futsal, basketball, tug-of-war, relay). Skip if every
  sport is one-on-one.
- **Player** — every individual person, whether they compete solo or will be added to a roster.

You can add them one at a time with the forms here, or **bulk import** the whole event from one
Excel workbook — see [Importing Event Data](/importing-event-data/). If you told the Setup
Assistant your data is in a spreadsheet, this step points you straight at the import card.

---

## Step 6 — Registration

Registration turns a person/team/club from the directory into an **entry** — someone officially
competing in a specific category. Adding someone in step 5 does **not** register them anywhere by
itself.

- Pick a category, then add entries to it one by one, **or**
- Use **Bulk assign across sports** to tick which club/team plays which category across many
  team/pair/club categories at once, in a single submit.

Every entry is given a seed number the moment it is added; you refine that order in step 7.

See [Participants & Registration](/participants-and-registration/) for the public
self-registration form and the approval queue.

---

## Step 7 — Draw & Seeding

Set each entry's **seed** — the order participants are placed in the draw. Lower seed numbers are
kept apart in the early rounds so the strongest entries do not meet too soon.

Switch between categories at the top. Adding or removing entries is done in step 6, not here. You can
also shuffle seeds randomly.

---

## Step 8 — Generate Matches

Choose a category with **at least two confirmed entries**:

- **Single Elimination** and **Round Robin** — generate a seeded first round (or the full
  round-robin) automatically with one click. InTourney shows an estimate of how many matches will be
  created and how many courts are available for that sport.
- **Group Stage to Knockout** — use the **Groups** panel: create groups, distribute entries,
  generate group matches, then (after every group match has a published result) finalize the group
  stage and promote the qualifiers to the knockout bracket.
- **League / Friendly** and other manual formats — not generated here; schedule them in the
  Scheduler workspace.

If no courts are set up yet, matches still generate but have nowhere to be scheduled — add at least
one court under **Facilities & Venues** (see [Running Match Day](/running-match-day/)).

---

## Step 9 — Bracket

Review the generated fixtures per category. Here you can also set a **per-stage ruleset override** —
useful when one stage needs different rules than the rest of the category (best-of-3 in the group
stage, best-of-5 in the final). Leave it on **Inherit from category** unless you need the difference.

This step is also where you **publish** the event. You have three choices:

| Choice | Event status | What becomes public |
|---|---|---|
| **Save as draft** | Draft | Nothing — keeps working privately |
| **Publish event info only** | Coming Soon | The public event page (details, sports, sponsors), but not the schedule/results |
| **Publish event and schedule** | Live | The full public site — schedule, brackets, standings, live scores |

See [Publishing & the Public Site](/publishing-and-public-site/) for what each public page
shows.

---

## Step 10 — History

A read-only audit log of every recorded change to the event — sports, categories, participants,
entries, venues, and matches — most recent first. Every guided action in InTourney writes an entry
here.

---

## Saving and resuming

### Before the event exists (steps 1–2)

Your typing on the **Event** step is auto-saved to your browser as you go. If you refresh, close the
tab, or navigate away by accident and come back to the wizard, a banner offers:

> **Continue previous draft?** … [ Restore ] [ Discard draft ]

Restoring re-fills the form. The draft is kept for 7 days, is discarded automatically when you
successfully create the event, and is stored **only in your browser on this device** — it is never
uploaded. The event logo cannot be restored automatically (browsers do not allow it); the banner
reminds you to re-attach it.

### After the event exists (steps 3–10)

Everything is saved on the server immediately. There is nothing to lose. To pick up where you left
off:

1. Open the **Event Admin dashboard** (`/workspaces/event-admin`). If your active event's setup is
   unfinished, a **"Setup in progress"** card and a **Resume Setup** button appear at the top.
2. **Resume Setup** takes you back into the wizard at the **first step that still needs work** — not
   the beginning. If your browser remembers the exact step you last had open for this event, it
   takes you there instead.

You can also always reopen the wizard from **Event Setup → Create New Event** with your event active;
without an explicit step it opens at the first incomplete one.

## Next step

Most organizers set up participants next: [Importing Event Data](/importing-event-data/) or
[Participants & Registration](/participants-and-registration/).
