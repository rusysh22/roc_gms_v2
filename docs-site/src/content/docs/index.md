---
title: "InTourney Documentation"
description: "How InTourney is organized and where to start."
---


InTourney is a platform for planning and running multi-sport tournaments and games: company
sports days, inter-school competitions, community and public games, club leagues, and similar
events. It covers the whole lifecycle — from creating the event and importing participants, through
the draw and match generation, to match-day operations, results, standings, medals, and the public
event website.

This documentation is written for the people who **use** InTourney: event organizers and the staff
who help them run an event. It does not cover installation or server administration.

## How InTourney is organized

InTourney has two surfaces:

| Surface | Who it is for | URL shape |
|---|---|---|
| **Public event site** | Participants, spectators, media | `/events/<event-slug>` |
| **Staff workspaces** | Organizers and operational staff | `/workspaces/...` |

Everything staff do happens inside a **workspace**, and every workspace acts on one **active
event** at a time (see [Getting Started](/getting-started/#the-active-event)).

## Table of contents

1. [Getting Started](/getting-started/) — accounts, signing in, roles, the workspace layout, the active event
2. [Creating an Event](/creating-an-event/) — the New Event Wizard, step by step, and how to resume a half-finished setup
3. [Importing Event Data](/importing-event-data/) — the Excel workbook: sheets, columns, rules, and the preview/confirm flow
4. [Participants & Registration](/participants-and-registration/) — clubs, teams, players, rosters, entries, and public self-registration
5. [Draw & Match Generation](/draw-and-match-generation/) — seeding, formats, generating matches, group-to-knockout, brackets
6. [Running Match Day](/running-match-day/) — the Scheduler, Command Center, Match Officer, live scoring, results, and recalculation
7. [Publishing & the Public Site](/publishing-and-public-site/) — status and visibility, appearance, sponsors, and every public page
8. [Content](/content/) — articles, announcements, the media library, and match documentation
9. [Roles & Permissions](/roles-and-permissions/) — the full role reference and per-event access scoping
10. [Reference](/reference/) — glossary, status values, formats, and troubleshooting
11. [Worked Example](/worked-example/) — one company sports day taken through every step, with real values and clicks

New to InTourney? Read [Getting Started](/getting-started/), then follow the
[Worked Example](/worked-example/) alongside the feature chapters — it shows the whole flow with
concrete data instead of describing it in the abstract.

## Conventions used in this documentation

- **Bold** text that matches a button, menu item, or field label is written exactly as it appears in
  the interface.
- Paths like `/workspaces/event-admin` are the address you can type or bookmark in your browser.
- "Organizer" means anyone with the **Event Admin** (or **Super Admin**) role. Other roles are named
  explicitly where they matter.
