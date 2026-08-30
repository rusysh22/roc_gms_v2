---
title: "Getting Started"
description: "Accounts, signing in, roles, the workspace layout, and the active event."
sidebar:
  order: 1
---


## What you need

- A modern web browser (Chrome, Edge, Firefox, or Safari — current versions).
- An InTourney account. Anyone can create one; see below.

## Creating an account

1. Go to `/register`.
2. Enter your **name**, **email**, and a **password** (at least 8 characters), then confirm the
   password.
3. Submit the form. Your account is created and you are signed in automatically and taken to your
   workspace.

A new self-service account is given the **Event Admin** role. This lets you create your own events
and manage them fully. Access is **scoped per event** — you only ever see events you created or were
added to, never other organizers' events.

If someone else is setting up an account for you (for example, to add you as a scheduler or match
officer on an existing event), they create it for you and assign the appropriate role. You will
receive the email and password to sign in with.

## Signing in

1. Go to `/login`.
2. Enter your email and password.
3. You land in the workspace most relevant to your role:
   - **Event Admin / Super Admin** → the Event Admin dashboard
   - **Scheduler** → the Scheduler
   - **Match Officer** → the Match Officer match list
   - **Content Admin** → the Content Desk
   - **Draw** → Entries
   - **Registration** → the Approval Queue

## Resetting a forgotten password

1. On the sign-in page, choose **Forgot password** (or go to `/forgot-password`).
2. Enter your email. If an account exists, a reset link is emailed to you.
3. Open the link (it goes to `/reset-password`), set a new password, and you are signed in.

## The workspace layout

Every staff page shares the same shell:

- **Left sidebar** — grouped navigation (Event Setup, Registration, Operations, Reports, Content).
  You only see the groups your role can use.
- **Sidebar footer** — the **Active event** switcher and your account info.
- **Main area** — the page you are on.

Some pages open in a **focus view** — a full-screen layout with its own header and a **back** link
instead of the sidebar. The New Event Wizard and the Live Score screen use this.

### Sidebar groups at a glance

| Group | Sections | Roles |
|---|---|---|
| **Event Setup** | Dashboard, Event Details, Create New Event, Facilities & Venues, Rulesets, Appearance, Sponsors | Event Admin |
| **Registration** | Clubs, Participants, Entries, Approval Queue | Event Admin, Draw, Registration |
| **Operations** | Command Center, Scheduler, Match Officer, Matches | Event Admin, Scheduler, Match Officer |
| **Reports** | Standings, Brackets, Analytics, Medal Tally | Event Admin, Scheduler, Draw |
| **Content** | Content Desk (Articles, Announcements, Media Library) | Event Admin, Content Admin |

See [Roles & Permissions](/roles-and-permissions/) for exactly what each role can do.

## The active event

InTourney can hold many events at once. Almost everything in a workspace — clubs, players, entries,
matches, the schedule, standings — belongs to **one event**. So each workspace has a single
**active event**: the one you are currently working on.

- Switch it with the **Active event** dropdown in the sidebar footer. Your choice is remembered
  between sessions.
- An event whose setup was never finished is labelled **· draft** in the dropdown.
- When you create a new event, it automatically becomes your active event.
- If you have never picked one, InTourney selects your earliest-starting event.

If a page says **"No active event"**, either you have not created one yet, or the event you were
working on is no longer accessible to you — pick another from the switcher or create one.

## The Advanced Data Administration panel

InTourney is built on a content management system that also exposes a low-level administration panel
at `/admin`. **You should not need it for normal work** — every routine task has a guided page in
the workspace. The panel is there for rare bulk corrections and for Super Admins. Changes made there
skip some of the guidance and validation the workspace pages provide, so prefer the workspace.

## Next step

Ready to run an event? Go to [Creating an Event](/creating-an-event/).
