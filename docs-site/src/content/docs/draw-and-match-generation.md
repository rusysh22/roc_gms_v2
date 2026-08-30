---
title: "Draw & Match Generation"
description: "Seeding, formats, generating matches, group-to-knockout, and brackets."
sidebar:
  order: 5
---


Once a category has its confirmed entries, you set the draw order and generate the fixtures. This is
wizard steps 7–9, plus the **Brackets** and **Standings** report pages.

## Seeding (wizard step 7 — Draw & Seeding)

A **seed** is the order an entry is placed in the draw. Lower numbers are kept apart in the early
rounds so the strongest entries do not meet too soon.

- Every entry gets a seed number automatically when it is registered.
- In **Draw & Seeding**, switch to a category and adjust the numbers, or **shuffle** them randomly
  for an unseeded draw.
- Each entry's seed must be unique within its category. If two share a number, InTourney asks you to
  fix it before continuing.

Add or remove entries in the Registration step, not here.

## Generating matches (wizard step 8 — Generate Matches)

Pick a category with **at least two confirmed entries**. What happens depends on the format:

### Single Elimination / Round Robin / Double Elimination / Time Trial / Score Ranking

One click generates the fixtures:

- **Single Elimination** — a seeded first-round bracket. Byes are given to the top seeds when the
  entry count is not a power of two.
- **Round Robin** — every entry plays every other entry once.
- **Double Elimination** — needs a power-of-two entry count.
- **Time Trial / Score Ranking** — one attempt per entry, ranked by the recorded result.

InTourney shows an estimate of how many matches will be created and how many courts are available
for that sport before you commit.

> **Example** — Men's Singles has 16 confirmed entries. On **Generate Matches** the preview reads
> *"Will generate: 8 first-round matches · 2 courts available for this sport."* One click produces a
> seeded 16-draw (#1 vs #16, #8 vs #9, …). Mixed Doubles has 6 pairs, so generation makes a 6-pair
> bracket where the top 2 seeds get a first-round bye. Chess Open (6 players, round robin) produces
> 15 matches.

### Fixing a draw — Clear & regenerate

Generation is **additive** — running it again only fills in matches that failed the first time. To
rebuild a draw properly (you fixed seeds, a late entry came in, you changed the format), use
**Clear & regenerate** on the category row. It deletes every generated match, group, and cached
bracket/standings for that category so you can generate fresh.

It refuses once **any match in the category has started** — a match with a real result must go
through the [match lifecycle](/running-match-day/#the-match-lifecycle), not a bulk delete.

### Group Stage to Knockout

This format has its own **Groups & qualifiers** panel:

1. **Create groups** and choose how many entries **qualify per group**.
2. **Distribute entries** into the groups (seeded or manual).
3. **Generate group matches** — a round robin within each group.
4. Play the group stage. Every group match needs a **published result**.
5. **Finalize & lock group stage** — computes the standings and the qualifiers.
6. **Promote to knockout** — builds the knockout bracket from the qualifiers.

Steps back:

- Change the **Total groups** number down to remove empty groups (a group with an entry or a
  match must be emptied first).
- **Reopen group stage** — after Finalize but *before* Promote, if a group result was wrong. It
  clears the qualifier marks so you can fix the result and finalize again.
- **Undo Phase** — after Promote: deletes the knockout matches and unlocks the group stage, while
  no knockout match has started.
- **Clear & regenerate** on the category row wipes everything (groups, matches, standings) for a
  full restart.

### League / Friendly

Not generated here. Create and schedule these matches by hand in the
[Scheduler workspace](/running-match-day/#scheduler).

### If there are no courts yet

Matches still generate, but they have nowhere to be scheduled. Add at least one venue and court
under **Event Setup → Facilities & Venues** (see [Running Match Day](/running-match-day/)).

## Reviewing fixtures (wizard step 9 — Bracket)

Switch between categories to review the generated bracket or fixture list.

### Per-stage ruleset override

A category normally uses one ruleset throughout. If a single stage needs different rules — best-of-3
in the group stage but best-of-5 in the final — set a **ruleset for this stage** here. Leave it on
**Inherit from category** otherwise. The individual match records always remain the source of truth
for status, score, and winners.

## The report pages

These recompute cached views from the current match data. They do not change any match — the matches
are always the source of truth.

| Page | What it does |
|---|---|
| **Reports → Brackets** (`/workspaces/brackets`) | Recalculate the cached bracket layout for a single- or double-elimination stage from its matches. |
| **Reports → Standings** (`/workspaces/standings`) | Recalculate cached standings for a group-stage or round-robin scope. |
| **Reports → Medal Tally** (`/workspaces/medals`) | Derive gold/silver/bronze from finished categories and rank contingents. Supports manual overrides per medal. |

You normally do not need to run these by hand — InTourney keeps them current as results are
published. Run them if you have made a bulk correction and want the cached views refreshed
immediately.

## Next step

With fixtures generated, you are ready for [Running Match Day](/running-match-day/).
