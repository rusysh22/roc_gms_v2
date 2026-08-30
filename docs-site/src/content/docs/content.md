---
title: "Content"
description: "Articles, announcements, the media library, and match documentation."
sidebar:
  order: 8
---


The **Content Desk** (`/workspaces/content-admin`) is where you prepare everything that appears in
the reading and news parts of the public event site. Roles: **Content Admin**, **Event Admin**,
**Super Admin**.

It has four areas:

## Dashboard

An overview of drafts in progress, items awaiting review, and recently published content.

## Articles — `/workspaces/content-admin/articles`

Longer-form pieces — previews, recaps, features. Each article has a **status**:

| Status | Meaning |
|---|---|
| **Draft** | Being written; not public |
| **Review** | Ready for someone to check |
| **Published** | Live on `/events/<slug>/articles` |

Create one with **New**, edit it at `/workspaces/content-admin/articles/<id>`, and set its status
when it is ready.

## Announcements — `/workspaces/content-admin/announcements`

Short, time-sensitive notices — schedule changes, venue notes, weather calls. Same
Draft → Review → Published status flow. Published announcements appear on
`/events/<slug>/announcements` and in the combined **Updates** feed, and the most recent ones are
surfaced on the event home page.

An announcement can be **scoped** — attached to a specific sport or category — so it only shows on
the relevant pages.

## Media Library — `/workspaces/content-admin/media`

The shared pool of uploaded images used by articles, announcements, event branding, and sponsors.
Uploads are checked against a size and file-type allowlist.

---

## Match documentation

Separately from the Content Desk, each match has its own **Documentation** section on the Match
Details page (`/workspaces/matches/<match-number>`) — see
[Running Match Day](/running-match-day/#scores-and-documentation-match-details). Use it to attach
score sheets, incident photos, and referee reports to the match record. The **Analytics** page
tracks documentation completion across the event.
