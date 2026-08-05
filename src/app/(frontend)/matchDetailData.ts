import { getPayload, type Where } from 'payload'

import config from '@payload-config'
import {
  collectEntryClubLabels,
  type BracketChampion,
  type BracketMatchCard,
  type SingleEliminationBracketData,
} from '@/lib/brackets'
import {
  getSingleEliminationAdvancementPreview,
  type WinnerAdvancementResult,
} from '@/lib/winnerAdvancement'
import { EntryDoc, RelationshipDoc } from './workspaces/workspaceComponents'

export type StageDoc = RelationshipDoc & {
  stage_type?: string
  order?: number
}

export type CategoryDoc = RelationshipDoc & {
  participant_mode?: string
  format_type?: string
  result_unit?: string | null
}

export type MatchDetail = {
  id: string | number
  match_number: string
  round_name?: string | null
  status: string
  generation_source?: string | null
  documentation_status?: string | null
  score_summary?: string | null
  is_public?: boolean | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  actual_start_at?: string | null
  actual_end_at?: string | null
  event_id?: RelationshipDoc | string | number | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: CategoryDoc | string | number | null
  stage_id?: StageDoc | string | number | null
  group_id?: RelationshipDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
  participant_a_entry_id?: EntryDoc | string | number | null
  participant_b_entry_id?: EntryDoc | string | number | null
  winner_entry_id?: EntryDoc | string | number | null
  officer_ids?: (RelationshipDoc | string | number)[] | null
  result_value?: number | null
  result_qualifier?: string | null
}

export type MatchSetDetail = {
  id: string | number
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
  winner_entry_id?: EntryDoc | string | number | null
  notes?: string | null
}

export type DocumentationAssetDetail = {
  id: string | number
  asset_type: string
  caption?: string | null
  visibility: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  uploaded_by?: RelationshipDoc | string | number | null
  createdAt?: string
}

export type AuditLogEntry = {
  id: string | number
  action: string
  entity_type: string
  entity_id: string
  actor_user_id?: RelationshipDoc | string | number | null
  before_snapshot?: unknown
  after_snapshot?: unknown
  createdAt?: string
}

export type CommentDetail = {
  id: string | number
  entity_type: string
  entity_id: string
  comment_type: string
  author_name: string
  author_user_id?: RelationshipDoc | string | number | null
  body: string
  status: string
  is_pinned?: boolean | null
  resolved_at?: string | null
  parent_comment_id?: RelationshipDoc | string | number | null
  createdAt?: string
}

export type StandingImpactRow = {
  id: string | number
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
  qualified_status: string
  entry_id?: EntryDoc | string | number | null
  // Populated from collectEntryClubLabels (src/lib/brackets.ts) - the team/player's own club, not
  // a raw relationship field on Standings itself. Absent when the entry has no club (club-mode
  // entries skip this - their own name already IS the club name).
  clubLabel?: string
}

export type StandingImpact = {
  scopeLabel: string
  rows: StandingImpactRow[]
  participantRows: StandingImpactRow[]
  reason?: string
}

export type BracketImpact = {
  roundName: string
  currentMatch?: BracketMatchCard
  nextMatchNumber?: string
  nextMatchHref?: string
  nextTargetSlot?: 'a' | 'b'
  nextReason: string
  isLastRound: boolean
  champion?: BracketChampion | null
}

export type MatchDetailResult = {
  match: MatchDetail
  matchSets: MatchSetDetail[]
  documentationAssets: DocumentationAssetDetail[]
  comments: CommentDetail[]
  advancement?: WinnerAdvancementResult | null
  champion?: BracketChampion | null
  standingImpact?: StandingImpact | null
  bracketImpact?: BracketImpact | null
  // The two participants' parent club (team_id.club_id / player_id.club_id), if any - see
  // collectEntryClubLabels. undefined when that participant has no club (a club-mode entry, an
  // entry with no club_id set, or no participant at all).
  participantAClub?: string
  participantBClub?: string
}

const getRelationshipId = (value: RelationshipDoc | string | number | null | undefined) => {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return value.id
}

const idsEqual = (left: string | number | undefined, right: string | number | undefined) =>
  left !== undefined && right !== undefined && String(left) === String(right)

const standingsStageTypes = new Set(['group_stage', 'round_robin', 'league', 'swiss'])

const getStandingImpact = async (
  payload: Awaited<ReturnType<typeof getPayload>>,
  match: MatchDetail,
  stageType: string | undefined,
): Promise<StandingImpact | null> => {
  if (!stageType || !standingsStageTypes.has(stageType)) {
    return null
  }

  const categoryId = getRelationshipId(match.category_id)
  const stageId = getRelationshipId(match.stage_id)
  const groupId = getRelationshipId(match.group_id)
  if (!categoryId || !stageId) {
    return null
  }

  const standings = await payload.find({
    collection: 'standings',
    depth: 1,
    limit: 100,
    sort: 'rank',
    where: {
      and: [
        { category_id: { equals: categoryId } },
        { stage_id: { equals: stageId } },
        groupId ? { group_id: { equals: groupId } } : { group_id: { exists: false } },
      ],
    },
  })
  const rows = standings.docs as StandingImpactRow[]
  const rowEntryIds = rows.map((row) => getRelationshipId(row.entry_id)).filter((id): id is string | number => Boolean(id))
  const clubLabelByEntryId = await collectEntryClubLabels(payload, rowEntryIds)
  for (const row of rows) {
    const entryId = getRelationshipId(row.entry_id)
    row.clubLabel = entryId !== undefined ? clubLabelByEntryId.get(String(entryId)) : undefined
  }
  const participantAId = getRelationshipId(match.participant_a_entry_id)
  const participantBId = getRelationshipId(match.participant_b_entry_id)
  const participantRows = rows.filter((row) => {
    const entryId = getRelationshipId(row.entry_id)
    return idsEqual(entryId, participantAId) || idsEqual(entryId, participantBId)
  })

  return {
    scopeLabel: [
      match.category_id && typeof match.category_id === 'object' ? match.category_id.name : 'Category',
      match.stage_id && typeof match.stage_id === 'object' ? match.stage_id.name : 'Stage',
      match.group_id && typeof match.group_id === 'object' ? match.group_id.name : 'No group',
    ].join(' / '),
    rows,
    participantRows,
    reason:
      rows.length === 0 ?
        'Standings are not calculated yet for this match scope.'
      : undefined,
  }
}

const getBracketImpact = (
  match: MatchDetail,
  bracketData: SingleEliminationBracketData | undefined,
  advancement: WinnerAdvancementResult | null,
  champion: BracketChampion | null,
  matchBasePath: string,
): BracketImpact | null => {
  const roundName = match.round_name || 'Single Elimination'
  if (!bracketData) {
    return {
      roundName,
      nextReason: advancement?.reason || 'Bracket cache has not been generated yet.',
      isLastRound: false,
      champion,
    }
  }

  const currentRoundIndex = bracketData.rounds.findIndex((round) =>
    round.matches.some((roundMatch) => idsEqual(roundMatch.id, match.id)),
  )
  const currentRound = currentRoundIndex >= 0 ? bracketData.rounds[currentRoundIndex] : undefined
  const currentMatch = currentRound?.matches.find((roundMatch) => idsEqual(roundMatch.id, match.id))
  const isLastRound = currentRoundIndex >= 0 && currentRoundIndex === bracketData.rounds.length - 1

  return {
    roundName: currentRound?.name || roundName,
    currentMatch,
    nextMatchNumber: advancement?.targetMatchNumber,
    nextMatchHref: advancement?.targetMatchNumber
      ? `${matchBasePath}/${advancement.targetMatchNumber}`
      : undefined,
    nextTargetSlot: advancement?.targetSlot,
    nextReason:
      isLastRound ?
        'This is the last round for the current single-elimination bracket.'
      : advancement?.reason || 'No next-match target is available yet.',
    isLastRound,
    champion: isLastRound ? champion : null,
  }
}

export const getMatchDetail = async (
  matchNumber: string,
  eventId?: string | number,
  matchBasePath = '/matches',
): Promise<MatchDetailResult | null> => {
  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 1,
    where: eventId
      ? { and: [{ match_number: { equals: matchNumber } }, { event_id: { equals: eventId } }] }
      : { match_number: { equals: matchNumber } },
  })

  const match = matches.docs[0] as MatchDetail | undefined
  if (!match) {
    return null
  }

  const participantEntryIds = [match.participant_a_entry_id, match.participant_b_entry_id]
    .map((value) => getRelationshipId(value))
    .filter((id): id is string | number => Boolean(id))
  const participantClubLabelByEntryId = await collectEntryClubLabels(payload, participantEntryIds)
  const participantAEntryId = getRelationshipId(match.participant_a_entry_id)
  const participantBEntryId = getRelationshipId(match.participant_b_entry_id)
  const participantAClub =
    participantAEntryId !== undefined ? participantClubLabelByEntryId.get(String(participantAEntryId)) : undefined
  const participantBClub =
    participantBEntryId !== undefined ? participantClubLabelByEntryId.get(String(participantBEntryId)) : undefined

  const matchSets = await payload.find({
    collection: 'match-sets',
    depth: 1,
    limit: 50,
    sort: 'set_number',
    where: {
      match_id: { equals: match.id },
    },
  })

  const documentationAssets = await payload.find({
    collection: 'documentation-assets',
    depth: 1,
    limit: 100,
    sort: '-createdAt',
    where: {
      match_id: { equals: match.id },
    },
  })

  const comments = await payload.find({
    collection: 'comments',
    depth: 1,
    limit: 100,
    sort: ['-is_pinned', '-createdAt'],
    where: {
      and: [
        { entity_type: { equals: 'matches' } },
        { entity_id: { equals: String(match.id) } },
        { status: { in: ['pending', 'approved', 'hidden', 'resolved'] } },
      ],
    },
  })
  let advancement: WinnerAdvancementResult | null = null
  let champion: BracketChampion | null = null
  let standingImpact: StandingImpact | null = null
  let bracketImpact: BracketImpact | null = null
  const stageType =
    match.stage_id && typeof match.stage_id === 'object' ? match.stage_id.stage_type : undefined

  try {
    standingImpact = await getStandingImpact(payload, match, stageType)
  } catch (error) {
    payload.logger.error(
      `Failed to load standing impact for match ${match.match_number}: ${error}`,
    )
  }

  if (stageType === 'single_elimination') {
    let bracketData: SingleEliminationBracketData | undefined

    try {
      advancement = await getSingleEliminationAdvancementPreview(payload, match.id)
    } catch (error) {
      payload.logger.error(
        `Failed to load winner advancement preview for match ${match.match_number}: ${error}`,
      )
    }

    const stageId = getRelationshipId(match.stage_id)
    if (stageId) {
      try {
        const brackets = await payload.find({
          collection: 'brackets',
          depth: 0,
          limit: 1,
          where: {
            stage_id: {
              equals: stageId,
            },
          },
        })
        bracketData = brackets.docs[0]?.bracket_data as SingleEliminationBracketData | undefined
        champion =
          bracketData?.champion || {
            status: 'pending',
            reason: 'Champion metadata has not been generated yet.',
          }
      } catch (error) {
        payload.logger.error(
          `Failed to load champion context for match ${match.match_number}: ${error}`,
        )
      }
    }

    bracketImpact = getBracketImpact(match, bracketData, advancement, champion, matchBasePath)
  }

  return {
    match,
    matchSets: matchSets.docs as MatchSetDetail[],
    documentationAssets: documentationAssets.docs as DocumentationAssetDetail[],
    comments: comments.docs as CommentDetail[],
    advancement,
    champion,
    standingImpact,
    bracketImpact,
    participantAClub,
    participantBClub,
  }
}

export const getMatchAuditLog = async (
  matchId: string | number,
  matchSetIds: (string | number)[],
  commentIds: (string | number)[] = [],
): Promise<AuditLogEntry[]> => {
  const payload = await getPayload({ config })

  const orConditions: Where[] = [
    {
      and: [{ entity_type: { equals: 'matches' } }, { entity_id: { equals: String(matchId) } }],
    },
    ...matchSetIds.map((setId) => ({
      and: [{ entity_type: { equals: 'match-sets' } }, { entity_id: { equals: String(setId) } }],
    })),
    ...commentIds.map((commentId) => ({
      and: [{ entity_type: { equals: 'comments' } }, { entity_id: { equals: String(commentId) } }],
    })),
  ]

  const logs = await payload.find({
    collection: 'audit-logs',
    depth: 1,
    limit: 100,
    sort: '-createdAt',
    where: { or: orConditions },
  })

  return logs.docs as AuditLogEntry[]
}
