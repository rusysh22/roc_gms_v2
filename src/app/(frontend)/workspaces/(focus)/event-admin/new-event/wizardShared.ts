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
