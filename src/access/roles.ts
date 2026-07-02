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
