'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  createDoubleEliminationBracketMatches,
  isExactPowerOfTwo,
  recalculateDoubleEliminationBracket,
} from '@/lib/doubleElimination'
import {
  createRankingAttemptMatches,
  createSingleEliminationBracketMatches,
  generateRoundRobinPairings,
  getMatchPairKey,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { advanceCategoryStatus } from '@/lib/categoryLifecycle'
import { recordAuditLog } from '@/lib/audit'
import { recalculateRankingStandingsForScope, recalculateStandingsForScope } from '@/lib/standings'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import {
  AUTO_GENERATE_FORMATS as supportedFormats,
  CLEARABLE_FIXTURE_STATUSES,
  getWizardEvent,
  text,
  wizardPage,
} from './wizardShared'

export async function generateMatchesAction(formData: FormData): Promise<void> {
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
  if (!categoryId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=generate&wizardError=invalid_category`)
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=generate&wizardError=invalid_relationship`)
  }

  const formatType = String(category!.format_type || '')
  if (!supportedFormats.has(formatType)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=generate&wizardError=unsupported_format`)
  }

  const entriesResult = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 500,
    where: {
      and: [
        { category_id: { equals: categoryId } },
        { status: { equals: 'confirmed' } },
      ],
    },
  })
  const schedulableEntries = getSchedulableEntries(
    entriesResult.docs.map((entry) => ({
      id: entry.id,
      display_name: String(entry.display_name),
      seed_number: entry.seed_number ?? null,
      status: entry.status,
    })) as MatchGenerationEntry[],
  )

  if (schedulableEntries.length < 2) {
    redirect(`${wizardPage}?eventId=${eventId}&step=generate&wizardError=not_enough_entries`)
  }
  if (formatType === 'double_elimination' && !isExactPowerOfTwo(schedulableEntries.length)) {
    // ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md F-14 scope decision (see
    // src/lib/doubleElimination.ts's header comment): the generator only supports an exact
    // power-of-two entry count. Surface that up front instead of a confusing mid-generation
    // failure.
    redirect(`${wizardPage}?eventId=${eventId}&step=generate&wizardError=double_elimination_requires_power_of_two`)
  }

  const stageTypeLabel: Record<string, string> = {
    single_elimination: 'Single Elimination',
    round_robin: 'Round Robin',
    double_elimination: 'Double Elimination',
    time_trial: 'Time Trial',
    score_ranking: 'Score Ranking',
  }

  const existingStage = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 1,
    where: {
      and: [{ category_id: { equals: categoryId } }, { order: { equals: 1 } }],
    },
  })
  const stage =
    existingStage.docs[0] ||
    (await payload.create({
      collection: 'stages',
      data: {
        event_id: Number(eventId),
        category_id: Number(categoryId),
        name: `${category!.name} - ${stageTypeLabel[formatType] || 'Round Robin'}`,
        // Guaranteed one of supportedFormats' members by the supportedFormats.has(formatType)
        // check above - narrower than the field's plain `string` type here.
        stage_type: formatType as
          | 'single_elimination'
          | 'round_robin'
          | 'double_elimination'
          | 'time_trial'
          | 'score_ranking',
        order: 1,
        status: 'ready',
      },
    }))

  const existingStageMatches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: { stage_id: { equals: stage.id } },
  })
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

  if (formatType === 'single_elimination') {
    const result = await createSingleEliminationBracketMatches({
      payload,
      eventId,
      eventSlug: event.slug,
      sportId: category!.sport_id,
      categoryId,
      categorySlug: category!.slug,
      stageId: stage.id,
      entries: schedulableEntries,
      thirdPlacePolicy: (category!.third_place_policy as 'none' | 'match' | 'shared' | undefined) ?? 'none',
      nextMatchNumber,
    })
    createdCount = result.createdCount
    failedCount = result.failedCount

    await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
  } else if (formatType === 'double_elimination') {
    const result = await createDoubleEliminationBracketMatches({
      payload,
      eventId,
      eventSlug: event.slug,
      sportId: category!.sport_id,
      categoryId,
      categorySlug: category!.slug,
      stageId: stage.id,
      entries: schedulableEntries,
      nextMatchNumber,
    })
    createdCount = result.createdCount
    failedCount = result.failedCount

    await recalculateDoubleEliminationBracket(payload, { stageId: stage.id })
  } else if (formatType === 'time_trial' || formatType === 'score_ranking') {
    const result = await createRankingAttemptMatches({
      payload,
      eventId,
      sportId: category!.sport_id,
      categoryId,
      stageId: stage.id,
      formatType,
      entries: schedulableEntries,
      nextMatchNumber,
    })
    createdCount = result.createdCount
    failedCount = result.failedCount

    await recalculateRankingStandingsForScope(payload, {
      eventId,
      categoryId,
      stageId: stage.id,
    })
  } else {
    const pairings = generateRoundRobinPairings(schedulableEntries)

    for (const pairing of pairings) {
      const pairKey = getMatchPairKey(pairing.participantA.id, pairing.participantB.id)
      const generationKey = `${event.slug}:${category!.slug}:${stage.id}:no-group:${formatType}:${pairKey}`

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
            stage_id: stage.id,
            round_name: pairing.roundName,
            match_number: nextMatchNumber('r1'),
            participant_a_entry_id: Number(pairing.participantA.id),
            participant_b_entry_id: Number(pairing.participantB.id),
            status: 'ready_for_scheduling',
            // Guaranteed 'round_robin' here (the single_elimination branch is handled above and
            // returns before reaching this else-branch).
            generation_source: formatType as 'round_robin',
            generation_key: generationKey,
            // Wizard-generated fixtures are linked from the published public bracket.
            // Keep them readable through the public match route from the moment the bracket is shown.
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
      stageId: stage.id,
    })
  }

  if (createdCount > 0) {
    // Fixtures exist now - the category's registration and draw are settled, so lock it
    // (open -> locked). Publishing still happens at the final step.
    await advanceCategoryStatus(payload, categoryId, 'locked')
  }

  revalidatePath(wizardPage)
  const failedParam = failedCount > 0 ? `&wizardGenerateFailed=${failedCount}` : ''
  redirect(
    `${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardGenerated=${createdCount}${failedParam}`,
  )
}

// The backward counterpart to generateMatchesAction: wipe a category's generated fixtures so the
// organiser can fix seeding / entries / format and regenerate. Deliberately narrow - it only runs
// while nothing has actually happened yet (every match still in CLEARABLE_FIXTURE_STATUSES, no
// winner, no recorded sets). group_stage_to_knockout is out of scope here (its groups / assignments
// / knockout stage are managed from GroupKnockoutPanel, which already has "Undo Phase").
export async function clearCategoryFixturesAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')

  const backToGenerate = (suffix: string): never =>
    redirect(`${wizardPage}?eventId=${eventId}&step=generate&categoryId=${categoryId}${suffix}`)

  if (!categoryId) {
    backToGenerate('&wizardError=invalid_category')
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(eventId)) {
    backToGenerate('&wizardError=invalid_relationship')
  }

  if (String(category!.format_type) === 'group_stage_to_knockout') {
    backToGenerate('&wizardError=use_groups_panel')
  }

  const matches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 500,
    where: { category_id: { equals: categoryId } },
  })
  if (matches.totalDocs === 0) {
    backToGenerate('&wizardUpdated=1')
  }

  const inPlay = matches.docs.some(
    (match) => !CLEARABLE_FIXTURE_STATUSES.has(String(match.status)) || match.winner_entry_id != null,
  )
  const matchIds = matches.docs.map((match) => match.id)
  const recordedSets =
    matchIds.length > 0
      ? await payload.count({ collection: 'match-sets', where: { match_id: { in: matchIds } } })
      : { totalDocs: 0 }
  if (inPlay || recordedSets.totalDocs > 0) {
    backToGenerate('&wizardError=fixtures_in_play')
  }

  const stages = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 50,
    where: { category_id: { equals: categoryId } },
  })
  const stageIds = stages.docs.map((stage) => stage.id)

  if (matchIds.length > 0) {
    await payload.delete({ collection: 'match-sets', where: { match_id: { in: matchIds } } }).catch(() => null)
    await payload.delete({ collection: 'matches', where: { id: { in: matchIds } } })
  }
  // Standings rows are (re)built by generateMatchesAction's recalculate* call - drop them too so a
  // stale table doesn't linger on the public category page after the fixtures behind it are gone.
  await payload.delete({ collection: 'standings', where: { category_id: { equals: categoryId } } }).catch(() => null)
  if (stageIds.length > 0) {
    // brackets.stage_id is required + unique - drop the bracket before its stage.
    await payload.delete({ collection: 'brackets', where: { stage_id: { in: stageIds } } }).catch(() => null)
    await payload.delete({ collection: 'stages', where: { id: { in: stageIds } } })
  }

  // advanceCategoryStatus is monotonic (draft->open->locked->published) and can't walk back the
  // status generateMatchesAction / publish moved this category to - do it directly, same as
  // undoPromoteToKnockoutAction resets its group stage. Back to `open` so registration/draw stay
  // editable and (if it was published) the empty bracket drops off the public site.
  const statusBefore = String(category!.status)
  const needsReset = statusBefore === 'locked' || statusBefore === 'published'
  if (needsReset) {
    await payload.update({ collection: 'competition-categories', id: categoryId, data: { status: 'open' } })
  }

  await recordAuditLog({
    payload,
    action: 'competition_category.clear_fixtures',
    entityType: 'competition-categories',
    entityId: categoryId,
    before: { matchCount: matches.totalDocs, stageCount: stages.totalDocs, status: statusBefore },
    after: { matchCount: 0, stageCount: 0, status: needsReset ? 'open' : statusBefore },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  backToGenerate('&wizardCleared=1')
}

// MSG-03: sets or clears a stage's ruleset override. Empty rulesetId clears it back to "inherit
// from category" (Stages.ruleset_id is optional) rather than being rejected as invalid input.
export async function setStageRulesetOverrideAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const categoryId = text(formData, 'categoryId')
  const stageId = text(formData, 'stageId')
  const rulesetId = text(formData, 'rulesetId')

  if (!stageId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardError=invalid_request`)
  }

  const stage = await payload.findByID({ collection: 'stages', id: stageId, depth: 0 }).catch(() => null)
  if (!stage || String(stage.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardError=invalid_relationship`)
  }

  if (rulesetId) {
    const ruleset = await payload.findByID({ collection: 'rulesets', id: rulesetId, depth: 0 }).catch(() => null)
    if (!ruleset || String(ruleset.event_id) !== String(eventId)) {
      redirect(`${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardError=invalid_relationship`)
    }
  }

  await payload.update({
    collection: 'stages',
    id: stageId,
    data: { ruleset_id: rulesetId ? Number(rulesetId) : null },
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardUpdated=1`)
}
