'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  buildSingleEliminationBracketPlan,
  generateRoundRobinPairings,
  getMatchPairKey,
  getNextPowerOfTwo,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { AUTO_GENERATE_FORMATS as supportedFormats, getWizardEvent, text, wizardPage } from './wizardShared'

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
        name: `${category!.name} - ${formatType === 'single_elimination' ? 'Single Elimination' : 'Round Robin'}`,
        stage_type: formatType,
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

  // Round names/prefixes counting back from the Final, applied to every round including the
  // first - so an 8-bracket's opening round is correctly labelled "Quarterfinal" (not a generic
  // "First Round" regardless of bracket size, which is what this used to say).
  const roundNameForRemaining = (roundsRemaining: number) => {
    if (roundsRemaining <= 0) return 'Final'
    if (roundsRemaining === 1) return 'Semifinal'
    if (roundsRemaining === 2) return 'Quarterfinal'
    if (roundsRemaining === 3) return 'Round of 16'
    return `Round of ${2 ** (roundsRemaining + 1)}`
  }
  const roundPrefixForRemaining = (roundsRemaining: number) => {
    if (roundsRemaining <= 0) return 'final'
    if (roundsRemaining === 1) return 'sf'
    if (roundsRemaining === 2) return 'qf'
    return `r${2 ** (roundsRemaining + 1)}`
  }

  let createdCount = 0
  let failedCount = 0

  if (formatType === 'single_elimination') {
    // Builds every round up front with standard seed placement (bye recipients spread across
    // separate quarters, never paired against each other - see AUDIT_E2E BRK-01) and creates
    // matches round-by-round so each match can record an explicit next_match_id/next_match_slot
    // once its target match exists, instead of advancement being re-derived later from
    // round_name/index (AUDIT_E2E BRK-02).
    const bracketSize = getNextPowerOfTwo(schedulableEntries.length)
    const totalRounds = bracketSize > 1 ? Math.log2(bracketSize) : 0
    const plan = buildSingleEliminationBracketPlan(schedulableEntries)
    const matchIdByRoundAndIndex = new Map<string, string | number>()

    for (let round = 0; round < totalRounds; round += 1) {
      const roundsRemaining = totalRounds - 1 - round
      const roundName = roundNameForRemaining(roundsRemaining)
      const roundPrefix = roundPrefixForRemaining(roundsRemaining)
      const roundPlans = plan.filter((matchPlan) => matchPlan.round === round)

      for (const matchPlan of roundPlans) {
        const generationKey = `${event.slug}:${category!.slug}:${stage.id}:no-group:${formatType}:r${round}:m${matchPlan.matchIndex}`
        const existingMatch = await payload.find({
          collection: 'matches',
          depth: 0,
          limit: 1,
          where: { generation_key: { equals: generationKey } },
        })

        let matchId = existingMatch.docs[0]?.id

        if (!matchId) {
          const byeWinnerId = matchPlan.isBye
            ? (matchPlan.participantA ?? matchPlan.participantB)!.id
            : undefined
          try {
            const created = await payload.create({
              collection: 'matches',
              data: {
                event_id: Number(eventId),
                sport_id: category!.sport_id,
                category_id: Number(categoryId),
                stage_id: stage.id,
                round_name: roundName,
                match_number: nextMatchNumber(roundPrefix),
                participant_a_entry_id: matchPlan.participantA?.id,
                participant_b_entry_id: matchPlan.participantB?.id,
                // A bye auto-resolves: the sole participant is the winner and the match is an
                // auditable walkover record (GEN-02) instead of silently vanishing - BracketTree
                // already renders a 'walkover' status with one participant as a bye card.
                status: matchPlan.isBye ? 'walkover' : 'ready_for_scheduling',
                winner_entry_id: byeWinnerId,
                score_summary: matchPlan.isBye ? 'Bye' : undefined,
                generation_source: formatType,
                generation_key: generationKey,
                is_public: true,
                documentation_status: matchPlan.isBye ? 'not_required' : 'not_started',
              },
            })
            matchId = created.id
            createdCount += 1
          } catch {
            // A concurrent duplicate submission or a rare match_number/generation_key race can
            // fail a single match - keep generating the rest. Re-running "Generate Matches" will
            // safely skip already-created matches via the generation_key check above.
            failedCount += 1
            continue
          }
        }

        matchIdByRoundAndIndex.set(`${round}:${matchPlan.matchIndex}`, matchId)

        if (round > 0) {
          const parentRound = round - 1
          const parentASlotId = matchIdByRoundAndIndex.get(`${parentRound}:${matchPlan.matchIndex * 2}`)
          const parentBSlotId = matchIdByRoundAndIndex.get(`${parentRound}:${matchPlan.matchIndex * 2 + 1}`)

          if (parentASlotId) {
            await payload.update({
              collection: 'matches',
              id: parentASlotId,
              data: { next_match_id: matchId, next_match_slot: 'a' },
            })
          }
          if (parentBSlotId) {
            await payload.update({
              collection: 'matches',
              id: parentBSlotId,
              data: { next_match_id: matchId, next_match_slot: 'b' },
            })
          }
        }
      }
    }

    await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
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
            participant_a_entry_id: pairing.participantA.id,
            participant_b_entry_id: pairing.participantB.id,
            status: 'ready_for_scheduling',
            generation_source: formatType,
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

  revalidatePath(wizardPage)
  const failedParam = failedCount > 0 ? `&wizardGenerateFailed=${failedCount}` : ''
  redirect(
    `${wizardPage}?eventId=${eventId}&step=bracket&categoryId=${categoryId}&wizardGenerated=${createdCount}${failedParam}`,
  )
}
