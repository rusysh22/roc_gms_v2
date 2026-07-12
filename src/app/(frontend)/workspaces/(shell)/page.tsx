import { redirect } from 'next/navigation'

import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../workspaceAuth'

export const dynamic = 'force-dynamic'

const ALL_WORKSPACE_ROLES = [
  'super_admin',
  'event_admin',
  'scheduler',
  'match_officer',
  'content_admin',
] as const

/** Entry point used by the public navigation. Authentication is enforced here,
 * then each staff member lands in the most relevant workspace for their role. */
export default async function WorkspaceEntryPage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: [...ALL_WORKSPACE_ROLES],
    returnTo: '/workspaces',
    workspaceName: 'Operational Workspaces',
  })

  if (!access.authorized) {
    return (
      <WorkspaceUnauthorized
        workspaceName={access.workspaceName}
        allowedRoles={access.allowedRoles}
      />
    )
  }

  const roles = access.user.roles || []
  if (roles.includes('super_admin') || roles.includes('event_admin')) {
    redirect('/workspaces/event-admin')
  }
  if (roles.includes('scheduler')) redirect('/workspaces/scheduler')
  if (roles.includes('match_officer')) redirect('/workspaces/match-officer')
  if (roles.includes('content_admin')) redirect('/workspaces/content-admin')

  return <WorkspaceUnauthorized workspaceName="Operational Workspaces" allowedRoles={[...ALL_WORKSPACE_ROLES]} />
}
