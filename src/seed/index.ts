import { getPayload } from 'payload'

import config from '@payload-config'
import {
  generateRoundRobinPairings,
  generateSingleEliminationFirstRound,
  getMatchPairKey,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { demoScenario } from './data/demoScenario'
import { defaultSiteConfig } from './data/siteConfig'

type CollectionName =
  | 'events'
  | 'rulesets'
  | 'sports'
  | 'competition-categories'
  | 'stages'
  | 'groups'
  | 'clubs'
  | 'players'
  | 'teams'
  | 'rosters'
  | 'competition-entries'
  | 'venues'
  | 'courts'
  | 'matches'
  | 'match-sets'
  | 'comments'

type SeedPayload = Awaited<ReturnType<typeof getPayload>>
type SeedId = string | number

const getId = (doc: { id: SeedId }) => doc.id
const getRelationshipId = (value: unknown): SeedId | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object' && 'id' in value) {
    return (value as { id: SeedId }).id
  }

  return undefined
}

const findOne = async (
  payload: SeedPayload,
  collection: CollectionName,
  field: string,
  value: string,
) => {
  const result = await payload.find({
    collection,
    limit: 1,
    where: {
      [field]: {
        equals: value,
      },
    },
  })

  return result.docs[0]
}

const findOneInEvent = async (
  payload: SeedPayload,
  collection: CollectionName,
  field: string,
  value: string,
  eventId: SeedId,
) => {
  const result = await payload.find({
    collection,
    limit: 1,
    where: {
      and: [
        {
          [field]: {
            equals: value,
          },
        },
        {
          event_id: {
            equals: eventId,
          },
        },
      ],
    },
  })

  return result.docs[0]
}

const findRoster = async (payload: SeedPayload, eventId: SeedId, teamId: SeedId, playerId: SeedId) => {
  const result = await payload.find({
    collection: 'rosters',
    limit: 1,
    where: {
      and: [
        {
          event_id: {
            equals: eventId,
          },
        },
        {
          team_id: {
            equals: teamId,
          },
        },
        {
          player_id: {
            equals: playerId,
          },
        },
      ],
    },
  })

  return result.docs[0]
}

const findGroup = async (payload: SeedPayload, eventId: SeedId, stageId: SeedId, name: string) => {
  const result = await payload.find({
    collection: 'groups',
    limit: 1,
    where: {
      and: [
        {
          event_id: {
            equals: eventId,
          },
        },
        {
          stage_id: {
            equals: stageId,
          },
        },
        {
          name: {
            equals: name,
          },
        },
      ],
    },
  })

  return result.docs[0]
}

const findStage = async (payload: SeedPayload, eventId: SeedId, categoryId: SeedId, name: string) => {
  const result = await payload.find({
    collection: 'stages',
    limit: 1,
    where: {
      and: [
        {
          event_id: {
            equals: eventId,
          },
        },
        {
          category_id: {
            equals: categoryId,
          },
        },
        {
          name: {
            equals: name,
          },
        },
      ],
    },
  })

  return result.docs[0]
}

const findMatchSet = async (
  payload: SeedPayload,
  eventId: SeedId,
  matchId: SeedId,
  setNumber: number,
) => {
  const result = await payload.find({
    collection: 'match-sets',
    limit: 1,
    where: {
      and: [
        {
          event_id: {
            equals: eventId,
          },
        },
        {
          match_id: {
            equals: matchId,
          },
        },
        {
          set_number: {
            equals: setNumber,
          },
        },
      ],
    },
  })

  return result.docs[0]
}

const findComment = async (
  payload: SeedPayload,
  entityType: string,
  entityId: SeedId,
  commentType: string,
  body: string,
) => {
  const result = await payload.find({
    collection: 'comments',
    limit: 1,
    where: {
      and: [
        {
          entity_type: {
            equals: entityType,
          },
        },
        {
          entity_id: {
            equals: String(entityId),
          },
        },
        {
          comment_type: {
            equals: commentType,
          },
        },
        {
          body: {
            equals: body,
          },
        },
      ],
    },
  })

  return result.docs[0]
}

const seed = async () => {
  console.log('Starting ROC GMS seed...')
  const payload = await getPayload({ config })
  console.log('Payload ready for seed.')

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@roc-gms.local'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'

  const existingUsers = await payload.find({
    collection: 'users',
    limit: 1,
    where: {
      email: {
        equals: adminEmail,
      },
    },
  })

  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        name: 'ROC Super Admin',
        email: adminEmail,
        password: adminPassword,
        roles: ['super_admin'],
      },
    })
    payload.logger.info(`Created seed admin: ${adminEmail}`)
  } else {
    payload.logger.info(`Seed admin already exists: ${adminEmail}`)
  }

  const existingConfigs = await payload.find({
    collection: 'site-configs',
    limit: 1,
  })

  if (existingConfigs.totalDocs === 0) {
    await payload.create({
      collection: 'site-configs',
      data: defaultSiteConfig,
    })
    payload.logger.info('Created default site config')
  } else {
    payload.logger.info('Default site config already exists')
  }

  const existingEvent = await findOne(payload, 'events', 'slug', demoScenario.event.slug)
  const event =
    existingEvent ||
    (await payload.create({
      collection: 'events',
      data: demoScenario.event,
    }))
  const eventId = getId(event)

  if (!existingEvent) {
    payload.logger.info(`Created demo event: ${demoScenario.event.name}`)
  }

  const sportIds = new Map<string, SeedId>()
  for (const sportData of demoScenario.sports) {
    const existingSport = await findOne(payload, 'sports', 'slug', sportData.slug)
    const sport =
      existingSport ||
      (await payload.create({
        collection: 'sports',
        data: {
          name: sportData.name,
          slug: sportData.slug,
          description: sportData.description,
          icon: sportData.icon,
          sport_type: sportData.sport_type,
          event_id: eventId,
        },
      }))

    sportIds.set(sportData.slug, getId(sport))
  }

  const rulesetIds = new Map<string, SeedId>()
  for (const rulesetData of demoScenario.rulesets) {
    const existingRuleset = await findOne(payload, 'rulesets', 'slug', rulesetData.slug)
    const ruleset =
      existingRuleset ||
      (await payload.create({
        collection: 'rulesets',
        data: {
          name: rulesetData.name,
          slug: rulesetData.slug,
          description: rulesetData.description,
          event_id: eventId,
          sport_id: sportIds.get(rulesetData.sportSlug),
          score_type: rulesetData.score_type,
          allow_draw: rulesetData.allow_draw,
          set_based: rulesetData.set_based,
          timer_enabled: rulesetData.timer_enabled,
          points_win: rulesetData.points_win,
          points_draw: rulesetData.points_draw,
          points_loss: rulesetData.points_loss,
          best_of: rulesetData.best_of,
          target_score: rulesetData.target_score,
          max_score: rulesetData.max_score,
          deuce_enabled: rulesetData.deuce_enabled,
          period_count: rulesetData.period_count,
          period_duration: rulesetData.period_duration,
          overtime_enabled: rulesetData.overtime_enabled,
          penalty_enabled: rulesetData.penalty_enabled,
          tie_breakers: rulesetData.tie_breakers,
        },
      }))

    rulesetIds.set(rulesetData.slug, getId(ruleset))
  }

  for (const sportData of demoScenario.sports) {
    const sportId = sportIds.get(sportData.slug)
    const defaultRulesetId = rulesetIds.get(sportData.defaultRulesetSlug)

    if (sportId && defaultRulesetId) {
      await payload.update({
        collection: 'sports',
        id: sportId,
        data: {
          default_ruleset_id: defaultRulesetId,
        },
      })
    }
  }

  const categoryIds = new Map<string, SeedId>()
  for (const categoryData of demoScenario.categories) {
    const existingCategory = await findOne(payload, 'competition-categories', 'slug', categoryData.slug)
    const category =
      existingCategory ||
      (await payload.create({
        collection: 'competition-categories',
        data: {
          name: categoryData.name,
          slug: categoryData.slug,
          event_id: eventId,
          sport_id: sportIds.get(categoryData.sportSlug),
          participant_mode: categoryData.participant_mode,
          roster_required: categoryData.roster_required,
          min_roster_size: categoryData.min_roster_size,
          max_roster_size: categoryData.max_roster_size,
          ruleset_id: rulesetIds.get(categoryData.rulesetSlug),
          format_type: categoryData.format_type,
          status: categoryData.status,
        },
      }))

    categoryIds.set(categoryData.slug, getId(category))

    if (existingCategory) {
      await payload.update({
        collection: 'competition-categories',
        id: getId(existingCategory),
        data: {
          ruleset_id: rulesetIds.get(categoryData.rulesetSlug),
        },
      })
    }
  }

  const clubIds = new Map<string, SeedId>()
  for (const clubData of demoScenario.clubs) {
    const existingClub = await findOne(payload, 'clubs', 'slug', clubData.slug)
    const club =
      existingClub ||
      (await payload.create({
        collection: 'clubs',
        data: {
          ...clubData,
          event_id: eventId,
        },
      }))

    clubIds.set(clubData.slug, getId(club))
  }

  const playerIds = new Map<string, SeedId>()
  for (const playerData of demoScenario.players) {
    const existingPlayer = await findOne(payload, 'players', 'employee_id', playerData.employee_id)
    const player =
      existingPlayer ||
      (await payload.create({
        collection: 'players',
        data: {
          name: playerData.name,
          employee_id: playerData.employee_id,
          email: playerData.email,
          gender: playerData.gender,
          event_id: eventId,
          club_id: clubIds.get(playerData.clubSlug),
        },
      }))

    playerIds.set(playerData.employee_id, getId(player))
  }

  const teamIds = new Map<string, SeedId>()
  for (const teamData of demoScenario.teams) {
    const existingTeam = await findOne(payload, 'teams', 'slug', teamData.slug)
    const team =
      existingTeam ||
      (await payload.create({
        collection: 'teams',
        data: {
          name: teamData.name,
          slug: teamData.slug,
          event_id: eventId,
          club_id: clubIds.get(teamData.clubSlug),
          captain_player_id: playerIds.get(teamData.captainEmployeeId),
          contact_email: teamData.contact_email,
        },
      }))

    teamIds.set(teamData.slug, getId(team))
  }

  const mixedDoubleCategoryId = categoryIds.get('roc-olympic-2026-badminton-mixed-double')
  const futsalCategoryId = categoryIds.get('roc-olympic-2026-futsal-men')
  const rosterSeeds = [
    {
      key: 'it-pair-andi',
      teamSlug: 'roc-olympic-2026-it-smash-pair',
      employeeId: 'ROC-2026-001',
      categoryId: mixedDoubleCategoryId,
      role: 'captain',
    },
    {
      key: 'it-pair-citra',
      teamSlug: 'roc-olympic-2026-it-smash-pair',
      employeeId: 'ROC-2026-003',
      categoryId: mixedDoubleCategoryId,
      role: 'player',
    },
    {
      key: 'futsal-it-eko',
      teamSlug: 'roc-olympic-2026-it-futsal-squad',
      employeeId: 'ROC-2026-005',
      categoryId: futsalCategoryId,
      role: 'captain',
    },
    {
      key: 'futsal-finance-fajar',
      teamSlug: 'roc-olympic-2026-finance-futsal-squad',
      employeeId: 'ROC-2026-006',
      categoryId: futsalCategoryId,
      role: 'captain',
    },
  ]

  for (const rosterData of rosterSeeds) {
    const teamId = teamIds.get(rosterData.teamSlug)
    const playerId = playerIds.get(rosterData.employeeId)
    const existingRoster =
      teamId && playerId ? await findRoster(payload, eventId, teamId, playerId) : undefined

    if (!existingRoster) {
      await payload.create({
        collection: 'rosters',
        data: {
          event_id: eventId,
          team_id: teamId,
          player_id: playerId,
          category_id: rosterData.categoryId,
          role: rosterData.role,
          status: 'active',
        },
      })
    }
  }

  const entries = [
    {
      display_name: 'Andi Pratama',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      entry_type: 'individual',
      playerEmployeeId: 'ROC-2026-001',
      clubSlug: 'roc-olympic-2026-it-club',
      seed_number: 1,
      status: 'confirmed',
    },
    {
      display_name: 'Budi Santoso',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      entry_type: 'individual',
      playerEmployeeId: 'ROC-2026-002',
      clubSlug: 'roc-olympic-2026-finance',
      seed_number: 2,
      status: 'confirmed',
    },
    {
      display_name: 'Open Registration Slot',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      entry_type: 'open',
      status: 'pending',
    },
    {
      display_name: 'IT Smash Pair',
      categorySlug: 'roc-olympic-2026-badminton-mixed-double',
      entry_type: 'pair',
      teamSlug: 'roc-olympic-2026-it-smash-pair',
      clubSlug: 'roc-olympic-2026-it-club',
      seed_number: 1,
      status: 'confirmed',
    },
    {
      display_name: 'Marketing Mix Pair',
      categorySlug: 'roc-olympic-2026-badminton-mixed-double',
      entry_type: 'pair',
      teamSlug: 'roc-olympic-2026-marketing-mix-pair',
      clubSlug: 'roc-olympic-2026-marketing',
      status: 'confirmed',
    },
    {
      display_name: 'IT Futsal Squad',
      categorySlug: 'roc-olympic-2026-futsal-men',
      entry_type: 'team',
      teamSlug: 'roc-olympic-2026-it-futsal-squad',
      clubSlug: 'roc-olympic-2026-it-club',
      seed_number: 1,
      status: 'confirmed',
    },
    {
      display_name: 'Finance Futsal Squad',
      categorySlug: 'roc-olympic-2026-futsal-men',
      entry_type: 'team',
      teamSlug: 'roc-olympic-2026-finance-futsal-squad',
      clubSlug: 'roc-olympic-2026-finance',
      status: 'confirmed',
    },
    {
      display_name: 'HR Club',
      categorySlug: 'roc-olympic-2026-futsal-men',
      entry_type: 'club',
      clubSlug: 'roc-olympic-2026-hr',
      status: 'pending',
    },
    {
      display_name: 'TBD Futsal Opponent',
      categorySlug: 'roc-olympic-2026-futsal-men',
      entry_type: 'tbd',
      status: 'pending',
    },
  ]

  for (const entryData of entries) {
    const existingEntry = await findOneInEvent(
      payload,
      'competition-entries',
      'display_name',
      entryData.display_name,
      eventId,
    )

    if (!existingEntry) {
      await payload.create({
        collection: 'competition-entries',
        data: {
          event_id: eventId,
          category_id: categoryIds.get(entryData.categorySlug),
          entry_type: entryData.entry_type,
          club_id: entryData.clubSlug ? clubIds.get(entryData.clubSlug) : undefined,
          team_id: entryData.teamSlug ? teamIds.get(entryData.teamSlug) : undefined,
          player_id: entryData.playerEmployeeId ? playerIds.get(entryData.playerEmployeeId) : undefined,
          display_name: entryData.display_name,
          seed_number: entryData.seed_number,
          status: entryData.status,
        },
      })
    }
  }

  const venueIds = new Map<string, SeedId>()
  for (const venueData of demoScenario.venues) {
    const existingVenue = await findOneInEvent(payload, 'venues', 'name', venueData.name, eventId)
    const venue =
      existingVenue ||
      (await payload.create({
        collection: 'venues',
        data: {
          ...venueData,
          event_id: eventId,
        },
      }))

    venueIds.set(venueData.name, getId(venue))
  }

  for (const courtData of demoScenario.courts) {
    const existingCourt = await findOneInEvent(payload, 'courts', 'name', courtData.name, eventId)

    if (!existingCourt) {
      await payload.create({
        collection: 'courts',
        data: {
          event_id: eventId,
          venue_id: venueIds.get(courtData.venueName),
          name: courtData.name,
          sport_id: sportIds.get(courtData.sportSlug),
          capacity: courtData.capacity,
          is_active: true,
        },
      })
    }
  }

  const stageIds = new Map<string, SeedId>()
  for (const stageData of demoScenario.stages) {
    const categoryId = categoryIds.get(stageData.categorySlug)
    const existingStage = categoryId
      ? await findStage(payload, eventId, categoryId, stageData.name)
      : undefined

    const stage =
      existingStage ||
      (await payload.create({
        collection: 'stages',
        data: {
          event_id: eventId,
          category_id: categoryId,
          name: stageData.name,
          stage_type: stageData.stage_type,
          order: stageData.order,
          status: stageData.status,
        },
      }))

    stageIds.set(stageData.categorySlug, getId(stage))
  }

  const groupIds = new Map<string, SeedId>()
  for (const groupData of demoScenario.groups) {
    const stageId = stageIds.get(groupData.stageCategorySlug)
    const existingGroup = stageId ? await findGroup(payload, eventId, stageId, groupData.name) : undefined
    const group =
      existingGroup ||
      (await payload.create({
        collection: 'groups',
        data: {
          event_id: eventId,
          stage_id: stageId,
          name: groupData.name,
          order: groupData.order,
        },
      }))

    groupIds.set(`${groupData.stageCategorySlug}:${groupData.name}`, getId(group))
  }

  const entryIds = new Map<string, SeedId>()
  const seededEntries = await payload.find({
    collection: 'competition-entries',
    limit: 100,
    where: {
      event_id: {
        equals: eventId,
      },
    },
  })

  for (const entry of seededEntries.docs) {
    entryIds.set(entry.display_name, getId(entry))
  }

  const courtIds = new Map<string, SeedId>()
  const seededCourts = await payload.find({
    collection: 'courts',
    limit: 100,
    where: {
      event_id: {
        equals: eventId,
      },
    },
  })

  for (const court of seededCourts.docs) {
    courtIds.set(court.name, getId(court))
  }

  const matchIds = new Map<string, SeedId>()
  for (const matchData of demoScenario.matches) {
    const existingMatch = await findOne(payload, 'matches', 'match_number', matchData.match_number)
    const winnerEntryId =
      'winner' in matchData && matchData.winner ? entryIds.get(matchData.winner) : undefined
    const scoreSummary =
      'score_summary' in matchData && matchData.score_summary ? matchData.score_summary : undefined
    const match =
      existingMatch ||
      (await payload.create({
        collection: 'matches',
        data: {
          event_id: eventId,
          sport_id: sportIds.get(matchData.sportSlug),
          category_id: categoryIds.get(matchData.categorySlug),
          stage_id: stageIds.get(matchData.stageCategorySlug),
          group_id: matchData.groupName
            ? groupIds.get(`${matchData.stageCategorySlug}:${matchData.groupName}`)
            : undefined,
          round_name: matchData.round_name,
          match_number: matchData.match_number,
          participant_a_entry_id: entryIds.get(matchData.participantA),
          participant_b_entry_id: entryIds.get(matchData.participantB),
          scheduled_start_at: matchData.scheduled_start_at,
          scheduled_end_at: matchData.scheduled_end_at,
          venue_id: venueIds.get(matchData.venueName),
          court_id: courtIds.get(matchData.courtName),
          status: matchData.status,
          generation_source: 'manual',
          winner_entry_id: winnerEntryId,
          score_summary: scoreSummary,
          is_public: matchData.is_public,
          documentation_status: matchData.documentation_status,
        },
      }))

    matchIds.set(matchData.match_number, getId(match))

    if (
      existingMatch &&
      matchData.match_number === 'ROC-FUT-GA-001' &&
      existingMatch.status === 'published'
    ) {
      await payload.update({
        collection: 'matches',
        id: getId(existingMatch),
        data: {
          status: matchData.status,
          winner_entry_id: winnerEntryId,
          score_summary: scoreSummary,
        },
      })
    }
  }

  const matchesForEvent = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 200,
    where: {
      event_id: {
        equals: eventId,
      },
    },
  })

  const existingMatchPairKeys = new Set<string>()
  for (const match of matchesForEvent.docs) {
    const stageId = getRelationshipId(match.stage_id)
    const groupId = getRelationshipId(match.group_id) || 'no-group'
    const participantAId = getRelationshipId(match.participant_a_entry_id)
    const participantBId = getRelationshipId(match.participant_b_entry_id)

    if (stageId && participantAId && participantBId) {
      existingMatchPairKeys.add(
        `${stageId}:${groupId}:${getMatchPairKey(participantAId, participantBId)}`,
      )
    }
  }

  const entriesByCategorySlug = new Map<string, MatchGenerationEntry[]>()
  for (const categoryData of demoScenario.categories) {
    const categoryId = categoryIds.get(categoryData.slug)
    entriesByCategorySlug.set(
      categoryData.slug,
      seededEntries.docs
        .filter((entry) => getRelationshipId(entry.category_id) === categoryId)
        .map((entry) => ({
          id: getId(entry),
          display_name: String(entry.display_name),
          seed_number:
            typeof entry.seed_number === 'number' ? entry.seed_number : undefined,
          status: typeof entry.status === 'string' ? entry.status : undefined,
        })),
    )
  }

  for (const generationData of demoScenario.matchGeneration) {
    const categoryId = categoryIds.get(generationData.categorySlug)
    const stageId = stageIds.get(generationData.stageCategorySlug)
    const groupId = generationData.groupName
      ? groupIds.get(`${generationData.stageCategorySlug}:${generationData.groupName}`)
      : undefined
    const categoryEntries = entriesByCategorySlug.get(generationData.categorySlug) || []
    const pairings =
      generationData.generation_type === 'round_robin'
        ? generateRoundRobinPairings(categoryEntries, generationData.roundNamePrefix)
        : generateSingleEliminationFirstRound(categoryEntries, generationData.roundName)

    let createdCount = 0
    for (const pairing of pairings) {
      if (!stageId || !categoryId) {
        continue
      }

      const pairKey = getMatchPairKey(pairing.participantA.id, pairing.participantB.id)
      const scopedPairKey = `${stageId}:${groupId || 'no-group'}:${pairKey}`

      if (existingMatchPairKeys.has(scopedPairKey)) {
        continue
      }

      const generatedSequence = generationData.startNumber + pairing.sequence - 1
      const matchNumber = `${generationData.matchNumberPrefix}-${String(generatedSequence).padStart(3, '0')}`
      const generationKey = `${demoScenario.event.slug}:${generationData.categorySlug}:${generationData.stageCategorySlug}:${generationData.groupName || 'no-group'}:${generationData.generation_type}:${pairKey}`

      const existingMatch = await findOne(payload, 'matches', 'generation_key', generationKey)
      const match =
        existingMatch ||
        (await payload.create({
          collection: 'matches',
          data: {
            event_id: eventId,
            sport_id: sportIds.get(generationData.sportSlug),
            category_id: categoryId,
            stage_id: stageId,
            group_id: groupId,
            round_name: pairing.roundName,
            match_number: matchNumber,
            participant_a_entry_id: pairing.participantA.id,
            participant_b_entry_id: pairing.participantB.id,
            status: 'ready_for_scheduling',
            generation_source: generationData.generation_type,
            generation_key: generationKey,
            is_public: false,
            documentation_status: 'not_started',
          },
        }))

      matchIds.set(matchNumber, getId(match))
      existingMatchPairKeys.add(scopedPairKey)
      createdCount += existingMatch ? 0 : 1
    }

    if (createdCount > 0) {
      payload.logger.info(
        `Generated ${createdCount} ${generationData.generation_type} match seed(s) for ${generationData.categorySlug}`,
      )
    }
  }

  for (const setData of demoScenario.matchSets) {
    const matchId = matchIds.get(setData.matchNumber)
    const existingSet = matchId
      ? await findMatchSet(payload, eventId, matchId, setData.set_number)
      : undefined

    if (!existingSet && matchId) {
      await payload.create({
        collection: 'match-sets',
        data: {
          event_id: eventId,
          match_id: matchId,
          set_number: setData.set_number,
          participant_a_score: setData.participant_a_score,
          participant_b_score: setData.participant_b_score,
          notes: setData.notes,
        },
      })
    } else if (
      existingSet &&
      setData.matchNumber === 'ROC-FUT-GA-001' &&
      existingSet.participant_a_score === 0 &&
      existingSet.participant_b_score === 0
    ) {
      await payload.update({
        collection: 'match-sets',
        id: getId(existingSet),
        data: {
          participant_a_score: setData.participant_a_score,
          participant_b_score: setData.participant_b_score,
          notes: setData.notes,
        },
      })
    }
  }

  const publicCommentBody =
    'Reminder from the committee: please arrive 10 minutes before warm-up for this match.'
  const publicCommentMatchId = matchIds.get('ROC-BMS-001')
  const existingPublicComment = publicCommentMatchId
    ? await findComment(payload, 'matches', publicCommentMatchId, 'public', publicCommentBody)
    : undefined

  if (!existingPublicComment && publicCommentMatchId) {
    await payload.create({
      collection: 'comments',
      data: {
        entity_type: 'matches',
        entity_id: String(publicCommentMatchId),
        comment_type: 'public',
        author_name: 'ROC Sports Committee',
        body: publicCommentBody,
        status: 'approved',
        is_pinned: true,
      },
    })
  }

  const futsalStageId = stageIds.get('roc-olympic-2026-futsal-men')
  const futsalGroupId = groupIds.get('roc-olympic-2026-futsal-men:Group A')
  if (futsalCategoryId && futsalStageId && futsalGroupId) {
    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId: futsalCategoryId,
      stageId: futsalStageId,
      groupId: futsalGroupId,
    })
  }

  payload.logger.info('ROC Olympic 2026 demo event structure is ready')
  console.log('ROC GMS seed complete.')
}

await seed()
process.exit(0)
