import type { Payload } from 'payload'

import { AUTO_GENERATE_FORMATS } from '@/app/(frontend)/workspaces/(focus)/event-admin/new-event/wizardShared'

// prd/redesign/import-data-and-draft-persistence.md track DR-2 ("resume discoverability"): the New
// Event Wizard is a ten-step flow, but an event that is only half set up leaves no obvious way back
// in. The wizard page and the Event Admin landing both need to answer the same two questions -
// "which steps are actually done?" and "where should the organizer pick up?" - so the logic lives
// here once instead of being derived twice with two subtly different rules.
//
// `deriveWizardProgress` is a pure function over already-fetched counts so it can be unit tested;
// `computeWizardProgress` is the thin wrapper that runs the queries against the Payload local API.

// Steps that represent a real task with its own "done" bar, in the order the wizard presents them.
// `setup` (answered or skipped), `history` (a passive viewer) and `venues` (an optional
// add-venues-and-courts step you can skip) are not tasks; `event` is definitionally done once an
// event row exists, which is a precondition for calling this at all.
export const WIZARD_TASK_STEPS = [
  'sports',
  'categories',
  'participants',
  'registration',
  'draw',
  'generate',
  'bracket',
] as const

export type WizardTaskStep = (typeof WIZARD_TASK_STEPS)[number]

// The steps an organizer is sent back to when resuming - `bracket` is the review/publish step and
// is only ever the target once everything before it is done, so it is the implicit fallback rather
// than a member of this list.
const RESUMABLE_STEPS: WizardTaskStep[] = [
  'sports',
  'categories',
  'participants',
  'registration',
  'draw',
  'generate',
]

type ProgressCategory = {
  id: string | number
  status?: string | null
  format_type?: string | null
}

export type WizardProgressInput = {
  sportsCount: number
  categories: ProgressCategory[]
  clubsCount: number
  teamsCount: number
  playersCount: number
  /** Confirmed competition entries - only `category_id` is read. */
  confirmedEntries: { category_id: string | number }[]
  /** Every match for the event - `category_id` and `stage_id` are read. */
  matches: { category_id: string | number; stage_id: string | number }[]
  /**
   * Ids of `order: 1` + `group_stage` stages (the group stage of a group→KO category). Wizard
   * setup for such a category is "done" once its *group* fixtures exist - finalizing the group
   * standings and promoting to the knockout are event-time actions, not part of setup. See
   * prd/redesign/wizard-completion-and-post-generate-flow.md.
   */
  groupStageIds: (string | number)[]
}

export type WizardProgress = {
  completedSteps: Set<string>
  /** First task step still outstanding, or `bracket` when the whole flow is done. */
  firstIncompleteStep: WizardTaskStep
  completedTaskCount: number
  totalTaskCount: number
  isComplete: boolean
}

export const deriveWizardProgress = (input: WizardProgressInput): WizardProgress => {
  const completedSteps = new Set<string>(['event', 'setup', 'history', 'venues'])

  if (input.sportsCount > 0) completedSteps.add('sports')
  if (input.categories.length > 0) completedSteps.add('categories')
  if (input.clubsCount + input.teamsCount + input.playersCount > 0) completedSteps.add('participants')

  // Mirrors the wizard's own rule (NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 11): a step is only "done"
  // once every non-draft category clears its bar. Draft categories are not publishable yet, so they
  // do not block progress; a manual-scheduling-only format never blocks the auto-generate step
  // because the wizard cannot generate its matches anyway.
  const nonDraftCategories = input.categories.filter((category) => category.status !== 'draft')

  const confirmedByCategory = new Map<string, number>()
  for (const entry of input.confirmedEntries) {
    const key = String(entry.category_id)
    confirmedByCategory.set(key, (confirmedByCategory.get(key) || 0) + 1)
  }
  const categoriesWithMatches = new Set(input.matches.map((match) => String(match.category_id)))

  if (
    nonDraftCategories.length > 0 &&
    nonDraftCategories.every((category) => (confirmedByCategory.get(String(category.id)) || 0) >= 2)
  ) {
    // Registration and Draw share this criterion: an entry is given its seed_number the moment it
    // is added, so there is no independent "has this been seeded" signal to check separately.
    completedSteps.add('registration')
    completedSteps.add('draw')
  }

  const autoGenerateCategories = nonDraftCategories.filter((category) =>
    AUTO_GENERATE_FORMATS.has(String(category.format_type)),
  )
  const groupKnockoutCategories = nonDraftCategories.filter(
    (category) => category.format_type === 'group_stage_to_knockout',
  )
  const groupStageIds = new Set(input.groupStageIds.map((id) => String(id)))
  const categoriesWithGroupMatches = new Set(
    input.matches
      .filter((match) => groupStageIds.has(String(match.stage_id)))
      .map((match) => String(match.category_id)),
  )
  const generateReadyCategories = [...autoGenerateCategories, ...groupKnockoutCategories]
  // For a group→KO category, "generate done" means the *group* fixtures exist. Playing them,
  // finalizing the standings and promoting the qualifiers into the knockout bracket all happen
  // when the event runs - the wizard never blocks on them.
  const isGenerateDone = (category: ProgressCategory) =>
    category.format_type === 'group_stage_to_knockout'
      ? categoriesWithGroupMatches.has(String(category.id))
      : categoriesWithMatches.has(String(category.id))
  if (generateReadyCategories.length > 0 && generateReadyCategories.every(isGenerateDone)) {
    completedSteps.add('generate')
    completedSteps.add('bracket')
  }

  const firstIncompleteStep =
    RESUMABLE_STEPS.find((stepKey) => !completedSteps.has(stepKey)) ?? 'bracket'
  const completedTaskCount = WIZARD_TASK_STEPS.filter((stepKey) => completedSteps.has(stepKey)).length

  return {
    completedSteps,
    firstIncompleteStep,
    completedTaskCount,
    totalTaskCount: WIZARD_TASK_STEPS.length,
    isComplete: completedTaskCount === WIZARD_TASK_STEPS.length,
  }
}

export const computeWizardProgress = async (
  payload: Payload,
  eventId: string | number,
): Promise<WizardProgress> => {
  const eventWhere = { event_id: { equals: eventId } }

  const [sportsCount, categoriesResult, clubsCount, teamsCount, playersCount, confirmedEntries, eventMatches] =
    await Promise.all([
      payload.count({ collection: 'sports', where: eventWhere }),
      payload.find({ collection: 'competition-categories', depth: 0, limit: 500, where: eventWhere }),
      payload.count({ collection: 'clubs', where: eventWhere }),
      payload.count({ collection: 'teams', where: eventWhere }),
      payload.count({ collection: 'players', where: eventWhere }),
      payload.find({
        collection: 'competition-entries',
        depth: 0,
        limit: 5000,
        where: { and: [eventWhere, { status: { equals: 'confirmed' } }] },
      }),
      payload.find({ collection: 'matches', depth: 0, limit: 5000, where: eventWhere }),
    ])

  const categories = categoriesResult.docs as ProgressCategory[]
  const needsGroupStages = categories.some(
    (category) => category.status !== 'draft' && category.format_type === 'group_stage_to_knockout',
  )
  const groupStagesResult = needsGroupStages
    ? await payload.find({
        collection: 'stages',
        depth: 0,
        limit: 200,
        where: {
          and: [eventWhere, { order: { equals: 1 } }, { stage_type: { equals: 'group_stage' } }],
        },
      })
    : null

  return deriveWizardProgress({
    sportsCount: sportsCount.totalDocs,
    categories,
    clubsCount: clubsCount.totalDocs,
    teamsCount: teamsCount.totalDocs,
    playersCount: playersCount.totalDocs,
    confirmedEntries: confirmedEntries.docs as { category_id: string | number }[],
    matches: eventMatches.docs as { category_id: string | number; stage_id: string | number }[],
    groupStageIds: (groupStagesResult?.docs ?? []).map((stage) => stage.id),
  })
}
