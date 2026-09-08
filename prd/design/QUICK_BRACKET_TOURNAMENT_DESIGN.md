# Quick Bracket Tournament (no-login bracket generator)

Owner: Rusydani
Status: **SPEC — not started**
Created: 2026-09-08
Relates to: `prd/redesign/guest-wizard-and-auth-redesign.md` (the *other* no-login surface — full
event wizard, still requires sign-in to persist), `prd/decision-log.md`, `src/lib/matchGeneration.ts`,
`src/lib/doubleElimination.ts`, `src/app/(frontend)/brackets/bracketTree.tsx`

> ℹ️ This is a deliberately different product surface from the guest wizard. The guest wizard's
> guest-accessible steps (Setup + Event Details, per that doc) exist to reduce friction on the way
> to a **real, fully-featured event** — login is required before anything past Sports/Venues
> persists. Quick Bracket Tournament instead ships a **complete, useful artifact with zero login,
> ever** (a generated bracket you can look at and share) and only asks for an account when the
> visitor wants to *run* the tournament (enter scores, unlock other formats, keep it long-term).
> It is a top-of-funnel acquisition tool, not a step of the real onboarding flow.

## 1. Why this exists

Anyone who searches "bracket generator" today lands on Challonge/Toornament/bracketsninja — free,
instant, no account. InTourney's actual bracket rendering (`BracketTree`, the elbow-connector tree
spec in `prd/redesign/README.md` §4.2) is already better-looking than most of those tools, but it's
locked behind the full event-creation flow. Quick Bracket Tournament exposes just the bracket
generator, standalone, so a visitor's first contact with InTourney is "wow, nice bracket" in under a
minute — then converts them into an account when they want more than a static picture.

**Product goal (explicit trade-off):** maximize the number of people who *use* InTourney's bracket
output before they ever consider signing up, while keeping the write surface small enough that an
anonymous, low-value feature can't become a spam or cost vector. Every design choice below resolves
in favor of "cheap to abuse, cheap to clean up" over "featureful."

## 2. Target flow

```
Landing (optional future CTA - not in this scope) or direct link
      │
      ▼
/quick-bracket/new  (single scrolling page, no login, no eventId)
      │
      │  1. Tournament name (pinned at the top of the form)
      │  2. Format: Single Elimination | Double Elimination
      │     "Other formats (Round Robin, Swiss, and more) unlock when you sign up on InTourney"
      │  3. Format settings:
      │       Single Elim  → "Include a match for 3rd place"           [i] inline
      │       Double Elim  → "Enable split participants - start with   [i] Learn more (popover)
      │                        half of participants in the losers bracket"
      │  4. Bracket size:
      │       (•) Use the number of participants provided below
      │       ( ) Enter a number and generate a blank bracket
      │     Participants textarea (one per line, best → worst seed) OR bracket-size number input
      │     [Randomize seeds] button (client-side shuffle of the entered list)
      │  5. Turnstile widget (bot check) + honeypot field (hidden)
      │
      ▼  Submit
  createQuickBracketAction (Server Action)
      │  - honeypot check → silent no-op if tripped
      │  - Turnstile verify (server-side call to Cloudflare)
      │  - IP rate limit (new limiter, same pattern as anonymousDraftRateLimit.ts)
      │  - validate: 2-64 participants (or 2-64 bracket size), format-specific rules
      │  - build BracketRound[]/champion in memory (pure functions, no DB writes to
      │    events/matches/brackets/etc.)
      │  - payload.create({ collection: 'quick-brackets', data: {...} })
      │  - set owner_token cookie (read-only affordance for "my quick brackets", not an edit key)
      ▼
/quick-bracket/[slug]   (public, read-only, shareable)
      │  - BracketTree (single-elim) or the 3-panel double-elim view, fully populated,
      │    all matches TBD/no scores (nothing has been played - this is a generated draw, not
      │    a live tournament)
      │  - Settings summary (format, 3rd place / split-participants state, seed order)
      │  - Persistent CTA: "Sign up to run this live" → /register?claimQuickBracket=<slug>
      │  - "This is a guest tournament - expires in ~30 days unless you claim it"
      ▼ (Phase 2 - see §8)
  Sign up / log in → claimQuickBracketAction → real Events/Categories/Stages/Entries/Matches/
  Brackets rows created from the stored plan → redirected into the normal workspace, now with
  live scoring, sharing, and every other format available.
```

## 3. Anti-abuse & guest-ownership design

Chosen baseline (confirmed): **Turnstile at submit + hard participant/size cap + auto-expiry**, and
**read-only forever until claimed** (no anonymous score entry or edit path at all — this removes an
entire category of abuse: nobody can vandalize someone else's guest bracket, because nobody but the
claim flow can ever write to a `quick-brackets` row again after creation).

| Layer | Mechanism | Precedent in this repo |
|---|---|---|
| Bot check | Cloudflare Turnstile widget on the form, verified server-side in the action before any write | **New** — no CAPTCHA infra exists today (confirmed: zero hits for captcha/recaptcha/turnstile/hcaptcha repo-wide). Needs `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` env vars. |
| Rate limit | New `src/lib/quickBracketRateLimit.ts`, IP-keyed, in-memory sliding window | Clone of `src/lib/anonymousDraftRateLimit.ts` (3/hour for anon event drafts). Propose a looser cap here (this is much cheaper per-request than a full event) — **8 per IP per hour**, tunable. Same known limitation as the existing limiters: in-memory, doesn't survive restarts or scale past one instance (Redis is provisioned but unused - out of scope to fix here, matches existing precedent). |
| Honeypot | Hidden `website` field, silent no-op if filled | Same pattern as `eventActions.ts`'s `createEventAction` (lines ~58-62). |
| Size cap | 2-64 participants (or bracket size), enforced server-side regardless of what the client sends | New validation, cheap insurance against someone scripting a 10,000-node bracket. |
| Auto-expiry | `expires_at` field, default `createdAt + 30 days`; **read path checks expiry even before any cleanup job runs** (page renders "This tournament has expired" instead of the bracket) | No cron exists in this repo (`grep` for crons/vercel cron found nothing). Precedent: `src/scripts/cleanupAbandonedDrafts.ts` — a manually-invoked/host-scheduled cleanup script for unclaimed anonymous event drafts. Mirror it exactly: `src/scripts/cleanupExpiredQuickBrackets.ts`, `npm run quick-brackets:cleanup [-- --days=30] [-- --dry-run]`, deletes `quick-brackets` rows past `expires_at` and `status: 'active'`. Wire into whatever host scheduler eventually runs `drafts:cleanup` (same TODO, not a new one). |
| Ownership | `owner_token` (random UUID) in an httpOnly cookie, matched against the row on read for a **"your guest tournaments" convenience list only** - never grants write access | Modeled on `wizardAccess.ts`'s `wizard_draft` cookie/`draft_claim_token` pattern, but deliberately weaker: since there is no anonymous write path at all post-creation, the token's only job is letting the creator find their own quick brackets again (e.g. a `/quick-bracket` "your recent brackets" strip) and later claim them - it is not a security boundary for mutation. |
| Data minimization | Curated server-side payload only - the action builds `{name, format, ...}` itself from validated fields; it never spreads raw `formData` into `payload.create` | Same discipline `createEventAction` already follows (never trusts client-supplied `status`/token fields). |

**Explicitly not built:** anonymous score entry, anonymous editing of participants/seeds after
creation, anonymous deletion, any endpoint that mutates a `quick-brackets` row post-creation except
the authenticated claim action. This is what makes the read-only choice valuable: it collapses most
of the abuse surface (no vandalism, no griefing another guest's bracket) down to "can someone waste
compute generating brackets" - which the rate limit + Turnstile + size cap already bound tightly.

## 4. Data model

One new, deliberately unrelated collection - **not** a reuse of `Events`/`CompetitionCategories`/
`Stages`/`CompetitionEntries`/`Matches`. Those all have `required: true` relationships cascading to a
real event (and most also require a real `Sports` row), and their `access.create` is scoped to real
event membership - opening anonymous-write holes across five access-controlled collections just to
render a name-list bracket is a much bigger surface than one small, isolated collection with no
foreign keys into the authenticated system at all.

`src/collections/QuickBrackets.ts`, `slug: 'quick-brackets'`:

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | Tournament name, user-supplied |
| `slug` | text, unique, required | Short random id (nanoid), used in `/quick-bracket/[slug]` |
| `format` | select, required | `single_elimination` \| `double_elimination` |
| `third_place` | checkbox, default false | Single-elim only; mirrors `CompetitionCategories.third_place_policy`'s `'match'` option (no `'shared'` here - a guest tool has no semifinal-loser bookkeeping worth the extra copy) |
| `split_participants` | checkbox, default false | Double-elim only; see §7 risk note - **new** bracket-topology behavior, no code precedent exists yet |
| `bracket_size_mode` | select, required | `from_participants` \| `manual_size` |
| `participants` | array of `{ name: text, seed: number }` | Empty/placeholder entries (`"TBD"`) when `bracket_size_mode = manual_size` |
| `bracket_size` | number, required | Resolved power-of-two size actually generated |
| `bracket_data` | json, required | Same shape as `Brackets.bracket_data` (`SingleEliminationBracketData` \| `DoubleEliminationBracketData`) - computed once at submit, never recalculated (nothing ever changes it) |
| `owner_token` | text, hidden, indexed | Random UUID; matched against the `owner_token` cookie for the "your guest brackets" convenience list only |
| `creator_ip` | text, hidden | Abuse-investigation / rate-limit audit trail only, never displayed |
| `status` | select, default `active` | `active` \| `claimed` \| `expired` |
| `claimed_event_id` | relationship → `events`, optional | Set by the Phase 2 claim flow |
| `expires_at` | date, required | `createdAt + 30 days` at creation time |

Access control:
- `create`: open (public), but the server action in front of it does all the real gatekeeping
  (honeypot, Turnstile, rate limit, validation) - Payload's own `access.create` just checks the
  request came through the app's own action, not raw API access from the public API route (disable
  the REST/GraphQL create endpoint for this collection if Payload's config allows scoping that
  separately from the local API the action uses).
- `read`: public (anyone with the slug can view - it's meant to be shared).
- `update`: locked to the claim action only (effectively `() => false` for normal API access, since
  even the claim flow is expected to go through a dedicated server action using the local API, not
  through a public update endpoint).
- `delete`: `super_admin` only, plus the cleanup script (which uses the local API and bypasses
  access control the same way `cleanupAbandonedDrafts.ts` does).

## 5. Functional spec

### 5.1 Pure logic to reuse as-is (no changes needed)

All of the following are already DB-decoupled pure functions - directly importable by the new
server action with zero modification:

- `getSchedulableEntries`, `getNextPowerOfTwo`, `getStandardSeedSlotOrder`,
  `buildSingleEliminationBracketPlan`, `roundNameForRemaining`/`roundPrefixForRemaining`
  (`src/lib/matchGeneration.ts`).
- `isExactPowerOfTwo`, `buildLosersBracketPlan` (`src/lib/doubleElimination.ts`).
- `detectSingleEliminationChampion`, `detectDoubleEliminationChampion` (pure, operate on already-built
  `BracketRound[]`/`grandFinal` objects - will correctly report `status: 'pending'` since no match
  ever has a result in this flow).
- `BracketTree` (`src/app/(frontend)/brackets/bracketTree.tsx`) - a pure presentational component
  that already takes arbitrary in-memory `rounds`/`champion` props; no Payload read required to use
  it.

### 5.2 New (small) glue code needed

- **`planToBracketRounds(plan, { thirdPlace }): BracketRound[]`** - new function converting
  `BracketRoundMatchPlan[]` (from `buildSingleEliminationBracketPlan`) directly into the
  `BracketRound[]`/`BracketMatchCard[]` shape `BracketTree` expects, entirely in memory. Today this
  conversion only happens inside the Payload-writing wrapper (`createSingleEliminationBracketMatches`)
  and the DB-reading cache builder (`buildSingleEliminationBracketLayout`) - neither is reusable
  as-is since both assume real `matches` rows exist. This is genuinely new code, but small: it's
  reshaping data that's already fully computed by the reused pure functions above.
- **Bronze Final synthesis** - when `third_place` is set, synthesize the extra match card from the
  two semifinal-losing slots directly in `planToBracketRounds`, mirroring what
  `createSingleEliminationBracketMatches` does via `next_loser_match_id` wiring today, but without
  writing anything - just an extra `BracketRound` entry.
- **`planToDoubleEliminationData(...)`** - equivalent in-memory assembly for double elimination:
  winners plan (reused) + losers plan (reused) + a synthesized Grand Final (+ Grand Final Reset
  placeholder, always present but inert, matching existing production behavior of "always create,
  conditionally activate" - see `doubleElimination.ts` line ~445) → shaped as
  `DoubleEliminationBracketData`.
- **Extract `DoubleEliminationBracketSections`** into a shared component (currently duplicated
  verbatim in `events/[eventSlug]/brackets/page.tsx` and
  `events/[eventSlug]/sports/[sportSlug]/[categorySlug]/page.tsx` - move it to
  `src/app/(frontend)/brackets/doubleEliminationSections.tsx` so the new quick-bracket view page can
  import it as a third caller instead of becoming a third copy-paste).
- **`createQuickBracketAction`** (new server action, e.g.
  `src/app/(frontend)/quick-bracket/new/quickBracketActions.ts`): honeypot → Turnstile verify → rate
  limit → validate participants/size → resolve bracket size (next power of two ≥ participant count,
  reusing `getNextPowerOfTwo`; for `manual_size` mode, validate the entered number is itself a valid
  bracket size and pad with `"TBD"` placeholder entries) → build plan → convert to `bracket_data` →
  `payload.create` → set `owner_token` cookie → redirect to `/quick-bracket/[slug]`.
- **`src/lib/quickBracketRateLimit.ts`** - new, clone of `anonymousDraftRateLimit.ts`.
- **`src/collections/QuickBrackets.ts`** - new collection, registered in `payload.config.ts`.
- **`src/scripts/cleanupExpiredQuickBrackets.ts`** - new, clone of `cleanupAbandonedDrafts.ts`'s
  shape (`npm run quick-brackets:cleanup`).

### 5.3 Pages

- **`src/app/(frontend)/quick-bracket/new/page.tsx`** - the creation form. A single scrolling page
  (not a multi-route wizard - the whole point is "quick"), client component for the interactive bits
  (participant textarea, live count, randomize-seeds shuffle, bracket-size live preview), submitting
  to `createQuickBracketAction`. No auth check at all - this route is guest-only by nature (there's
  nothing here to protect).
- **`src/app/(frontend)/quick-bracket/[slug]/page.tsx`** - the result view. Server component, fetches
  by slug, checks `status`/`expires_at` server-side (renders an "expired" empty state rather than the
  bracket if past expiry, independent of whether the cleanup script has actually run yet), then
  renders `BracketTree` or `DoubleEliminationBracketSections` fed directly from the stored
  `bracket_data` - identical rendering path to the authenticated public bracket page, just sourced
  from a different collection.

## 6. Visual / UX direction

This is a sports tournament tool, and the marketing site already has a visual language worth
extending rather than reinventing (aurora-blob hero, bracket-connector motif, green/blue palette,
`rounded-full` pills, elbow-connector bracket tree per `prd/redesign/README.md` §4.2):

- **Creation page**: two-column on desktop (`lg:grid-cols-[1fr_0.9fr]`, matching the homepage Hero's
  asymmetric layout) - form on the left, a **live bracket-size preview** on the right: a small,
  schematic bracket skeleton (reusing the same decorative-SVG idea as the homepage Hero's 4→2→1
  bracket, but functional this time) that updates its slot count as the participant list grows or the
  manual size changes, plus the participant names dropping into slots live as they're typed. This
  turns an otherwise dry form into something that visibly "becomes" a tournament as you fill it in -
  the emotional payoff a generator tool like this should front-load.
- **Format picker**: a segmented control (two large pill buttons, Single/Double Elimination) rather
  than radio inputs - each carries a one-line description under it. A visually distinct, slightly
  muted row beneath lists the locked formats (Round Robin, Swiss, Group + Playoff, ...) as
  non-interactive chips with a small lock glyph and the "unlock by signing up" copy - visible enough
  to plant the idea, not so prominent it distracts from the two live options.
- **"Learn more" for split participants**: an inline popover (Radix `Popover`, already a dependency
  via shadcn/ui - not a link to an external/unknown URL, consistent with never fabricating URLs) with
  a tiny two-row diagram (winners-bracket half vs. losers-bracket half) and 2-3 sentences of plain
  explanation - not a modal, since it's a clarifying aside, not a decision point.
- **Randomize seeds**: a small ghost button with a shuffle icon directly above the participant
  textarea; triggers a client-side Fisher-Yates reshuffle of the current list with a brief
  reorder-transition (respecting `prefers-reduced-motion`, per this repo's existing motion policy) so
  the shuffle is visibly felt, not just silently applied.
- **Result page**: mirrors the redesigned public bracket page exactly (same node anatomy, connectors,
  champion chip - now permanently in its "pending" dashed state, captioned "No results yet - sign up
  to start recording scores" instead of the authenticated flow's neutral pending reason). The
  claim/sign-up CTA is a sticky bar (mobile) / floating card (desktop), not a banner that pushes the
  bracket down - the bracket is the reason people came, the CTA should not compete with it for the
  fold.
- **Guest badge**: a small `border-blue/40 bg-blue/5` chip near the title - "Guest tournament ·
  expires in 29 days" - same visual family as the wizard's existing draft-restore banner, so the
  "this is temporary" signal reads consistently with how the rest of the app already communicates
  ephemeral/unclaimed state.

## 7. Phasing

**Phase 1 (MVP - this is the scope worth shipping first):**
- Creation form (single elimination + standard double elimination only - **`split_participants`
  toggle rendered but disabled with a "Coming soon" tooltip**, see risk below), Turnstile, rate
  limit, honeypot, size cap, `QuickBrackets` collection, `planToBracketRounds`/
  `planToDoubleEliminationData`, result view page, expiry check on read, cleanup script.
- No claim/upgrade flow yet - the sign-up CTA on the result page links to plain `/register` (no
  `?claimQuickBracket=` wiring, no conversion of the guest row into a real event). This still fully
  serves the "try the bracket, then decide to sign up" goal even though it doesn't yet import the
  guest's exact bracket into their new account.

**Phase 2 (fast-follow):**
- `split_participants` double-elimination topology (real design work - see §8).
- `claimQuickBracketAction`: on sign-up/login with `?claimQuickBracket=<slug>`, materialize a real
  `Events` (+ placeholder `Sports`, one `CompetitionCategories`, one `Stages`, N `CompetitionEntries`)
  row set, then call the existing `createSingleEliminationBracketMatches`/
  `createDoubleEliminationBracketMatches` wrappers to produce real `Matches` + a real `Brackets` row
  from the stored plan - so the visitor's exact bracket (same seeds, same format, same settings)
  becomes their first real event instead of a second one they'd have to rebuild by hand. Mark the
  `quick-brackets` row `status: 'claimed'`.
- "Your recent guest brackets" strip on `/quick-bracket/new`, read via the `owner_token` cookie.

## 8. Risks / open engineering questions

1. **`split_participants` has no code precedent anywhere in `doubleElimination.ts`.** Today the
   losers bracket always fills purely from winners-bracket losers via `buildLosersBracketPlan`
   (winners bracket = 100% of the field). "Start with half the field already in the losers bracket"
   requires a genuinely different topology - splitting the seed list into two halves, running the
   top half through winners-bracket rounds while the bottom half plays each other directly in the
   losers bracket, then merging the two streams at the correct round so bracket math stays valid.
   This is real design work, not a config toggle on existing code. **Recommendation: ship Phase 1
   with the toggle visible-but-disabled** ("Coming soon" tooltip, satisfies the "show the option
   exists" ask without shipping unverified bracket math) and scope the actual algorithm as its own
   follow-up once someone can validate the math against a reference implementation.
2. **Turnstile is a new dependency and a new failure mode.** Needs `TURNSTILE_SITE_KEY`/
   `TURNSTILE_SECRET_KEY` in env (dev + prod), and an explicit decision on fail-open vs. fail-closed
   if Cloudflare's siteverify call itself errors/times out - recommend fail-closed (reject the
   submission, ask to retry) since this is exactly the scenario Turnstile exists to cover, and a
   guest losing one submission attempt is low-cost.
3. **In-memory rate limiting is a known, already-accepted limitation** in this codebase (all three
   existing limiters share it) - not a new risk, just inherited. No action needed beyond noting it.
4. **No cron infrastructure exists yet.** The expiry-cleanup script needs a host-level scheduler
   (same open TODO `cleanupAbandonedDrafts.ts` already carries) - not blocking, since the read-path
   expiry check makes cleanup a housekeeping/cost concern rather than a correctness one.
5. **Access-control scoping**: confirm Payload can restrict a collection's public REST/GraphQL
   `create` endpoint independently of the local-API `create` the server action uses, so the anonymous
   `create` access is only ever reachable through the action's own honeypot/Turnstile/rate-limit
   gauntlet - not directly via `POST /api/quick-brackets`.

## 9. Non-goals

- No anonymous score entry, live match status, or editing of any kind after creation - explicitly
  read-only until claimed (Phase 2).
- No Round Robin / Swiss / group-stage support in Quick Bracket - single/double elimination only, by
  design (the "unlock more formats" line is a real value prop for signing up, not a placeholder for
  work we intend to do here).
- No standings/medal computation - elimination-only formats have no separate standings table in this
  app even in the authenticated product (`medals.ts` has no double-elimination strategy either); the
  champion chip on the bracket itself is the entire "results" surface, and it stays in its pending
  state throughout the guest lifecycle since no scores are ever entered.
- No change to the existing guest event wizard, its collections, or its claim/draft-token mechanism -
  this is an intentionally separate, unrelated system (see the callout at the top of this doc).
- Redis-backed rate limiting is out of scope (matches existing precedent - not introduced here even
  though it would improve robustness, to avoid this feature being the reason infra work happens).

## 10. Verification checklist

- [ ] Logged-out visitor can complete the whole flow on `/quick-bracket/new` with zero redirects to
      `/login`.
- [ ] Single elimination: 2, 3 (bye), 8, and a non-power-of-two count (e.g. 11) all generate correct
      brackets; `third_place` on/off both render correctly.
- [ ] Double elimination: only accepts exact-power-of-two participant counts (matches existing
      `isExactPowerOfTwo` gate); clear inline validation message otherwise, not a generic error.
- [ ] "Enter a number and generate a blank bracket" produces the right slot count with `"TBD"`
      placeholders, no crash on an empty participants list.
- [ ] Randomize seeds visibly reorders the list client-side before submit; the submitted seed order
      matches what was shown.
- [ ] Honeypot-filled submission silently no-ops (no row created, generic success-looking redirect or
      no redirect - decide and document the exact behavior during implementation).
- [ ] Rate limit trips after 8 creations from one IP within an hour; clear "try again later" message.
- [ ] Turnstile failure blocks submission with a retry-friendly message; Turnstile success passes.
- [ ] `/quick-bracket/[slug]` renders correctly for both formats, shows no score-entry affordance
      anywhere, shows the guest/expiry badge, and shows the sign-up CTA.
- [ ] A slug past `expires_at` renders an "expired" state even if the cleanup script hasn't run.
- [ ] `npm run quick-brackets:cleanup -- --dry-run` correctly lists (without deleting) expired rows;
      the real run deletes only `status: active` rows past `expires_at`.
- [ ] Direct `POST` to the collection's public REST endpoint (bypassing the server action) is
      rejected or otherwise cannot create a row without going through the action's checks.
- [ ] `tsc` clean, existing bracket-related tests (`matchGeneration.test.ts`,
      `doubleElimination.test.ts`) still green (no behavior change to the reused pure functions).
