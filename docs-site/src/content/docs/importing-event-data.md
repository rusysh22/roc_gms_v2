---
title: "Importing Event Data"
description: "The Excel workbook: sheets, columns, rules, and the preview/confirm flow."
sidebar:
  order: 3
---


Instead of adding sports, categories, and participants one form at a time, you can prepare
**one Excel workbook** and upload it. The importer creates everything in the right order and ties it
all to the active event.

You reach the importer from the wizard's **Clubs / Teams / Players** step (step 5), in the
**"Import event data from Excel"** card.

## The two templates

| Button | When to use it |
|---|---|
| **Download blank template** | Starting from nothing. A small, complete example event across every sheet shows you what real data looks like once it is in the file. |
| **Download template for this event** | Recommended once you have added some sports and categories in the wizard. It comes back with your **Sports**, **Rulesets**, and **Categories** sheets already filled in, and every relationship/enum column is a dropdown so you pick values instead of typing names that have to match. |

Always start from a downloaded template — the sheet tab names and column headers must be exact.

## Workbook structure

The workbook has an **Instructions** sheet and up to seven data sheets. **Do not rename the tabs** —
the importer reads them by name. Fill them **top to bottom**; the importer processes them in this
order so that a later sheet can refer to something created by an earlier one, all in one upload:

```
Sports → Rulesets → Categories → Clubs → Teams → Players → Pairs
```

Any sheet you leave empty is simply skipped. You can import Sports and Categories now and
participants next week — same file, same flow.

### Sports

| Column | Required | Notes |
|---|---|---|
| `name` | Yes | The key. Re-importing the same name updates the sport instead of duplicating it. |
| `sport_type` | No | One of `court`, `field`, `table`, `board`, `esport`, `track`, `other`. Blank → `court`. |
| `description`, `icon` | No | |

### Rulesets (optional)

| Column | Required | Notes |
|---|---|---|
| `name` | Yes | Unique within the event. |
| `sport_name` | Yes | Must match a row on the **Sports** sheet or a sport already in the event. |
| `score_type` | Yes | One of `points`, `goals`, `sets`, `time`, `result`, `custom`. |
| `set_based`, `allow_draw` | No | `yes` / `no`. |
| `best_of`, `target_score`, `max_score` | No | Numbers. |

Skip this sheet to use each sport's default rules.

### Categories

| Column | Required | Notes |
|---|---|---|
| `name` | Yes | The key. |
| `sport_name` | Yes | Must resolve to a Sports row or an existing sport; unresolved rows are skipped with a reason. |
| `participant_mode` | Yes | `individual`, `pair`, `team`, `club`, `open`, `tbd`. |
| `format_type` | Yes | `single_elimination`, `double_elimination`, `round_robin`, `group_stage_to_knockout`, `league`, `friendly`, `time_trial`, `score_ranking`. |
| `ruleset_name` | No | Must match a ruleset in the workbook or the event. |
| `status` | No | `draft` (default), `open`, `locked`, `published`, `archived`. |
| roster / group / medal columns | No | `roster_required`, `min_roster_size`, `max_roster_size`, `group_qualify_count`, `third_place_policy`, `result_unit`, `medal_eligible`, `medal_weight`. |

Any unrecognized enum value falls back to the default **with a warning** — the row is never lost.

### Clubs / Teams / Players / Pairs

| Sheet | Required columns | Other columns |
|---|---|---|
| **Clubs** | `name` | `contact_person`, `contact_email`, `category_name` |
| **Teams** | `name` | `club_name`, `contact_email`, `category_name` |
| **Players** | `name` | `club_name`, `email`, `phone`, `gender` (`male`/`female`/`other`/`prefer_not_to_say`), `identification_number`, `photo` (URL), `category_name` |
| **Pairs** | `player1_name`, `player2_name` | `team_name`, `club_name`, `category_name` |

Rules:

- `club_name` on Teams/Players/Pairs is optional; if set it must match a Clubs row or an existing
  club (case-insensitive).
- `identification_number` on Players is optional but must be **unique within the event** if set. A
  duplicate fails only that one row. Use whatever ID your organization already has (student ID,
  member number, staff ID) or leave it blank.
- `photo` must be a URL to an image, not a file upload.
- `player1_name` / `player2_name` on Pairs must each match a Players row or an existing player;
  InTourney creates the two-player team for you. `team_name` defaults to "Player 1 / Player 2".

### The `category_name` shortcut

The `category_name` column on Clubs, Teams, Players, and Pairs does two things at once: it creates
the row **and** registers it as an entry into one or more categories — so you can skip the
Registration step for those participants.

- Each name must match (case-insensitive) a category that already exists in the event.
- The category's participant type must match the sheet (a Players row can only register into an
  `individual`-mode category).
- To enter the same row into **several** categories, list them in one cell separated by commas:
  `Badminton Singles Men, Badminton Doubles Men`. Each name is validated independently — if one does
  not match, only that registration is skipped (with a warning); the row and its other registrations
  are fine.

Leave the column blank to register participants manually later. Nothing breaks either way.

> **Example — a filled-in Players sheet**
>
> | name | club_name | gender | identification_number | category_name |
> |---|---|---|---|---|
> | Andi Pratama | Finance | male | EMP-0417 | Men's Singles |
> | Bima Sakti | IT | male | EMP-0091 | Men's Singles, Mixed Doubles |
> | Citra Larasati | Marketing | female | EMP-0233 | Mixed Doubles |
> | Eka Putri | HR | female | | Mixed Doubles |
>
> - Andi is added to the directory **and** entered into Men's Singles in one step.
> - Bima is entered into **two** categories from the one row (comma-separated).
> - Eka's `identification_number` is left genuinely blank — that is fine.
>
> And the matching **Pairs** sheet, which builds the doubles teams from those players:
>
> | player1_name | player2_name | club_name | category_name |
> |---|---|---|---|
> | Bima Sakti | Citra Larasati | IT | Mixed Doubles |
> | Eka Putri | Doni Kurnia | HR | Mixed Doubles |

## Preview and confirm

1. Upload your `.xlsx` file. InTourney runs a **dry run** — it writes nothing yet.
2. A **preview** shows, per sheet, how many rows will be **created**, **updated**, or **skipped**,
   plus a list of warnings you can expand row by row.
3. Click **Confirm & import** to apply it, or **Cancel** to discard the upload.

The confirm re-reads and re-plans the file from scratch, so the preview can never be stale.

> **Example — a preview with one problem to fix**
>
> ```
> Sports        0 new    3 update
> Categories    0 new    4 update
> Clubs         5 new
> Teams         2 new
> Players      40 new
> Pairs         6 new
> Registrations 28 entries will be created
>
> ⚠ 1 warning — View details ▾
>    Players · "Gilang" — identification_number "EMP-0155" already used by
>    "Doni Kurnia"; row created without an ID
> ```
>
> The organizer fixes Gilang's ID in the spreadsheet, re-uploads (Players now reads
> `39 update, 1 new`, no warning), and confirms.

## Idempotent re-import (upsert)

Sports, Rulesets, Categories, Clubs, and Teams are matched by name (slug) scoped to the event:

- A row whose name **matches** an existing record → the record is **updated** in place.
- A row whose name is **new** → a record is **created**.
- A record that exists in the event but is **absent** from the sheet is **never deleted** by an
  import. Deleting is always a separate, deliberate action.
- On a re-import, a **blank optional cell means "leave unchanged"**, not "clear the value".

This means you can treat the spreadsheet as the source of truth and re-upload an edited version
freely.

## After import

Every import writes one summary entry plus per-record entries to the event's **History** (step 10),
and the result banner shows how many rows were created, updated, skipped, and registered.
