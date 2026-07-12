import type { Payload } from 'payload'

type Id = string | number

type RelationshipDoc = {
  id?: Id
  name?: string
  display_name?: string
  entry_type?: string | null
}

type AdvancementStage = RelationshipDoc & {
  stage_type?: string | null
}

type AdvancementMatch = {
  id: Id
  match_number: string
  round_name?: string | null
  status: string
  stage_id?: AdvancementStage | Id | null
  participant_a_entry_id?: RelationshipDoc | Id | null
  participant_b_entry_id?: RelationshipDoc | Id | null
  winner_entry_id?: RelationshipDoc | Id | null
}

export type WinnerAdvancementOutcome =
  | 'advanced'
  | 'already_advanced'
  | 'skipped_not_single_elimination'
  | 'skipped_not_result_published'
  | 'skipped_missing_winner'
  | 'skipped_no_next_round'
  | 'skipped_no_target_match'
  | 'skipped_target_ambiguous'
  | 'skipped_target_occupied'

export type WinnerAdvancementResult = {
  outcome: WinnerAdvancementOutcome
  reason: string
  sourceMatchId: Id
  sourceMatchNumber: string
  winnerEntryId?: Id
  winnerLabel?: string
  targetMatchId?: Id
  targetMatchNumber?: string
  targetSlot?: 'a' | 'b'
  advanced?: boolean
}

const getRelationshipId = (value: RelationshipDoc | Id | null | undefined): Id | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && value.id) {
    return value.id
  }

  return undefined
}

const getRelationshipLabel = (
  value: RelationshipDoc | Id | null | undefined,
  fallback = 'TBD',
) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return fallback
  }

  return value.display_name || value.name || fallback
}

const getEntryType = (value: RelationshipDoc | Id | null | undefined) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return undefined
  }

  return value.entry_type || undefined
}

const idsEqual = (left: Id | undefined, right: Id | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

const getRoundOrder = (roundName: string) => {
  const normalizedName = roundName.toLowerCase()
  if (normalizedName.includes('first')) return 10
  const roundOfMatch = normalizedName.match(/round of (\d+)/)
  if (roundOfMatch) {
    // "Round of 16" keeps its historical order (20); larger brackets (Round of 32/64/...) sort
    // progressively earlier so bigger tournaments still order correctly end-to-end.
    return Math.max(1, 20 - (Math.log2(Number(roundOfMatch[1])) - 4) * 5)
  }
  if (normalizedName.includes('quarter')) return 30
  if (normalizedName.includes('semi')) return 40
  if (normalizedName.includes('bronze')) return 45
  if (normalizedName.includes('final')) return 50

  return 100
}

const isEmptyOrTbdSlot = (value: RelationshipDoc | Id | null | undefined) => {
  const entryId = getRelationshipId(value)
  if (!entryId) {
    return true
  }

  return getEntryType(value) === 'tbd'
}

const getMatchById = async (payload: Payload, matchId: Id) => {
  return (await payload.findByID({
    collection: 'matches',
    id: matchId,
    depth: 2,
  })) as AdvancementMatch
}

const buildSkipResult = (
  match: AdvancementMatch,
  outcome: WinnerAdvancementOutcome,
  reason: string,
  extra: Partial<WinnerAdvancementResult> = {},
): WinnerAdvancementResult => ({
  outcome,
  reason,
  sourceMatchId: match.id,
  sourceMatchNumber: match.match_number,
  winnerEntryId: getRelationshipId(match.winner_entry_id),
  winnerLabel: getRelationshipLabel(match.winner_entry_id, 'No winner'),
  advanced: false,
  ...extra,
})

export const getSingleEliminationAdvancementPreview = async (
  payload: Payload,
  matchId: Id,
): Promise<WinnerAdvancementResult> => {
  const match = await getMatchById(payload, matchId)
  const stageId = getRelationshipId(match.stage_id)
  const stageType =
    match.stage_id && typeof match.stage_id === 'object' ? match.stage_id.stage_type : undefined

  if (stageType !== 'single_elimination') {
    return buildSkipResult(
      match,
      'skipped_not_single_elimination',
      'This match is not in a single-elimination stage.',
    )
  }

  if (match.status !== 'result_published') {
    return buildSkipResult(
      match,
      'skipped_not_result_published',
      'Winner advancement waits until the match result is published.',
    )
  }

  const winnerEntryId = getRelationshipId(match.winner_entry_id)
  if (!winnerEntryId) {
    return buildSkipResult(match, 'skipped_missing_winner', 'No winner is set for this match.')
  }

  const matchesResult = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 200,
    sort: ['scheduled_start_at', 'match_number'],
    where: {
      stage_id: {
        equals: stageId,
      },
    },
  })
  const matches = (matchesResult.docs as AdvancementMatch[]).sort((left, right) => {
    const roundCompare =
      getRoundOrder(left.round_name || '') - getRoundOrder(right.round_name || '')
    if (roundCompare !== 0) {
      return roundCompare
    }

    return left.match_number.localeCompare(right.match_number, 'en')
  })
  const rounds = new Map<string, AdvancementMatch[]>()

  for (const stageMatch of matches) {
    const roundName = stageMatch.round_name || 'Single Elimination'
    const roundMatches = rounds.get(roundName) || []
    roundMatches.push(stageMatch)
    rounds.set(roundName, roundMatches)
  }

  const orderedRounds = Array.from(rounds.entries()).sort(
    ([leftName], [rightName]) => getRoundOrder(leftName) - getRoundOrder(rightName),
  )
  const currentRoundIndex = orderedRounds.findIndex(([, roundMatches]) =>
    roundMatches.some((roundMatch) => idsEqual(roundMatch.id, match.id)),
  )

  if (currentRoundIndex < 0 || currentRoundIndex >= orderedRounds.length - 1) {
    return buildSkipResult(
      match,
      'skipped_no_next_round',
      'No later round exists for this match.',
    )
  }

  const currentRoundMatches = orderedRounds[currentRoundIndex][1]
  const currentMatchIndex = currentRoundMatches.findIndex((roundMatch) =>
    idsEqual(roundMatch.id, match.id),
  )
  const nextRoundMatches = orderedRounds[currentRoundIndex + 1][1]
  const targetMatch = nextRoundMatches[Math.floor(currentMatchIndex / 2)]

  if (!targetMatch) {
    return buildSkipResult(
      match,
      'skipped_no_target_match',
      'No deterministic next-round match exists for this source match.',
    )
  }

  const targetParticipantAId = getRelationshipId(targetMatch.participant_a_entry_id)
  const targetParticipantBId = getRelationshipId(targetMatch.participant_b_entry_id)
  if (idsEqual(targetParticipantAId, winnerEntryId)) {
    return buildSkipResult(match, 'already_advanced', 'Winner is already in the next match.', {
      targetMatchId: targetMatch.id,
      targetMatchNumber: targetMatch.match_number,
      targetSlot: 'a',
    })
  }

  if (idsEqual(targetParticipantBId, winnerEntryId)) {
    return buildSkipResult(match, 'already_advanced', 'Winner is already in the next match.', {
      targetMatchId: targetMatch.id,
      targetMatchNumber: targetMatch.match_number,
      targetSlot: 'b',
    })
  }

  const emptySlots: ('a' | 'b')[] = []
  if (isEmptyOrTbdSlot(targetMatch.participant_a_entry_id)) {
    emptySlots.push('a')
  }
  if (isEmptyOrTbdSlot(targetMatch.participant_b_entry_id)) {
    emptySlots.push('b')
  }

  if (emptySlots.length === 0) {
    return buildSkipResult(
      match,
      'skipped_target_occupied',
      'Next match already has participants and cannot be overwritten safely.',
      {
        targetMatchId: targetMatch.id,
        targetMatchNumber: targetMatch.match_number,
      },
    )
  }

  const targetSlot =
    emptySlots.length === 1 ? emptySlots[0] : currentMatchIndex % 2 === 0 ? 'a' : 'b'

  if (!emptySlots.includes(targetSlot)) {
    return buildSkipResult(
      match,
      'skipped_target_ambiguous',
      'No deterministic empty target slot could be selected.',
      {
        targetMatchId: targetMatch.id,
        targetMatchNumber: targetMatch.match_number,
      },
    )
  }

  return {
    outcome: 'advanced',
    reason: `Winner can advance to ${targetMatch.match_number} participant ${targetSlot.toUpperCase()}.`,
    sourceMatchId: match.id,
    sourceMatchNumber: match.match_number,
    winnerEntryId,
    winnerLabel: getRelationshipLabel(match.winner_entry_id),
    targetMatchId: targetMatch.id,
    targetMatchNumber: targetMatch.match_number,
    targetSlot,
    advanced: false,
  }
}

export const attemptSingleEliminationWinnerAdvancement = async (
  payload: Payload,
  matchId: Id,
): Promise<WinnerAdvancementResult> => {
  const preview = await getSingleEliminationAdvancementPreview(payload, matchId)

  if (preview.outcome !== 'advanced' || !preview.targetMatchId || !preview.targetSlot) {
    return preview
  }

  await payload.update({
    collection: 'matches',
    id: preview.targetMatchId,
    data:
      preview.targetSlot === 'a'
        ? { participant_a_entry_id: preview.winnerEntryId }
        : { participant_b_entry_id: preview.winnerEntryId },
  })

  return {
    ...preview,
    advanced: true,
    reason: `Winner advanced to ${preview.targetMatchNumber} participant ${preview.targetSlot.toUpperCase()}.`,
  }
}
