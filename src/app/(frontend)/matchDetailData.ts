import { getPayload } from 'payload'

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

export type MatchDetailResult = {
  match: MatchDetail
  matchSets: MatchSetDetail[]
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

  return { match, matchSets: matchSets.docs as MatchSetDetail[] }
}
