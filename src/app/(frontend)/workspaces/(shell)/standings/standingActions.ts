'use server'

import { redirect } from 'next/navigation'

import { recalculateStandingsForScope } from '@/lib/standings'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'

export const recalculateStandingScopeAction = async (formData: FormData) => {
  const categoryId = String(formData.get('categoryId') || '')
  const stageId = String(formData.get('stageId') || '')
  const groupId = String(formData.get('groupId') || '')

  if (!categoryId || !stageId) {
    redirect('/workspaces/standings?standingError=missing_scope')
  }

  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.standings,
    returnTo: '/workspaces/standings',
  })
  const result = await recalculateStandingsForScope(payload, {
    categoryId,
    stageId,
    groupId: groupId || undefined,
  })

  redirect(`/workspaces/standings?standingUpdated=1&rows=${result.rows.length}`)
}
