'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  createSingleEliminationBracketMatches,
  generateRoundRobinRounds,
  getMatchPairKey,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, text, wizardPage } from './wizardShared'

const RESULT_STATUSES = new Set(['result_published', 'walkover'])
const MIN_GROUPS = 2
const MAX_GROUPS = 12

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

  revalidatePath(wizardPage)
  const failedParam = failedCount > 0 ? `&wizardGenerateFailed=${failedCount}` : ''
  redirectToGenerate(eventId, categoryId, `&wizardGenerated=${createdCount}${failedParam}`)
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
    (await payload.find({
      collection: 'stages',
      depth: 0,
      limit: 1,
      where: { and: [{ category_id: { equals: categoryId } }, { order: { equals: 2 } }] },
    }).then((result) => result.docs[0])) ||
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
