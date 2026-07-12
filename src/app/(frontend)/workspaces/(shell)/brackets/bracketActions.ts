'use server'

import { redirect } from 'next/navigation'

import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import { ensureSingleEliminationBracketStructure } from '@/lib/bracketRepair'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../workspaceAuth'

export const recalculateBracketStageAction = async (formData: FormData) => {
  const stageId = String(formData.get('stageId') || '')

  if (!stageId) {
    redirect('/workspaces/brackets?bracketError=missing_stage')
  }

  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.brackets,
    returnTo: '/workspaces/brackets',
  })
  const repair = await ensureSingleEliminationBracketStructure(payload, stageId)
  const result = await recalculateSingleEliminationBracket(payload, { stageId })

  redirect(`/workspaces/brackets?bracketUpdated=1&matches=${result.matchCount}&repaired=${repair.createdCount}`)
}
