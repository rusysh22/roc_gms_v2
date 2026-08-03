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
  group_qualify_count?: number | null
}

type StandingRuleset = {
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  allowDraw: boolean
  tieBreakers: string[]
  groupQualifyCount?: number
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
  tieNote?: string
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

// AUDIT_E2E STD-02: a match reaching `finished` means the officer is done playing, not that an
// admin has reviewed and published the result (see the match lifecycle: finished -> under_review
// -> result_published). Only these two states represent an *official* result and may affect
// public standings. `walkover` is included because it is itself already a final, official
// decision (see AUDIT_E2E BRK fixes / matchGeneration.ts's bye handling).
const RESULT_STATUSES = new Set(['result_published', 'walkover'])
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

const idsEqual = (left: Id | undefined, right: Id | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

const makeStandingKey = (stageId: Id, groupId: Id | undefined, entryId: Id) =>
  `${stageId}:${groupId || 'no-group'}:${entryId}`

const headToHeadKey = (entryId: Id, opponentId: Id) => `${entryId}:${opponentId}`

const getCategoryAndRuleset = async (
  payload: Payload,
  categoryId: Id,
): Promise<{ ruleset: StandingRuleset; eventId?: Id }> => {
  const category = (await payload.findByID({
    collection: 'competition-categories',
    id: categoryId,
    depth: 1,
  })) as RelationshipDoc & { event_id?: RelationshipDoc | Id | null }
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
    eventId: getRelationshipId(category.event_id),
    ruleset: {
      pointsWin: rulesetDoc?.points_win ?? 3,
      pointsDraw: rulesetDoc?.points_draw ?? 1,
      pointsLoss: rulesetDoc?.points_loss ?? 0,
      allowDraw: rulesetDoc?.allow_draw ?? true,
      tieBreakers:
        rulesetDoc?.tie_breakers && rulesetDoc.tie_breakers.length > 0
          ? rulesetDoc.tie_breakers
          : ['points', 'score_difference', 'score_for', 'set_difference', 'set_for'],
      groupQualifyCount: category.group_qualify_count ?? undefined,
    },
  }
}

// AUDIT_E2E STD-03: `head_to_head`, `fewest_penalties`, and `manual_decision` were silently
// ignored - ties always fell through to an alphabetical sort that looked rules-based but wasn't.
// `head_to_head` is now genuinely evaluated (points earned in direct meetings between the two tied
// entries). `fewest_penalties` has no penalty data model anywhere in this codebase yet, so it is
// explicitly skipped rather than faked. When `manual_decision` is configured and a tie still isn't
// resolved after every supported breaker, the row is flagged with `tieNote` instead of silently
// presenting the alphabetical fallback as if it were a rules-based result.
const compareRows =
  (ruleset: StandingRuleset, headToHead: Map<string, number>) =>
  (left: StandingRow, right: StandingRow) => {
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

    if (ruleset.tieBreakers.includes('head_to_head')) {
      const leftPoints = headToHead.get(headToHeadKey(left.entry_id, right.entry_id))
      const rightPoints = headToHead.get(headToHeadKey(right.entry_id, left.entry_id))
      if (leftPoints !== undefined && rightPoints !== undefined && leftPoints !== rightPoints) {
        return rightPoints - leftPoints
      }
    }

    // Every supported breaker is exhausted and the tie is still unresolved. Flag it (visible in
    // Payload Admin / a future manual-decision UI) rather than presenting the fallback order below
    // as if it were rules-based.
    if (ruleset.tieBreakers.includes('manual_decision')) {
      left.tieNote = `Tied with ${right.entry_label} after all configured tiebreakers - needs a manual decision.`
      right.tieNote = `Tied with ${left.entry_label} after all configured tiebreakers - needs a manual decision.`
    }

    const labelCompare = left.entry_label.localeCompare(right.entry_label, 'en')
    if (labelCompare !== 0) {
      return labelCompare
    }

    return String(left.entry_id).localeCompare(String(right.entry_id), 'en')
  }

const createEmptyRow = (
  entryId: Id,
  entryLabel: string,
  eventId: Id,
  categoryId: Id,
  stageId: Id,
  groupId?: Id,
): StandingRow => ({
  standing_key: makeStandingKey(stageId, groupId, entryId),
  event_id: eventId,
  category_id: categoryId,
  stage_id: stageId,
  group_id: groupId,
  entry_id: entryId,
  entry_label: entryLabel,
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
})

const addMatchToRows = (
  rowsByEntryId: Map<string, StandingRow>,
  match: StandingMatch,
  matchSets: StandingMatchSet[],
  ruleset: StandingRuleset,
  headToHead: Map<string, number>,
) => {
  const participantAId = getRelationshipId(match.participant_a_entry_id)
  const participantBId = getRelationshipId(match.participant_b_entry_id)

  if (!participantAId || !participantBId) {
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

  let pointsA = 0
  let pointsB = 0

  if (isDraw) {
    rowA.drawn += 1
    rowB.drawn += 1
    pointsA = ruleset.pointsDraw
    pointsB = ruleset.pointsDraw
  } else if (winnerSide === 'a') {
    rowA.won += 1
    rowB.lost += 1
    pointsA = ruleset.pointsWin
    pointsB = ruleset.pointsLoss
  } else if (winnerSide === 'b') {
    rowB.won += 1
    rowA.lost += 1
    pointsB = ruleset.pointsWin
    pointsA = ruleset.pointsLoss
  }

  rowA.points += pointsA
  rowB.points += pointsB
  rowA.score_difference = rowA.score_for - rowA.score_against
  rowB.score_difference = rowB.score_for - rowB.score_against
  rowA.set_difference = rowA.set_for - rowA.set_against
  rowB.set_difference = rowB.set_for - rowB.set_against

  headToHead.set(headToHeadKey(participantAId, participantBId), pointsA)
  headToHead.set(headToHeadKey(participantBId, participantAId), pointsB)
}

export const calculateStandingsForScope = async (
  payload: Payload,
  input: RecalculateStandingsInput,
): Promise<RecalculateStandingsResult> => {
  const { ruleset, eventId: categoryEventId } = await getCategoryAndRuleset(payload, input.categoryId)
  const eventId = input.eventId ?? categoryEventId
  if (!eventId) {
    return { rows: [], finishedMatchCount: 0 }
  }

  const scopeConditions: Where[] = [
    { category_id: { equals: input.categoryId } },
    { stage_id: { equals: input.stageId } },
  ]
  if (input.groupId) {
    scopeConditions.push({ group_id: { equals: input.groupId } })
  }

  // AUDIT_E2E STD-05: the roster used to come *only* from matches that had already reached a
  // result-bearing status, so an entry with zero decided matches (including "the stage/group has
  // no results at all yet") never got a row - standings looked empty even for a fully-confirmed
  // group. The roster is now independent of match outcomes: for a group-scoped stage it's every
  // entry that appears in *any* match in that group (entries don't carry a group_id of their own),
  // otherwise it's every confirmed entry in the category directly.
  const rowsByEntryId = new Map<string, StandingRow>()

  if (input.groupId) {
    const rosterMatches = await payload.find({
      collection: 'matches',
      depth: 1,
      limit: 500,
      where: { and: scopeConditions },
    })

    for (const doc of rosterMatches.docs as StandingMatch[]) {
      for (const side of [doc.participant_a_entry_id, doc.participant_b_entry_id]) {
        const entryId = getRelationshipId(side)
        if (entryId && !rowsByEntryId.has(String(entryId))) {
          rowsByEntryId.set(
            String(entryId),
            createEmptyRow(
              entryId,
              getRelationshipLabel(side, 'TBD'),
              eventId,
              input.categoryId,
              input.stageId,
              input.groupId,
            ),
          )
        }
      }
    }
  } else {
    const confirmedEntries = await payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 500,
      where: {
        and: [{ category_id: { equals: input.categoryId } }, { status: { equals: 'confirmed' } }],
      },
    })

    for (const entry of confirmedEntries.docs) {
      rowsByEntryId.set(
        String(entry.id),
        createEmptyRow(
          entry.id,
          String(entry.display_name || 'TBD'),
          eventId,
          input.categoryId,
          input.stageId,
          undefined,
        ),
      )
    }
  }

  const decidedMatchesResult = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 500,
    sort: ['scheduled_start_at', 'match_number'],
    where: { and: [...scopeConditions, { status: { in: Array.from(RESULT_STATUSES) } }] },
  })
  const decidedMatches = decidedMatchesResult.docs as StandingMatch[]

  const headToHead = new Map<string, number>()
  for (const match of decidedMatches) {
    const matchSets = await payload.find({
      collection: 'match-sets',
      depth: 1,
      limit: 50,
      sort: 'set_number',
      where: { match_id: { equals: match.id } },
    })

    addMatchToRows(rowsByEntryId, match, matchSets.docs as StandingMatchSet[], ruleset, headToHead)
  }

  const rows = Array.from(rowsByEntryId.values()).sort(compareRows(ruleset, headToHead))
  rows.forEach((row, index) => {
    row.rank = index + 1
    // AUDIT_E2E STD-06: qualified_status was always left at its 'pending' default - it's now a
    // live "currently in qualifying position" indicator once the category configures
    // group_qualify_count. This is provisional (it can move as more results come in), not a final
    // mathematically-clinched determination - full elimination/clinch math is a larger follow-up.
    if (ruleset.groupQualifyCount) {
      row.qualified_status = index < ruleset.groupQualifyCount ? 'qualified' : 'pending'
    }
  })

  return {
    rows,
    finishedMatchCount: decidedMatches.length,
  }
}

// Relationship fields on Standings are Postgres integer FKs. Every id flowing through this module
// ultimately comes from one of two sources: a populated relationship doc's `.id` (already a
// number) or a raw form-data string passed straight through by a caller (e.g.
// generateMatchesAction's round-robin branch passes `eventId`/`categoryId` as strings). Payload's
// relationship validation rejects a numeric-looking *string* here even though REST/GraphQL callers
// send strings routinely - normalize to a real number right before writing.
const toRelationId = (value: Id): number => Number(value)

// Shared by recalculateStandingsForScope (win/loss/points) and recalculateRankingStandingsForScope
// (time_trial/score_ranking) - both compute a `StandingRow[]` in the same shape, so upserting them
// into the `standings` collection and pruning stale rows only needs writing once.
const persistStandingRows = async (
  payload: Payload,
  input: RecalculateStandingsInput,
  rows: StandingRow[],
) => {
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
  const wantedKeys = new Set(rows.map((row) => row.standing_key))

  for (const row of rows) {
    const existingRow = existing.docs.find((doc) => doc.standing_key === row.standing_key)
    const data = {
      standing_key: row.standing_key,
      event_id: toRelationId(row.event_id),
      category_id: toRelationId(row.category_id),
      stage_id: toRelationId(row.stage_id),
      group_id: row.group_id !== undefined ? toRelationId(row.group_id) : undefined,
      entry_id: toRelationId(row.entry_id),
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
      tie_note: row.tieNote || null,
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
}

export const recalculateStandingsForScope = async (
  payload: Payload,
  input: RecalculateStandingsInput,
): Promise<RecalculateStandingsResult> => {
  const result = await calculateStandingsForScope(payload, input)
  await persistStandingRows(payload, input, result.rows)
  return result
}

type RankingMatch = {
  id: Id
  status: string
  participant_a_entry_id?: RelationshipDoc | Id | null
  result_value?: number | null
  result_qualifier?: 'dns' | 'dnf' | 'dsq' | null
}

// ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md F-13: time_trial/score_ranking categories
// don't have a winner/loser per match - every confirmed entry gets one solo "attempt" match (see
// createRankingAttemptMatches) carrying a single result_value, and standings are a ranking of
// those values, not a win/loss/points table. Reuses the same StandingRow shape and the same
// `standings` collection as calculateStandingsForScope so the existing persistence and public
// standings plumbing works unmodified - `score_for` holds the result value, `tieNote` holds the
// DNS/DNF/DSQ label for entries with no comparable result.
export const calculateRankingStandingsForScope = async (
  payload: Payload,
  input: RecalculateStandingsInput,
): Promise<RecalculateStandingsResult> => {
  const category = (await payload.findByID({
    collection: 'competition-categories',
    id: input.categoryId,
    depth: 0,
  })) as RelationshipDoc & { event_id?: RelationshipDoc | Id | null; format_type?: string | null }
  const eventId = input.eventId ?? getRelationshipId(category.event_id)
  if (!eventId) {
    return { rows: [], finishedMatchCount: 0 }
  }
  // Lower is better for time_trial (fastest wins); higher is better for score_ranking (most
  // points/distance/etc wins).
  const ascending = category.format_type === 'time_trial'

  const confirmedEntries = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 500,
    where: { and: [{ category_id: { equals: input.categoryId } }, { status: { equals: 'confirmed' } }] },
  })
  const rowsByEntryId = new Map<string, StandingRow>()
  for (const entry of confirmedEntries.docs) {
    rowsByEntryId.set(
      String(entry.id),
      createEmptyRow(entry.id, String(entry.display_name || 'TBD'), eventId, input.categoryId, input.stageId, undefined),
    )
  }

  const decidedMatchesResult = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: {
      and: [
        { category_id: { equals: input.categoryId } },
        { stage_id: { equals: input.stageId } },
        { status: { in: Array.from(RESULT_STATUSES) } },
      ],
    },
  })
  const decidedMatches = decidedMatchesResult.docs as RankingMatch[]

  for (const match of decidedMatches) {
    const entryId = getRelationshipId(match.participant_a_entry_id)
    if (!entryId) continue
    const row = rowsByEntryId.get(String(entryId))
    if (!row) continue

    row.played = 1
    if (match.result_qualifier) {
      row.tieNote = match.result_qualifier.toUpperCase()
    } else if (typeof match.result_value === 'number') {
      row.score_for = match.result_value
      // `won` has no head-to-head meaning for a ranking result - reused purely as this row's
      // "has a comparable result" flag so hasResult() below doesn't need a new StandingRow field.
      row.won = 1
    }
  }

  const hasResult = (row: StandingRow) => row.won === 1
  const rows = Array.from(rowsByEntryId.values()).sort((left, right) => {
    if (hasResult(left) !== hasResult(right)) {
      return hasResult(left) ? -1 : 1
    }
    if (hasResult(left) && left.score_for !== right.score_for) {
      return ascending ? left.score_for - right.score_for : right.score_for - left.score_for
    }
    return left.entry_label.localeCompare(right.entry_label, 'en')
  })

  const groupQualifyCount = category.group_qualify_count ?? undefined
  rows.forEach((row, index) => {
    row.rank = index + 1
    if (groupQualifyCount) {
      row.qualified_status = hasResult(row) && index < groupQualifyCount ? 'qualified' : 'pending'
    }
  })

  return { rows, finishedMatchCount: decidedMatches.length }
}

export const recalculateRankingStandingsForScope = async (
  payload: Payload,
  input: RecalculateStandingsInput,
): Promise<RecalculateStandingsResult> => {
  const result = await calculateRankingStandingsForScope(payload, input)
  await persistStandingRows(payload, input, result.rows)
  return result
}
