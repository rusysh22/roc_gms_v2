import type { Payload } from 'payload'

export const wizardPage = '/workspaces/event-admin/new-event'

// Single source of truth for which category formats step 6 (Generate Matches) can auto-generate a
// first round for. Kept here (not just in generateActions.ts) so the step 3 format picker can
// warn the user up front instead of them discovering the "manual scheduling only" limit three
// steps later.
export const AUTO_GENERATE_FORMATS = new Set(['single_elimination', 'round_robin'])

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
