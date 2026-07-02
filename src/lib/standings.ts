import type { Payload, Where } from 'payload'

type Id = string | number

type RelationshipDoc = {
  id?: Id
  name?: string
  display_name?: string
  ruleset_id?: RelationshipDoc | Id | null
  tie_breakers?: string[] | null
  points_win?: number | null
  points_draw?: number | null
  points_loss?: number | null
  allow_draw?: boolean | null
}

type StandingRuleset = {
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  allowDraw: boolean
  tieBreakers: string[]
}

type StandingMatch = {
  id: Id
  event_id?: RelationshipDoc | Id | null
  category_id?: RelationshipDoc | Id | null
  stage_id?: RelationshipDoc | Id | null
  group_id?: RelationshipDoc | Id | null
  status: string
  participant_a_entry_id?: RelationshipDoc | Id | null
  participant_b_entry_id?: RelationshipDoc | Id | null
  winner_entry_id?: RelationshipDoc | Id | null
}

type StandingMatchSet = {
  id: Id
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
  winner_entry_id?: RelationshipDoc | Id | null
}

export type StandingRow = {
  standing_key: string
  event_id: Id
  category_id: Id
  stage_id: Id
  group_id?: Id
  entry_id: Id
  entry_label: string
  rank: number
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  score_for: number
  score_against: number
  score_difference: number
  set_for: number
  set_against: number
  set_difference: number
  qualified_status: 'pending' | 'qualified' | 'eliminated' | 'champion' | 'runner_up'
}

export type RecalculateStandingsInput = {
  eventId?: Id
  categoryId: Id
  stageId: Id
  groupId?: Id
}

export type RecalculateStandingsResult = {
  rows: StandingRow[]
  finishedMatchCount: number
}

const RESULT_STATUSES = new Set(['finished', 'result_published'])
const SCALAR_TIE_BREAKERS = new Set([
  'points',
  'score_difference',
  'score_for',
  'set_difference',
  'set_for',
])

export const getRelationshipId = (
  value: RelationshipDoc | Id | null | undefined,
): Id | undefined => {
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
  fallback: string,
) => {
  if (!value || typeof value === 'string' || typeof value === 'number') {
    return fallback
  }

  return value.display_name || value.name || fallback
}

const toId = (value: Id | undefined, label: string): Id => {
  if (value === undefined) {
    throw new Error(`Missing ${label}`)
  }

  return value
}

const idsEqual = (left: Id | undefined, right: Id | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

const makeStandingKey = (stageId: Id, groupId: Id | undefined, entryId: Id) =>
  `${stageId}:${groupId || 'no-group'}:${entryId}`

const getRulesetFromCategory = async (
  payload: Payload,
  categoryId: Id,
): Promise<StandingRuleset> => {
  const category = (await payload.findByID({
    collection: 'competition-categories',
    id: categoryId,
    depth: 1,
  })) as RelationshipDoc
  const ruleset = category.ruleset_id as RelationshipDoc | Id | null | undefined

  let rulesetDoc = typeof ruleset === 'object' && ruleset ? ruleset : undefined
  const rulesetId = getRelationshipId(ruleset)
  if (!rulesetDoc && rulesetId) {
    rulesetDoc = (await payload.findByID({
      collection: 'rulesets',
      id: rulesetId,
      depth: 0,
    })) as RelationshipDoc
  }

  return {
    pointsWin: rulesetDoc?.points_win ?? 3,
    pointsDraw: rulesetDoc?.points_draw ?? 1,
    pointsLoss: rulesetDoc?.points_loss ?? 0,
    allowDraw: rulesetDoc?.allow_draw ?? true,
    tieBreakers:
      rulesetDoc?.tie_breakers && rulesetDoc.tie_breakers.length > 0
        ? rulesetDoc.tie_breakers
        : ['points', 'score_difference', 'score_for', 'set_difference', 'set_for'],
  }
}

const compareRows = (ruleset: StandingRuleset) => (left: StandingRow, right: StandingRow) => {
  const configuredTieBreakers = [
    ...new Set(['points', ...ruleset.tieBreakers.filter((breaker) => SCALAR_TIE_BREAKERS.has(breaker))]),
  ]

  for (const breaker of configuredTieBreakers) {
    const leftValue = left[breaker as keyof StandingRow]
    const rightValue = right[breaker as keyof StandingRow]

    if (typeof leftValue === 'number' && typeof rightValue === 'number' && leftValue !== rightValue) {
      return rightValue - leftValue
    }
  }

  const labelCompare = left.entry_label.localeCompare(right.entry_label, 'en')
  if (labelCompare !== 0) {
    return labelCompare
  }

  return String(left.entry_id).localeCompare(String(right.entry_id), 'en')
}

const createEmptyRow = (
  match: StandingMatch,
  entrySide: 'a' | 'b',
  eventId: Id,
  categoryId: Id,
  stageId: Id,
  groupId?: Id,
): StandingRow => {
  const entry = entrySide === 'a' ? match.participant_a_entry_id : match.participant_b_entry_id
  const entryId = toId(getRelationshipId(entry), 'entry id')

  return {
    standing_key: makeStandingKey(stageId, groupId, entryId),
    event_id: eventId,
    category_id: categoryId,
    stage_id: stageId,
    group_id: groupId,
    entry_id: entryId,
    entry_label: getRelationshipLabel(entry, 'TBD'),
    rank: 1,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    score_for: 0,
    score_against: 0,
    score_difference: 0,
    set_for: 0,
    set_against: 0,
    set_difference: 0,
    qualified_status: 'pending',
  }
}

const addMatchToRows = (
  rowsByEntryId: Map<string, StandingRow>,
  match: StandingMatch,
  matchSets: StandingMatchSet[],
  ruleset: StandingRuleset,
) => {
  const participantAId = getRelationshipId(match.participant_a_entry_id)
  const participantBId = getRelationshipId(match.participant_b_entry_id)

  if (!participantAId || !participantBId || matchSets.length === 0) {
    return
  }

  const rowA = rowsByEntryId.get(String(participantAId))
  const rowB = rowsByEntryId.get(String(participantBId))
  if (!rowA || !rowB) {
    return
  }

  const scoreA = matchSets.reduce((sum, set) => sum + (set.participant_a_score ?? 0), 0)
  const scoreB = matchSets.reduce((sum, set) => sum + (set.participant_b_score ?? 0), 0)
  const setForA = matchSets.filter((set) => {
    const winnerId = getRelationshipId(set.winner_entry_id)
    return idsEqual(winnerId, participantAId) || (!winnerId && (set.participant_a_score ?? 0) > (set.participant_b_score ?? 0))
  }).length
  const setForB = matchSets.filter((set) => {
    const winnerId = getRelationshipId(set.winner_entry_id)
    return idsEqual(winnerId, participantBId) || (!winnerId && (set.participant_b_score ?? 0) > (set.participant_a_score ?? 0))
  }).length

  rowA.played += 1
  rowB.played += 1
  rowA.score_for += scoreA
  rowA.score_against += scoreB
  rowB.score_for += scoreB
  rowB.score_against += scoreA
  rowA.set_for += setForA
  rowA.set_against += setForB
  rowB.set_for += setForB
  rowB.set_against += setForA

  const winnerId = getRelationshipId(match.winner_entry_id)
  const isDraw = !winnerId && scoreA === scoreB && ruleset.allowDraw
  const winnerSide =
    idsEqual(winnerId, participantAId) || (!winnerId && scoreA > scoreB)
      ? 'a'
      : idsEqual(winnerId, participantBId) || (!winnerId && scoreB > scoreA)
        ? 'b'
        : undefined

  if (isDraw) {
    rowA.drawn += 1
    rowB.drawn += 1
    rowA.points += ruleset.pointsDraw
    rowB.points += ruleset.pointsDraw
  } else if (winnerSide === 'a') {
    rowA.won += 1
    rowB.lost += 1
    rowA.points += ruleset.pointsWin
    rowB.points += ruleset.pointsLoss
  } else if (winnerSide === 'b') {
    rowB.won += 1
    rowA.lost += 1
    rowB.points += ruleset.pointsWin
    rowA.points += ruleset.pointsLoss
  }

  rowA.score_difference = rowA.score_for - rowA.score_against
  rowB.score_difference = rowB.score_for - rowB.score_against
  rowA.set_difference = rowA.set_for - rowA.set_against
  rowB.set_difference = rowB.set_for - rowB.set_against
}

export const calculateStandingsForScope = async (
  payload: Payload,
  input: RecalculateStandingsInput,
): Promise<RecalculateStandingsResult> => {
  const whereConditions: Where[] = [
    { category_id: { equals: input.categoryId } },
    { stage_id: { equals: input.stageId } },
    { status: { in: Array.from(RESULT_STATUSES) } },
  ]

  if (input.eventId) {
    whereConditions.push({ event_id: { equals: input.eventId } })
  }

  if (input.groupId) {
    whereConditions.push({ group_id: { equals: input.groupId } })
  }

  const matchesResult = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 500,
    sort: ['scheduled_start_at', 'match_number'],
    where: { and: whereConditions },
  })

  const matches = matchesResult.docs as StandingMatch[]
  const firstMatch = matches[0]
  if (!firstMatch) {
    return { rows: [], finishedMatchCount: 0 }
  }

  const eventId = toId(getRelationshipId(firstMatch.event_id), 'event id')
  const categoryId = toId(getRelationshipId(firstMatch.category_id), 'category id')
  const stageId = toId(getRelationshipId(firstMatch.stage_id), 'stage id')
  const groupId = getRelationshipId(firstMatch.group_id)
  const ruleset = await getRulesetFromCategory(payload, categoryId)
  const rowsByEntryId = new Map<string, StandingRow>()

  for (const match of matches) {
    const participantAId = getRelationshipId(match.participant_a_entry_id)
    const participantBId = getRelationshipId(match.participant_b_entry_id)

    if (participantAId && !rowsByEntryId.has(String(participantAId))) {
      rowsByEntryId.set(
        String(participantAId),
        createEmptyRow(match, 'a', eventId, categoryId, stageId, groupId),
      )
    }

    if (participantBId && !rowsByEntryId.has(String(participantBId))) {
      rowsByEntryId.set(
        String(participantBId),
        createEmptyRow(match, 'b', eventId, categoryId, stageId, groupId),
      )
    }
  }

  for (const match of matches) {
    const matchSets = await payload.find({
      collection: 'match-sets',
      depth: 1,
      limit: 50,
      sort: 'set_number',
      where: { match_id: { equals: match.id } },
    })

    addMatchToRows(rowsByEntryId, match, matchSets.docs as StandingMatchSet[], ruleset)
  }

  const rows = Array.from(rowsByEntryId.values()).sort(compareRows(ruleset))
  rows.forEach((row, index) => {
    row.rank = index + 1
  })

  return {
    rows,
    finishedMatchCount: matches.length,
  }
}

export const recalculateStandingsForScope = async (
  payload: Payload,
  input: RecalculateStandingsInput,
): Promise<RecalculateStandingsResult> => {
  const result = await calculateStandingsForScope(payload, input)
  const existing = await payload.find({
    collection: 'standings',
    depth: 0,
    limit: 500,
    where: {
      and: [
        { category_id: { equals: input.categoryId } },
        { stage_id: { equals: input.stageId } },
        input.groupId ? { group_id: { equals: input.groupId } } : { group_id: { exists: false } },
      ],
    },
  })
  const wantedKeys = new Set(result.rows.map((row) => row.standing_key))

  for (const row of result.rows) {
    const existingRow = existing.docs.find((doc) => doc.standing_key === row.standing_key)
    const data = {
      standing_key: row.standing_key,
      event_id: row.event_id,
      category_id: row.category_id,
      stage_id: row.stage_id,
      group_id: row.group_id,
      entry_id: row.entry_id,
      rank: row.rank,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      points: row.points,
      score_for: row.score_for,
      score_against: row.score_against,
      score_difference: row.score_difference,
      set_for: row.set_for,
      set_against: row.set_against,
      set_difference: row.set_difference,
      qualified_status: row.qualified_status,
    }

    if (existingRow) {
      await payload.update({
        collection: 'standings',
        id: existingRow.id,
        data,
      })
    } else {
      await payload.create({
        collection: 'standings',
        data,
      })
    }
  }

  for (const staleRow of existing.docs) {
    if (!wantedKeys.has(staleRow.standing_key)) {
      await payload.delete({
        collection: 'standings',
        id: staleRow.id,
      })
    }
  }

  return result
}
