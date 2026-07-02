import { getPayload, type Where } from 'payload'

import config from '@payload-config'
import { EntryDoc, RelationshipDoc } from './workspaces/workspaceComponents'

export type StageDoc = RelationshipDoc & {
  stage_type?: string
  order?: number
}

export type CategoryDoc = RelationshipDoc & {
  participant_mode?: string
  format_type?: string
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

export type MatchDetailResult = {
  match: MatchDetail
  matchSets: MatchSetDetail[]
  documentationAssets: DocumentationAssetDetail[]
}

export const getMatchDetail = async (matchNumber: string): Promise<MatchDetailResult | null> => {
  const payload = await getPayload({ config })
  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 1,
    where: {
      match_number: { equals: matchNumber },
    },
  })

  const match = matches.docs[0] as MatchDetail | undefined
  if (!match) {
    return null
  }

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

  return {
    match,
    matchSets: matchSets.docs as MatchSetDetail[],
    documentationAssets: documentationAssets.docs as DocumentationAssetDetail[],
  }
}

export const getMatchAuditLog = async (
  matchId: string | number,
  matchSetIds: (string | number)[],
): Promise<AuditLogEntry[]> => {
  const payload = await getPayload({ config })

  const orConditions: Where[] = [
    {
      and: [{ entity_type: { equals: 'matches' } }, { entity_id: { equals: String(matchId) } }],
    },
    ...matchSetIds.map((setId) => ({
      and: [{ entity_type: { equals: 'match-sets' } }, { entity_id: { equals: String(setId) } }],
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
