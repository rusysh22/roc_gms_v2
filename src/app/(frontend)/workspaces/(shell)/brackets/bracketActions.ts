'use server'

import { redirect } from 'next/navigation'

import { canAccessEvent, getRelationId } from '@/access/eventMembership'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import { ensureSingleEliminationBracketStructure } from '@/lib/bracketRepair'
import { recalculateDoubleEliminationBracket } from '@/lib/doubleElimination'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'

export const recalculateBracketStageAction = async (formData: FormData) => {
  const stageId = String(formData.get('stageId') || '')

  if (!stageId) {
    redirect('/workspaces/brackets?bracketError=missing_stage')
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.brackets,
    returnTo: '/workspaces/brackets',
  })

  const stage = await payload.findByID({ collection: 'stages', id: stageId, depth: 0 }).catch(() => null)

  // AUDIT_TOURNAMENT_STANDARDS SEC-01: stageId comes straight from the form and the role check is
  // global - verify the caller is a member of the stage's event before rebuilding its bracket.
  const stageEventId = getRelationId(stage?.event_id)
  if (!stage || (stageEventId && !(await canAccessEvent(payload, user, stageEventId)))) {
    redirect('/workspaces/brackets?bracketError=missing_stage')
  }

  if (stage!.stage_type === 'double_elimination') {
    const result = await recalculateDoubleEliminationBracket(payload, { stageId })
    redirect(`/workspaces/brackets?bracketUpdated=1&matches=${result.matchCount}&repaired=0`)
  }

  const repair = await ensureSingleEliminationBracketStructure(payload, stageId)
  const result = await recalculateSingleEliminationBracket(payload, { stageId })

  redirect(`/workspaces/brackets?bracketUpdated=1&matches=${result.matchCount}&repaired=${repair.createdCount}`)
}
