'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  generateRoundRobinPairings,
  generateSingleEliminationFirstRound,
  getMatchPairKey,
  getNextPowerOfTwo,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, text, wizardPage } from './wizardShared'

const supportedFormats = new Set(['single_elimination', 'round_robin'])

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

  const pairings =
    formatType === 'single_elimination'
      ? generateSingleEliminationFirstRound(schedulableEntries)
      : generateRoundRobinPairings(schedulableEntries)

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

  // Round names/prefixes for every round after the first, counting back from the Final. A
  // single-elimination bracket only ever has byes in round 1 (bracket size is always a power of
  // two), so every later round is a clean, fully-empty set of TBD placeholder matches that
  // attemptSingleEliminationWinnerAdvancement (src/lib/winnerAdvancement.ts) fills in as earlier
  // rounds get results. Without pre-creating these placeholders, the bracket view only ever shows
  // round 1 (see BracketTree's g-loot transform, which infers round count/shape from
  // bracketData.rounds itself rather than the round's real match count).
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
      // A concurrent duplicate submission or a rare match_number/generation_key race can fail a
      // single pairing - keep generating the rest instead of aborting the whole batch. Re-running
      // "Generate Matches" will safely skip already-created pairings via the generation_key check
      // above and pick up fresh match numbers via existingStageMatches on the next call.
      failedCount += 1
    }
  }

  if (formatType === 'single_elimination') {
    const bracketSize = getNextPowerOfTwo(schedulableEntries.length)
    const totalRounds = Math.log2(bracketSize)

    if (totalRounds > 1) {
      const byeCount = bracketSize - schedulableEntries.length
      const byeEntryIds = schedulableEntries.slice(0, byeCount).map((entry) => Number(entry.id))

      // Slot fillers for round 2, in order: one placeholder per round-1 match (so round-1 match
      // index i lands at flat position i, matching attemptSingleEliminationWinnerAdvancement's
      // `nextRoundMatches[Math.floor(currentMatchIndex / 2)]` targeting), then any bye entrants
      // filling the remaining slots. Byes only ever occur at this round-1-to-round-2 boundary.
      let previousRoundSlots: (number | undefined)[] = [
        ...pairings.map(() => undefined),
        ...byeEntryIds,
      ]

      for (let roundIndex = 1; roundIndex < totalRounds; roundIndex += 1) {
        const roundsRemaining = totalRounds - 1 - roundIndex
        const roundName = roundNameForRemaining(roundsRemaining)
        const roundPrefix = roundPrefixForRemaining(roundsRemaining)
        const matchCountThisRound = previousRoundSlots.length / 2
        const nextRoundSlots: undefined[] = []

        for (let matchIndex = 0; matchIndex < matchCountThisRound; matchIndex += 1) {
          const generationKey = `${event.slug}:${category!.slug}:${stage.id}:no-group:${formatType}:round-${roundIndex}:slot-${matchIndex}`
          const existingMatch = await payload.find({
            collection: 'matches',
            depth: 0,
            limit: 1,
            where: { generation_key: { equals: generationKey } },
          })

          if (existingMatch.docs.length === 0) {
            try {
              await payload.create({
                collection: 'matches',
                data: {
                  event_id: Number(eventId),
                  sport_id: category!.sport_id,
                  category_id: Number(categoryId),
                  stage_id: stage.id,
                  round_name: roundName,
                  match_number: nextMatchNumber(roundPrefix),
                  participant_a_entry_id: previousRoundSlots[matchIndex * 2],
                  participant_b_entry_id: previousRoundSlots[matchIndex * 2 + 1],
                  status: 'ready_for_scheduling',
                  generation_source: formatType,
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

          nextRoundSlots.push(undefined)
        }

        previousRoundSlots = nextRoundSlots
      }
    }

    await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
  } else {
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
