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

// Matches that have not been touched at all downstream of their source match - overwriting a
// participant slot on one of these is safe. Anything past this list (ongoing, finished,
// result_published, ...) means the next match has its own progress that a silent overwrite could
// corrupt, so a winner revision must stop and ask for manual resolution instead (AUDIT_E2E BRK-03).
export const UNSTARTED_TARGET_STATUSES = new Set([
  'draft',
  'ready_for_scheduling',
  'scheduled',
  'published',
  'check_in_open',
  'ready_to_start',
])

type AdvancementMatch = {
  id: Id
  match_number: string
  round_name?: string | null
  status: string
  stage_id?: AdvancementStage | Id | null
  participant_a_entry_id?: RelationshipDoc | Id | null
  participant_b_entry_id?: RelationshipDoc | Id | null
  winner_entry_id?: RelationshipDoc | Id | null
  next_match_id?: RelationshipDoc | Id | null
  next_match_slot?: 'a' | 'b' | null
  // MSG-01: only ever set on a semifinal that feeds a Bronze Final (see
  // createSingleEliminationBracketMatches in matchGeneration.ts) - every other single-elimination
  // match has this unset, so the loser-routing step below is a no-op for them.
  next_loser_match_id?: RelationshipDoc | Id | null
  next_loser_match_slot?: 'a' | 'b' | null
}

export type WinnerAdvancementOutcome =
  | 'advanced'
  | 'revised'
  | 'already_advanced'
  | 'skipped_not_single_elimination'
  | 'skipped_not_result_published'
  | 'skipped_missing_winner'
  | 'skipped_no_next_round'
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
  // MSG-01: populated only when the source match is a semifinal wired to a Bronze Final
  // (next_loser_match_id set) - undefined for every other match, including a Bronze Final itself
  // (it has no next_loser_match_id of its own).
  loserTargetMatchId?: Id
  loserTargetMatchNumber?: string
  loserTargetSlot?: 'a' | 'b'
  loserAdvanced?: boolean
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

const idsEqual = (left: Id | undefined, right: Id | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

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

const PUBLISHED_RESULT_STATUSES = new Set(['result_published', 'walkover'])

// Determines whether (and where) a source match's winner should be written into the next round,
// using the explicit next_match_id/next_match_slot graph recorded at generation time (see
// buildSingleEliminationBracketPlan in src/lib/matchGeneration.ts) instead of re-deriving position
// from round_name/index (AUDIT_E2E BRK-02 - a rename, an extra round, or a classification match
// used to silently break advancement).
export const getSingleEliminationAdvancementPreview = async (
  payload: Payload,
  matchId: Id,
): Promise<WinnerAdvancementResult> => {
  const match = await getMatchById(payload, matchId)
  const stageType =
    match.stage_id && typeof match.stage_id === 'object' ? match.stage_id.stage_type : undefined

  if (stageType !== 'single_elimination') {
    return buildSkipResult(
      match,
      'skipped_not_single_elimination',
      'This match is not in a single-elimination stage.',
    )
  }

  if (!PUBLISHED_RESULT_STATUSES.has(match.status)) {
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

  const targetMatchId = getRelationshipId(match.next_match_id)
  const targetSlot = match.next_match_slot || undefined

  if (!targetMatchId || !targetSlot) {
    return buildSkipResult(
      match,
      'skipped_no_next_round',
      'This match has no recorded next-match target (final, or generated before the bracket-graph fix).',
    )
  }

  const targetMatch = await getMatchById(payload, targetMatchId)
  const targetParticipantId = getRelationshipId(
    targetSlot === 'a' ? targetMatch.participant_a_entry_id : targetMatch.participant_b_entry_id,
  )

  if (idsEqual(targetParticipantId, winnerEntryId)) {
    return buildSkipResult(match, 'already_advanced', 'Winner is already in the next match.', {
      targetMatchId: targetMatch.id,
      targetMatchNumber: targetMatch.match_number,
      targetSlot,
    })
  }

  if (targetParticipantId) {
    // Occupied by a *different* participant than the current winner - either the target still
    // has its generation-time TBD placeholder resolved wrong, or (far more likely) this is a
    // winner revision: the source match's winner changed after it had already advanced someone
    // else. Reported as occupied here; attemptSingleEliminationWinnerAdvancement decides below
    // whether that occupant can be safely replaced.
    return buildSkipResult(
      match,
      'skipped_target_occupied',
      'The next match already has a different participant in this slot.',
      { targetMatchId: targetMatch.id, targetMatchNumber: targetMatch.match_number, targetSlot },
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

// MSG-01: mirrors src/lib/doubleElimination.ts's own advanceIntoSlot exactly (kept as a separate
// copy rather than a shared import, matching that file's existing choice to have no runtime
// dependency between the single- and double-elimination advancement modules).
const advanceIntoSlot = async (
  payload: Payload,
  targetMatchId: Id,
  targetSlot: 'a' | 'b',
  entryId: Id,
): Promise<'advanced' | 'already_advanced' | 'skipped_target_occupied'> => {
  const targetMatch = await getMatchById(payload, targetMatchId)
  const currentOccupantId = getRelationshipId(
    targetSlot === 'a' ? targetMatch.participant_a_entry_id : targetMatch.participant_b_entry_id,
  )

  if (idsEqual(currentOccupantId, entryId)) {
    return 'already_advanced'
  }
  if (currentOccupantId && !UNSTARTED_TARGET_STATUSES.has(targetMatch.status)) {
    return 'skipped_target_occupied'
  }

  await payload.update({
    collection: 'matches',
    id: targetMatchId,
    data:
      targetSlot === 'a'
        ? { participant_a_entry_id: Number(entryId) }
        : { participant_b_entry_id: Number(entryId) },
  })
  return 'advanced'
}

// MSG-01: routes a semifinal's loser into its Bronze Final slot, if this match was wired with a
// next_loser_match_id at generation time (see createSingleEliminationBracketMatches). A no-op for
// every match that wasn't - which is every match except a semifinal under third_place_policy:
// 'match'. Called independently of winner advancement above: even if the winner side is already
// occupied/unstarted-blocked, the loser side should still get its own chance to route.
const routeSemifinalLoserToBronze = async (
  payload: Payload,
  match: AdvancementMatch,
  winnerEntryId: Id,
): Promise<Pick<WinnerAdvancementResult, 'loserTargetMatchId' | 'loserTargetMatchNumber' | 'loserTargetSlot' | 'loserAdvanced'>> => {
  const loserTargetMatchId = getRelationshipId(match.next_loser_match_id)
  const loserTargetSlot = match.next_loser_match_slot || undefined
  if (!loserTargetMatchId || !loserTargetSlot) {
    return {}
  }

  const participantAId = getRelationshipId(match.participant_a_entry_id)
  const participantBId = getRelationshipId(match.participant_b_entry_id)
  const loserEntryId = idsEqual(participantAId, winnerEntryId) ? participantBId : participantAId
  if (!loserEntryId) {
    return { loserTargetMatchId, loserTargetSlot, loserAdvanced: false }
  }

  const targetMatch = await getMatchById(payload, loserTargetMatchId)
  const outcome = await advanceIntoSlot(payload, loserTargetMatchId, loserTargetSlot, loserEntryId)

  return {
    loserTargetMatchId,
    loserTargetMatchNumber: targetMatch.match_number,
    loserTargetSlot,
    loserAdvanced: outcome === 'advanced',
  }
}

export type AdvancementRetractionResult = {
  retracted: boolean
  reason: string
  /** match_number of the downstream match that blocked the retraction, if any. */
  blockedBy?: string
  /** match_numbers whose participant slots were cleared. */
  clearedFrom: string[]
}

// The reverse of attemptSingleEliminationWinnerAdvancement: used when a published result is
// reopened. Pulls this match's winner (and, for a Bronze-Final-wired semifinal, its loser) back
// out of the next-round slots they were pushed into - but only while those downstream matches have
// not progressed. If any has (checked in / started / scored / finished), nothing is touched and
// the blocking match is reported, so the admin resolves it by hand instead of losing real results.
export const retractSingleEliminationAdvancement = async (
  payload: Payload,
  matchId: Id,
): Promise<AdvancementRetractionResult> => {
  const match = await getMatchById(payload, matchId)
  const stageType =
    match.stage_id && typeof match.stage_id === 'object' ? match.stage_id.stage_type : undefined
  if (stageType !== 'single_elimination') {
    return { retracted: false, reason: 'Not a single-elimination stage.', clearedFrom: [] }
  }

  const winnerEntryId = getRelationshipId(match.winner_entry_id)
  const participantAId = getRelationshipId(match.participant_a_entry_id)
  const participantBId = getRelationshipId(match.participant_b_entry_id)
  const loserEntryId = idsEqual(participantAId, winnerEntryId) ? participantBId : participantAId

  type Target = { matchId: Id; slot: 'a' | 'b'; entryId: Id | undefined }
  const targets: Target[] = []
  const winnerTargetId = getRelationshipId(match.next_match_id)
  if (winnerTargetId && match.next_match_slot && winnerEntryId) {
    targets.push({ matchId: winnerTargetId, slot: match.next_match_slot, entryId: winnerEntryId })
  }
  const loserTargetId = getRelationshipId(match.next_loser_match_id)
  if (loserTargetId && match.next_loser_match_slot && loserEntryId) {
    targets.push({ matchId: loserTargetId, slot: match.next_loser_match_slot, entryId: loserEntryId })
  }

  // Pass 1: check every downstream match is still safe to touch.
  const resolved: Array<Target & { match: AdvancementMatch; occupantId: Id | undefined }> = []
  for (const target of targets) {
    const targetMatch = await getMatchById(payload, target.matchId)
    const occupantId = getRelationshipId(
      target.slot === 'a' ? targetMatch.participant_a_entry_id : targetMatch.participant_b_entry_id,
    )
    if (idsEqual(occupantId, target.entryId) && !UNSTARTED_TARGET_STATUSES.has(targetMatch.status)) {
      return {
        retracted: false,
        reason: `${targetMatch.match_number} has already progressed (status: ${targetMatch.status}). Resolve it before reopening this result.`,
        blockedBy: targetMatch.match_number,
        clearedFrom: [],
      }
    }
    resolved.push({ ...target, match: targetMatch, occupantId })
  }

  // Pass 2: clear the slots this match had filled.
  const clearedFrom: string[] = []
  for (const target of resolved) {
    if (!idsEqual(target.occupantId, target.entryId)) continue
    await payload.update({
      collection: 'matches',
      id: target.matchId,
      data:
        target.slot === 'a'
          ? { participant_a_entry_id: null }
          : { participant_b_entry_id: null },
    })
    clearedFrom.push(target.match.match_number)
  }

  return {
    retracted: true,
    reason:
      clearedFrom.length > 0
        ? `Pulled the result back out of ${clearedFrom.join(', ')}.`
        : 'No downstream slot needed clearing.',
    clearedFrom,
  }
}

export const attemptSingleEliminationWinnerAdvancement = async (
  payload: Payload,
  matchId: Id,
): Promise<WinnerAdvancementResult> => {
  const preview = await getSingleEliminationAdvancementPreview(payload, matchId)
  const match = await getMatchById(payload, matchId)
  const loserRouting = preview.winnerEntryId
    ? await routeSemifinalLoserToBronze(payload, match, preview.winnerEntryId)
    : {}

  if (preview.outcome === 'advanced' && preview.targetMatchId && preview.targetSlot) {
    await payload.update({
      collection: 'matches',
      id: preview.targetMatchId,
      data:
        preview.targetSlot === 'a'
          ? { participant_a_entry_id: Number(preview.winnerEntryId) }
          : { participant_b_entry_id: Number(preview.winnerEntryId) },
    })

    return {
      ...preview,
      ...loserRouting,
      advanced: true,
      reason: `Winner advanced to ${preview.targetMatchNumber} participant ${preview.targetSlot.toUpperCase()}.`,
    }
  }

  if (preview.outcome === 'skipped_target_occupied' && preview.targetMatchId && preview.targetSlot) {
    // Compensating propagation for a winner revision (AUDIT_E2E BRK-03): only overwrite the
    // downstream slot if that next match genuinely has not progressed yet. If it has (checked in,
    // started, scored, or already finished), refuse and surface the conflict instead of silently
    // erasing real downstream progress - the caller/admin must resolve it by hand.
    const targetMatch = await getMatchById(payload, preview.targetMatchId)
    if (!UNSTARTED_TARGET_STATUSES.has(targetMatch.status)) {
      return {
        ...preview,
        ...loserRouting,
        reason: `${preview.targetMatchNumber} has already progressed (status: ${targetMatch.status}) and cannot be silently corrected. Resolve the conflict manually.`,
      }
    }

    await payload.update({
      collection: 'matches',
      id: preview.targetMatchId,
      data:
        preview.targetSlot === 'a'
          ? { participant_a_entry_id: Number(preview.winnerEntryId) }
          : { participant_b_entry_id: Number(preview.winnerEntryId) },
    })

    return {
      ...preview,
      ...loserRouting,
      outcome: 'revised',
      advanced: true,
      reason: `Winner revision propagated to ${preview.targetMatchNumber} participant ${preview.targetSlot.toUpperCase()}.`,
    }
  }

  return { ...preview, ...loserRouting }
}
