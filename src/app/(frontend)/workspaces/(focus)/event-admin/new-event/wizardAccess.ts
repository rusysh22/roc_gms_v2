import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { recordAuditLog } from '@/lib/audit'
import { ACTIVE_EVENT_COOKIE } from '../../../activeEvent'
import {
  WORKSPACE_ROLES,
  getAuthenticatedWorkspaceUser,
  hasWorkspaceRole,
} from '../../../workspaceAuth'
import { wizardPage } from './wizardShared'

// The visitor's proof that a given draft event is theirs: an httpOnly cookie holding the event id
// and the random token that was written to events.draft_claim_token when they created it while
// logged out. Unsigned is fine - same capability model as `active_event_id`; the token itself is
// the secret and there is exactly one per event.
export const WIZARD_DRAFT_COOKIE = 'wizard_draft'

// Steps a logged-out visitor may walk. Everything from "Clubs / Teams / Players" onward
// ("generate club/player") needs a real account - see NEW_EVENT anonymous-wizard plan.
export const ANON_WIZARD_STEPS = new Set(['setup', 'event', 'sports', 'venues', 'categories'])

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
} as const

type DraftCookie = { eventId: string; token: string }

export const readWizardDraftCookie = async (): Promise<DraftCookie | null> => {
  const raw = (await cookies()).get(WIZARD_DRAFT_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<DraftCookie>
    if (parsed && typeof parsed.eventId === 'string' && typeof parsed.token === 'string') {
      return { eventId: parsed.eventId, token: parsed.token }
    }
  } catch {
    /* malformed cookie - treat as absent */
  }
  return null
}

export const setWizardDraftCookie = async (eventId: string | number, token: string): Promise<void> => {
  ;(await cookies()).set(
    WIZARD_DRAFT_COOKIE,
    JSON.stringify({ eventId: String(eventId), token }),
    { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 7 },
  )
}

export const clearWizardDraftCookie = async (): Promise<void> => {
  ;(await cookies()).delete(WIZARD_DRAFT_COOKIE)
}

type WizardEvent = {
  id: string | number
  status?: string | null
  draft_claim_token?: string | null
  organizer_name?: string | null
}

/** The draft is the caller's iff the cookie names this exact event, the stored token matches, and
 * the event is still an unclaimed draft. Returns the event row on success so callers that need it
 * don't re-fetch. */
const verifyAnonDraft = async (
  payload: Payload,
  eventId: string,
): Promise<WizardEvent | null> => {
  if (!eventId) return null
  const draft = await readWizardDraftCookie()
  if (!draft || draft.eventId !== String(eventId)) return null
  const event = (await payload
    .findByID({ collection: 'events', id: eventId, depth: 0 })
    .catch(() => null)) as WizardEvent | null
  if (!event || event.status !== 'draft') return null
  if (!event.draft_claim_token || event.draft_claim_token !== draft.token) return null
  return event
}

/** When a now-authenticated organizer opens (or acts on) a wizard whose event is still an
 * unclaimed anonymous draft they own, transfer it to their account: enrol them as its first
 * member (the Events.ts afterChange hook never fired - no req.user at anon create time), clear the
 * token, point the active-event cookie at it. Best-effort and idempotent - a second call after the
 * token is already NULL is a no-op. MUST only run from a Server Action / Route Handler (it writes
 * cookies). */
export const claimDraftIfPending = async (
  payload: Payload,
  eventId: string,
  user: { id: string | number; name?: string | null },
): Promise<boolean> => {
  const draft = await readWizardDraftCookie()
  if (!draft || draft.eventId !== String(eventId)) return false

  const event = (await payload
    .findByID({ collection: 'events', id: eventId, depth: 0 })
    .catch(() => null)) as WizardEvent | null
  if (!event || !event.draft_claim_token || event.draft_claim_token !== draft.token) {
    // Cookie is stale (already claimed, or points at someone else's event) - drop it.
    await clearWizardDraftCookie()
    return false
  }

  try {
    await payload.create({
      collection: 'event-memberships',
      data: { event_id: Number(eventId), user_id: Number(user.id) },
    })
  } catch (error) {
    payload.logger.error(`Failed to enrol claimer as member of event ${eventId}: ${error}`)
  }

  await payload.update({
    collection: 'events',
    id: eventId,
    data: {
      draft_claim_token: null,
      draft_creator_ip: null,
      organizer_name: event.organizer_name || user.name || undefined,
    },
  })

  await recordAuditLog({
    payload,
    action: 'event.claim',
    entityType: 'events',
    entityId: eventId,
    before: null,
    after: { claimed_by: user.id },
    actorUserId: user.id,
  })

  const jar = await cookies()
  jar.set(ACTIVE_EVENT_COOKIE, String(eventId), { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 })
  jar.delete(WIZARD_DRAFT_COOKIE)
  revalidatePath(wizardPage)
  return true
}

export type WizardActor =
  | { mode: 'user'; payload: Payload; user: Awaited<ReturnType<typeof getAuthenticatedWorkspaceUser>> }
  | { mode: 'anon'; payload: Payload; user: null }

const loginRedirect = (returnTo: string): never => {
  redirect(`/login?redirect=${encodeURIComponent(returnTo)}`)
}

export const buildWizardReturnTo = (step: string, eventId: string): string =>
  eventId ? `${wizardPage}?eventId=${eventId}&step=${step}` : `${wizardPage}?step=${step}`

/** Shared resolution used by both the wizard page (render context - does NOT mutate) and the
 * step-1..5 server actions (via assertWizardActionAccess, which additionally runs the claim). */
export const resolveWizardAccess = async ({
  step,
  eventId,
  returnTo,
}: {
  step: string
  eventId: string
  returnTo: string
}): Promise<WizardActor> => {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)

  if (user) {
    if (hasWorkspaceRole(user, WORKSPACE_ROLES.eventAdmin)) {
      return { mode: 'user', payload, user }
    }
    // Signed in but without event-admin capability - not an anonymous visitor; send them somewhere
    // sane rather than bouncing through /login (which would just redirect them back here).
    redirect('/workspaces?workspaceError=unauthorized')
  }

  if (ANON_WIZARD_STEPS.has(step)) {
    if (!eventId) {
      return { mode: 'anon', payload, user: null }
    }
    if (await verifyAnonDraft(payload, eventId)) {
      return { mode: 'anon', payload, user: null }
    }
  }

  return loginRedirect(returnTo)
}

/** Guard for the step-1..5 server actions. Drop-in replacement for `assertWorkspaceActionAccess`
 * that additionally admits a valid anonymous draft session and, for a signed-in caller, claims a
 * still-pending draft. `user` is null in anon mode - pass `actorUserId: user?.id ?? null`. */
export const assertWizardActionAccess = async (
  formData: FormData,
  step: string,
): Promise<WizardActor> => {
  const raw = formData.get('eventId')
  const eventId = typeof raw === 'string' ? raw.trim() : ''
  const access = await resolveWizardAccess({
    step,
    eventId,
    returnTo: buildWizardReturnTo(step, eventId),
  })
  if (access.mode === 'user' && eventId && access.user) {
    await claimDraftIfPending(access.payload, eventId, access.user)
  }
  return access
}
