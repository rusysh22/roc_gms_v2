# ROC GMS V2 - Public Redesign Plan (Draft)

Owner: Rusydani
Status: R0 (Design Foundation) and R1 (Public Landing & Navigation) complete; PD1-PD4 promoted to
`prd/decision-log.md` D020-D023; R2-R4 not started
Last updated: 2026-07-03
Relates to: `prd/README.md` (section 21, UX direction), `prd/implementation-plan.md` (Phase 6/7/8),
`prd/decision-log.md`

## 1. Why this exists

The current public pages (`src/app/(frontend)/page.tsx`, `src/app/(frontend)/styles.css`) render as
an internal status/checklist screen: no hero, no persistent navigation, one ~1,700-line hand-written
CSS file, system/Inter font stack. PRD section 21.2 says public users need fast answers to "what's
happening now / when do I play / where / what's the result / who won" — the current visuals do not
support that yet.

Before Phase 6 (Content, Announcements, Sharing) and Phase 7 (Public Edit Mode) add more public
surface area on top of the current styling, the base visual system should exist first, so those
phases are built on it once instead of being restyled twice.

This plan is a separate track, not a renumbering of `implementation-plan.md`. It only touches
presentation (CSS, components, layout, fonts) — no Payload collection/schema changes are implied by
anything in this document.

## 2. Direction requested (stakeholder notes, 2026-07-03)

- Move away from the current "generic CRUD/status tool" look toward a public-friendly, Olympic-style
  event site: hero landing section, schedule/standings/brackets front and center.
- Public content should read as low-technical / friendly, not operational — current tone is too close
  to an admin tool for a general office audience.
- Typeface: Plus Jakarta Sans.
- Palette: white, green, blue.
- Should feel noticeably interactive, not just static tables and forms.
- Explicit goal: have this settled before starting Phase 6 and Phase 7 work.

### 2.1 Style reference (added 2026-07-03)

Stakeholder shared a reference screenshot (a modern agency site) and confirmed: adopt the **style**,
not the layout or content. The style is the "modern SaaS/agency aesthetic". Elements to adopt,
translated to this project's identity:

1. **Floating pill navbar (island navigation)** — the header the stakeholder specifically likes.
   Nav is a detached rounded-full capsule floating below the top edge (not a full-width bar), with
   the active item marked by a contrasting pill inside it. Sticky on scroll. For ROC GMS: capsule on
   white/mist ground, active pill in green or ink.
2. **Typography-first hero** — very large display headline (2 lines), where one or two key words get
   a color/gradient emphasis. The headline *is* the visual. For ROC GMS: Plus Jakarta Sans
   ExtraBold, emphasis words in a green→blue gradient instead of the reference's navy/pink.
3. **Aurora / gradient blob background** — soft, heavily-blurred radial gradient blobs floating on
   the white canvas behind the hero. For ROC GMS: green and blue blobs (low saturation, generous
   blur) instead of purple/pink/peach.
4. **White-dominant canvas with generous whitespace** — sections breathe; color lives in accents,
   not full-bleed backgrounds. Aligns with PD4.
5. **Pill buttons** — rounded-full primary (solid green) + secondary (outline/ghost) side by side.
6. *(Optional, layout-level — not requested, note only)* the reference also uses a stacked
   perspective card showcase under the hero; if ever used here it would show real pages (schedule,
   bracket) rather than portfolio shots.

Impact on section 4: the "track lane divider" motif proposal is demoted to optional; the aurora-blob
+ typography-first direction above takes precedence as the primary visual signature.

## 3. Proposed decisions (NOT yet in `decision-log.md`)

These needed sign-off before anything was built. They have been promoted into `prd/decision-log.md`
as D020-D023 per this project's own continuation discipline (PRD section 29), same as every other
durable decision so far.

| # | Proposed decision | Why |
|----|----|----|
| PD1 | Adopt Tailwind CSS + shadcn/ui (Radix-based primitives) as the styling foundation, replacing the single hand-written `styles.css` | Needed for accessible interactive components (nav drawer, tabs, dialogs) without hand-rolling each one; also the foundation Phase 8 Live Score will want |
| PD2 | Self-host Plus Jakarta Sans via `next/font/google` (variable weight range) | No FOUT/layout shift, no external font request at runtime |
| PD3 | Redesign public site first (R0–R2 below), workspace/admin visual refresh trails behind (R4) | Public pages are what non-technical visitors judge the product by; admin pages are already usable/functional |
| PD4 | Palette stays white-dominant, with green + blue spent deliberately on a few focal elements (buttons, one hero widget, status accents) rather than full-bleed colored backgrounds everywhere | Keeps mobile readability high outdoors, avoids a "loud" look while still feeling like an event brand |

## 4. Design direction (proposal, needs review)

### Color

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FFFFFF` | Dominant background |
| `--mist` | `#F1F7F4` | Alternating section background, subtle green tint |
| `--ink` | `#0C231F` | Primary text |
| `--ink-soft` | `#41564F` | Secondary text/meta |
| `--green` | `#128A56` | Primary accent — CTAs, active nav, qualified/positive status |
| `--blue` | `#1B57C4` | Secondary accent — links, scheduled status, secondary actions |
| `--gold` | `#DE9F1E` | Sparse accent only — champion/medal moments, live indicator |

Existing status-color usage in `styles.css` (`--green`/`--blue`/`--red`/`--gold` for match states) can
carry over conceptually; exact values above are a proposal, not final.

### Typography

- Plus Jakarta Sans for both display and body, per the brief — weight 800/700 for headings, 500 for
  nav/labels, 400 for body copy.
- Digits (scores, times, countdowns) use `font-variant-numeric: tabular-nums` so columns stay aligned.
- No second typeface introduced unless a specific screen (e.g. a scoreboard/live-score view) proves it
  needs one.

### Layout motif (updated per section 2.1)

- Public pages stay white-dominant; the visual signature comes from the section 2.1 style elements:
  floating pill navbar, typography-first hero with gradient-emphasis words, and soft green/blue
  aurora blobs behind the hero.
- Color is spent on a small number of focal elements per page (CTAs, active nav pill, one hero
  widget) rather than spread across every section.
- Corner language: rounded-full for nav capsule, buttons, chips, and status badges; larger soft radii
  (12–16px) for cards.
- Optional/deprioritized: the earlier "track lane divider" motif idea — keep only if it survives
  contact with the aurora style, don't force both.

## 4.1 Design consistency contract

Everything in R0–R4 must draw from one shared vocabulary. If a screen needs something these rules
don't cover, extend the contract here first — don't invent a one-off on the page.

**Shape language**

| Element | Radius | Notes |
|---|---|---|
| Nav capsule, buttons, chips, status badges, seed markers | `rounded-full` | The pill is the signature shape |
| Cards (match ticket, bracket node, sport card, standings card) | 12px | One value for all cards, no mixing 8/10/12 per page |
| Large containers (hero widget, panels, section frames) | 16px | |
| Inputs/selects | 10px | Slightly tighter than cards so forms read as controls |

**Borders, elevation, states**

- Default card: 1px border `--line`, no shadow. Hover/focus: border shifts to accent (green for
  interactive-primary contexts, blue for navigational), plus a soft `-translate-y` of 2px.
- Shadow is reserved for floating elements only: nav capsule, hero widget, open drawer/dialog.
  Cards in flow never carry shadows — elevation means "floats above the page".
- Winner/positive state: green border + green-tint (`--mist`-family) fill. Live state: gold pill.
  Scheduled: blue pill. These three mappings are global — a winner looks the same in a bracket node,
  a standings row, and a match ticket.

**Sizing rhythm**

- Spacing scale: 4px base (4/8/12/16/24/32/48/64). Section vertical padding: 48px mobile / 64px+
  desktop.
- Tap targets ≥ 44px on mobile (already a norm in the current CSS — keep it).
- Card internal padding: 16px; large containers: 24px.

**Type roles (Plus Jakarta Sans everywhere)**

- Display 800, headings 700, labels/nav 500–600, body 400, all-caps micro-labels 700 with
  letter-spacing. Scores/times/countdowns always 700–800 + `tabular-nums`.

## 4.2 Bracket tree spec (single elimination)

The bracket is the most identity-defining data view on the site, so it gets its own spec. Current
state (`src/app/(frontend)/brackets/page.tsx` + `.bracket-*` styles): rounds are CSS grid columns,
cards stack top-aligned, **no connector lines, no vertical centering** — it reads as lists side by
side, not a tree. The redesign turns it into a real tree while keeping the same data flow
(bracket cache read-only over match truth, D016/D019 — no schema changes).

**Node (match card) anatomy** — one card design, reused identically in every round:

```
┌──────────────────────────────┐
│ ROC-BMS-005        ● Final   │  ← match number (mono-ish 700) + status pill (rounded-full)
│ ┌──┐                         │
│ │ 1│ IT Club          21     │  ← seed circle · participant name · per-participant score
│ └──┘                         │
│ ┌──┐                         │
│ │ 4│ Finance          18     │
│ └──┘                         │
└──────────────────────────────┘
```

- Node card: 12px radius, 1px `--line` border, white fill — same recipe as every other card.
- Participant rows: seed in a small `rounded-full` circle (same shape as status badges); winner row
  gets the global winner state (green border + tint + 700 weight); loser stays neutral (never red —
  losing is not an error).
- Score moves INTO each participant row (right-aligned, `tabular-nums`) instead of the current
  single "Sets: …" line under the card, so the winner is readable at a glance.
- TBD slots: dashed 1px border, `--ink-soft` italic label — visually "empty", not broken.
- Whole node stays a link to match detail (as today), with the standard hover treatment
  (green border + lift).

**Tree layout**

- Rounds as columns left→right (keep), but each column is vertically centered against the previous
  round so a node sits at the midpoint of its two feeder nodes — this is what makes it a tree.
  Implementation: flex column with `justify-content: space-around` per round, or CSS grid row-span
  doubling per round (node in round N spans 2× the rows of round N−1).
- Connectors: elbow lines (horizontal → vertical → horizontal) drawn with an absolutely-positioned
  SVG layer or `::before/::after` borders, 1.5px `--line` color. On the champion path, connectors
  upgrade to 2px green — the "champion path highlight" from R2 lives in the connectors, not extra
  card decoration.
- Round headers: all-caps micro-label style (700 + letter-spacing), sticky at the top of the
  horizontal scroll area so the round name stays visible mid-scroll.
- Champion terminal: to the right of the final node, one detached champion chip — gold accent
  (the only gold moment on the page) with the winner's name. Replaces the current full-width
  champion banner above the tree; pending state shows the chip in neutral/dashed style with the
  existing reason text as a tooltip/caption.

**Column sizing**

- Node width: fixed 260px (current `minmax(260px,1fr)` becomes fixed so connector geometry is
  predictable). Column gap: 48px (room for elbows). Vertical gap between sibling nodes: 16px
  minimum, grows with centering.

**Mobile (≤ 640px)**

- Keep horizontal scroll with the tree intact (current code collapses to a vertical list — that
  loses the tree shape). Snap-scroll per round (`scroll-snap-type: x mandatory`), with a round
  indicator (e.g. "Semi Final · 2/4") pinned above.
- Pinch-zoom/pan stays a stretch goal (as in R2); snap-per-round is the baseline that must ship.
- Node width on mobile: 82vw max 260px, so one full node + a peek of the next round is visible.

**States checklist** (all must be designed, not just the happy path)

- [ ] Match with both participants + published score (winner readable at a glance)
- [ ] Match scheduled, no score yet (status pill = blue, no score column)
- [ ] Match live (gold pill — same as the "Live" pill on schedule/home)
- [ ] One or both slots TBD (dashed)
- [ ] Walkover/cancelled (status pill neutral/muted, no winner styling unless winner set)
- [ ] Champion decided vs pending (chip states)
- [ ] Empty bracket (no matches yet — keep current empty-state copy, restyled)

## 5. Phased rollout

Sizing is relative (S/M/L), not hour estimates — we can size R0 properly once it's scoped.

### R0 — Design Foundation (size: L, one-time)
- [x] Install and configure Tailwind CSS + shadcn/ui
- [ ] Remove/replace `src/app/(frontend)/styles.css` incrementally (deferred to R1+ as pages migrate)
- [x] Self-host Plus Jakarta Sans via `next/font/google`
- [x] Define design tokens: color, radius, shadow, spacing scale
- [x] Build shared primitives: floating pill NavBar (+ mobile drawer, sticky-on-scroll), Footer,
      pill Button, StatusBadge, Card, Skeleton

No visible change to end users yet — everything after this is built on top of it.

R0 status (2026-07-03): complete except incremental `styles.css` removal, which only makes sense
once R1/R2 start migrating pages onto the new primitives. See `prd/session-handoff.md` for verification
notes and `prd/decision-log.md` D020-D023 for the promoted decisions (formerly PD1-PD4 here).

### R1 — Public Landing & Navigation (size: M)
- [x] Persistent public nav: Home, Schedule, Standings, Brackets, Champions (Sports/Announcements/
      Articles/Winners deferred — no dedicated pages exist yet; Announcements/Articles wait for
      Phase 6, Sports/Winners are not yet separate routes)
- [x] Homepage hero: typography-first display headline with gradient-emphasis words, aurora blob
      background, countdown, pill CTAs into schedule/standings/brackets
- [x] "Live Now / Next Up" strip sourced from `is_public = true` matches
- [x] Sports overview grid linking into filtered schedule (links to `/schedule?sport=<slug>`; `/schedule`
      does not read the query param yet — wiring that up is R2 scope, see filter chips item below)

This is the page most visitors see first — it's the one that decides whether the "feels like an
Olympic site" goal is met.

R1 status (2026-07-03): complete. See `prd/session-handoff.md` for what was built and verified.

### R2 — Public Feature Pages (size: L)
- [ ] Schedule: filter chips, date-grouped agenda, status badges, sticky mobile filter bar
- [ ] Standings: table → card on mobile, qualified/eliminated badges
- [ ] Brackets: implement the full tree spec in section 4.2 (centered columns, elbow connectors,
      champion-path connectors, champion chip, snap-scroll mobile, all listed states)
- [ ] Champions: celebratory card layout
- [ ] Public match detail: large score card, documentation gallery, share buttons

### R3 — Interaction & Motion polish (size: S–M, runs alongside Phase 6/7)
- [ ] Hover/tap transitions on cards and buttons
- [ ] Skeleton loading states for data fetches
- [ ] Homepage "Live & Next" widget auto-refreshes without a full reload

### R4 — Workspace/Admin visual refresh (size: S per page, lowest priority)
- [ ] Apply the same tokens to Event Admin / Scheduler / Match Officer / Content Admin workspaces
- [ ] Keep them dense and functional per PRD 21.3 — not decorative, just consistent

## 6. Sequencing against `implementation-plan.md`

Current state per `prd/session-handoff.md`: Phase 5F complete. Next in the existing plan:

- Phase 6 — Content, Announcements, and Sharing (Article, Announcement, share metadata — all
  public-facing)
- Phase 7 — Public Edit Mode
- Phase 8 — Live Score
- Phase 9 — Advanced Features

Recommendation: treat R0 + R1 + R2 as a track that runs **before Phase 6 starts** (effectively a
"Phase 5.5"). Reason: Phase 6 adds new public pages (articles, announcements) — building those
directly on the new design system avoids restyling them a second time right after they ship. R3 can
run alongside Phase 6/7 since both are about interaction. R4 has no dependency on anything and can
trail behind at any point, including after Phase 8/9.

## 7. Suggested session prompts

Follow the same continuation discipline as the rest of the project (PRD section 29): every session
reads the docs first, works one phase, verifies, and updates `prd/session-handoff.md`. Run the
phases in order — R1 must not start before R0 is merged, R2 not before R1.

### R0 — Design Foundation

```text
Continue ROC GMS V2. Read prd/README.md, prd/implementation-plan.md, prd/decision-log.md,
prd/session-handoff.md, and prd/redesign/README.md first, then inspect the repository and git
status. Execute redesign phase R0 only, on a new branch: install and configure Tailwind CSS +
shadcn/ui for the (frontend) route group, self-host Plus Jakarta Sans via next/font/google, define
the design tokens from prd/redesign/README.md section 4 as Tailwind theme values, and build the
shared primitives (floating pill NavBar with mobile drawer and sticky-on-scroll, Footer, pill
Button, StatusBadge, Card, Skeleton) following the consistency contract in section 4.1. Do not
restyle any existing page yet and do not change any Payload collection, server action, or data
loader. Promote PD1-PD4 from prd/redesign/README.md into prd/decision-log.md as accepted decisions
(D020+). Keep (payload) admin routes untouched. Run typecheck and production build, verify the
existing routes still render (/, /schedule, /standings, /brackets, /champions,
/matches/ROC-BMS-001), check off completed R0 items in prd/redesign/README.md, and update
prd/session-handoff.md.
```

### R1 — Public Landing & Navigation

```text
Continue ROC GMS V2. Read prd/README.md, prd/decision-log.md, prd/session-handoff.md, and
prd/redesign/README.md first, then inspect the repository. R0 is complete; execute redesign phase
R1 only: rebuild the public homepage (src/app/(frontend)/page.tsx) as the event landing page using
the R0 primitives and the style direction in prd/redesign/README.md sections 2.1 and 4 —
typography-first hero with gradient-emphasis words and green/blue aurora blob background, event
countdown, pill CTAs, a "Live Now / Next Up" strip sourced from is_public=true matches, and a
sports overview grid. Add the floating pill NavBar with the public destinations (Home, Schedule,
Standings, Brackets, Champions; leave Announcements/Articles out until Phase 6 ships them) to the
public pages via the (frontend) layout, excluding /workspaces routes. Public-facing copy stays
non-technical. Do not change collections, server actions, or data loaders except read-only queries
the homepage needs. Run typecheck, build, verify routes, check off R1 items in
prd/redesign/README.md, and update prd/session-handoff.md.
```

### R2 — Public Feature Pages

```text
Continue ROC GMS V2. Read prd/README.md, prd/decision-log.md, prd/session-handoff.md, and
prd/redesign/README.md first, then inspect the repository. R0-R1 are complete; execute redesign
phase R2. Restyle the public feature pages one at a time in this order, keeping each functional
exactly as-is: (1) /schedule with filter chips, date-grouped agenda, status badges, sticky mobile
filter bar; (2) /standings with table-to-card mobile behavior and qualified/eliminated badges;
(3) /brackets implementing the full tree spec in prd/redesign/README.md section 4.2 — node anatomy,
vertically centered rounds, elbow connectors, champion-path connectors, champion chip, snap-scroll
mobile, and every state in the states checklist; (4) /champions celebratory cards;
(5) /matches/[matchNumber] public detail with large score card, documentation gallery, and share
buttons. Follow the consistency contract in section 4.1 strictly — no one-off shapes, radii, or
state colors. Do not touch workspace pages or any mutation logic. Run typecheck, build, verify all
routes, check off R2 items, and update prd/session-handoff.md.
```

### R3 — Interaction & Motion (can run alongside Phase 6/7)

```text
Continue ROC GMS V2. Read prd/redesign/README.md and prd/session-handoff.md first. R0-R2 are
complete; execute redesign phase R3: add hover/tap transitions to cards and buttons per the
consistency contract, skeleton loading states for data-dependent sections, and make the homepage
"Live & Next" strip auto-refresh without a full page reload (polling is fine; respect
prefers-reduced-motion throughout). No new heavy animation dependency unless the work proves it
necessary — plain CSS/React first. Run typecheck and build, check off R3 items, and update
prd/session-handoff.md.
```

### R4 — Workspace visual refresh (lowest priority, anytime after R0)

```text
Continue ROC GMS V2. Read prd/redesign/README.md and prd/session-handoff.md first. Execute redesign
phase R4: apply the R0 tokens and primitives to the workspace pages (event-admin, scheduler,
match-officer, content-admin, workspace match detail) while keeping them dense and operational per
PRD section 21.3 — consistent tokens, no decorative rework, no behavior changes to server actions
or forms. Work page by page and verify each still functions (status transitions, score input,
uploads, comments) before moving on. Run typecheck and build, check off R4 items, and update
prd/session-handoff.md.
```

## 8. Open questions

- Confirm or adjust the hex values in section 4 before any component is built.
- Public-facing copy language: Bahasa Indonesia, English, or bilingual? (Internal code/routes/db stay
  English per D001 either way — this is only about visible text.)
- Icon approach: install `lucide-react` (pairs naturally with shadcn/ui) vs a small set of hand-drawn
  SVGs tied to specific sports/motifs?
- Motion: plain CSS transitions vs adding Framer Motion as a dependency — only worth it if R3 wants
  more than hover/skeleton states.
- Rollout shape: one large PR per R-phase, or page-by-page within R2 (schedule first, then standings,
  etc.)?
- Once direction is agreed, do PD1–PD4 get written into `prd/decision-log.md` as-is, or do you want
  changes first?
