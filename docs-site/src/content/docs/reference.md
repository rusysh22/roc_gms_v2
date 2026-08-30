---
title: "Reference"
description: "Glossary, status values, formats, and troubleshooting."
sidebar:
  order: 10
---


## Glossary

| Term | Meaning |
|---|---|
| **Event** | One tournament or games occasion. Everything else in InTourney belongs to an event. |
| **Active event** | The event a workspace is currently acting on, chosen in the sidebar switcher. |
| **Sport** | A game played at the event (Badminton, Futsal, Chess). |
| **Ruleset** | A reusable set of scoring rules that can be attached to a category or a single stage. |
| **Category** | A specific competition within a sport (Badminton Singles Men). The unit that has a draw and a bracket. |
| **Participant mode** | Who competes in a category: individual, pair, team, club, open, or to-be-decided. |
| **Format** | How a category's matches are produced (single elimination, round robin, group stage to knockout, …). |
| **Club** | A contingent competing as a group — a department, school, chapter, or delegation. |
| **Team** | A squad for a team sport, with a roster. |
| **Player** | An individual person in the event directory. |
| **Pair** | Two players competing together as one entry (doubles). |
| **Roster** | The players assigned to a team. |
| **Directory** | All the clubs, teams, and players in the event — who *could* take part. |
| **Entry** | A player/pair/team/club *officially registered* into one category. |
| **Seed** | An entry's position in the draw; lower numbers are kept apart early. |
| **Stage** | A phase of a category (group stage, knockout). Can have its own ruleset. |
| **Walkover** | A match decided without play because one side did not appear. Counts as a real result. |
| **Contingent** | Same as club — used on the public medal tally and standings. |

## Event status values

| Status | Meaning |
|---|---|
| **Draft** | Being set up; not public |
| **Coming Soon** | Announced publicly, but schedule/results withheld |
| **Live** | Running; full public site |
| **Completed** | Finished |
| **Archived** | Read-only, past event |

## Event visibility values

| Visibility | The public sees |
|---|---|
| **Hidden** | Nothing |
| **Coming Soon** | The teaser / basic event page |
| **Published** | Everything the current status allows |
| **Archived** | A read-only archived page |

## Match status values

| Status | Stage of the match |
|---|---|
| **Draft** / **Ready for Scheduling** | Created, not yet on the schedule |
| **Scheduled** | Has a time and court |
| **Published** | Schedule is public |
| **Check-in Open** / **Ready to Start** | Pre-match, at the venue |
| **Ongoing** / **Paused** | Being played |
| **Finished** | Play over; result **provisional** |
| **Under Review** | Result being checked before publishing |
| **Result Published** | Final, public result; bracket advanced |
| **Disputed** | Result contested |
| **Postponed** | Removed from its slot; will be rescheduled |
| **Cancelled** | Will not be played |
| **Walkover** | Decided without play; counts as a result |

## Category formats

| Format | Matches generated | Where |
|---|---|---|
| Single Elimination | Seeded knockout bracket | Wizard step 8, one click |
| Double Elimination | Winners + losers brackets (needs power-of-two entries) | Wizard step 8, one click |
| Round Robin | Everyone plays everyone once | Wizard step 8, one click |
| Group Stage to Knockout | Group round robins → knockout from qualifiers | Wizard step 8, Groups panel |
| Time Trial / Score Ranking | One attempt per entry, ranked by result | Wizard step 8 |
| League / Friendly | None automatically — build them by hand | Scheduler workspace |

## Useful URLs

| Page | URL |
|---|---|
| Sign in / register / reset | `/login`, `/register`, `/forgot-password` |
| Workspace entry (routes by role) | `/workspaces` |
| Event Admin dashboard | `/workspaces/event-admin` |
| New Event Wizard | `/workspaces/event-admin/new-event` |
| Resume the wizard at a step | `/workspaces/event-admin/new-event?eventId=<id>&step=<step>` |
| Public event site | `/events/<event-slug>` |
| Venue display board | `/events/<event-slug>/display` |
| Broadcast overlay | `/events/<event-slug>/matches/<match-number>/broadcast` |
| Advanced Data Administration | `/admin` |

---

## Troubleshooting

**A page says "No active event".**
You have not created one, or the event you were on is no longer accessible to you. Pick another from
the sidebar switcher, or create one.

**A colleague can't see my event.**
Their role is not enough on its own — they must be added as a **member of that event**. See
[Roles & Permissions](/roles-and-permissions/#per-event-access-scoping).

**I refreshed the New Event Wizard and my work is gone.**
For the **Event** step (before the event is created), a restore banner appears when you return — your
typing is auto-saved in your browser for 7 days. After the event exists, nothing is lost; go to the
Event Admin dashboard and click **Resume Setup**. See
[Creating an Event](/creating-an-event/#saving-and-resuming).

**The wizard opens on the wrong step.**
Without an explicit step in the URL, it opens at the first step that still needs work (or the step
you last had open on this device). Click any step in the top bar to go straight there.

**My Excel import skipped some rows.**
Open the row-by-row detail in the preview or the result banner. Common causes: a `sport_name` /
`category_name` that does not match anything, an enum value that is not in the allowed list (these
fall back to the default with a warning), a category whose participant type does not match the sheet,
or a duplicate `identification_number`. Fix those cells and re-upload — matched rows update in place,
they do not duplicate.

**"Add at least two confirmed entries before generating matches."**
The category needs at least two entries with status *confirmed*. Add them in the Registration step.

**Matches generated but have no time or court.**
Add a venue and at least one court under **Facilities & Venues**, then schedule the matches (the
Scheduler workspace, or the Command Center's queue).

**Live Score says "N points could not be applied (match/set state changed)".**
Points are only accepted while the match is *ongoing* (or *paused* / *under review*). The usual
cause is tapping before the match is started — open the **Match flow** panel and tap **Start
Match**, then score. It also appears if the match was already *finished* / *result published*
(possibly on another device), or if you are on a stale Live Score tab whose set no longer exists.

**A published result is wrong.**
Only **Event Admin** and **Super Admin** can revise a published result. Open the Match Details page
and use the Match Actions there.

**The public site isn't showing the schedule.**
Check the event's **status** (must be Live, or the *schedule publishes* time must have passed) and
**visibility** (must be Published).

**Registration form rejects a submission.**
The event may be outside its registration window, or the chosen category is not set to **open**.
Check both on Event Details and in the category settings.
