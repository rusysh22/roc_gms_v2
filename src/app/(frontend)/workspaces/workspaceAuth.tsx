import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import type { UserRole } from '@/access/roles'
import { buttonVariants } from '@/components/ui/button'

type WorkspaceUser = {
  id: string | number
  email?: string | null
  name?: string | null
  roles?: UserRole[] | null
}

type WorkspaceAccessResult =
  | {
      authorized: true
      payload: Payload
      user: WorkspaceUser
    }
  | {
      authorized: false
      payload: Payload
      user: WorkspaceUser
      allowedRoles: UserRole[]
      workspaceName: string
    }

export const WORKSPACE_ROLES = {
  eventAdmin: ['super_admin', 'event_admin'],
  scheduler: ['super_admin', 'event_admin', 'scheduler'],
  matchOfficer: ['super_admin', 'event_admin', 'match_officer'],
  contentAdmin: ['super_admin', 'event_admin', 'content_admin'],
  brackets: ['super_admin', 'event_admin', 'scheduler'],
  standings: ['super_admin', 'event_admin', 'scheduler'],
} satisfies Record<string, UserRole[]>

export const hasWorkspaceRole = (
  user: WorkspaceUser | null | undefined,
  allowedRoles: UserRole[],
) => {
  if (!user) {
    return false
  }

  return Boolean(user.roles?.some((role) => allowedRoles.includes(role)))
}

const getLoginUrl = (returnTo: string) =>
  `/admin/login?redirect=${encodeURIComponent(returnTo)}`

export const getAuthenticatedWorkspaceUser = async (payload: Payload) => {
  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user?.id) {
    return null
  }

  return (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })) as WorkspaceUser
}

export const requireWorkspaceAccess = async ({
  allowedRoles,
  returnTo,
  workspaceName,
}: {
  allowedRoles: UserRole[]
  returnTo: string
  workspaceName: string
}): Promise<WorkspaceAccessResult> => {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)

  if (!user) {
    redirect(getLoginUrl(returnTo))
  }

  if (!hasWorkspaceRole(user, allowedRoles)) {
    return {
      authorized: false,
      payload,
      user,
      allowedRoles,
      workspaceName,
    }
  }

  return {
    authorized: true,
    payload,
    user,
  }
}

export const assertWorkspaceActionAccess = async ({
  allowedRoles,
  returnTo,
}: {
  allowedRoles: UserRole[]
  returnTo: string
}) => {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)

  if (!user) {
    redirect(getLoginUrl(returnTo))
  }

  if (!hasWorkspaceRole(user, allowedRoles)) {
    redirect(`${returnTo}?workspaceError=unauthorized`)
  }

  return { payload, user }
}

export const WorkspaceUnauthorized = ({
  workspaceName,
  allowedRoles,
}: {
  workspaceName: string
  allowedRoles: UserRole[]
}) => (
  <main className="flex min-h-svh items-center justify-center bg-mist px-4 py-12 font-sans">
    <div className="w-full max-w-md rounded-panel border border-line bg-paper p-8 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mist text-gold">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Unauthorized</p>
      <h1 className="mt-1 text-2xl font-extrabold text-ink">Access restricted</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Your account does not have access to {workspaceName}. Ask a Super Admin to adjust your role
        if you need to work in this area.
      </p>
      <div className="mt-5 rounded-card border border-line bg-mist px-4 py-3 text-left">
        <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Allowed roles</p>
        <p className="mt-1 text-sm font-semibold text-ink">
          {allowedRoles.map((role) => role.replaceAll('_', ' ')).join(', ')}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/workspaces" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          Workspaces
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
          Public Home
        </Link>
      </div>
    </div>
  </main>
)
