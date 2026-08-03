import type { Payload } from 'payload'

import { detectScheduleConflicts } from '../scheduler/conflicts'
import { getRelationshipId, type RelationshipDoc, type WorkspaceMatch } from '../../workspaceComponents'

type ReadinessMatch = WorkspaceMatch & { stage_id?: RelationshipDoc | string | number | null }

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 10.4 "Category readiness service" + section 15 P2 item
// 6 "Readiness analytics dan rekomendasi otomatis". Three partial, non-reusable readiness
// computations already existed before this (ReadinessChecklist.tsx and event-admin/page.tsx's
// setupTasks - both flat event-wide booleans; the new-event wizard's inline `categoryReadiness` -
// per-category but only 5 fixed labels, no blockers/warnings arrays, no conflict count, no
// roster/seed/group checks). None of them match section 10.4's actual contract
// (ready/warnings/blockers/nextAction/completionBySection/publishable) or call
// detectScheduleConflicts at all. This is that service, built once and reused by a new dashboard
// page rather than a fourth copy of the same aggregate-count pattern.

export type ReadinessIssue = { code: string; message: string }

export type CategoryReadiness = {
  categoryId: string
  categoryName: string
  sportLabel: string
  formatType: string
  status: string
  blockers: ReadinessIssue[]
  warnings: ReadinessIssue[]
  ready: boolean
  publishable: boolean
  nextAction: string | null
  completionBySection: {
    participants: boolean
    draw: boolean
    schedule: boolean
    publish: boolean
  }
}

export type EventReadinessSummary = {
  categories: CategoryReadiness[]
  publishableCount: number
  blockedCount: number
}

const AUTO_GENERATE_FORMATS = new Set(['single_elimination', 'round_robin', 'double_elimination', 'time_trial', 'score_ranking'])

type MinimalCategory = {
  id: string | number
  name: string
  format_type: string
  participant_mode: string
  status: string
  roster_required?: boolean | null
  min_roster_size?: number | null
  group_qualify_count?: number | null
  sport_id?: { id?: string | number; name?: string } | string | number | null
}

type MinimalEntry = {
  id: string | number
  category_id: string | number
  entry_type?: string | null
  team_id?: { id?: string | number } | string | number | null
  seed_number?: number | null
  group_id?: string | number | null
  status: string
}

type MinimalStage = {
  id: string | number
  category_id: string | number
  order: number
  status: string
  stage_type?: string | null
}

export const computeEventCategoryReadiness = async (payload: Payload, eventId: string | number): Promise<EventReadinessSummary> => {
  const eventWhere = { event_id: { equals: eventId } }

  const [categoriesResult, entriesResult, matchesResult, stagesResult, rostersResult] = await Promise.all([
    payload.find({ collection: 'competition-categories', depth: 1, limit: 500, where: eventWhere, sort: 'name' }),
    payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 2000,
      where: { and: [eventWhere, { status: { equals: 'confirmed' } }] },
    }),
    payload.find({ collection: 'matches', depth: 2, limit: 2000, where: eventWhere }),
    payload.find({ collection: 'stages', depth: 0, limit: 500, where: eventWhere }),
    payload.find({
      collection: 'rosters',
      depth: 0,
      limit: 5000,
      where: { and: [eventWhere, { status: { equals: 'active' } }] },
    }),
  ])

  const categories = categoriesResult.docs as unknown as MinimalCategory[]
  const entries = entriesResult.docs as unknown as MinimalEntry[]
  const matches = matchesResult.docs as ReadinessMatch[]
  const stages = stagesResult.docs as unknown as MinimalStage[]

  const entriesByCategory = new Map<string, MinimalEntry[]>()
  for (const entry of entries) {
    const key = String(entry.category_id)
    const list = entriesByCategory.get(key) || []
    list.push(entry)
    entriesByCategory.set(key, list)
  }

  const matchesByCategory = new Map<string, ReadinessMatch[]>()
  for (const match of matches) {
    const key = String(getRelationshipId(match.category_id))
    const list = matchesByCategory.get(key) || []
    list.push(match)
    matchesByCategory.set(key, list)
  }

  const stagesByCategory = new Map<string, MinimalStage[]>()
  for (const stage of stages) {
    const key = String(stage.category_id)
    const list = stagesByCategory.get(key) || []
    list.push(stage)
    stagesByCategory.set(key, list)
  }

  const rosterCountByTeamId = new Map<string, number>()
  for (const roster of rostersResult.docs) {
    const teamId = String(getRelationshipId(roster.team_id as { id?: string | number } | string | number | null))
    rosterCountByTeamId.set(teamId, (rosterCountByTeamId.get(teamId) || 0) + 1)
  }

  // Hard schedule conflicts are computed once across every match in the event (a conflict can
  // involve two matches from different categories), then attributed back to whichever
  // category/categories each conflicting match belongs to.
  const conflictWarnings = detectScheduleConflicts(matches).filter((warning) => warning.severity === 'alert')
  const matchCategoryById = new Map<string, string>()
  for (const match of matches) {
    matchCategoryById.set(String(match.id), String(getRelationshipId(match.category_id)))
  }
  const conflictCountByCategory = new Map<string, number>()
  for (const warning of conflictWarnings) {
    const touchedCategories = new Set(
      warning.matchIds.map((id) => matchCategoryById.get(String(id))).filter((id): id is string => Boolean(id)),
    )
    for (const categoryId of touchedCategories) {
      conflictCountByCategory.set(categoryId, (conflictCountByCategory.get(categoryId) || 0) + 1)
    }
  }

  const NOT_YET_PLAYED_MATCH_STATUSES = new Set(['walkover', 'cancelled', 'disqualified'])

  const categoryRows: CategoryReadiness[] = categories.map((category) => {
    const categoryId = String(category.id)
    const categoryEntries = entriesByCategory.get(categoryId) || []
    const categoryMatches = (matchesByCategory.get(categoryId) || []).filter(
      (match) => !NOT_YET_PLAYED_MATCH_STATUSES.has(match.status),
    )
    const sportLabel =
      category.sport_id && typeof category.sport_id === 'object' ? String(category.sport_id.name || '') : ''

    const blockers: ReadinessIssue[] = []
    const warnings: ReadinessIssue[] = []

    if (category.status === 'draft') {
      return {
        categoryId,
        categoryName: category.name,
        sportLabel,
        formatType: category.format_type,
        status: category.status,
        blockers: [],
        warnings: [{ code: 'draft', message: 'Still in Draft - not evaluated yet.' }],
        ready: false,
        publishable: false,
        nextAction: 'Move this category out of Draft when you start setting it up.',
        completionBySection: { participants: false, draw: false, schedule: false, publish: false },
      }
    }

    if (category.participant_mode === 'tbd') {
      blockers.push({ code: 'participant_mode_undecided', message: 'Participant type has not been decided yet.' })
    }

    const confirmedCount = categoryEntries.length
    if (confirmedCount < 2) {
      blockers.push({ code: 'not_enough_entries', message: `Only ${confirmedCount} confirmed entr${confirmedCount === 1 ? 'y' : 'ies'} - needs at least 2.` })
    }

    if (category.roster_required && (category.min_roster_size || 0) > 0) {
      const underRostered = categoryEntries.filter((entry) => {
        if (entry.entry_type !== 'team' && entry.entry_type !== 'pair') return false
        const teamId = getRelationshipId(entry.team_id as { id?: string | number } | string | number | null)
        if (!teamId) return false
        const count = rosterCountByTeamId.get(String(teamId)) || 0
        return count < (category.min_roster_size || 0)
      })
      if (underRostered.length > 0) {
        blockers.push({
          code: 'roster_below_minimum',
          message: `${underRostered.length} team(s) have fewer than ${category.min_roster_size} active roster player(s).`,
        })
      }
    }

    const seedNumbers = categoryEntries.map((entry) => entry.seed_number).filter((seed): seed is number => Boolean(seed))
    const hasDuplicateSeed = new Set(seedNumbers).size !== seedNumbers.length
    if (hasDuplicateSeed) {
      blockers.push({ code: 'duplicate_seed', message: 'Two or more entries share the same seed number.' })
    }

    const isGroupStageToKnockout = category.format_type === 'group_stage_to_knockout'
    const autoGenerates = AUTO_GENERATE_FORMATS.has(category.format_type)
    const categoryStages = stagesByCategory.get(categoryId) || []
    const groupStage = categoryStages.find((stage) => stage.order === 1)
    const knockoutStage = categoryStages.find((stage) => stage.order === 2)

    let groupsReady = true
    if (isGroupStageToKnockout) {
      if (!groupStage || groupStage.status !== 'completed') {
        warnings.push({ code: 'group_stage_not_finalized', message: 'Group stage results are not finalized yet.' })
        groupsReady = false
      } else if (!knockoutStage || (matchesByCategory.get(categoryId) || []).every((match) => getRelationshipId(match.stage_id) !== String(knockoutStage.id))) {
        blockers.push({ code: 'not_promoted', message: 'Group stage is finalized but qualifiers have not been promoted to the knockout bracket yet.' })
        groupsReady = false
      }
    }

    const hasMatches = isGroupStageToKnockout
      ? Boolean(knockoutStage) && (matchesByCategory.get(categoryId) || []).some((match) => getRelationshipId(match.stage_id) === String(knockoutStage?.id))
      : categoryMatches.length > 0
    if (confirmedCount >= 2 && autoGenerates && !isGroupStageToKnockout && !hasMatches) {
      blockers.push({ code: 'matches_not_generated', message: 'Matches have not been generated yet.' })
    }

    const conflictCount = conflictCountByCategory.get(categoryId) || 0
    if (conflictCount > 0) {
      blockers.push({ code: 'hard_conflict', message: `${conflictCount} scheduling conflict(s) involve this category's matches.` })
    }

    const unscheduledCount = categoryMatches.filter((match) => !match.scheduled_start_at || !getRelationshipId(match.venue_id) || !getRelationshipId(match.court_id)).length
    if (categoryMatches.length > 0 && unscheduledCount > 0) {
      warnings.push({ code: 'schedule_incomplete', message: `${unscheduledCount} match(es) still need a venue/court/time.` })
    }

    if (!autoGenerates && !isGroupStageToKnockout) {
      warnings.push({ code: 'manual_scheduling', message: 'This format is scheduled manually in the Scheduler workspace, not auto-generated.' })
    }

    const ready = blockers.length === 0
    const publishable = ready && category.status !== 'draft'
    const nextAction = blockers[0]?.message || warnings[0]?.message || null

    return {
      categoryId,
      categoryName: category.name,
      sportLabel,
      formatType: category.format_type,
      status: category.status,
      blockers,
      warnings,
      ready,
      publishable,
      nextAction,
      completionBySection: {
        participants: confirmedCount >= 2 && !blockers.some((b) => b.code === 'roster_below_minimum'),
        draw: !hasDuplicateSeed && groupsReady,
        schedule: hasMatches && conflictCount === 0 && unscheduledCount === 0,
        publish: category.status !== 'draft',
      },
    }
  })

  return {
    categories: categoryRows,
    publishableCount: categoryRows.filter((row) => row.publishable).length,
    blockedCount: categoryRows.filter((row) => row.blockers.length > 0).length,
  }
}
