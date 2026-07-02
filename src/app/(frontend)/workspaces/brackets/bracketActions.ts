'use server'

import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'

export const recalculateBracketStageAction = async (formData: FormData) => {
  const stageId = String(formData.get('stageId') || '')

  if (!stageId) {
    redirect('/workspaces/brackets?bracketError=missing_stage')
  }

  const payload = await getPayload({ config })
  const result = await recalculateSingleEliminationBracket(payload, { stageId })

  redirect(`/workspaces/brackets?bracketUpdated=1&matches=${result.matchCount}`)
}
