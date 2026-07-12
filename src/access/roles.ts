import type { Access, FieldAccess } from 'payload'

export type UserRole =
  | 'super_admin'
  | 'event_admin'
  | 'scheduler'
  | 'match_officer'
  | 'content_admin'

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

export const canReadEventBackoffice: Access = ({ req }) => {
  return hasRole(req.user as AccessUser | null | undefined, [
    'super_admin',
    'event_admin',
    'scheduler',
    'match_officer',
    'content_admin',
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
