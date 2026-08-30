# New Event Wizard — Completion & Post-"Generate Matches" Flow

Owner: Rusydani
Status: **SHIPPED 2026-08-30** (commit `e319b67`)
Created: 2026-08-30

Shipped:
- `wizardProgress.ts` — group→KO `generate`/`bracket` done at group fixtures; `groupStageIds` input.
- GenerateStep — per-category "Continue to Publish →", "Fixtures generated" marker.
- GroupKnockoutPanel — Card 2 "Setup is done" panel + Continue button; Card 3 "X of Y … have a
  result" line, reframed as event-time.
- BracketStep — "You're set up" card (fixtures + optional schedule checklist + Matches-workspace
  note); primary "View public competition page"; publish/draft copy → public page.
- Verified: group fixtures ⇒ `isComplete: true`, no "Resume Setup" on Event Admin landing.

---

## 1. Problem

After an organizer clicks **Generate Matches** in the New Event Wizard, the flow stops making
sense — especially for `group_stage_to_knockout` (and, to a lesser degree, every format):

1. **The wizard says it isn't finished.** `computeWizardProgress` marks the `generate` / `bracket`
   steps "done" for a group→KO category only once **knockout-stage matches exist**. Knockout
   matches can only be created after the group matches have been *played and scored*, which does
   not happen during setup. So the stepper sits below 100%, `firstIncompleteStep` keeps pointing
   at `generate`, and the "Resume Setup" button on the Event Admin landing never goes away.

2. **A blocking-looking wall.** The `GroupKnockoutPanel` shows a prominent **"Finalize & lock
   group stage"** button, disabled, under the line _"Every group match needs a published result
   before finalizing."_ To a first-time organizer this reads as _"you cannot continue"_, not
   _"this happens later, when the event runs"_.

3. **No exit to the finish line.** There is no clear "you're done setting up — go here next"
   moment. The Publish card is buried at the bottom of the `bracket` step behind a bracket view
   that, for an un-promoted group→KO category, shows only a round-robin fixture list.

4. **Schedule vs. result confusion.** Generating fixtures creates *pairings* only — every match is
   `ready_for_scheduling` with no date / venue / court. Organizers don't realise the schedule is a
   separate, still-optional step (the Excel round-trip), and they conflate "enter the schedule"
   with "enter the results".

### Root cause

The wizard's definition of "done" includes work that is **not setup**. Playing matches, entering
results, finalizing group standings and promoting to the knockout are **event-time operations**
that belong to the Matches / Scheduler workspaces during the tournament — not to the one-sitting
setup flow.

---

## 2. Target model

> **Wizard setup is complete when: every category has its fixtures generated, (optionally) a
> schedule, and the event has been published.** Everything after that — results, group
> finalization, knockout promotion — is done later, from the running-event workspaces, and the
> public pages update themselves.

### 2.1 What "done" means per step (after this change)

| Step           | Done when…                                                                                          |
|----------------|----------------------------------------------------------------------------------------------------|
| sports         | ≥ 1 sport (unchanged)                                                                              |
| venues         | always (optional step, unchanged)                                                                  |
| categories     | ≥ 1 category (unchanged)                                                                            |
| participants   | ≥ 1 club/team/player (unchanged)                                                                    |
| registration   | every non-draft category has ≥ 2 confirmed entries (unchanged)                                      |
| draw           | same criterion as registration (unchanged)                                                          |
| generate       | **every generate-ready category has its first-round / group fixtures generated** — see 2.2          |
| bracket        | same as `generate` (it's the review+publish step; nothing new to *do* once fixtures exist)          |

### 2.2 `generate` "done" rule change

| Category format                         | OLD "done" signal                          | NEW "done" signal                          |
|-----------------------------------------|--------------------------------------------|--------------------------------------------|
| single/double elim, round robin, ranking| a match exists for the category            | *unchanged*                                 |
| `group_stage_to_knockout`               | a match on the **knockout** stage (order 2)| **a match on the group stage (order 1)**    |

Group-stage finalization and knockout promotion no longer gate wizard completion. They remain
available in the `GroupKnockoutPanel`, reframed as event-time actions.

### 2.3 The three post-generate tasks, ranked

1. **Set the schedule** (dates / times / courts) — *setup, optional*. Done via the existing Excel
   export → edit → import round-trip. Prominent on the `bracket` step.
2. **Publish** — *setup, the finish line*. The 3-option Publish card. After publishing, the
   organizer is sent to / pointed at the public competition page.
3. **Run the event** — *not setup*. Enter results (Matches workspace / quick-score form),
   finalize groups, promote to knockout. The wizard only *mentions* this; it never blocks on it.

---

## 3. Functional spec

### 3.1 `computeWizardProgress` / `deriveWizardProgress` (`src/lib/wizardProgress.ts`)

- `isGenerateDone(category)`:
  - `group_stage_to_knockout` → `categoriesWithGroupMatches.has(id)` where
    `categoriesWithGroupMatches` is derived from matches whose `stage_id` is a **group stage**
    (order 1) for that category. Reuse the `matches` list already passed in; add a
    `groupStageIds` input array alongside the existing `knockoutStageIds` (or replace it).
  - all other auto-generate formats → unchanged (`categoriesWithMatches.has(id)`).
- `knockoutStageIds` input: keep it only if still needed elsewhere; the "promoted" state is no
  longer part of progress. If nothing else reads it, remove it and the extra `stages` query in
  `computeWizardProgress`.
- Unit tests (`wizardProgress.test.ts`): update the group→KO cases — "group fixtures generated →
  `generate` + `bracket` done; promotion not required". Keep a case asserting promotion is *not*
  needed for completion.

### 3.2 Wizard page (`…/new-event/page.tsx`)

- No structural change to `completedSteps` wiring (already delegated to `computeWizardProgress`).
- **GenerateStep**: after a category's fixtures are generated (any format), show a clear
  **"Continue to Publish →"** primary action in that category's row / panel, linking to
  `?step=bracket&categoryId=<id>`. For non-group formats the existing redirect already lands on
  `bracket`; this is mainly for `group_stage_to_knockout`, whose actions redirect back to
  `step=generate`.
- **GenerateStep**, group→KO category, once group fixtures exist: a short info line —
  _"Group fixtures are ready. You can publish now; play the group matches and record results
  during the event, then come back to this panel to finalize and promote to the knockout."_

### 3.3 `GroupKnockoutPanel` (`…/new-event/GroupKnockoutPanel.tsx`)

Four cards today: (1) Groups & qualifiers, (2) Group matches, (3) Standings & finalize,
(4) Promote to knockout. Changes:

- **Card 2 (Group matches)** — after fixtures exist, the intro becomes an explicit
  _"Setup is done for this category"_ panel (already drafted): fixtures created; the rest happens
  when the event runs; you may leave the wizard and resume later; here is how results are entered
  (Matches workspace for live events, the inline score form for a small self-run stage).
  Add a **"Continue to Publish →"** button here.
- **Card 3 (Standings & finalize)** — retitle the section framing from a setup step to an
  event-time step. When not all group matches are decided, replace the scary
  _"Every group match needs a published result before finalizing"_ with:
  _"Finalize once every group match has been played (N of M have a result so far). This is done
  during the event — it decides who advances to the knockout."_
  The **Finalize** button stays disabled until all decided; that guard is correct and unchanged.
- **Card 4 (Promote to knockout)** — unchanged behaviour; copy already implies it's post-finalize.
- The inline quick-score form (`recordGroupMatchResultAction`) stays exactly as is.

### 3.4 BracketStep / Publish (`…/new-event/page.tsx`)

- **Publish card**: unchanged 3 options. After a successful publish (`?wizardPublished` /
  redirect), the destination copy / CTA changes:
  - `info` / `full` → redirect already goes to `/events/<slug>`; keep it, but the wizard's
    pre-publish copy should say _"Publishing takes you to your public competition page."_
  - `draft` → stays in the wizard; the info banner gains a link:
    _"Saved as draft — [preview the public page]"_.
- **New "You're set up" summary** on the `bracket` step, above Publish, shown once
  `progress.isComplete` (i.e. all fixtures generated): a short checklist —
  - ✅ Sports, categories, participants
  - ✅ Fixtures generated for N categories
  - ⬜ / ✅ Schedule set (dates & courts) — links to the Excel card
  - ➡️ Publish below, then check your public page
  - ℹ️ During the event: enter results in the **Matches** workspace — brackets & standings update
    automatically.
- The `bracket` step's `StepActions` (currently "Generate another category / Go to Scheduler / Go
  to Brackets Workspace") gains a primary **"View public competition page"** button (→
  `/events/<slug>`), and the workspace links stay as secondary.

### 3.5 Event Admin landing (`workspaces/(shell)/event-admin`)

- No code change needed if 3.1 is correct: once fixtures are generated the event's
  `progress.isComplete` is true, so the "Setup in progress" card and "Resume Setup" button
  disappear on their own. **Verify** this in testing with a group→KO event that has group
  fixtures but no promotion.

---

## 4. UI / UX spec

### 4.1 Copy principles

- Never say "finish"/"complete" about playing matches. Setup finishes at publish.
- "Fixtures" = the pairings (who plays whom). "Schedule" = when/where. "Results" = scores. Use
  these three words consistently and never interchangeably.
- The group finalize/promote area uses future/conditional tense ("once the matches have been
  played", "during the event") — not imperative ("you must").

### 4.2 GenerateStep — per category row, after generating

```
┌───────────────────────────────────────────────────────────────┐
│ Men's Doubles            group stage → knockout · 7 entries    │
│ Group fixtures: 9 created                                      │
│                                                               │
│ ✅ Fixtures ready. Publish whenever you like — results and the │
│    knockout bracket are filled in as the event runs.          │
│                                            [ Continue to Publish → ] │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 GroupKnockoutPanel — Card 2 header (fixtures exist)

Tinted info panel (already drafted in code):

> **Setup is done for this category** — the group fixtures below are created. The rest happens
> *when the event runs*: these matches get played and their results entered, then you come back
> here to finalize the standings and promote the top **2** of each group to the knockout. You can
> leave the wizard now and resume from the Event Admin page later.
>
> Entering results: during a live event use the **Matches workspace** (live points, per-set,
> referees). If you're running a small group stage yourself, just type each final score below once
> the match is played.

`[ Continue to Publish → ]`

### 4.4 GroupKnockoutPanel — Card 3 (Standings & finalize)

- Title stays "Standings & finalize".
- Sub-copy: _"Standings update live as results come in. **Finalize during the event, once every
  group match has been played** — it locks the standings and marks who advances to the knockout."_
- Progress line (replaces the gold warning): `3 of 9 group matches have a result.`
- Button: `Finalize & lock group stage` — disabled until 9/9. Tooltip/hint on disabled:
  _"Available once every group match has a result."_

### 4.5 BracketStep — "You're set up" summary (new card, above Publish)

```
┌── You're set up ──────────────────────────────────────────────┐
│ ✅  Sports, categories, participants                          │
│ ✅  Fixtures generated — 3 categories                         │
│ ⬜  Schedule (dates & courts) — optional   [ Set schedule ]   │
│                                                              │
│ Next: publish below, then open your public competition page. │
│                                                              │
│ During the event, enter results in the Matches workspace —   │
│ the public bracket and standings update automatically.       │
└──────────────────────────────────────────────────────────────┘
```

- "Schedule" row is ✅ when any match in the event has `scheduled_start_at` set, else ⬜.
- `[ Set schedule ]` scrolls to / anchors the existing "Adjust dates, times & courts (Excel)" card.

### 4.6 Publish card + after

- Pre-publish helper text gains: _"'Publish event & schedule' takes you straight to your public
  competition page."_
- `bracket` step `StepActions`: `[ View public competition page ]` (primary) ·
  `Generate another category` · `Go to Scheduler` · `Go to Brackets Workspace` (secondary).

---

## 5. Technical spec

### 5.1 Files & changes

| File | Change |
|------|--------|
| `src/lib/wizardProgress.ts` | `deriveWizardProgress`: group→KO `isGenerateDone` uses group-stage matches. Add `groupStageIds` to `WizardProgressInput` (or derive group-vs-knockout from a `stages` map). `computeWizardProgress`: fetch order-1 `group_stage` stage ids for group→KO categories (one query, alongside or replacing the existing knockout-stage query). |
| `src/lib/wizardProgress.test.ts` | Update group→KO fixtures. Assert: group fixtures ⇒ `generate`+`bracket` done, `isComplete` true; promotion NOT required. |
| `…/new-event/page.tsx` — `GenerateStep` | Per-category "Continue to Publish →" once fixtures exist; group→KO info line. |
| `…/new-event/page.tsx` — `BracketStep` | New "You're set up" summary card above Publish; `scheduleIsSet` flag (any event match has `scheduled_start_at`); primary "View public competition page" action; publish helper copy. |
| `…/new-event/GroupKnockoutPanel.tsx` | Card 2 info panel + "Continue to Publish →"; Card 3 copy + `X of Y` progress line replacing the gold warning; disabled-button hint. (Card 2 info panel edit already in progress — keep.) |
| `…/new-event/page.tsx` — `errorMessages` | none new expected; keep `invalid_result` / `result_locked` / `result_tie_needs_winner` from the quick-score feature. |
| `prd/redesign/import-data-and-draft-persistence.md` | add a "shipped" line pointing at this doc when done. |

### 5.2 `wizardProgress` data flow

Current `computeWizardProgress` fetches: sports count, categories, clubs/teams/players counts,
confirmed entries, all matches, and (conditionally) order-2 `single_elimination` stage ids.

New requirement: for each group→KO category, know its **group** stage id (order 1). Options:

- **A (minimal):** add a second conditional query for order-1 `group_stage` stages of this event,
  pass `groupStageIds` into `deriveWizardProgress`; `isGenerateDone` for group→KO becomes
  `input.matches.some(m => groupStageIds.has(String(m.stage_id)) && String(m.category_id) === id)`.
- **B:** one `stages` query (all stages for the event's categories), build
  `Map<categoryId, {groupStageId?, knockoutStageId?}>`, drop the knockout-only query. Cleaner,
  one extra query instead of two conditionals.

Prefer **B**.

### 5.3 `scheduleIsSet` in BracketStep

```ts
const scheduleIsSet = eventMatches.docs.some((m) => Boolean(m.scheduled_start_at))
```
`eventMatches` is already fetched in `BracketStep` (or fetch a `payload.count` with
`where: { and: [{ event_id }, { scheduled_start_at: { exists: true } }] }` — cheaper).

### 5.4 Non-goals / out of scope

- No change to match status lifecycle, `finalizeGroupStandingsAction`'s all-results guard,
  `promoteToKnockoutAction`, or the Scheduler import/export.
- No auto-advance of the wizard step on generate (keep explicit "Continue" buttons).
- No new "results entry" surface beyond the existing quick-score form.
- `advanceCategoryStatus` (draft→open→locked→published) is unchanged; note that a group→KO
  category reaches `locked` on group-fixture generation (already wired) and `published` on event
  publish — consistent with "setup done at publish".

### 5.5 Test / verification checklist

- [ ] `wizardProgress.test.ts` green; new group→KO assertions.
- [ ] `tsc --noEmit` clean, `vitest run` green.
- [ ] Manual (event 5 / "Men's Doubles", group→KO, groups already created):
  - [ ] Generate group matches → GenerateStep shows "Continue to Publish →".
  - [ ] Stepper reads 100% / no "Resume Setup" on Event Admin landing.
  - [ ] `bracket` step shows "You're set up" card; schedule row ⬜.
  - [ ] Set a schedule via Excel → schedule row flips ✅.
  - [ ] Publish "event & schedule" → lands on `/events/rusydani`.
  - [ ] Back in wizard: GroupKnockoutPanel Card 3 shows `0 of 9 …`; Finalize disabled; no scary red.
  - [ ] Enter all 9 scores (quick form) → Finalize enables → finalize → promote → knockout bracket
        renders; wizard still 100% throughout.
- [ ] Regression: a single-elimination category still marks `generate`/`bracket` done on first
      generation and lands on `bracket`.
