import type { Access, CollectionBeforeChangeHook, FieldAccess, Payload } from 'payload'
import { Forbidden } from 'payload'

export type UserRole =
  | 'super_admin'
  | 'event_admin'
  | 'scheduler'
  | 'match_officer'
  | 'content_admin'
  | 'registration'
  | 'draw'

type AccessUser = {
  roles?: UserRole[] | null
}

const hasRole = (user: AccessUser | null | undefined, roles: UserRole[]) => {
  return Boolean(user?.roles?.some((role) => roles.includes(role)))
}

/** Named capabilities keep routes and server actions aligned. Collection rules
 * remain the authoritative authorization boundary. */
export const CAPABILITIES = {
  accessEventSetup: ['super_admin', 'event_admin'],
  accessScheduler: ['super_admin', 'event_admin', 'scheduler'],
  accessMatchOperations: ['super_admin', 'event_admin', 'match_officer'],
  recalculateStandings: ['super_admin', 'event_admin', 'scheduler'],
  recalculateBrackets: ['super_admin', 'event_admin', 'scheduler'],
  editPublicContent: ['super_admin', 'event_admin', 'content_admin'],
  reviseFinishedScore: ['super_admin', 'event_admin'],
  // Split out of the former single canManageMatches capability (AUDIT_E2E AUTH-02) so a
  // match_officer can no longer create/delete matches or change schedule/venue, and a scheduler
  // can no longer overwrite an already-published result - both previously possible through
  // Payload Admin/REST/GraphQL even though the custom workspace UI never exposed those actions.
  createMatch: ['super_admin', 'event_admin', 'scheduler'],
  deleteMatch: ['super_admin', 'event_admin'],
  scheduleMatch: ['super_admin', 'event_admin', 'scheduler'],
  operateMatch: ['super_admin', 'event_admin', 'match_officer'],
} satisfies Record<string, UserRole[]>

export const hasCapability = (
  user: AccessUser | null | undefined,
  capability: keyof typeof CAPABILITIES,
) => hasRole(user, CAPABILITIES[capability])

export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

export const isSuperAdmin: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, ['super_admin'])
}

export const isSystemAdmin: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, ['super_admin', 'event_admin'])
}

export const canManageContent: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, [
    'super_admin',
    'event_admin',
    'content_admin',
  ])
}

export const canManageEventStructure: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, ['super_admin', 'event_admin'])
}

/** NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 4 "collaborative roles": a `draw` role owns the
 * competitor database and seeding (Clubs/Teams/Players/Rosters/CompetitionEntries) without the
 * rest of event_admin's power (venues, appearance, sponsors, category/bracket generation). */
export const canManageParticipants: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, ['super_admin', 'event_admin', 'draw'])
}

/** Same split for the `registration` role: owns the public registration approval queue only. */
export const canManageRegistrationQueue: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, ['super_admin', 'event_admin', 'registration'])
}

export const canManageSchedule: Access = ({ req }) => {
  return hasCapability(req.user as AccessUser | null | undefined, 'accessScheduler')
}

export const canManageMatches: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, [
    'super_admin',
    'event_admin',
    'scheduler',
    'match_officer',
  ])
}

/** Only schedulers and above may create new fixtures - a match_officer operates matches that
 * already exist but should not be able to invent new ones. */
export const canCreateMatch: Access = ({ req }) => {
  return hasCapability(req.user as AccessUser | null | undefined, 'createMatch')
}

/** Hard-deleting a match is destructive and permanent - reserved for event_admin/super_admin. */
export const canDeleteMatch: Access = ({ req }) => {
  return hasCapability(req.user as AccessUser | null | undefined, 'deleteMatch')
}

const SCHEDULE_FIELDS = ['scheduled_start_at', 'scheduled_end_at', 'venue_id', 'court_id'] as const
const RESULT_FIELDS = ['winner_entry_id', 'score_summary', 'result_value', 'result_qualifier'] as const
const LOCKED_RESULT_STATUSES = new Set(['finished', 'result_published', 'walkover', 'disputed'])

/** NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.5: once a group_stage is finalized (status 'completed')
 * and its qualifiers have already been promoted into a knockout stage, a group-stage match's
 * result must not be revisable - doing so would silently rewrite the persisted standings/
 * qualified_status underneath participants already placed into knockout bracket slots. Undo
 * Phase (groupActions.ts's undoPromoteToKnockoutAction) is the only supported way back in, and
 * it refuses to run once any of those knockout matches has itself started. */
const isGroupPhaseLocked = async (payload: Payload, stageId: string | number): Promise<boolean> => {
  const stage = await payload.findByID({ collection: 'stages', id: stageId, depth: 0 }).catch(() => null)
  if (!stage || stage.order !== 1 || stage.status !== 'completed') {
    return false
  }
  const knockoutStage = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 1,
    where: { and: [{ category_id: { equals: stage.category_id } }, { order: { equals: 2 } }] },
  })
  if (!knockoutStage.docs[0]) {
    return false
  }
  const knockoutMatches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { stage_id: { equals: knockoutStage.docs[0].id } },
  })
  return knockoutMatches.totalDocs > 0
}

const getFieldValueId = (value: unknown) =>
  value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)
    ? (value as { id: unknown }).id
    : value

const fieldChanged = (
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown>,
  field: string,
) => field in data && getFieldValueId(data[field]) !== getFieldValueId(originalDoc[field])

/** Collection-boundary enforcement for the create_match/schedule_match/operate_match/
 * revise_result split (AUDIT_E2E AUTH-02): runs on every entry point (Local API, REST, GraphQL,
 * Payload Admin), not just the custom workspace UI, so a scheduler genuinely cannot revise a
 * published result and a match_officer genuinely cannot reschedule a match - previously only the
 * custom Server Actions checked this, so the same mutation via Payload Admin/REST/GraphQL bypassed
 * it entirely. */
export const enforceMatchMutationCapabilities: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (operation !== 'update' || !originalDoc) {
    return data
  }

  const changesResult =
    RESULT_FIELDS.some((field) => fieldChanged(data, originalDoc, field)) ||
    ('status' in data && data.status !== originalDoc.status)

  // Checked before the super_admin/event_admin bypass below - the phase lock applies to every
  // role, since event_admin is exactly who would otherwise revise a finalized group match.
  if (changesResult && originalDoc.stage_id) {
    const locked = await isGroupPhaseLocked(req.payload, getFieldValueId(originalDoc.stage_id) as string | number)
    if (locked) {
      throw new Forbidden(req.t)
    }
  }

  const user = req.user as AccessUser | null | undefined
  if (hasRole(user, ['super_admin', 'event_admin'])) {
    return data
  }

  const changesSchedule = SCHEDULE_FIELDS.some((field) => fieldChanged(data, originalDoc, field))
  if (changesSchedule && !hasCapability(user, 'scheduleMatch')) {
    throw new Forbidden(req.t)
  }

  const wasLocked = LOCKED_RESULT_STATUSES.has(String(originalDoc.status))
  if (wasLocked && changesResult && !hasCapability(user, 'reviseFinishedScore')) {
    throw new Forbidden(req.t)
  }

  return data
}

/** Same boundary as enforceMatchMutationCapabilities, but for the sets that make up a match's
 * score: once the parent match is locked (finished/result_published/walkover/disputed), only
 * event_admin/super_admin may still touch its sets - a match_officer/scheduler must go through the
 * revision-reason flow the workspace UI already requires, not a direct API/Admin write. */
export const enforceMatchSetMutationCapabilities: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  const user = req.user as AccessUser | null | undefined
  if (hasRole(user, ['super_admin', 'event_admin'])) {
    return data
  }

  const matchId = getFieldValueId(data.match_id ?? originalDoc?.match_id)
  if (!matchId) {
    return data
  }

  const match = await req.payload
    .findByID({ collection: 'matches', id: matchId as string | number, depth: 0 })
    .catch(() => null)

  if (match && LOCKED_RESULT_STATUSES.has(String(match.status))) {
    throw new Forbidden(req.t)
  }

  return data
}

export const canReadEventBackoffice: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, [
    'super_admin',
    'event_admin',
    'scheduler',
    'match_officer',
    'content_admin',
    'registration',
    'draw',
  ])
}

export const canReadAdminField: FieldAccess = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, ['super_admin'])
}

/** Unauthenticated callers can only see explicitly public documentation. */
export const canReadDocumentation: Access = ({ req }) => {
  if (req.user) return true
  return { visibility: { equals: 'public' } }
}

/** Public APIs must not reveal drafts or internal matches. */
export const canReadPublicMatch: Access = ({ req }) => {
  if (req.user) return true
  return { is_public: { equals: true } }
}

export const canReadBackofficeOnly: Access = ({ req }) => Boolean(req.user)
