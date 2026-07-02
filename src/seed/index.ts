import { getPayload } from 'payload'

import config from '@payload-config'
import { demoScenario } from './data/demoScenario'
import { defaultSiteConfig } from './data/siteConfig'

type CollectionName =
  | 'events'
  | 'sports'
  | 'competition-categories'
  | 'clubs'
  | 'players'
  | 'teams'
  | 'rosters'
  | 'competition-entries'
  | 'venues'
  | 'courts'

type SeedPayload = Awaited<ReturnType<typeof getPayload>>
type SeedId = string | number

const getId = (doc: { id: SeedId }) => doc.id

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

const seed = async () => {
  const payload = await getPayload({ config })

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
          ...sportData,
          event_id: eventId,
        },
      }))

    sportIds.set(sportData.slug, getId(sport))
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
          ruleset_id: categoryData.ruleset_id,
          format_type: categoryData.format_type,
          status: categoryData.status,
        },
      }))

    categoryIds.set(categoryData.slug, getId(category))
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

  payload.logger.info('ROC Olympic 2026 demo event structure is ready')
}

await seed()
process.exit(0)
