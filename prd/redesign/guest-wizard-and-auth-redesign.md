# Guest-first "Create Event" flow + Login/Register redesign

Owner: Rusydani
Status: **SPEC — not started**
Created: 2026-08-30

> ⚠️ The referenced design source `http://needmcp.com/docs` returns no readable content (client-
> rendered SPA / empty body). This spec grounds the visual redesign in the app's **existing**
> design system (the landing page's bracket-connector motif, the audited `ink / ink-soft / paper /
> mist / green / blue / line` tokens, `Card` / `Button` / `Field` / `Input`). If needmcp.com has
> real guidance, paste it and this section gets revised.

---

## 1. Problem

The landing page says *"Walk through every step of the wizard before you create an account"* and
*"only sign in when you want to save it"* — but clicking **Create your event** hits
`/workspaces/event-admin/new-event`, whose first line is `requireWorkspaceAccess(...)`, which
**redirects straight to `/login`**. The copy is a promise the flow breaks on the first click.

## 2. Target flow

```
Landing "Create your event"
      │
      ▼
Wizard  Step 0 (Setup Assistant)  ─┐
        Step 1 (Event details)     │  ← GUEST-ACCESSIBLE (no account, no eventId yet)
        [fill the form]            │     form autosaves to localStorage (WizardFormDraft, exists)
      │                           ─┘
      ▼  submit "Create event"
   not signed in?  ──► /login?redirect=<wizard event step + setup params>&intent=create
                          │  first-timer → "Create an account" is the primary path
                          ▼
                       signed in → back to the wizard event step
                          │  draft-restore banner: "Continue your draft?" → refills the form
                          ▼
                       submit again → createEventAction persists → Step 2 (Sports) …
```

Everything from **Step 2 onward, and every server action, still requires auth** — unchanged.

### 2.1 What becomes guest-accessible

| Route / state | Guest? |
|---|---|
| `/workspaces/event-admin/new-event` with **no `eventId`**, `step` ∈ {`setup`, `event`} (or unset) | ✅ yes |
| same, any other `step` | ➡️ redirect to `?step=setup` (nothing to show without an event) |
| `/workspaces/event-admin/new-event?eventId=…` (existing event) | 🔒 auth as today |
| every `*Action` server action (`createEventAction`, …) | 🔒 auth as today |
| every other workspace route | 🔒 unchanged |

## 3. Functional spec

### 3.1 `NewEventWizardPage` (`…/new-event/page.tsx`)

Replace the unconditional `requireWorkspaceAccess` with a branch:

```ts
const eventId = get(params, 'eventId')
const requestedStep = get(params, 'step')
const GUEST_STEPS = new Set(['setup', 'event'])
const isGuestEligible = !eventId && (!requestedStep || GUEST_STEPS.has(requestedStep))

// getPayload + getAuthenticatedWorkspaceUser (no redirect)
const payload = await getPayload({ config })
const user = await getAuthenticatedWorkspaceUser(payload)

if (!user) {
  if (!isGuestEligible) redirect(getLoginUrl('/workspaces/event-admin/new-event'))
  // else: fall through in guest mode
} else if (!hasWorkspaceRole(user, WORKSPACE_ROLES.eventAdmin)) {
  return <WorkspaceUnauthorized … />
}
const isGuest = !user
```

- Export `getAuthenticatedWorkspaceUser` / `getLoginUrl` / `hasWorkspaceRole` from `workspaceAuth.tsx`
  (all exist; `getLoginUrl` is currently private — export it).
- `step` for a guest is always `'setup'` unless `requestedStep === 'event'`.
- Pass `isGuest` down to `FocusHeader` + `EventStep`.

### 3.2 Wizard chrome in guest mode

- `FocusHeader`: `backHref` / `backLabel` → `"/"` / `"Home"` for a guest (today: `/workspaces/event-admin` which would bounce to login).
- `StepProgress` / stepper: render as today (steps are visible but only setup/event are reachable — a guest clicking a later step link lands back on `?step=setup`; give those `<Link>`s `aria-disabled` styling + no href for guests, or point them at `?step=event`).
- `SummaryPanel`: already no-ops to *"Create the event first to see live progress here."* for
  `!eventId` — for a guest, change that copy to *"Your progress appears here once you create the
  event."* and add a one-line *"You'll sign in at that step."*
- `WizardStepMemory` (localStorage last-step): only mounted `if (event)` today — leave off for guests.

### 3.3 `SetupStep` — guest

No change. It's pure GET-param navigation (`?scale=…`, then a `<Link>` to `?step=event&…`). Works
for a guest as-is.

### 3.4 `EventStep` — guest

The form stays `<form action={createEventAction}>` wrapped in `<WizardFormDraft>`. When `isGuest`:

- Above the form, a slim inline notice (not an alarming banner):
  *"You can fill this in now — you'll sign in to save it and continue."* with a bracket-connector
  glyph, `border-blue/40 bg-blue/5` (matches the draft banner).
- The submit button changes:
  - authed: `Create event & continue` (as today)
  - guest: `Sign in to save & continue` — still `type="submit"` on the same form. `createEventAction`
    already `assertWorkspaceActionAccess` → redirects to `/login?redirect=…`. The `returnTo` it
    passes must be the **event step with the setup params preserved** so the guest lands back on a
    pre-fillable form:
    `/workspaces/event-admin/new-event?step=event&scale=<…>&setupTournamentType=<…>&…`
    (Read these from `formData` inside `createEventAction` and build the return URL before the
    auth check — see 3.5.)
- On return, `WizardFormDraft`'s existing restore banner ("Melanjutkan draft sebelumnya?") shows;
  one click refills the form; submit → real create.
  - *Optional polish:* if `?resumeDraft=1` is present (added to the login `redirect`), auto-invoke
    `restore()` on mount instead of showing the banner. Weigh against WizardFormDraft's stated
    "recovery is never a silent auto-repopulate" rule — **default: keep the banner**, it's one click.

### 3.5 `createEventAction` (`eventActions.ts`)

```ts
export async function createEventAction(formData: FormData): Promise<void> {
  // Build the guest return URL from the setup params BEFORE the auth gate, so a bounced guest
  // lands back on the event step (not step=sports) with their assistant answers intact.
  const setupQuery = new URLSearchParams()
  for (const k of ['scale','setupTournamentType','setupParticipantMode','setupParticipantSource']) {
    const v = text(formData, k === 'scale' ? 'setupEventScale' : k)
    if (v) setupQuery.set(k, v)
  }
  const returnTo = `/workspaces/event-admin/new-event?step=event${setupQuery.size ? `&${setupQuery}` : ''}`

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo,          // ← was the bare wizard root
  })
  … unchanged …
}
```

No other action changes.

### 3.6 Landing page (`src/app/(frontend)/page.tsx`)

Mostly correct already. Tweaks:
- The two `Create your event` CTAs keep pointing at `/workspaces/event-admin/new-event` (now
  guest-safe).
- Hero sub-line copy is accurate now — keep. The CTA-panel line *"only sign in when you want to
  save it"* — keep.
- `Log in` secondary CTA → `/login` (unchanged).

## 4. Login / Register redesign

### 4.1 Shared shell

Keep the current **split layout** (brand panel left ≥`lg`, form right) — it's the right pattern.
Rework:

- **Brand panel** (`LoginShowcase`): replace the auto-rotating "feature carousel" with a single
  static composition built from the **bracket-connector motif** used on the landing page — a large
  faint 4→2→1 bracket SVG, the wordmark, one line of value copy, and a 3-item "what you get" list
  with connector bullets. No motion, no carousel (consistency with the rest of the app, which is
  MOTION-dial-1). Gradient stays (`from-[#062e22] via-green to-blue`) but calmer.
- **Form column**: on `bg-mist`, a single `max-w-sm` card on `bg-paper` with `border-line`
  `rounded-panel` — the forms currently float directly on the mist with no card. Card gives the
  inputs a definite edge and matches every other surface in the app.

### 4.2 Login form

- Fields as today (email, password, show/hide, forgot link).
- Replace the bespoke `bg-gradient-to-r from-green to-blue` submit button with the app's
  `<Button variant="brand" className="w-full">` for consistency (the gradient button is the one
  component on these pages that doesn't exist anywhere else).
- Inputs: use `<Field>` + `<Input>` (already partly done) at the app's default height, drop the
  ad-hoc `h-11 rounded-xl` overrides so they match `Input` everywhere else.
- Below: **"New to InTourney? Create an account"** — equal visual weight to "sign in", not a
  footnote, because a first-time organizer coming from "Create your event" has no account.

### 4.3 Context banner (arriving mid-create)

When `?intent=create` (set by `createEventAction`'s `returnTo`… actually set a separate
`&intent=create` on the login URL from `getLoginUrl` when returnTo starts with the wizard path):

- A `border-blue/40 bg-blue/5` banner above the form:
  *"One step left — sign in (or create an account) to save the event you just set up. Your
  answers are kept."*
- The **Create an account** button becomes the visual primary in this context; sign-in stays
  available.

### 4.4 Register form / page

- Adopt the same card shell + `Button variant="brand"`.
- `register/page.tsx` currently has no brand panel — give it the **same split shell** as login
  (share a `<AuthShell>` component: `src/app/(frontend)/(auth)/AuthShell.tsx` or just a shared
  component) so login ↔ register feel like one flow, not two pages.
- After successful register: if the request carried `?redirect=…` (from the guest wizard), honor
  it (currently `RegisterForm` likely always goes to `/workspaces`). Land the new user back on the
  wizard event step so they immediately finish creating.
- Forgot-password page: same shell for consistency (lower priority).

### 4.5 New shared component

`src/app/(frontend)/(auth)/AuthShell.tsx` (client-agnostic, server component):
```
<AuthShell brandSlot={<BrandPanel/>}>{form}</AuthShell>
```
Used by `login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`.
Moving these into a `(auth)` route group is optional (no shared layout needed) — the shared
component is enough.

## 5. Technical spec — files

| File | Change |
|---|---|
| `workspaceAuth.tsx` | `export` `getLoginUrl`; `getLoginUrl` optionally takes `{ intent }` → appends `&intent=`. |
| `…/new-event/page.tsx` | guest branch (3.1); `isGuest` prop to `FocusHeader` usage + `EventStep`; guest back-link; guest SummaryPanel copy; stepper links for guests. |
| `…/new-event/eventActions.ts` | `createEventAction` builds `returnTo` from setup params before the auth gate (3.5); `registerAction` / post-register redirect honors `?redirect`. |
| `login/page.tsx`, `login/LoginForm.tsx`, `login/LoginShowcase.tsx` | redesign per §4; context banner; `Button variant="brand"`. |
| `register/page.tsx`, `register/RegisterForm.tsx` | shared shell; honor `?redirect` post-register. |
| `forgot-password/page.tsx`, `reset-password/page.tsx` | shared shell (lower priority). |
| `src/app/(frontend)/(auth)/AuthShell.tsx` + `BrandPanel.tsx` | new. |
| `src/app/(frontend)/page.tsx` | copy already fine; verify CTAs. |

## 6. Non-goals

- No change to Payload auth, roles, session/cookie handling, or the `/register` self-registration
  eligibility rules (commit 589a9e7).
- No social login, no magic links, no email verification changes.
- Guest work is **not** persisted server-side — only the existing `localStorage` draft. A guest who
  clears storage before signing in loses the form (acceptable; it's a 6-field form).
- The Setup Assistant answers ride in the URL for guests (already how it works), not a DB row.

## 7. Verification checklist

- [ ] Logged out, from landing → "Create your event" → lands on **Setup Assistant** (not `/login`).
- [ ] Guest can navigate Setup → Event details, fill the form.
- [ ] Guest submit → `/login?redirect=…&intent=create`, context banner shown, "Create account" primary.
- [ ] Register (or login) → back on **event step**, draft-restore banner → refill → submit → event
      created → Step 2 (Sports). Setup Assistant answers preserved on the created event.
- [ ] Direct hit `/workspaces/event-admin/new-event?step=sports` while logged out → `/login`.
- [ ] `?eventId=…` while logged out → `/login`. Logged-in wrong role → Unauthorized page.
- [ ] Every server action still redirects to login when logged out.
- [ ] `tsc` clean, `vitest` green, all auth pages render 200 on `https://intourney.id`.
