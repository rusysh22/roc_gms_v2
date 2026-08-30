---
title: "Roles & Permissions"
description: "The full role reference and per-event access scoping."
sidebar:
  order: 9
---


## The seven roles

An account can hold one or more roles. A self-service signup gets **Event Admin**.

| Role | Purpose | Lands on |
|---|---|---|
| **Super Admin** | Full access to everything, every event, plus the Advanced Data Administration panel | Event Admin dashboard |
| **Event Admin** | Set up and run their own events end to end | Event Admin dashboard |
| **Scheduler** | Build and maintain the match schedule, resolve conflicts | Scheduler |
| **Match Officer** | Run matches at the venue: status changes, live scoring, documentation | Match Officer match list |
| **Draw** | Manage participants, entries, and the draw/seeding | Entries |
| **Registration** | Review and approve public registration submissions | Approval Queue |
| **Content Admin** | Write and publish articles and announcements | Content Desk |

## What each role can reach

| Workspace area | Super Admin | Event Admin | Scheduler | Match Officer | Draw | Registration | Content Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Event Setup (Dashboard, Details, New Event, Facilities, Rulesets, Appearance, Sponsors) | ✓ | ✓ | | | | | |
| Clubs / Participants / Entries | ✓ | ✓ | | | ✓ | | |
| Approval Queue | ✓ | ✓ | | | | ✓ | |
| Command Center / Scheduler / Matches | ✓ | ✓ | ✓ | | | | |
| Match Officer / Live Score | ✓ | ✓ | | ✓ | | | |
| Standings / Analytics / Medal Tally | ✓ | ✓ | ✓ | | | | |
| Brackets (report) | ✓ | ✓ | ✓ | | ✓ | | |
| Content Desk | ✓ | ✓ | | | | | ✓ |

## Capability boundaries within match operations

Some actions are deliberately split so a role can do its job without being able to undo someone
else's:

| Action | Allowed roles |
|---|---|
| Create or delete a match | Super Admin, Event Admin, Scheduler (create); Super Admin, Event Admin (delete) |
| Reschedule a match | Super Admin, Event Admin, Scheduler |
| Change match status, enter scores, run Live Score | Super Admin, Event Admin, Match Officer |
| **Revise an already-published result** | Super Admin, Event Admin only |
| Recalculate standings / brackets | Super Admin, Event Admin, Scheduler |
| Edit public content | Super Admin, Event Admin, Content Admin |

So a Match Officer can score and finish matches but cannot create, delete, reschedule, or reopen a
published result; a Scheduler can move matches but cannot overwrite a result that has been published.

## Per-event access scoping

Roles say *what* you can do. **Event membership** says *which events* you can do it in.

- When you create an event, you are automatically made a member of it.
- To let someone else work on your event (a scheduler, a match officer), they must be **added as a
  member of that event**. Until then, the event does not appear in their switcher and none of its
  data is visible to them — even if their role would otherwise allow the page.
- **Super Admin** bypasses membership and can access every event.
- A membership can be scoped further (for example, to specific sports) so a match officer only sees
  the part of the event they are responsible for.

If a colleague cannot see an event you expect them to, the fix is almost always to add them as a
member of that event, not to change their role.

> **Example** — Sari created the sports-day event, so she is a member automatically. She wants Budi
> to build the schedule and Rina to run matches at the badminton hall:
>
> - She adds **Budi** as a member with the **Scheduler** role. He can now select the event in his
>   switcher and open the Scheduler and Command Center for it — but not Event Details, and not the
>   other event he has no membership in.
> - She adds **Rina** as a member with **Match Officer**, scoped to Badminton. Rina sees only the
>   badminton matches on her Match Officer list, and cannot reschedule or delete anything.
> - A colleague from another department who was never added sees nothing — the event is not in his
>   switcher at all.
