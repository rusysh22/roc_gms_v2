'use server'

import { redirect } from 'next/navigation'

import { canAccessEvent, getRelationId } from '@/access/eventMembership'
import { recalculateStandingsForScope } from '@/lib/standings'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'

export const recalculateStandingScopeAction = async (formData: FormData) => {
  const categoryId = String(formData.get('categoryId') || '')
  const stageId = String(formData.get('stageId') || '')
  const groupId = String(formData.get('groupId') || '')

  if (!categoryId || !stageId) {
    redirect('/workspaces/standings?standingError=missing_scope')
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.standings,
    returnTo: '/workspaces/standings',
  })

  // AUDIT_TOURNAMENT_STANDARDS SEC-01: categoryId is a form value and the role check is global -
  // verify event membership via the category before recalculating its standings.
  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  const categoryEventId = getRelationId(category?.event_id)
  if (!category || (categoryEventId && !(await canAccessEvent(payload, user, categoryEventId)))) {
    redirect('/workspaces/standings?standingError=missing_scope')
  }

  const result = await recalculateStandingsForScope(payload, {
    categoryId,
    stageId,
    groupId: groupId || undefined,
  })

  redirect(`/workspaces/standings?standingUpdated=1&rows=${result.rows.length}`)
}
