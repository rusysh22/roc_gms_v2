import { getPayload } from 'payload'

import config from '@payload-config'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  generateRoundRobinPairings,
  generateSingleEliminationFirstRound,
  getMatchPairKey,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { attemptSingleEliminationWinnerAdvancement } from '@/lib/winnerAdvancement'
import { demoScenario, type DemoEntrySeed, type DemoMatchSeed } from './data/demoScenario'
import { defaultSiteConfig } from './data/siteConfig'

type CollectionName =
  | 'announcements'
  | 'articles'
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
  | 'brackets'
  | 'comments'

type LexicalContent = {
  root: {
    type: 'root'
    format: ''
    indent: 0
    version: 1
    direction: 'ltr'
    children: Array<{
      type: 'paragraph'
      format: ''
      indent: 0
      version: 1
      direction: 'ltr'
      children: Array<{
        type: 'text'
        text: string
        format: 0
        style: ''
        mode: 'normal'
        detail: 0
        version: 1
      }>
      textFormat: 0
      textStyle: ''
    }>
  }
}

type SeedPayload = Awaited<ReturnType<typeof getPayload>>
type SeedId = string | number

type DemoMatchSetSeedLike = {
  set_number: number
  participant_a_score: number
  participant_b_score: number
  notes?: string
}

// A minimal valid 1x1 transparent PNG, reused for every seeded documentation asset. Real bytes
// are only needed so DocumentationAssets (an upload-enabled collection) accepts the create call -
// the mimetype on each seeded row is what drives the redesigned gallery's image/video/file icon
// choice, not the actual file content, so this same tiny buffer works for every asset_type.
const PLACEHOLDER_FILE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const PLACEHOLDER_FILE_BUFFER = Buffer.from(PLACEHOLDER_FILE_BASE64, 'base64')

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

const findDocumentationAsset = async (
  payload: SeedPayload,
  matchId: SeedId,
  caption: string,
) => {
  const result = await payload.find({
    collection: 'documentation-assets',
    limit: 1,
    where: {
      and: [{ match_id: { equals: matchId } }, { caption: { equals: caption } }],
    },
  })

  return result.docs[0]
}

const createLexicalContent = (paragraphs: string[]): LexicalContent => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'text',
          text,
          format: 0,
          style: '',
          mode: 'normal',
          detail: 0,
          version: 1,
        },
      ],
      textFormat: 0,
      textStyle: '',
    })),
  },
})

const seed = async () => {
  console.log('Starting InTourney seed...')
  const payload = await getPayload({ config })
  console.log('Payload ready for seed.')

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@intourney.local'
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

  for (const rosterData of demoScenario.rosterSeeds) {
    const teamId = teamIds.get(rosterData.teamSlug)
    const playerId = playerIds.get(rosterData.employeeId)
    const categoryId = categoryIds.get(rosterData.categorySlug)
    const existingRoster =
      teamId && playerId ? await findRoster(payload, eventId, teamId, playerId) : undefined

    if (!existingRoster) {
      await payload.create({
        collection: 'rosters',
        data: {
          event_id: eventId,
          team_id: teamId,
          player_id: playerId,
          category_id: categoryId,
          role: rosterData.role,
          status: 'active',
        },
      })
    }
  }

  for (const entryData of demoScenario.entries as DemoEntrySeed[]) {
    const categoryId = categoryIds.get(entryData.categorySlug)
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
          category_id: categoryId,
          entry_type: entryData.entry_type,
          club_id: entryData.clubSlug ? clubIds.get(entryData.clubSlug) : undefined,
          team_id: entryData.teamSlug ? teamIds.get(entryData.teamSlug) : undefined,
          player_id: entryData.playerEmployeeId ? playerIds.get(entryData.playerEmployeeId) : undefined,
          display_name: entryData.display_name,
          seed_number: entryData.seed_number,
          status: entryData.status,
        },
      })
    } else {
      // Keep status/seed_number in sync so re-running the seed against a database created by an
      // older version of this file (before an entry's demo status/seed changed) still converges.
      await payload.update({
        collection: 'competition-entries',
        id: getId(existingEntry),
        data: {
          seed_number: entryData.seed_number,
          status: entryData.status,
        },
      })
    }
  }

  // Prune entries left over from an older version of this file (e.g. a placeholder that used to
  // exist in a category's entry list but was since removed/renamed). Stale entries silently
  // pollute round-robin/single-elimination generation - see D024 - so every entry in this event
  // must either match a name in the current demoScenario.entries, or get removed.
  const currentEntryDisplayNames = new Set(
    (demoScenario.entries as DemoEntrySeed[]).map((entryData) => entryData.display_name),
  )
  const allEntriesForEvent = await payload.find({
    collection: 'competition-entries',
    limit: 500,
    where: { event_id: { equals: eventId } },
  })
  for (const entry of allEntriesForEvent.docs) {
    if (!currentEntryDisplayNames.has(String(entry.display_name))) {
      await payload.delete({ collection: 'competition-entries', id: entry.id })
      payload.logger.info(`Pruned stale demo entry: ${entry.display_name}`)
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
    limit: 200,
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
  for (const matchData of demoScenario.matches as DemoMatchSeed[]) {
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
          participant_a_entry_id: entryIds.get(matchData.participantA || ''),
          participant_b_entry_id: entryIds.get(matchData.participantB || ''),
          scheduled_start_at: matchData.scheduled_start_at,
          scheduled_end_at: matchData.scheduled_end_at,
          venue_id: matchData.venueName ? venueIds.get(matchData.venueName) : undefined,
          court_id: matchData.courtName ? courtIds.get(matchData.courtName) : undefined,
          status: matchData.status,
          generation_source: 'manual',
          winner_entry_id: winnerEntryId,
          score_summary: scoreSummary,
          is_public: matchData.is_public,
          documentation_status: matchData.documentation_status,
        },
      }))

    matchIds.set(matchData.match_number, getId(match))

    // Fully-declared matches (finalStateDeclared !== false) stay in sync with the seed data on
    // every run. Placeholder matches (TBD participants, or a result applied later by
    // matchGenerationOverrides/singleEliminationResults) are deliberately left alone here -
    // re-syncing them would wipe out participants/results that advancement already wrote in.
    if (existingMatch && matchData.finalStateDeclared !== false) {
      await payload.update({
        collection: 'matches',
        id: getId(existingMatch),
        data: {
          status: matchData.status,
          winner_entry_id: winnerEntryId,
          score_summary: scoreSummary,
          is_public: matchData.is_public,
          documentation_status: matchData.documentation_status,
          scheduled_start_at: matchData.scheduled_start_at,
          scheduled_end_at: matchData.scheduled_end_at,
          venue_id: matchData.venueName ? venueIds.get(matchData.venueName) : undefined,
          court_id: matchData.courtName ? courtIds.get(matchData.courtName) : undefined,
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

  // Keyed by `${categorySlug}:${groupName || 'no-group'}` - entries themselves don't carry a
  // group_id (group assignment only exists at the match/pairing level), so demoScenario.entries
  // carries an explicit optional groupName used only to scope round-robin generation correctly.
  // Without this, a category with more than one group (Futsal Men: Group A + Group B) would mix
  // every group's entries into one giant round-robin instead of pairing within each group.
  const entryGroupNameByDisplayName = new Map<string, string | undefined>()
  for (const entryData of demoScenario.entries as DemoEntrySeed[]) {
    entryGroupNameByDisplayName.set(entryData.display_name, entryData.groupName)
  }

  const entriesByCategoryAndGroup = new Map<string, MatchGenerationEntry[]>()
  for (const categoryData of demoScenario.categories) {
    const categoryId = categoryIds.get(categoryData.slug)
    const categoryEntryDocs = seededEntries.docs.filter(
      (entry) => getRelationshipId(entry.category_id) === categoryId,
    )
    const groupNamesInCategory = new Set(
      categoryEntryDocs.map((entry) => entryGroupNameByDisplayName.get(String(entry.display_name))),
    )

    for (const groupName of groupNamesInCategory) {
      const key = `${categoryData.slug}:${groupName || 'no-group'}`
      entriesByCategoryAndGroup.set(
        key,
        categoryEntryDocs
          .filter((entry) => entryGroupNameByDisplayName.get(String(entry.display_name)) === groupName)
          .map((entry) => ({
            id: getId(entry),
            display_name: String(entry.display_name),
            seed_number:
              typeof entry.seed_number === 'number' ? entry.seed_number : undefined,
            status: typeof entry.status === 'string' ? entry.status : undefined,
          })),
      )
    }
  }

  for (const generationData of demoScenario.matchGeneration) {
    const categoryId = categoryIds.get(generationData.categorySlug)
    const stageId = stageIds.get(generationData.stageCategorySlug)
    const groupId = generationData.groupName
      ? groupIds.get(`${generationData.stageCategorySlug}:${generationData.groupName}`)
      : undefined
    const categoryEntries =
      entriesByCategoryAndGroup.get(
        `${generationData.categorySlug}:${generationData.groupName || 'no-group'}`,
      ) || []
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

  // Any match_number not yet in matchIds (generated matches created on a previous seed run) still
  // needs to resolve before the override/results passes below can find it by number.
  const resolveMatchId = async (matchNumber: string): Promise<SeedId | undefined> => {
    if (matchIds.has(matchNumber)) {
      return matchIds.get(matchNumber)
    }

    const match = await findOne(payload, 'matches', 'match_number', matchNumber)
    if (match) {
      matchIds.set(matchNumber, getId(match))
      return getId(match)
    }

    return undefined
  }

  const articleSeeds: Array<{
    title: string
    slug: string
    excerpt: string
    paragraphs: string[]
    status: string
    published_at?: string
    sportSlug?: string
    categorySlug?: string
    matchNumber?: string
    share_title: string
    share_description: string
    comments_enabled?: boolean
  }> = [
    {
      title: 'ROC Olympic 2026 is Getting Ready',
      slug: 'roc-olympic-2026-getting-ready',
      excerpt:
        'A quick organizer note for the opening week, sports lineup, and where participants should watch for updates.',
      paragraphs: [
        'ROC Olympic 2026 is moving from setup into match-week readiness. The committee is preparing sport pages, schedules, venue details, and result updates so employees can follow the event from one place.',
        'Badminton, futsal, table tennis, chess, running, and padel are represented in the demo content foundation. Public reading pages will be added in the next Phase 6 session.',
      ],
      status: 'published',
      published_at: '2026-07-03T02:00:00.000Z',
      share_title: 'ROC Olympic 2026 is getting ready',
      share_description: 'Opening update for the ROC Olympic 2026 demo event.',
      comments_enabled: false,
    },
    {
      title: 'Badminton Final Recap: Andi Claims the First Crown',
      slug: 'badminton-final-recap-andi-claims-the-first-crown',
      excerpt:
        'A seeded match recap connected to the Badminton Men Single final for CMS and related-content testing.',
      paragraphs: [
        'The Badminton Men Single final delivered a three-set finish, with Andi Pratama recovering after the opening set and closing the championship match with steady attacking play.',
        'This recap is linked to the final match record so later public article pages can show related match context without inventing another data model.',
      ],
      status: 'review',
      published_at: '2026-08-21T04:30:00.000Z',
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      matchNumber: 'ROC-BMS-001',
      share_title: 'Badminton final recap: Andi claims the crown',
      share_description: 'A draft recap connected to the ROC-BMS-001 final match.',
      comments_enabled: true,
    },
  ]

  for (const articleData of articleSeeds) {
    const existingArticle = await findOne(payload, 'articles', 'slug', articleData.slug)
    const matchId = articleData.matchNumber ? await resolveMatchId(articleData.matchNumber) : undefined
    const data = {
      title: articleData.title,
      slug: articleData.slug,
      excerpt: articleData.excerpt,
      content: createLexicalContent(articleData.paragraphs),
      status: articleData.status,
      published_at: articleData.published_at,
      event_id: eventId,
      sport_id: articleData.sportSlug ? sportIds.get(articleData.sportSlug) : undefined,
      category_id: articleData.categorySlug ? categoryIds.get(articleData.categorySlug) : undefined,
      match_id: matchId,
      share_title: articleData.share_title,
      share_description: articleData.share_description,
      comments_enabled: articleData.comments_enabled || false,
    }

    if (existingArticle) {
      await payload.update({
        collection: 'articles',
        id: getId(existingArticle),
        data,
      })
    } else {
      await payload.create({
        collection: 'articles',
        data,
      })
    }
  }

  const announcementSeeds: Array<{
    title: string
    slug: string
    summary: string
    body: string
    urgency: string
    display_mode: string
    status: string
    target_scope: string
    published_at?: string
    expires_at?: string
    sportSlug?: string
    categorySlug?: string
    matchNumber?: string
    cta_label?: string
    cta_url?: string
    share_title: string
    share_description: string
  }> = [
    {
      title: 'Weather Watch: Futsal Kickoff May Shift',
      slug: 'weather-watch-futsal-kickoff-may-shift',
      summary: 'Urgent operational alert for outdoor futsal matches if heavy rain continues.',
      body: 'The committee is monitoring field conditions. Please check the public schedule before leaving for the Futsal Field.',
      urgency: 'urgent',
      display_mode: 'urgent_alert',
      status: 'published',
      target_scope: 'event',
      published_at: '2026-07-03T02:30:00.000Z',
      expires_at: '2026-08-19T05:00:00.000Z',
      cta_label: 'Open schedule',
      cta_url: '/schedule',
      share_title: 'ROC Olympic weather watch',
      share_description: 'Urgent futsal schedule watch for ROC Olympic 2026.',
    },
    {
      title: 'Badminton Mixed Double Group A Starts on Court 2',
      slug: 'badminton-mixed-double-group-a-starts-on-court-2',
      summary: 'Category notice for players and supporters following Badminton Mixed Double.',
      body: 'Group A matches for Badminton Mixed Double are planned on Court 2. Players should arrive early for warm-up and check-in.',
      urgency: 'info',
      display_mode: 'banner',
      status: 'review',
      target_scope: 'category',
      published_at: '2026-08-18T23:00:00.000Z',
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-mixed-double',
      cta_label: 'View category',
      cta_url: '/sports/roc-olympic-2026-badminton/roc-olympic-2026-badminton-mixed-double',
      share_title: 'Badminton Mixed Double Group A starts on Court 2',
      share_description: 'Category update for ROC Olympic 2026 Badminton Mixed Double.',
    },
  ]

  for (const announcementData of announcementSeeds) {
    const existingAnnouncement = await findOne(payload, 'announcements', 'slug', announcementData.slug)
    const matchId = announcementData.matchNumber
      ? await resolveMatchId(announcementData.matchNumber)
      : undefined
    const data = {
      title: announcementData.title,
      slug: announcementData.slug,
      summary: announcementData.summary,
      body: announcementData.body,
      urgency: announcementData.urgency,
      display_mode: announcementData.display_mode,
      status: announcementData.status,
      target_scope: announcementData.target_scope,
      published_at: announcementData.published_at,
      expires_at: announcementData.expires_at,
      event_id: eventId,
      sport_id: announcementData.sportSlug ? sportIds.get(announcementData.sportSlug) : undefined,
      category_id: announcementData.categorySlug
        ? categoryIds.get(announcementData.categorySlug)
        : undefined,
      match_id: matchId,
      cta_label: announcementData.cta_label,
      cta_url: announcementData.cta_url,
      share_title: announcementData.share_title,
      share_description: announcementData.share_description,
    }

    if (existingAnnouncement) {
      await payload.update({
        collection: 'announcements',
        id: getId(existingAnnouncement),
        data,
      })
    } else {
      await payload.create({
        collection: 'announcements',
        data,
      })
    }
  }

  const upsertMatchSet = async (setData: DemoMatchSetSeedLike, matchId: SeedId) => {
    const existingSet = await findMatchSet(payload, eventId, matchId, setData.set_number)

    if (existingSet) {
      await payload.update({
        collection: 'match-sets',
        id: getId(existingSet),
        data: {
          participant_a_score: setData.participant_a_score,
          participant_b_score: setData.participant_b_score,
          notes: setData.notes,
        },
      })
    } else {
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
    }
  }

  for (const setData of demoScenario.matchSets) {
    const matchId = await resolveMatchId(setData.matchNumber)
    if (matchId) {
      await upsertMatchSet(setData, matchId)
    }
  }

  // Status/score upgrades for matches that don't need winner advancement (round robin and
  // standalone matches). Safe to re-run: every field here is an idempotent upsert.
  for (const overrideData of demoScenario.matchGenerationOverrides) {
    const matchId = await resolveMatchId(overrideData.matchNumber)
    if (!matchId) {
      payload.logger.warn(`Seed: could not resolve match ${overrideData.matchNumber} for override`)
      continue
    }

    for (const setData of overrideData.sets || []) {
      await upsertMatchSet(setData, matchId)
    }

    await payload.update({
      collection: 'matches',
      id: matchId,
      data: {
        status: overrideData.status,
        winner_entry_id: overrideData.winner ? entryIds.get(overrideData.winner) : undefined,
        score_summary: overrideData.score_summary,
        is_public: overrideData.is_public,
        documentation_status: overrideData.documentation_status,
        scheduled_start_at: overrideData.scheduled_start_at,
        scheduled_end_at: overrideData.scheduled_end_at,
        venue_id: overrideData.venueName ? venueIds.get(overrideData.venueName) : undefined,
        court_id: overrideData.courtName ? courtIds.get(overrideData.courtName) : undefined,
      },
    })
  }

  // Single-elimination results, applied in dependency order (quarter -> semi -> final) through the
  // real attemptSingleEliminationWinnerAdvancement helper - the same function the match officer
  // workspace calls - so TBD placeholder matches get filled in exactly like production. Safe to
  // re-run: advancement is a no-op once a winner is already in the target slot.
  for (const resultData of demoScenario.singleEliminationResults) {
    const matchId = await resolveMatchId(resultData.matchNumber)
    if (!matchId) {
      payload.logger.warn(`Seed: could not resolve match ${resultData.matchNumber} for result`)
      continue
    }

    for (const setData of resultData.sets) {
      await upsertMatchSet(setData, matchId)
    }

    await payload.update({
      collection: 'matches',
      id: matchId,
      data: {
        status: 'result_published',
        winner_entry_id: entryIds.get(resultData.winner),
        score_summary: resultData.score_summary,
        is_public: resultData.is_public,
        documentation_status: resultData.documentation_status,
        scheduled_start_at: resultData.scheduled_start_at,
        scheduled_end_at: resultData.scheduled_end_at,
        venue_id: resultData.venueName ? venueIds.get(resultData.venueName) : undefined,
        court_id: resultData.courtName ? courtIds.get(resultData.courtName) : undefined,
      },
    })

    await attemptSingleEliminationWinnerAdvancement(payload, matchId)
  }

  // Documentation assets: a small spread of photo/video/file/score-sheet uploads across a few
  // matches, mixing public and internal visibility. Uses the same tiny placeholder buffer for
  // every asset - only the mimetype/asset_type/visibility metadata varies, which is what the
  // redesigned public gallery and workspace list actually render differently.
  const documentationSeeds: Array<{
    matchNumber: string
    asset_type: string
    caption: string
    visibility: string
    mimetype: string
    filename: string
  }> = [
    { matchNumber: 'ROC-BMS-001', asset_type: 'photo', caption: 'Championship point celebration', visibility: 'public', mimetype: 'image/png', filename: 'bms-final-point.png' },
    { matchNumber: 'ROC-BMS-001', asset_type: 'video', caption: 'Final rally highlight', visibility: 'public', mimetype: 'video/mp4', filename: 'bms-final-highlight.mp4' },
    { matchNumber: 'ROC-BMS-001', asset_type: 'score_sheet', caption: 'Official final score sheet', visibility: 'internal', mimetype: 'application/pdf', filename: 'bms-final-scoresheet.pdf' },
    { matchNumber: 'ROC-FUT-GA-001', asset_type: 'photo', caption: 'Kickoff at the Futsal Field', visibility: 'public', mimetype: 'image/png', filename: 'fut-ga-001-kickoff.png' },
    { matchNumber: 'ROC-FUT-GA-001', asset_type: 'photo', caption: 'Committee notes on crowd size', visibility: 'internal', mimetype: 'image/png', filename: 'fut-ga-001-crowd.png' },
    { matchNumber: 'ROC-FUT-GA-001', asset_type: 'score_sheet', caption: 'Referee score sheet', visibility: 'internal', mimetype: 'application/pdf', filename: 'fut-ga-001-scoresheet.pdf' },
    { matchNumber: 'ROC-TTO-SF-001', asset_type: 'photo', caption: 'Semi-final match point', visibility: 'public', mimetype: 'image/png', filename: 'tto-sf-001-point.png' },
    { matchNumber: 'ROC-CHS-GA-001', asset_type: 'file', caption: 'Recorded move list (PGN)', visibility: 'internal', mimetype: 'text/plain', filename: 'chs-ga-001-moves.txt' },
  ]

  for (const docData of documentationSeeds) {
    const matchId = await resolveMatchId(docData.matchNumber)
    if (!matchId) {
      continue
    }

    const existingAsset = await findDocumentationAsset(payload, matchId, docData.caption)
    if (!existingAsset) {
      await payload.create({
        collection: 'documentation-assets',
        data: {
          event_id: eventId,
          match_id: matchId,
          asset_type: docData.asset_type,
          caption: docData.caption,
          visibility: docData.visibility,
        },
        file: {
          data: PLACEHOLDER_FILE_BUFFER,
          mimetype: docData.mimetype,
          name: docData.filename,
          size: PLACEHOLDER_FILE_BUFFER.length,
        },
      })
    }
  }

  // Comments: keep the existing pinned public reminder, and add internal/official-note variety
  // (pending, approved, resolved) across a couple of different matches.
  const commentSeeds: Array<{
    matchNumber: string
    comment_type: string
    author_name: string
    body: string
    status: string
    is_pinned?: boolean
    resolved_at?: string
  }> = [
    {
      matchNumber: 'ROC-BMS-001',
      comment_type: 'public',
      author_name: 'ROC Sports Committee',
      body: 'Reminder from the committee: please arrive 10 minutes before warm-up for this match.',
      status: 'approved',
      is_pinned: true,
    },
    {
      matchNumber: 'ROC-FUT-GA-001',
      comment_type: 'internal',
      author_name: 'Match Officer',
      body: 'Pitch was slightly wet before kickoff - flagged to the venue team for the next Group A match.',
      status: 'pending',
    },
    {
      matchNumber: 'ROC-FUT-GEN-GA-006',
      comment_type: 'official_note',
      author_name: 'Scheduler',
      body: 'Marketing Futsal Squad confirmed unable to field a team; walkover awarded to HR Club per committee rules.',
      status: 'approved',
    },
    {
      matchNumber: 'ROC-RUN-002',
      comment_type: 'internal',
      author_name: 'Match Officer',
      body: 'Timing camera angle was obstructed - committee to review footage before publishing the result.',
      status: 'resolved',
      resolved_at: '2026-07-02T10:00:00.000Z',
    },
  ]

  for (const commentData of commentSeeds) {
    const matchId = await resolveMatchId(commentData.matchNumber)
    if (!matchId) {
      continue
    }

    const existingComment = await findComment(
      payload,
      'matches',
      matchId,
      commentData.comment_type,
      commentData.body,
    )

    if (!existingComment) {
      await payload.create({
        collection: 'comments',
        data: {
          entity_type: 'matches',
          entity_id: String(matchId),
          comment_type: commentData.comment_type,
          author_name: commentData.author_name,
          body: commentData.body,
          status: commentData.status,
          is_pinned: commentData.is_pinned || false,
          resolved_at: commentData.resolved_at,
        },
      })
    }
  }

  // Standings recalculation for every group-stage/round-robin scope in the demo.
  const badmintonMixedDoubleCategoryId = categoryIds.get('roc-olympic-2026-badminton-mixed-double')
  const badmintonMixedDoubleStageId = stageIds.get('roc-olympic-2026-badminton-mixed-double')
  const badmintonMixedDoubleGroupId = groupIds.get('roc-olympic-2026-badminton-mixed-double:Group A')
  if (badmintonMixedDoubleCategoryId && badmintonMixedDoubleStageId && badmintonMixedDoubleGroupId) {
    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId: badmintonMixedDoubleCategoryId,
      stageId: badmintonMixedDoubleStageId,
      groupId: badmintonMixedDoubleGroupId,
    })
  }

  const futsalCategoryId = categoryIds.get('roc-olympic-2026-futsal-men')
  const futsalStageId = stageIds.get('roc-olympic-2026-futsal-men')
  const futsalGroupAId = groupIds.get('roc-olympic-2026-futsal-men:Group A')
  const futsalGroupBId = groupIds.get('roc-olympic-2026-futsal-men:Group B')
  if (futsalCategoryId && futsalStageId && futsalGroupAId) {
    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId: futsalCategoryId,
      stageId: futsalStageId,
      groupId: futsalGroupAId,
    })
  }
  if (futsalCategoryId && futsalStageId && futsalGroupBId) {
    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId: futsalCategoryId,
      stageId: futsalStageId,
      groupId: futsalGroupBId,
    })
  }

  const chessCategoryId = categoryIds.get('roc-olympic-2026-chess-open')
  const chessStageId = stageIds.get('roc-olympic-2026-chess-open')
  if (chessCategoryId && chessStageId) {
    await recalculateStandingsForScope(payload, {
      eventId,
      categoryId: chessCategoryId,
      stageId: chessStageId,
    })
  }

  // Demo-only manual enrichment: the standings calculator always leaves qualified_status as
  // 'pending' (there is no manual-override workflow yet - see prd/implementation-plan.md Phase 5
  // "standing admin override" as still unbuilt). To exercise the redesigned qualified/eliminated/
  // champion StatusBadge tones, mark the top team in Futsal Group A as a preview of that future
  // workflow. This does not change calculateStandingsForScope itself.
  if (futsalCategoryId && futsalStageId && futsalGroupAId) {
    const futsalGroupAStandings = await payload.find({
      collection: 'standings',
      depth: 0,
      limit: 10,
      sort: 'rank',
      where: {
        and: [
          { category_id: { equals: futsalCategoryId } },
          { stage_id: { equals: futsalStageId } },
          { group_id: { equals: futsalGroupAId } },
        ],
      },
    })

    for (const [index, standing] of futsalGroupAStandings.docs.entries()) {
      const qualifiedStatus = index === 0 ? 'qualified' : index === futsalGroupAStandings.docs.length - 1 ? 'eliminated' : 'pending'
      if (standing.qualified_status !== qualifiedStatus) {
        await payload.update({
          collection: 'standings',
          id: standing.id,
          data: { qualified_status: qualifiedStatus },
        })
      }
    }
  }

  // Bracket cache recalculation for every single-elimination stage in the demo.
  const badmintonMenSingleCategoryId = categoryIds.get('roc-olympic-2026-badminton-men-single')
  const badmintonMenSingleStageId = stageIds.get('roc-olympic-2026-badminton-men-single')
  if (badmintonMenSingleCategoryId && badmintonMenSingleStageId) {
    await recalculateSingleEliminationBracket(payload, {
      stageId: badmintonMenSingleStageId,
    })
  }

  const tableTennisStageId = stageIds.get('roc-olympic-2026-table-tennis-open')
  if (tableTennisStageId) {
    await recalculateSingleEliminationBracket(payload, {
      stageId: tableTennisStageId,
    })
  }

  const padelMenStageId = stageIds.get('roc-olympic-2026-padel-men')
  if (padelMenStageId) {
    await recalculateSingleEliminationBracket(payload, {
      stageId: padelMenStageId,
    })
  }

  const padelWomenStageId = stageIds.get('roc-olympic-2026-padel-women')
  if (padelWomenStageId) {
    await recalculateSingleEliminationBracket(payload, {
      stageId: padelWomenStageId,
    })
  }

  payload.logger.info('ROC Olympic 2026 demo event structure is ready')
  console.log('InTourney seed complete.')
}

await seed()
process.exit(0)
