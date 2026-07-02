'use server'

import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { recordAuditLog } from '@/lib/audit'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import { recalculateStandingsForScope } from '@/lib/standings'
import { attemptSingleEliminationWinnerAdvancement } from '@/lib/winnerAdvancement'
import { isValidTransition } from './matchLifecycle'

type MinimalMatch = {
  id: string | number
  event_id?: string | number | null
  category_id?: string | number | null
  stage_id?: string | number | null
  group_id?: string | number | null
  status: string
  actual_start_at?: string | null
  actual_end_at?: string | null
  participant_a_entry_id?: string | number | null
  participant_b_entry_id?: string | number | null
  winner_entry_id?: string | number | null
}

type MinimalStage = {
  id: string | number
  stage_type?: string | null
}

type MinimalMatchSet = {
  id: string | number
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
  winner_entry_id?: string | number | null
  notes?: string | null
}

const toStringField = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : ''

const parseScore = (value: FormDataEntryValue | null) => {
  const text = toStringField(value)
  if (text === '') {
    return 0
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed)
}

const findMatchByNumber = async (matchNumber: string) => {
  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { match_number: { equals: matchNumber } },
  })

  return { payload, match: matches.docs[0] as MinimalMatch | undefined }
}

const revalidateMatch = (matchNumber: string) => {
  revalidatePath(`/workspaces/matches/${matchNumber}`)
  revalidatePath(`/matches/${matchNumber}`)
  revalidatePath('/standings')
  revalidatePath('/brackets')
  revalidatePath('/workspaces/standings')
  revalidatePath('/workspaces/brackets')
}

const getActorUserId = async (payload: Payload): Promise<string | number | null> => {
  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })
  return user?.id ?? null
}

const standingStageTypes = new Set(['group_stage', 'round_robin', 'league', 'swiss'])
const standingResultStatuses = new Set(['finished', 'result_published'])

const recalculateResultCachesBestEffort = async ({
  payload,
  match,
  matchNumber,
  action,
  actorUserId,
}: {
  payload: Payload
  match: MinimalMatch
  matchNumber: string
  action: string
  actorUserId: string | number | null
}) => {
  if (!match.stage_id || !match.category_id) {
    return
  }

  let stage: MinimalStage
  try {
    stage = (await payload.findByID({
      collection: 'stages',
      id: match.stage_id,
      depth: 0,
    })) as MinimalStage
  } catch (error) {
    payload.logger.error(
      `Failed to load stage for result cache recalculation after ${action} on match ${matchNumber}: ${error}`,
    )
    return
  }

  if (stage.stage_type && standingStageTypes.has(stage.stage_type)) {
    if (!standingResultStatuses.has(match.status)) {
      return
    }

    try {
      const result = await recalculateStandingsForScope(payload, {
        eventId: match.event_id || undefined,
        categoryId: match.category_id,
        stageId: match.stage_id,
        groupId: match.group_id || undefined,
      })

      await recordAuditLog({
        payload,
        action: 'standing.cache_recalculate',
        entityType: 'matches',
        entityId: match.id,
        before: null,
        after: {
          reason: action,
          match_number: matchNumber,
          row_count: result.rows.length,
          finished_match_count: result.finishedMatchCount,
        },
        actorUserId,
      })
    } catch (error) {
      payload.logger.error(
        `Failed to recalculate standings after ${action} on match ${matchNumber}: ${error}`,
      )
    }

    return
  }

  if (stage.stage_type === 'single_elimination') {
    if (match.status === 'result_published' && match.winner_entry_id) {
      try {
        const advancement = await attemptSingleEliminationWinnerAdvancement(payload, match.id)

        await recordAuditLog({
          payload,
          action: advancement.advanced ? 'winner_advancement.advance' : 'winner_advancement.skip',
          entityType: 'matches',
          entityId: match.id,
          before: null,
          after: {
            reason: action,
            match_number: matchNumber,
            outcome: advancement.outcome,
            skipped_reason: advancement.reason,
            winner_entry_id: advancement.winnerEntryId,
            winner_label: advancement.winnerLabel,
            target_match_id: advancement.targetMatchId,
            target_match_number: advancement.targetMatchNumber,
            target_slot: advancement.targetSlot,
            advanced: advancement.advanced,
          },
          actorUserId,
        })

        if (advancement.targetMatchNumber) {
          revalidatePath(`/workspaces/matches/${advancement.targetMatchNumber}`)
          revalidatePath(`/matches/${advancement.targetMatchNumber}`)
        }
      } catch (error) {
        payload.logger.error(
          `Failed to attempt winner advancement after ${action} on match ${matchNumber}: ${error}`,
        )
      }
    }

    try {
      const result = await recalculateSingleEliminationBracket(payload, {
        stageId: match.stage_id,
      })

      await recordAuditLog({
        payload,
        action: 'bracket.cache_recalculate',
        entityType: 'matches',
        entityId: match.id,
        before: null,
        after: {
          reason: action,
          match_number: matchNumber,
          bracket_id: result.bracketId,
          match_count: result.matchCount,
          round_count: result.roundCount,
        },
        actorUserId,
      })
    } catch (error) {
      payload.logger.error(
        `Failed to recalculate bracket after ${action} on match ${matchNumber}: ${error}`,
      )
    }
  }
}

export async function transitionMatchStatusAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const targetStatus = toStringField(formData.get('targetStatus'))
  const winnerSide = toStringField(formData.get('winnerSide'))

  if (!matchNumber || !targetStatus) {
    redirect(`/workspaces/matches/${matchNumber || ''}?matchError=invalid_request`)
  }

  const { payload, match } = await findMatchByNumber(matchNumber)

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=not_found`)
  }

  if (!isValidTransition(match.status, targetStatus)) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=invalid_transition`)
  }

  const updateData: Record<string, unknown> = { status: targetStatus }

  if (targetStatus === 'ongoing' && !match.actual_start_at) {
    updateData.actual_start_at = new Date().toISOString()
  }

  if (targetStatus === 'finished' && !match.actual_end_at) {
    updateData.actual_end_at = new Date().toISOString()
  }

  if ((targetStatus === 'result_published' || targetStatus === 'walkover') && winnerSide) {
    const winnerEntryId =
      winnerSide === 'a'
        ? match.participant_a_entry_id
        : winnerSide === 'b'
          ? match.participant_b_entry_id
          : null

    if (winnerEntryId) {
      updateData.winner_entry_id = winnerEntryId
    }
  }

  const beforeSnapshot = {
    status: match.status,
    actual_start_at: match.actual_start_at ?? null,
    actual_end_at: match.actual_end_at ?? null,
    winner_entry_id: match.winner_entry_id ?? null,
  }

  await payload.update({
    collection: 'matches',
    id: match.id,
    data: updateData,
  })

  const actorUserId = await getActorUserId(payload)

  await recordAuditLog({
    payload,
    action: 'match.status_transition',
    entityType: 'matches',
    entityId: match.id,
    before: beforeSnapshot,
    after: { ...beforeSnapshot, ...updateData },
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match: { ...match, ...updateData, status: targetStatus },
    matchNumber,
    action: 'match.status_transition',
    actorUserId,
  })

  revalidateMatch(matchNumber)
  redirect(`/workspaces/matches/${matchNumber}?matchUpdated=1`)
}

export async function updateMatchSetScoreAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const matchSetId = toStringField(formData.get('matchSetId'))
  const winnerSide = toStringField(formData.get('winnerSide'))
  const notes = toStringField(formData.get('notes'))
  const participantAScore = parseScore(formData.get('participantAScore'))
  const participantBScore = parseScore(formData.get('participantBScore'))

  if (!matchNumber || !matchSetId) {
    redirect(`/workspaces/matches/${matchNumber || ''}?matchError=invalid_request`)
  }

  if (participantAScore === null || participantBScore === null) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=invalid_score`)
  }

  const { payload, match } = await findMatchByNumber(matchNumber)

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=not_found`)
  }

  const winnerEntryId =
    winnerSide === 'a'
      ? match.participant_a_entry_id
      : winnerSide === 'b'
        ? match.participant_b_entry_id
        : null

  const existingSet = (await payload.findByID({
    collection: 'match-sets',
    id: matchSetId,
    depth: 0,
  })) as MinimalMatchSet

  const beforeSnapshot = {
    participant_a_score: existingSet.participant_a_score ?? null,
    participant_b_score: existingSet.participant_b_score ?? null,
    winner_entry_id: existingSet.winner_entry_id ?? null,
    notes: existingSet.notes ?? null,
  }
  const afterSnapshot = {
    participant_a_score: participantAScore,
    participant_b_score: participantBScore,
    winner_entry_id: winnerEntryId,
    notes: notes || null,
  }

  await payload.update({
    collection: 'match-sets',
    id: matchSetId,
    data: afterSnapshot,
  })

  const actorUserId = await getActorUserId(payload)

  await recordAuditLog({
    payload,
    action: 'match_set.score_update',
    entityType: 'match-sets',
    entityId: matchSetId,
    before: beforeSnapshot,
    after: afterSnapshot,
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match,
    matchNumber,
    action: 'match_set.score_update',
    actorUserId,
  })

  revalidateMatch(matchNumber)
  redirect(`/workspaces/matches/${matchNumber}?matchUpdated=1`)
}

export async function addMatchSetAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))

  if (!matchNumber) {
    redirect('/workspaces/scheduler?matchError=invalid_request')
  }

  const { payload, match } = await findMatchByNumber(matchNumber)

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?matchError=not_found`)
  }

  const existingSets = await payload.find({
    collection: 'match-sets',
    depth: 0,
    limit: 1,
    sort: '-set_number',
    where: { match_id: { equals: match.id } },
  })
  const lastSet = existingSets.docs[0] as MinimalMatchSet | undefined
  const nextSetNumber = (lastSet?.set_number || 0) + 1

  const createdSet = await payload.create({
    collection: 'match-sets',
    data: {
      event_id: match.event_id,
      match_id: match.id,
      set_number: nextSetNumber,
      participant_a_score: 0,
      participant_b_score: 0,
    },
  })

  const actorUserId = await getActorUserId(payload)

  await recordAuditLog({
    payload,
    action: 'match_set.create',
    entityType: 'match-sets',
    entityId: createdSet.id,
    before: null,
    after: {
      set_number: nextSetNumber,
      participant_a_score: 0,
      participant_b_score: 0,
    },
    actorUserId,
  })

  await recalculateResultCachesBestEffort({
    payload,
    match,
    matchNumber,
    action: 'match_set.create',
    actorUserId,
  })

  revalidateMatch(matchNumber)
  redirect(`/workspaces/matches/${matchNumber}?matchUpdated=1`)
}
