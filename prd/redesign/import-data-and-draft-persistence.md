# New Event Wizard — Unified Excel Import + Draft Persistence

Owner: Rusydani
Status: **DR — MVP shipped** · **DR-2 — MVP shipped** · **IMP MVP + part of IMP-2 shipped** · dropdowns / Registrations sheet / CSV / IMP-3 not started

Shipped 2026-08-30 (DR-2 — resume discoverability):
- `src/lib/wizardProgress.ts` — one shared `deriveWizardProgress` / `computeWizardProgress`
  (extracted from the wizard page's inline step-completion logic, now unit-tested) that answers
  both "which steps are done?" and "which step should a returning organizer resume at?".
- New Event Wizard: with `?eventId=` but no `?step=`, the wizard now opens at the **first
  incomplete step** instead of always `sports`. `WizardStepMemory` records the last-viewed step per
  event in `localStorage`.
- Event Admin landing (`workspaces/(shell)/event-admin`): a **"Setup in progress" card** + a
  **"Resume Setup"** hero button appear whenever the active event's wizard is unfinished. The
  button (`ResumeSetupLink`) targets the server-computed first-incomplete step, upgraded on mount
  to the `localStorage` last-viewed step when present.
- `EventSwitcher`: draft events are labelled `· draft` so an admin juggling several events can see
  which still needs setup.

Shipped 2026-08-29:
- DR: `WizardFormDraft` (replaces `UnsavedChangesGuard`) autosaves the Event step to `localStorage`
  and offers an opt-in restore banner; keeps the `beforeunload` guard.
- IMP MVP: `Sports` + `Categories` sheets in the template and importer (upsert by slug, ordered
  before participants); "Download template for this event" (prefilled) at `…/new-event/data-template`;
  preview shows create/update per sheet for all entities.
- IMP-2 (partial): `Rulesets` sheet added (parser, template, prefilled template, importer — upsert
  by slug, ordered Sports → Rulesets → Categories; category `ruleset_name` resolves against it).
  Clubs and Teams moved to full upsert-by-slug (edited re-import updates in place).
- IMP-2 dropdowns: `eventDataTemplate.ts` rewritten on **`exceljs`** (added as a dependency;
  `serverExternalPackages` in `next.config.mjs`). The "template for this event" now has a hidden
  `_Reference` sheet and list `dataValidation` on every relationship/enum column — strict for enums,
  `warning` style on `category_name` so comma-separated multi-category cells still work. The blank
  template and the import parser stay on `xlsx` (community build can't write validations; the parser
  reads exceljs output fine).

Still pending: explicit `Registrations` sheet, downloadable CSV of the issue list, upsert for
Players/Pairs (need a stable per-person key — `identification_number`), and all of IMP-3.
Created: 2026-08-29
Relates to: `NOVICE_ADMIN_FLOW_UX_REDESIGN.md` (items 1, 2, 8), `prd/decision-log.md`,
`src/app/(frontend)/workspaces/(focus)/event-admin/new-event/`

---

## 1. Why this exists

Two separate pain points in the **New Event Wizard**, both about *not making the organizer redo
work*:

1. **Import is fragmented and starts from a generic template.** Sports and Categories are still
   created one row at a time in the wizard. Only Clubs/Teams/Players/Pairs can be bulk-imported, and
   the template is a fixed generic example — it does not know which sports/categories this event
   actually runs, so the organizer still has to hand-type every `category_name` cell and hope it
   matches. The stated goal: *"ketika import data dan sudah tahu category dan game apa saja yang
   dimainkan, dengan mudah dirancang di Excel, bisa export template (contoh datanya) dan import
   dengan mudah."*

2. **A refresh mid-form loses everything.** Every wizard form is a plain uncontrolled
   `<form action={serverAction}>` with no client state. `UnsavedChangesGuard` only fires the
   browser's native `beforeunload` prompt — it does nothing for an actual reload, a crash, a dead
   battery, or an accidental in-app navigation. A half-filled Event step (name, dates, timezone,
   location, organizer, logo) is gone. The only existing recovery is the query-string round-trip
   that `createEventAction` does *on a validation error* — there is no recovery for anything else.

This doc specifies both. They ship as two independent tracks:

- **DR** — Draft persistence / autosave-and-restore for wizard forms.
- **IMP** — Unified "Import event data" workbook (Sports, Rulesets, Categories, Clubs, Teams,
  Players, Pairs, Registrations) with a context-aware template export.

---

## 2. Track DR — Draft persistence

### 2.1 Principle

> A browser refresh, tab crash, or accidental navigation must never force the organizer to retype a
> form they had not yet submitted.

Recovery is **opt-in on the user's side** (a restore banner they accept), never a silent
auto-repopulate — a silently-restored form that the user thought was blank is its own trap.

### 2.2 Scope

| Form | Persist? | Notes |
|---|---|---|
| **Event step** (`EventStep`) | ✅ MVP | Highest cost to retype. name, slug, start, end, timezone, location, organizer, + Setup Assistant hidden fields. |
| Setup Assistant (`SetupStep`) | ✅ (free) | Already a GET form; its answers already ride the query string into the Event step. Persist alongside the Event draft. |
| Sports / Categories / Clubs / Teams / Players add-forms | ⬜ Later | Each is a short single-purpose form against an existing event; lower retype cost. Same component, applied later. |
| File inputs (event logo, import file) | ❌ Never | The browser does not allow programmatic restore of `<input type=file>` for security reasons. The restore banner explicitly says *"re-attach your logo"*. |

### 2.3 Mechanism

A client component **`WizardFormDraft`** (evolution of `UnsavedChangesGuard` — keeps its
`beforeunload` guard, adds persistence):

```
<WizardFormDraft storageKey="new-event:event-step" fieldNames={[...]}>
  <form action={createEventAction}> … </form>
</WizardFormDraft>
```

**Save (autosave):**
- Listen for `input` / `change` events bubbling out of the wrapped subtree.
- Debounce ~400 ms, then serialise the *named* form controls (skipping `type=file` and `type=password`)
  to `localStorage` under `storageKey` as `{ savedAt: <ISO>, values: { name: value, … } }`.
- Also keep the existing dirty flag for the `beforeunload` prompt.

**Restore (on mount):**
- If a draft exists **and** it is non-trivial (at least one non-empty value) **and** the live form is
  still at its defaults (don't clobber an error-bounce repopulate, which already carried values in via
  props/query) → render a dismissible banner:

  > **Melanjutkan draft sebelumnya?** Kami menyimpan isian form ini dari `<relative time>`.
  > [ Pulihkan ]  [ Buang draft ]

- **Pulihkan**: for each saved field, find the control by `name`, set its value via the native value
  setter, and dispatch a bubbling `input` event so React-controlled inputs (`EventNameSlugFields`)
  pick it up. Then hide the banner.
- **Buang draft**: `localStorage.removeItem(storageKey)`, hide the banner.

**Clear:**
- On `submit` of the wrapped form (capture phase) → remove the draft. A successful submit redirects
  away; a failed one re-renders server-side with values already in props, so a stale draft would only
  cause a confusing double "restore?" prompt.
- Also clear if the draft is older than **7 days** (`savedAt` check on mount) — stale enough that
  restoring it is more likely wrong than right.

### 2.4 Storage key scheme

`new-event:event-step` — no event id (the Event step runs *before* an event exists). Later per-event
forms would use `new-event:<eventId>:<formKey>`.

Only one Event draft can exist at a time; starting a second event before finishing the first
overwrites it. Acceptable — the wizard is single-flow.

### 2.5 Privacy / safety notes

- `localStorage` is origin-scoped and stays on the device; nothing is sent anywhere. Fine for event
  metadata (names, dates). No participant PII is ever in the Event step.
- Wrap every `localStorage` read/write in `try/catch` — private-mode browsers and storage-blocked
  contexts throw on access. A storage failure degrades to "no draft persistence", never a crash.

### 2.6 Server-side companion (optional, later)

The client draft covers the 95% case (same browser, same device). A fuller version would let
`createEventAction`, on *any* early failure, also stash the payload in a short-lived `event-drafts`
cookie or collection so a different device can resume. **Out of scope for DR MVP** — noted so the
client-only approach is a deliberate first step, not an oversight.

---

## 2b. Track DR-2 — Resume discoverability

### 2b.1 The gap DR MVP left open

DR MVP protects the **Event step** (before an event row exists). But the more common confusion
happens *after* the event is created: the organizer gets three or four steps into the wizard, closes
the tab, and comes back the next day with **no idea where to go**. Everything they did is safely in
the database (`status=draft`), yet:

- The Event Admin landing led with *"Create Another Event"* — nothing said "you have one half-built".
- Opening the wizard again (`?eventId=…`, no `step`) always dumped them at `sports`, step 3, even if
  they were on Draw & Seeding.
- The `EventSwitcher` listed every event by name with no draft/finished distinction.

So: yes, the event *can* be continued from the management page — but only if the organizer already
knew to click into a specific setup-checklist row. DR-2 makes the way back **the first thing they
see**.

### 2b.2 Principle

> A half-finished event must advertise itself, and "continue" must land on the step that actually
> needs work — not the top of the flow.

### 2b.3 Mechanism (shipped MVP)

| Piece | What it does |
|---|---|
| `src/lib/wizardProgress.ts` | `deriveWizardProgress(counts)` (pure, tested) + `computeWizardProgress(payload, eventId)`. Single source of truth for step completion, extracted verbatim from the wizard page's former inline block. Also derives `firstIncompleteStep` (first of `sports → categories → participants → registration → draw → generate` not yet done; `bracket` once all done) and `completedTaskCount / totalTaskCount`. |
| Wizard default step | `?eventId=` + no `?step=` → open at `firstIncompleteStep`. Explicit `?step=` always wins (deep links, the post-create redirect). |
| `WizardStepMemory` (client) | Writes `roc:new-event:<eventId>:last-step` to `localStorage` on every step view. Renders nothing; storage wrapped in try/catch. |
| Event Admin landing | "Setup in progress — N of M steps done" card + a "Resume Setup" hero button, shown whenever `computeWizardProgress(activeEvent).isComplete === false`. |
| `ResumeSetupLink` (client) | Server-rendered href = `firstIncompleteStep`; on mount, upgraded to the `localStorage` last-viewed step if one is stored and valid. Progressive enhancement — no JS still resumes sensibly. |
| `EventSwitcher` | Appends `· draft` to any event still at `status=draft`. |

### 2b.4 Deliberately deferred

- **Global resume dock** (a strip in the workspace shell chrome, visible on *every* page, not just
  the Event Admin landing). Higher reach, but needs a spot in `WorkspaceShellChrome` and a
  dismiss-per-session rule — a second increment once the landing-page version proves the copy.
- **Multi-draft awareness.** If an admin has two unfinished events, only the *active* one surfaces
  its progress. Listing all drafts belongs with the "Copy from a previous event" work in IMP-3,
  which already needs an event picker.
- **Instant-draft** (create the event row the moment a name is typed, collapsing DR into DR-2).
  Attractive — it makes "refresh loses work" structurally impossible — but it can litter the events
  table with abandoned rows and needs a cleanup job + "draft" filtering everywhere events are
  listed. Revisit after DR-2 telemetry.

### 2b.5 Where export/import fits

The organizer's other "don't make me redo it" lever is the workbook (Track IMP). Two connections to
DR-2, both **deferred, noted here so they aren't rediscovered later**:

1. **Import step reachable from the landing.** The setup checklist should link participant/data
   steps straight to the wizard's Import step (`…/new-event?eventId=…&step=participants&tab=import`),
   and the prefilled "template for this event" download should be offered there too — not only
   inside the wizard.
2. **Export the event's real data as a re-importable workbook.** `buildEventDataTemplateWorkbook`
   already emits a *prefilled* template. A true round-trip export (every sport/category/club/team/
   player/entry as rows the importer's upsert can read back) turns the spreadsheet into a portable
   backup and is the mechanism behind IMP-3's "Copy from a previous event". Same engine, new entry
   point.

---

## 3. Track IMP — Unified "Import event data" workbook

### 3.1 Principles

| Principle | Why |
|---|---|
| **One workbook, all entities** | The organizer manages one `.xlsx`, not four. |
| **Sheets ordered by dependency** | `Sports → Rulesets → Categories → Clubs → Teams → Players → Pairs → Registrations`. The importer processes top-to-bottom so every cross-sheet reference resolves against rows already created earlier in the same run. |
| **Template mirrors *your* event** | Once Sports & Categories exist, the export pre-fills those sheets with the event's real rows, and every relationship cell (`sport_name`, `category_name`, `club_name`, enums) is a **dropdown** driven by a hidden `_Reference` sheet. The organizer *picks*, never types a name that has to match. |
| **Idempotent upsert** | Match by `slug` (name → `slugify`) scoped to the event. Re-uploading the same file makes no duplicates; an edited row updates in place. The spreadsheet can be treated as the source of truth and re-imported freely. |
| **One preview → confirm for the whole workbook** | A read-only dry run over the *same* resolution code the confirm uses. Per-sheet diff: `create / update / skip / warn`. Re-run fresh at confirm time (never trust the stale snapshot). |
| **Partial import** | An empty sheet is ignored. Import Sports + Categories now, participants next week — same file, same flow. |

### 3.2 Workbook structure

Sheet tab names are read verbatim by the parser — **do not rename tabs**.

#### `Instructions`
Human-readable: fill order, what each sheet is for, column rules, "delete the example rows",
"upload on the Import step".

#### `Sports`
| column | required | notes |
|---|---|---|
| `name` | ✅ | key (slugified, unique per event) |
| `sport_type` | ✅ | dropdown: `court`, `field`, `table`, `board`, `esport`, `track`, `other` (default `court`) |
| `description` | — | |
| `icon` | — | icon key or URL |

#### `Rulesets` (optional)
| column | required | notes |
|---|---|---|
| `name` | ✅ | key (unique per event) |
| `sport_name` | ✅ | must resolve to a `Sports` row / existing sport |
| `score_type` | ✅ | dropdown: `points`, `goals`, `sets`, `time`, `result`, `custom` |
| `set_based`, `allow_draw` | — | `yes`/`no` (blank = no) |
| `best_of`, `target_score`, `max_score` | — | numbers |

> MVP note: the `Rulesets` sheet is **deferred past the IMP MVP**. For MVP, a category's
> `ruleset_name` may only reference a ruleset that already exists in the event (created via the
> wizard). Full ruleset import lands in IMP-2.

#### `Categories`
| column | required | notes |
|---|---|---|
| `name` | ✅ | key (slugified, unique per event) |
| `sport_name` | ✅ | dropdown from `Sports`; unresolved → row skipped with a clear reason |
| `participant_mode` | ✅ | dropdown: `individual`, `pair`, `team`, `club`, `open`, `tbd` (default `open`) |
| `format_type` | ✅ | dropdown: `single_elimination`, `double_elimination`, `round_robin`, `group_stage_to_knockout`, `league`, `friendly`, `time_trial`, `score_ranking` (default `single_elimination`) |
| `ruleset_name` | — | dropdown; must match an existing ruleset for MVP |
| `status` | — | dropdown: `draft` (default), `open`, `locked`, `published`, `archived` |
| `roster_required` | — | `yes`/`no` |
| `min_roster_size`, `max_roster_size` | — | numbers |
| `group_qualify_count` | — | number; group-stage formats only |
| `third_place_policy` | — | dropdown: `none` (default), `match`, `shared` |
| `result_unit` | — | time-trial / score-ranking only |
| `medal_eligible` | — | `yes` (default) / `no` |
| `medal_weight` | — | number, default 1 |

#### `Clubs` / `Teams` / `Players` / `Pairs`
Unchanged from today's template (`participantsImportTemplate.ts`), including the
`category_name` register-on-import shortcut (comma-separated, multi-category). Column reference:

- **Clubs**: `name`✅, `contact_person`, `contact_email`, `category_name`
- **Teams**: `name`✅, `club_name`, `contact_email`, `category_name`
- **Players**: `name`✅, `club_name`, `email`, `phone`, `gender`
  (`male`/`female`/`other`/`prefer_not_to_say`), `identification_number` (unique per event),
  `photo` (URL), `category_name`
- **Pairs**: `player1_name`✅, `player2_name`✅, `team_name`, `club_name`, `category_name`

#### `Registrations` (optional — deferred to IMP-2)
An explicit alternative to per-row `category_name`, for when a participant enters many categories and
a row-per-registration list is easier to eyeball than one comma-stuffed cell.
| `participant_name` | `participant_type` (`player`/`team`/`club`) | `category_name` |

#### `_Reference` (hidden, generated only in the "this event" template)
Columns of allowed values (sport names, category names, club names, each enum) that the other
sheets' `dataValidation` dropdowns point at. Not parsed on import — purely an authoring aid.

### 3.3 Template export — two variants, one button

On the wizard's **Import** step, **"Download Excel template"** with a choice:

1. **Contoh (blank template)** — a small, coherent fictional multi-sport event across every sheet.
   For an organizer starting from nothing. This is today's `buildParticipantsTemplateWorkbook`,
   extended with `Sports` + `Categories` example sheets.

2. **Template event ini (prefilled)** — recommended once the event has ≥ 1 sport / category:
   - `Sports` and `Categories` sheets **pre-filled with the event's real rows** (so the organizer
     reviews/edits rather than re-enters).
   - Every relationship / enum column is an Excel **dropdown** sourced from `_Reference`.
   - 2–3 example rows on each participant sheet that use *this event's real category names*, each
     flagged `DELETE THIS EXAMPLE ROW`.

**Implementation note:** `dataValidation` dropdowns and cell protection are awkward with the current
`xlsx` (SheetJS community) build. Options: (a) hand-write the `!dataValidation` structures on the
worksheet objects, or (b) add `exceljs` for the template-build path only (import stays on `xlsx`).
Decision deferred; **MVP ships variant 2 prefilled but *without* dropdowns** (prefilled + flagged
example rows already removes most of the typing risk). Dropdowns are IMP-2.

### 3.4 UI flow

```
Wizard step "Import event data"  (rename/reframe of the current Participants step's import card)
│
├─ 1. Download template
│      ○ Contoh (blank)
│      ○ Template event ini (prefilled)   ← shown/recommended once sports or categories exist
│
├─ 2. Fill it in Excel (offline)
│
├─ 3. Upload .xlsx   →   previewImportAction  (dry run, writes nothing)
│
├─ 4. PREVIEW card
│      ┌───────────────────────────────────────────────┐
│      │ Sports        8 new    0 update   1 skipped   │
│      │ Categories    12 new   2 update   0 skipped   │
│      │ Clubs         5 new                           │
│      │ Teams         6 new                           │
│      │ Players       80 new   3 skipped              │
│      │ Pairs         4 new                           │
│      │ Registrations 140 entries will be created     │
│      │                                               │
│      │ ⚠ 12 warnings — View row-by-row details ▾     │
│      └───────────────────────────────────────────────┘
│      [ Cancel ]                        [ Confirm & import ]
│
└─ 5. Result banner: created / updated / skipped / registered counts
       + row-by-row issue list (downloadable as CSV in IMP-2)
```

Preview and confirm run the **same** planning function (mirrors today's `planParticipantsImport` /
`confirmParticipantsImportAction`, generalised to all sheets). The uploaded file is held in the
existing filesystem scratch dir (`media/import-scratch/<uuid>.xlsx`) between preview and confirm;
confirm re-parses and re-plans from scratch, then deletes the scratch file. Cancel just deletes it.

### 3.5 Import engine — order & resolution

Processed strictly in this order within one confirm:

1. **Sports** — upsert by `slug`. Build `Map<sportSlug, id>`. Invalid `sport_type` → warn + default
   to `court` (mirrors `addSportAction`).
2. **Rulesets** *(IMP-2)* — upsert by name; needs `sport_name` resolved from step 1.
3. **Categories** — resolve `sport_name` against step 1's map + sports already in the event. No
   match → skip row with reason. Upsert by `slug`. Unknown enum values → warn + fall back to the
   field default (never hard-fail the row). `ruleset_name` resolved against existing rulesets;
   unresolved → warn, saved without a ruleset.
4. **Clubs → Teams → Players → Pairs** — exactly as today (`club_name` optional and
   case-insensitive, `identification_number` unique per event, pairs matched by player name, etc.).
5. **Registrations / `category_name`** — collected during step 4, applied in one batch at the end
   (needs each referenced category's current entry count for correct running `seed_number` — same
   as today's `queueRegistration` + the trailing batch loop).

Rules carried over unchanged from the current importer:
- All name matching case-insensitive on trimmed values.
- Category mode must match the sheet type (a `Players` row can only register into an
  `individual`-mode category; ambiguous name across two categories → warn, don't guess).
- Per-row `skip` (nothing created) vs `warn` (created, with a caveat) distinction, surfaced as an
  actionable `{ sheet, name, reason }[]` list.
- Audit-logged: one `data.bulk_import` entry summarising counts + issues, plus per-doc
  `*.create` / `*.update` entries.

### 3.6 Upsert semantics (new vs today's create-or-skip)

Today the importer **creates or skips**. IMP moves Sports/Categories (and later the rest) to
**create or update**:

- Row whose `slug` matches an existing doc in the event → `payload.update` with the sheet's values
  (only columns present in the sheet; a blank optional cell means "leave unchanged" *unless* the
  column header is present and the organiser explicitly blanked a previously-set value — MVP keeps
  it simple: **blank optional cell = leave unchanged**, documented in `Instructions`).
- Row whose `slug` is new → `payload.create`.
- A category/sport that exists in the event but is **absent** from the sheet is **never deleted** by
  an import. Deletion stays a manual, guarded action (`deleteSportAction` / `deleteCategoryAction`).

Preview must show `update` counts distinctly from `create` so a re-import's effect is legible.

### 3.7 Files touched (IMP MVP)

| File | Change |
|---|---|
| `src/lib/participantsImport.ts` | Parse `Sports` + `Categories` sheets; extend `ParsedParticipantsWorkbook`. |
| `src/lib/participantsImportTemplate.ts` | Add `Sports` + `Categories` example sheets; update `Instructions`. |
| `src/lib/eventDataTemplate.ts` *(new)* | `buildEventDataTemplateWorkbook(payload, eventId)` — prefilled variant. |
| `…/new-event/participants-template/route.ts` | Keep (blank template). |
| `…/new-event/data-template/route.ts` *(new)* | Prefilled "this event" template download. |
| `…/new-event/participantActions.ts` | Extend `planParticipantsImport` + `confirmParticipantsImportAction` with sports/categories (upsert, ordered first); extend preview redirect params; widen `empty_import` check. |
| `…/new-event/page.tsx` | `ParticipantsStep`: second download button, Sports/Categories rows in the preview `dl`, new error copy. Rename card to "Import event data". |

### 3.8 Roadmap

**IMP MVP (this pass):**
- `Sports` + `Categories` sheets in parser, template, planner, confirm (upsert).
- Prefilled "template event ini" (no dropdowns yet).
- Preview shows create/update/skip per sheet for all entities.

**IMP-2:**
- `dataValidation` dropdowns via `_Reference` (evaluate `exceljs` for the build path).
- `Rulesets` sheet + explicit `Registrations` sheet.
- Downloadable CSV of the issue list.
- Full upsert for Clubs/Teams/Players/Pairs.

**IMP-3:**
- Make "Import event data" a first-class entry point early in the wizard (the Setup Assistant's
  *"data saya di Excel"* answer routes here directly).
- "Copy from a previous event" reuses the same engine (export event A → import into event B).

---

## 4. Sequencing

DR and IMP are independent and can land in either order. DR is smaller and self-contained — ship it
first. Neither changes a Payload collection schema (IMP upsert uses existing fields; DR is
client-only).

## 5. Open questions

- DR: 7-day stale cutoff — right number?
- IMP: blank optional cell on a re-import = "leave unchanged" (MVP) vs "clear the value". MVP picks
  leave-unchanged; revisit if organisers report they can't un-set a field via the sheet.
- IMP: adopt `exceljs` for dropdown-capable templates, or hand-roll `!dataValidation` on `xlsx`
  worksheet objects?
- IMP: should `status` default for imported categories be `draft` (safe, matches wizard) or `open`
  (fewer post-import clicks)? MVP: `draft`.
