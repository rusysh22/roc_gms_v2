'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { advanceCategoryStatus } from '@/lib/categoryLifecycle'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  createSingleEliminationBracketMatches,
  generateRoundRobinRounds,
  getMatchPairKey,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { UNSTARTED_TARGET_STATUSES } from '@/lib/winnerAdvancement'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, text, wizardPage } from './wizardShared'

const RESULT_STATUSES = new Set(['result_published', 'walkover'])
const MIN_GROUPS = 2
const MAX_GROUPS = 12

const findKnockoutStage = async (
  payload: Awaited<ReturnType<typeof assertWorkspaceActionAccess>>['payload'],
  categoryId: string,
) => {
  const result = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 1,
    where: { and: [{ category_id: { equals: categoryId } }, { order: { equals: 2 } }] },
  })
  return result.docs[0] || null
}

const redirectToGenerate = (eventId: string, categoryId: string, suffix: string): never => {
  redirect(`${wizardPage}?eventId=${eventId}&step=generate&categoryId=${categoryId}${suffix}`)
}

// group_id is a relationship field (Postgres integer FK) - Payload rejects numeric-looking
// *strings* on relationship fields even though form data always arrives as strings
// (src/lib/standings.ts's toRelationId documents the same class of bug).
const toRelationId = (value: string | number): number => Number(value)

const findGroupStage = async (
  payload: Awaited<ReturnType<typeof assertWorkspaceActionAccess>>['payload'],
  categoryId: string,
) => {
  const result = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 1,
    where: { and: [{ category_id: { equals: categoryId } }, { order: { equals: 1 } }] },
  })
  return result.docs[0] || null
}

export async function createGroupsAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const groupCount = Number(text(formData, 'groupCount'))

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!categoryId || !Number.isInteger(groupCount) || groupCount < MIN_GROUPS || groupCount > MAX_GROUPS) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_group_count')
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }

  const stage =
    (await findGroupStage(payload, categoryId)) ||
    (await payload.create({
      collection: 'stages',
      data: {
        event_id: Number(eventId),
        category_id: Number(categoryId),
        name: `${category!.name} - Group Stage`,
        stage_type: 'group_stage',
        order: 1,
        status: 'draft',
      },
    }))

  const existingGroups = await payload.find({
    collection: 'groups',
    depth: 0,
    limit: MAX_GROUPS,
    sort: 'order',
    where: { stage_id: { equals: stage.id } },
  })

  const toCreate = groupCount - existingGroups.totalDocs
  for (let index = 0; index < toCreate; index += 1) {
    const order = existingGroups.totalDocs + index + 1
    await payload.create({
      collection: 'groups',
      data: {
        event_id: Number(eventId),
        stage_id: stage.id,
        name: `Group ${String.fromCharCode(65 + order - 1)}`,
        order,
      },
    })
  }

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUpdated=1')
}

export async function saveGroupAssignmentsAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const updates: Array<{ id: string; groupId: string | null }> = []
  for (const [key, value] of formData.entries()) {
    const match = /^group_(.+)$/.exec(key)
    if (!match || typeof value !== 'string') {
      continue
    }
    updates.push({ id: match[1], groupId: value || null })
  }

  await Promise.all(
    updates.map(({ id, groupId }) =>
      payload.update({
        collection: 'competition-entries',
        id,
        data: { group_id: groupId ? toRelationId(groupId) : null },
      }),
    ),
  )

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUpdated=1')
}

export async function autoSplitGroupsAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const stage = await findGroupStage(payload, categoryId)
  if (!stage) {
    redirectToGenerate(eventId, categoryId, '&wizardError=missing_groups')
  }

  const [groupsResult, entriesResult] = await Promise.all([
    payload.find({
      collection: 'groups',
      depth: 0,
      limit: MAX_GROUPS,
      sort: 'order',
      where: { stage_id: { equals: stage!.id } },
    }),
    payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 500,
      where: { and: [{ category_id: { equals: categoryId } }, { status: { equals: 'confirmed' } }] },
    }),
  ])

  if (groupsResult.docs.length === 0) {
    redirectToGenerate(eventId, categoryId, '&wizardError=missing_groups')
  }

  const shuffled = [...entriesResult.docs]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  await Promise.all(
    shuffled.map((entry, index) =>
      payload.update({
        collection: 'competition-entries',
        id: entry.id,
        data: { group_id: groupsResult.docs[index % groupsResult.docs.length].id },
      }),
    ),
  )

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUpdated=1')
}

export async function setGroupQualifyCountAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const qualifyCount = Number(text(formData, 'qualifyCount'))

  if (!categoryId || !Number.isInteger(qualifyCount) || qualifyCount < 1) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_qualify_count')
  }

  await payload.update({
    collection: 'competition-categories',
    id: categoryId,
    data: { group_qualify_count: qualifyCount },
  })

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUpdated=1')
}

export async function generateGroupMatchesAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }

  const stage = await findGroupStage(payload, categoryId)
  if (!stage) {
    redirectToGenerate(eventId, categoryId, '&wizardError=missing_groups')
  }

  const [groupsResult, entriesResult, existingStageMatches] = await Promise.all([
    payload.find({
      collection: 'groups',
      depth: 0,
      limit: MAX_GROUPS,
      sort: 'order',
      where: { stage_id: { equals: stage!.id } },
    }),
    payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 500,
      where: {
        and: [
          { category_id: { equals: categoryId } },
          { status: { equals: 'confirmed' } },
          { group_id: { exists: true } },
        ],
      },
    }),
    payload.find({
      collection: 'matches',
      depth: 0,
      limit: 500,
      where: { stage_id: { equals: stage!.id } },
    }),
  ])

  const entriesByGroupId = new Map<string, MatchGenerationEntry[]>()
  for (const entry of entriesResult.docs) {
    const groupId = String(entry.group_id)
    const list = entriesByGroupId.get(groupId) || []
    list.push({
      id: entry.id,
      display_name: String(entry.display_name),
      seed_number: entry.seed_number ?? null,
      status: entry.status,
    })
    entriesByGroupId.set(groupId, list)
  }

  const usedMatchNumbers = new Set(existingStageMatches.docs.map((match) => String(match.match_number)))
  let sequence = existingStageMatches.totalDocs + 1
  const nextMatchNumber = (prefix: string) => {
    let candidate = `${category!.slug}-${prefix}-${String(sequence).padStart(3, '0')}`
    while (usedMatchNumbers.has(candidate)) {
      sequence += 1
      candidate = `${category!.slug}-${prefix}-${String(sequence).padStart(3, '0')}`
    }
    usedMatchNumbers.add(candidate)
    sequence += 1
    return candidate
  }

  let createdCount = 0
  let failedCount = 0

  for (const group of groupsResult.docs) {
    const groupEntries = getSchedulableEntries(entriesByGroupId.get(String(group.id)) || [])
    if (groupEntries.length < 2) {
      continue
    }

    const pairings = generateRoundRobinRounds(groupEntries)
    for (const pairing of pairings) {
      const pairKey = getMatchPairKey(pairing.participantA.id, pairing.participantB.id)
      const generationKey = `${event.slug}:${category!.slug}:${stage!.id}:${group.id}:round_robin:${pairKey}`

      const existingMatch = await payload.find({
        collection: 'matches',
        depth: 0,
        limit: 1,
        where: { generation_key: { equals: generationKey } },
      })
      if (existingMatch.docs.length > 0) {
        continue
      }

      try {
        await payload.create({
          collection: 'matches',
          data: {
            event_id: Number(eventId),
            sport_id: category!.sport_id,
            category_id: Number(categoryId),
            stage_id: stage!.id,
            group_id: group.id,
            round_name: `${group.name} - ${pairing.roundName}`,
            match_number: nextMatchNumber(`g${group.order}`),
            participant_a_entry_id: Number(pairing.participantA.id),
            participant_b_entry_id: Number(pairing.participantB.id),
            status: 'ready_for_scheduling',
            generation_source: 'round_robin',
            generation_key: generationKey,
            is_public: true,
            documentation_status: 'not_started',
          },
        })
        createdCount += 1
      } catch {
        failedCount += 1
      }
    }

    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId,
      stageId: stage!.id,
      groupId: group.id,
    })
  }

  if (createdCount > 0) {
    // Group fixtures exist - the group stage's draw is settled, lock the category (open -> locked).
    await advanceCategoryStatus(payload, categoryId, 'locked')
  }

  revalidatePath(wizardPage)
  const failedParam = failedCount > 0 ? `&wizardGenerateFailed=${failedCount}` : ''
  redirectToGenerate(eventId, categoryId, `&wizardGenerated=${createdCount}${failedParam}`)
}

// Quick final-score entry for a group match, straight from the wizard. The full match lifecycle
// (schedule -> ready_to_start -> ongoing -> finished -> result_published, with per-set live scoring)
// lives in the Matches / live-score workspace and is the right tool once an event is running. But a
// group-stage-to-knockout category can't be finalized or promoted until every group match has an
// official result, and a small event's organizer scoring everything themselves shouldn't have to
// walk each fixture through five status changes just to type "3-1". This collapses that to one form
// for group-stage matches that never entered the live-scoring flow (still ready_for_scheduling /
// scheduled / ready_to_start), writing a single decisive set and publishing the result.
export async function recordGroupMatchResultAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const matchId = text(formData, 'matchId')
  const scoreARaw = text(formData, 'scoreA')
  const scoreBRaw = text(formData, 'scoreB')
  const winnerOverride = text(formData, 'winner') // 'A' | 'B' | '' - only used to break a drawn score
  const scoreA = Number(scoreARaw)
  const scoreB = Number(scoreBRaw)

  if (
    !matchId ||
    scoreARaw === '' ||
    scoreBRaw === '' ||
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0
  ) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_result')
  }

  const match = await payload
    .findByID({ collection: 'matches', id: matchId, depth: 0 })
    .catch(() => null)
  if (
    !match ||
    String(match.event_id) !== String(eventId) ||
    String(match.category_id) !== String(categoryId)
  ) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }

  const groupStage = await findGroupStage(payload, categoryId)
  if (!groupStage || String(match!.stage_id) !== String(groupStage.id)) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }
  // Anything already through the real result flow stays there - correcting a published/disputed
  // score has its own revision-reason path in the Matches workspace.
  if (['result_published', 'walkover', 'finished', 'under_review', 'disputed'].includes(String(match!.status))) {
    redirectToGenerate(eventId, categoryId, '&wizardError=result_locked')
  }

  const entryAId = Number(match!.participant_a_entry_id)
  const entryBId = Number(match!.participant_b_entry_id)
  if (!entryAId || !entryBId) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }

  let winnerEntryId: number
  if (scoreA > scoreB) winnerEntryId = entryAId
  else if (scoreB > scoreA) winnerEntryId = entryBId
  else if (winnerOverride === 'A') winnerEntryId = entryAId
  else if (winnerOverride === 'B') winnerEntryId = entryBId
  else redirectToGenerate(eventId, categoryId, '&wizardError=result_tie_needs_winner')

  // Replace any prior set(s) so re-submitting a corrected score doesn't stack rows.
  const existingSets = await payload.find({
    collection: 'match-sets',
    depth: 0,
    limit: 50,
    where: { match_id: { equals: matchId } },
  })
  for (const set of existingSets.docs) {
    await payload.delete({ collection: 'match-sets', id: set.id })
  }

  await payload.create({
    collection: 'match-sets',
    data: {
      event_id: Number(eventId),
      match_id: Number(matchId),
      set_number: 1,
      participant_a_score: scoreA,
      participant_b_score: scoreB,
      winner_entry_id: winnerEntryId!,
    },
    user,
  })

  const before = { status: match!.status, winner_entry_id: match!.winner_entry_id ?? null }
  await payload.update({
    collection: 'matches',
    id: matchId,
    data: { status: 'result_published', winner_entry_id: winnerEntryId! },
    user,
  })
  await recordAuditLog({
    payload,
    action: 'group_match.quick_result',
    entityType: 'matches',
    entityId: matchId,
    before,
    after: { status: 'result_published', winner_entry_id: winnerEntryId!, participant_a_score: scoreA, participant_b_score: scoreB },
    actorUserId: user.id,
  })

  await recalculateStandingsForScope(payload, {
    eventId,
    categoryId,
    stageId: groupStage!.id,
    groupId: match!.group_id ? Number(match!.group_id) : undefined,
  })

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUpdated=1')
}

export async function finalizeGroupStandingsAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }
  const qualifyCount = Number(category!.group_qualify_count || 0)
  if (!Number.isInteger(qualifyCount) || qualifyCount < 1) {
    redirectToGenerate(eventId, categoryId, '&wizardError=missing_qualify_count')
  }

  const stage = await findGroupStage(payload, categoryId)
  if (!stage) {
    redirectToGenerate(eventId, categoryId, '&wizardError=missing_groups')
  }

  const groupsResult = await payload.find({
    collection: 'groups',
    depth: 0,
    limit: MAX_GROUPS,
    sort: 'order',
    where: { stage_id: { equals: stage!.id } },
  })
  if (groupsResult.docs.length === 0) {
    redirectToGenerate(eventId, categoryId, '&wizardError=missing_groups')
  }

  // Every group match must have an official result before standings can be trusted as final - a
  // group that's still mid-play can't distinguish "genuinely eliminated" from "just hasn't played
  // its decisive match yet".
  const allStageMatches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: { stage_id: { equals: stage!.id } },
  })
  const undecided = allStageMatches.docs.filter((match) => !RESULT_STATUSES.has(String(match.status)))
  if (allStageMatches.totalDocs === 0 || undecided.length > 0) {
    redirectToGenerate(eventId, categoryId, '&wizardError=groups_not_finished')
  }

  for (const group of groupsResult.docs) {
    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId,
      stageId: stage!.id,
      groupId: group.id,
    })

    const standingsResult = await payload.find({
      collection: 'standings',
      depth: 0,
      limit: 200,
      sort: 'rank',
      where: {
        and: [
          { category_id: { equals: categoryId } },
          { stage_id: { equals: stage!.id } },
          { group_id: { equals: group.id } },
        ],
      },
    })

    await Promise.all(
      standingsResult.docs.map((standing, index) =>
        payload.update({
          collection: 'standings',
          id: standing.id,
          data: { qualified_status: index < qualifyCount ? 'qualified' : 'eliminated' },
        }),
      ),
    )
  }

  const beforeStatus = stage!.status
  await payload.update({ collection: 'stages', id: stage!.id, data: { status: 'completed' } })
  await recordAuditLog({
    payload,
    action: 'group_stage.finalize',
    entityType: 'stages',
    entityId: stage!.id,
    before: { status: beforeStatus },
    after: { status: 'completed' },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUpdated=1')
}

export async function promoteToKnockoutAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirectToGenerate(eventId, categoryId, '&wizardError=invalid_relationship')
  }

  const groupStage = await findGroupStage(payload, categoryId)
  if (!groupStage || groupStage.status !== 'completed') {
    redirectToGenerate(eventId, categoryId, '&wizardError=group_stage_not_finalized')
  }

  // Section 15.5's "Start Phase" can only run once - re-invoking it once the knockout stage
  // already has matches would silently skip every already-generated slot (createSingleElimination
  // BracketMatches dedups by stage/round/slot, not by which entry occupies it) rather than fail
  // loudly, leaving the bracket stale. The GroupKnockoutPanel UI already hides the promote form in
  // this state; this is the server-side guard for direct submits. Undo Phase is the only way back.
  const existingKnockoutStage = await findKnockoutStage(payload, categoryId)
  if (existingKnockoutStage) {
    const existingKnockoutMatchCount = await payload.find({
      collection: 'matches',
      depth: 0,
      limit: 1,
      where: { stage_id: { equals: existingKnockoutStage.id } },
    })
    if (existingKnockoutMatchCount.totalDocs > 0) {
      redirectToGenerate(eventId, categoryId, '&wizardError=already_promoted')
    }
  }

  // The seed rank for each qualifier comes from the (possibly admin-reordered) form, not
  // recomputed here - QualifierSeedOrder always renders every qualifier with a `rank_<entryId>`
  // hidden input reflecting its current on-screen order, so this is the single source of truth.
  const rankByEntryId = new Map<string, number>()
  for (const [key, value] of formData.entries()) {
    const match = /^rank_(.+)$/.exec(key)
    if (match && typeof value === 'string') {
      const rank = Number(value)
      if (Number.isInteger(rank)) {
        rankByEntryId.set(match[1], rank)
      }
    }
  }
  if (rankByEntryId.size === 0) {
    redirectToGenerate(eventId, categoryId, '&wizardError=no_qualifiers')
  }

  const entriesResult = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 500,
    where: { id: { in: Array.from(rankByEntryId.keys()) } },
  })

  // A qualifier withdrawn/disqualified after finalize but before promotion is dropped rather than
  // silently left in as a phantom bracket slot - flagged via wizardPromoteWarning instead of
  // failing outright, since the rest of the bracket can still be built.
  const droppedCount = entriesResult.docs.filter((entry) =>
    ['withdrawn', 'disqualified'].includes(String(entry.status)),
  ).length
  const qualifierEntries: MatchGenerationEntry[] = entriesResult.docs
    .filter((entry) => !['withdrawn', 'disqualified'].includes(String(entry.status)))
    .map((entry) => ({
      id: entry.id,
      display_name: String(entry.display_name),
      seed_number: rankByEntryId.get(String(entry.id)) ?? null,
      status: entry.status,
    }))

  if (qualifierEntries.length < 2) {
    redirectToGenerate(eventId, categoryId, '&wizardError=no_qualifiers')
  }

  const knockoutStage =
    existingKnockoutStage ||
    (await payload.create({
      collection: 'stages',
      data: {
        event_id: Number(eventId),
        category_id: Number(categoryId),
        name: `${category!.name} - Knockout`,
        stage_type: 'single_elimination',
        order: 2,
        status: 'ready',
      },
    }))

  const existingKnockoutMatches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: { stage_id: { equals: knockoutStage.id } },
  })
  const usedMatchNumbers = new Set(existingKnockoutMatches.docs.map((match) => String(match.match_number)))
  let sequence = existingKnockoutMatches.totalDocs + 1
  const nextMatchNumber = (prefix: string) => {
    let candidate = `${category!.slug}-${prefix}-${String(sequence).padStart(3, '0')}`
    while (usedMatchNumbers.has(candidate)) {
      sequence += 1
      candidate = `${category!.slug}-${prefix}-${String(sequence).padStart(3, '0')}`
    }
    usedMatchNumbers.add(candidate)
    sequence += 1
    return candidate
  }

  const { createdCount, failedCount } = await createSingleEliminationBracketMatches({
    payload,
    eventId,
    eventSlug: event.slug,
    sportId: category!.sport_id,
    categoryId,
    categorySlug: category!.slug,
    stageId: knockoutStage.id,
    entries: qualifierEntries,
    thirdPlacePolicy: (category!.third_place_policy as 'none' | 'match' | 'shared' | undefined) ?? 'none',
    nextMatchNumber,
  })

  await recalculateSingleEliminationBracket(payload, { stageId: knockoutStage.id })
  await recordAuditLog({
    payload,
    action: 'group_stage.promote_to_knockout',
    entityType: 'stages',
    entityId: knockoutStage.id,
    before: null,
    after: { qualifierCount: qualifierEntries.length, droppedCount },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  const warningParam = droppedCount > 0 ? `&wizardPromoteWarning=${droppedCount}` : ''
  const failedParam = failedCount > 0 ? `&wizardGenerateFailed=${failedCount}` : ''
  redirect(
    `${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardGenerated=${createdCount}${warningParam}${failedParam}`,
  )
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.5 "Undo Phase": the counterpart to promoteToKnockoutAction
// ("Start Phase"). Reverses a promotion that hasn't actually started playing yet - deletes the
// generated knockout matches/sets and reopens the group stage for revision (status back to
// 'ready', which is what src/access/roles.ts's isGroupPhaseLocked checks). Refuses to run once
// any knockout match has progressed past UNSTARTED_TARGET_STATUSES, matching the exact guard
// winnerAdvancement.ts already uses for "don't silently corrupt a match that's already running."
export async function undoPromoteToKnockoutAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const knockoutStage = await findKnockoutStage(payload, categoryId)
  if (!knockoutStage) {
    redirectToGenerate(eventId, categoryId, '&wizardError=not_promoted')
  }

  const knockoutMatches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: { stage_id: { equals: knockoutStage!.id } },
  })
  if (knockoutMatches.totalDocs === 0) {
    redirectToGenerate(eventId, categoryId, '&wizardError=not_promoted')
  }
  const started = knockoutMatches.docs.filter((match) => !UNSTARTED_TARGET_STATUSES.has(String(match.status)))
  if (started.length > 0) {
    redirectToGenerate(eventId, categoryId, '&wizardError=knockout_already_started')
  }

  for (const match of knockoutMatches.docs) {
    await payload.delete({ collection: 'match-sets', where: { match_id: { equals: match.id } } }).catch(() => null)
  }
  await payload.delete({
    collection: 'matches',
    where: { id: { in: knockoutMatches.docs.map((match) => match.id) } },
  })
  // brackets.stage_id is required+unique (one bracket per stage) - the stage row can't be deleted
  // while a bracket still points at it.
  await payload.delete({ collection: 'brackets', where: { stage_id: { equals: knockoutStage!.id } } }).catch(() => null)
  await payload.delete({ collection: 'stages', id: knockoutStage!.id })

  const groupStage = await findGroupStage(payload, categoryId)
  const beforeGroupStatus = groupStage?.status
  if (groupStage) {
    await payload.update({ collection: 'stages', id: groupStage.id, data: { status: 'ready' } })
  }

  await recordAuditLog({
    payload,
    action: 'group_stage.undo_promote_to_knockout',
    entityType: 'stages',
    entityId: knockoutStage!.id,
    before: { knockoutMatchCount: knockoutMatches.totalDocs, groupStageStatus: beforeGroupStatus },
    after: { knockoutMatchCount: 0, groupStageStatus: 'ready' },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirectToGenerate(eventId, categoryId, '&wizardUndone=1')
}
