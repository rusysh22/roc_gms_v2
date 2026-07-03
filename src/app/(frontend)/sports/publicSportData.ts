import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import type { RelationshipDoc } from '../workspaces/workspaceComponents'

export type SportDoc = RelationshipDoc & {
  slug: string
  description?: string | null
  sport_type?: string | null
  is_active?: boolean | null
  event_id?: RelationshipDoc | string | number | null
}

export type RulesetDoc = RelationshipDoc & {
  description?: string | null
  score_type?: string | null
  allow_draw?: boolean | null
  points_win?: number | null
  points_draw?: number | null
  points_loss?: number | null
  set_based?: boolean | null
  best_of?: number | null
  target_score?: number | null
  deuce_enabled?: boolean | null
  period_count?: number | null
  period_duration?: number | null
  tie_breakers?: unknown
}

export type CategoryDoc = RelationshipDoc & {
  slug: string
  participant_mode: string
  roster_required?: boolean | null
  min_roster_size?: number | null
  max_roster_size?: number | null
  format_type: string
  status: string
  event_id?: RelationshipDoc | string | number | null
  sport_id?: SportDoc | string | number | null
  ruleset_id?: RulesetDoc | string | number | null
}

export type StageDoc = RelationshipDoc & {
  stage_type: string
  order?: number | null
  status?: string | null
}

export type PublicMatch = {
  id: string | number
  match_number: string
  round_name?: string | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  status: string
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
}

export type StandingRow = {
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
  stage_id?: RelationshipDoc | string | number | null
  group_id?: RelationshipDoc | string | number | null
  entry_id?: RelationshipDoc | string | number | null
}

export type PublicBracket = {
  id: string | number
  name: string
  format: string
  status: string
  bracket_data?: SingleEliminationBracketData | null
  stage_id?: RelationshipDoc | string | number | null
}

export type CategoryDetailData = {
  sport: SportDoc
  category: CategoryDoc
  stages: StageDoc[]
  matches: PublicMatch[]
  standings: StandingRow[]
  bracket?: PublicBracket
}

export const standingFormatTypes = new Set([
  'group_stage',
  'group_stage_to_knockout',
  'round_robin',
  'league',
])

export const getSportCategories = async () => {
  const payload = await getPayload({ config })

  const [sportsResult, categoriesResult] = await Promise.all([
    payload.find({
      collection: 'sports',
      depth: 0,
      limit: 50,
      sort: 'name',
      where: { is_active: { equals: true } },
    }),
    payload.find({
      collection: 'competition-categories',
      depth: 1,
      limit: 200,
      sort: ['sport_id', 'name'],
      where: { status: { in: ['open', 'locked', 'published'] } },
    }),
  ])

  return {
    sports: sportsResult.docs as SportDoc[],
    categories: categoriesResult.docs as CategoryDoc[],
  }
}

export const getCategoryDetail = async (
  sportSlug: string,
  categorySlug: string,
): Promise<CategoryDetailData | null> => {
  const payload = await getPayload({ config })

  const sportsResult = await payload.find({
    collection: 'sports',
    depth: 0,
    limit: 1,
    where: {
      and: [{ slug: { equals: sportSlug } }, { is_active: { equals: true } }],
    },
  })
  const sport = sportsResult.docs[0] as SportDoc | undefined
  if (!sport?.id) {
    return null
  }

  const categoriesResult = await payload.find({
    collection: 'competition-categories',
    depth: 2,
    limit: 1,
    where: {
      and: [
        { slug: { equals: categorySlug } },
        { sport_id: { equals: sport.id } },
        { status: { in: ['open', 'locked', 'published'] } },
      ],
    },
  })
  const category = categoriesResult.docs[0] as CategoryDoc | undefined
  if (!category?.id) {
    return null
  }

  const [stagesResult, matchesResult, standingsResult, bracketsResult] = await Promise.all([
    payload.find({
      collection: 'stages',
      depth: 0,
      limit: 50,
      sort: 'order',
      where: { category_id: { equals: category.id } },
    }),
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 100,
      sort: ['scheduled_start_at', 'match_number'],
      where: {
        and: [{ category_id: { equals: category.id } }, { is_public: { equals: true } }],
      },
    }),
    payload.find({
      collection: 'standings',
      depth: 1,
      limit: 200,
      sort: ['stage_id', 'group_id', 'rank'],
      where: { category_id: { equals: category.id } },
    }),
    payload.find({
      collection: 'brackets',
      depth: 1,
      limit: 1,
      where: {
        and: [
          { category_id: { equals: category.id } },
          { status: { in: ['published', 'locked'] } },
        ],
      },
    }),
  ])

  return {
    sport,
    category,
    stages: stagesResult.docs as StageDoc[],
    matches: matchesResult.docs as PublicMatch[],
    standings: standingsResult.docs as StandingRow[],
    bracket: bracketsResult.docs[0] as PublicBracket | undefined,
  }
}
