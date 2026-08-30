import type { Payload } from 'payload'

export const wizardPage = '/workspaces/event-admin/new-event'

// Single source of truth for which category formats step 8 (Generate Matches) can auto-generate a
// first round for. Kept here (not just in generateActions.ts) so the step 4 format picker can
// warn the user up front instead of them discovering the "manual scheduling only" limit four
// steps later.
export const AUTO_GENERATE_FORMATS = new Set([
  'single_elimination',
  'round_robin',
  'double_elimination',
  'time_trial',
  'score_ranking',
])

// A category's generated fixtures can still be cleared (and the category rebuilt) only while every
// one of its matches is in one of these "nothing has happened yet" states. The moment a match is
// checked in / started / has a result, the fixtures are load-bearing and the wizard refuses to wipe
// them - mirrors the UNSTARTED_TARGET_STATUSES guard winnerAdvancement.ts / undoPromoteToKnockout
// use, kept deliberately stricter here (no `published` / `check_in_open` / `ready_to_start`).
export const CLEARABLE_FIXTURE_STATUSES = new Set(['draft', 'ready_for_scheduling', 'scheduled'])

type FixtureMatch = { category_id?: unknown; status?: unknown; winner_entry_id?: unknown }

// Rolls an already-fetched match list up per category into { count, locked } so a caller that has
// loaded the matches once (e.g. GenerateStep) doesn't need a second query to decide whether the
// "Clear & rebuild" affordance is safe to offer. `locked` = at least one match has moved past the
// clearable states or already has a winner.
export const summarizeCategoryFixtures = (matches: FixtureMatch[]) => {
  const byCategory = new Map<string, { count: number; locked: boolean }>()
  for (const match of matches) {
    const key = String(match.category_id)
    const current = byCategory.get(key) ?? { count: 0, locked: false }
    current.count += 1
    if (!CLEARABLE_FIXTURE_STATUSES.has(String(match.status)) || match.winner_entry_id != null) {
      current.locked = true
    }
    byCategory.set(key, current)
  }
  return byCategory
}

export const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

// `redirect()` / `notFound()` work by throwing a control-flow error Next.js re-catches upstream -
// a try/catch around a server action's body must let those through untouched and only swallow real
// failures. https://nextjs.org/docs/app/api-reference/functions/redirect#behavior
export const isNextControlFlowError = (error: unknown): boolean =>
  typeof (error as { digest?: unknown })?.digest === 'string' &&
  ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
    (error as { digest: string }).digest === 'NEXT_NOT_FOUND')

export const getWizardEvent = async (payload: Payload, eventId: string) => {
  if (!eventId) {
    return null
  }

  try {
    return await payload.findByID({ collection: 'events', id: eventId, depth: 0 })
  } catch {
    return null
  }
}
