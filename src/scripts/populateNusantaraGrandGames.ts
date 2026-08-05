import config from '@payload-config'
import { getPayload } from 'payload'

import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  buildSingleEliminationBracketPlan,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { attemptSingleEliminationWinnerAdvancement } from '@/lib/winnerAdvancement'

type Doc = Record<string, any> & { id: number | string }

const EVENT_SLUG = 'nusantara-grand-games-2026'
const PREFIX = `${EVENT_SLUG}-`

const payload = await getPayload({ config })
const db = payload as any
const adminUser = (
  await db.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: { roles: { contains: 'super_admin' } },
  })
).docs[0]

const findOne = async (collection: string, where: Record<string, unknown>): Promise<Doc | undefined> => {
  const result = await db.find({ collection, depth: 0, limit: 1, where })
  return result.docs[0] as Doc | undefined
}

// `scopeEventId`, when passed, checks slug uniqueness scoped to that event (matching the
// `[event_id, slug]` compound unique index that sports/rulesets/competition-categories/clubs/
// teams all use) instead of checking the slug alone across the whole collection. Announcements'
// `slug` field is `unique: true` globally instead, so its callers deliberately omit this and keep
// checking unscoped - scoping that one would be a false fix, not a correct one.
const ensureBySlug = async (
  collection: string,
  slug: string,
  data: Record<string, unknown>,
  scopeEventId?: number | string,
): Promise<Doc> => {
  const where =
    scopeEventId !== undefined ?
      { and: [{ event_id: { equals: scopeEventId } }, { slug: { equals: slug } }] }
    : { slug: { equals: slug } }
  const existing = await findOne(collection, where)
  if (existing) {
    return (await db.update({ collection, id: existing.id, data })) as Doc
  }
  return (await db.create({ collection, data: { ...data, slug } })) as Doc
}

const ensureByEventName = async (
  collection: string,
  eventId: number | string,
  name: string,
  data: Record<string, unknown>,
): Promise<Doc> => {
  const existing = await findOne(collection, {
    and: [{ event_id: { equals: eventId } }, { name: { equals: name } }],
  })
  if (existing) {
    return (await db.update({ collection, id: existing.id, data })) as Doc
  }
  return (await db.create({ collection, data: { ...data, event_id: eventId, name } })) as Doc
}

let event = await findOne('events', { slug: { equals: EVENT_SLUG } })
if (!event) {
  event = (await db.create({
    collection: 'events',
    data: {
      name: 'Nusantara Grand Games 2026',
      slug: EVENT_SLUG,
      event_start_at: '2026-07-15T01:00:00.000Z',
      event_end_at: '2026-08-31T14:00:00.000Z',
      timezone: 'Asia/Jakarta',
      status: 'live',
      visibility: 'published',
    },
  })) as Doc
}

event = (await db.update({
  collection: 'events',
  id: event.id,
  data: {
    name: 'Nusantara Grand Games 2026',
    description:
      'A seven-week national multi-sport festival bringing clubs, teams, athletes, officials, and supporters together across indoor, field, mind-sport, track, and esports competitions.',
    hero_tagline: 'One Nation. Many Arenas. One Grand Stage.',
    event_start_at: '2026-07-15T01:00:00.000Z',
    event_end_at: '2026-08-31T14:00:00.000Z',
    public_open_at: '2026-06-15T01:00:00.000Z',
    registration_open_at: '2026-06-01T01:00:00.000Z',
    registration_close_at: '2026-07-07T16:59:00.000Z',
    schedule_publish_at: '2026-07-10T01:00:00.000Z',
    archive_at: '2026-09-30T16:59:00.000Z',
    status: 'live',
    visibility: 'published',
    location: 'Jakarta International Sports Complex',
    organizer_name: 'Nusantara Sports Federation',
    contact_email: 'committee@nusantara-games.test',
    rules_summary:
      'Participants must check in 30 minutes before their first fixture. Competition-specific rules apply. The tournament director may revise schedules for safety, venue, or broadcast requirements.',
    theme_config: { preset: 'ocean' },
  },
})) as Doc

const eventId = event.id

const sportSeeds = [
  ['Badminton', 'court', 'Racket competition for singles and doubles categories.'],
  ['Futsal', 'field', 'Fast-paced five-a-side team competition.'],
  ['Basketball 3x3', 'court', 'Half-court three-player basketball competition.'],
  ['Table Tennis', 'table', 'Singles table-tennis competition.'],
  ['Chess', 'board', 'Rapid chess league competition.'],
  ['Athletics', 'track', 'Track races ranked by official timing.'],
  ['Mobile Legends', 'esport', 'Team-based esports competition.'],
  ['Archery', 'other', 'Score-ranking target archery competition.'],
] as const

const sports = new Map<string, Doc>()
for (const [name, sportType, description] of sportSeeds) {
  const key = name.toLowerCase().replaceAll(' ', '-').replace('3x3', '3x3')
  const sport = await ensureBySlug(
    'sports',
    key,
    {
      event_id: eventId,
      name,
      description,
      sport_type: sportType,
      is_active: true,
    },
    eventId,
  )
  sports.set(name, sport)
}

const rulesetSeeds = [
  {
    sport: 'Badminton',
    name: 'Badminton BWF-style Best of 3',
    score_type: 'sets',
    set_based: true,
    best_of: 3,
    target_score: 21,
    max_score: 30,
    deuce_enabled: true,
    allow_draw: false,
  },
  {
    sport: 'Futsal',
    name: 'Futsal Two Halves',
    score_type: 'goals',
    period_count: 2,
    period_duration: 20,
    timer_enabled: true,
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
    allow_draw: true,
    overtime_enabled: true,
    penalty_enabled: true,
    tie_breakers: ['points', 'head_to_head', 'score_difference', 'score_for'],
  },
  {
    sport: 'Basketball 3x3',
    name: 'Basketball 3x3 First to 21',
    score_type: 'points',
    period_count: 1,
    period_duration: 10,
    timer_enabled: true,
    target_score: 21,
    allow_draw: false,
    overtime_enabled: true,
  },
  {
    sport: 'Table Tennis',
    name: 'Table Tennis Best of 5',
    score_type: 'sets',
    set_based: true,
    best_of: 5,
    target_score: 11,
    deuce_enabled: true,
    allow_draw: false,
  },
  {
    sport: 'Chess',
    name: 'Rapid Chess 15+10',
    score_type: 'result',
    timer_enabled: true,
    allow_draw: true,
    points_win: 1,
    points_draw: 0.5,
    points_loss: 0,
    tie_breakers: ['points', 'head_to_head', 'manual_decision'],
  },
  {
    sport: 'Athletics',
    name: '100m Official Timing',
    score_type: 'time',
    allow_draw: false,
  },
  {
    sport: 'Mobile Legends',
    name: 'MLBB Best of 3',
    score_type: 'sets',
    set_based: true,
    best_of: 3,
    allow_draw: false,
  },
  {
    sport: 'Archery',
    name: 'Archery 72-arrow Ranking',
    score_type: 'points',
    allow_draw: false,
  },
] as const

const rulesets = new Map<string, Doc>()
for (const seed of rulesetSeeds) {
  const sport = sports.get(seed.sport)!
  const slug = seed.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
  const ruleset = await ensureBySlug(
    'rulesets',
    slug,
    {
      ...seed,
      sport: undefined,
      event_id: eventId,
      sport_id: sport.id,
      description: `${seed.name} for Nusantara Grand Games 2026.`,
    },
    eventId,
  )
  rulesets.set(seed.sport, ruleset)
  await db.update({ collection: 'sports', id: sport.id, data: { default_ruleset_id: ruleset.id } })
}

const categorySeeds = [
  ['Badminton Men Singles', 'Badminton', 'individual', 'single_elimination', false, 0, 1, 'published'],
  ['Badminton Mixed Doubles', 'Badminton', 'pair', 'round_robin', true, 2, 2, 'published'],
  ['Futsal Open Championship', 'Futsal', 'team', 'group_stage_to_knockout', true, 5, 10, 'published'],
  ['Basketball 3x3 Open', 'Basketball 3x3', 'team', 'round_robin', true, 3, 5, 'published'],
  ['Table Tennis Open Singles', 'Table Tennis', 'individual', 'single_elimination', false, 0, 1, 'published'],
  ['Rapid Chess League', 'Chess', 'individual', 'league', false, 0, 1, 'published'],
  ['100m Sprint Open', 'Athletics', 'individual', 'time_trial', false, 0, 1, 'draft'],
  ['MLBB Open', 'Mobile Legends', 'team', 'double_elimination', true, 5, 7, 'draft'],
  ['Archery Open Ranking', 'Archery', 'individual', 'score_ranking', false, 0, 1, 'draft'],
  ['Futsal Friendship Showcase', 'Futsal', 'club', 'friendly', false, 0, 1, 'published'],
] as const

const categories = new Map<string, Doc>()
for (const [name, sportName, participantMode, formatType, rosterRequired, minRoster, maxRoster, status] of categorySeeds) {
  const slug = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
  const category = await ensureBySlug(
    'competition-categories',
    slug,
    {
      event_id: eventId,
      sport_id: sports.get(sportName)!.id,
      name,
      participant_mode: participantMode,
      format_type: formatType,
      roster_required: rosterRequired,
      min_roster_size: minRoster,
      max_roster_size: maxRoster,
      ruleset_id: rulesets.get(sportName)!.id,
      group_qualify_count: formatType === 'group_stage_to_knockout' ? 2 : undefined,
      status,
    },
    eventId,
  )
  categories.set(name, category)
}

const clubSeeds = [
  ['Jakarta Garuda', 'Jakarta'],
  ['Bandung Arunika', 'Bandung'],
  ['Surabaya Samudra', 'Surabaya'],
  ['Yogyakarta Cakra', 'Yogyakarta'],
  ['Bali Dewata', 'Denpasar'],
  ['Makassar Phinisi', 'Makassar'],
  ['Medan Andalas', 'Medan'],
  ['Kalimantan Borneo', 'Balikpapan'],
] as const

const clubs: Doc[] = []
for (const [name, city] of clubSeeds) {
  clubs.push(
    await ensureBySlug(
      'clubs',
      name.toLowerCase().replaceAll(' ', '-'),
      {
        event_id: eventId,
        name,
        description: `${city}-based delegation competing across multiple sports.`,
        contact_person: `${name} Team Manager`,
        contact_email: `${name.toLowerCase().replaceAll(' ', '.')}@nusantara-games.test`,
      },
      eventId,
    ),
  )
}

const firstNames = [
  'Aditya', 'Alya', 'Bagas', 'Bella', 'Cakra', 'Citra', 'Damar', 'Dinda', 'Erlangga', 'Farah',
  'Galih', 'Hana', 'Indra', 'Intan', 'Jefri', 'Kirana', 'Lukman', 'Maya', 'Naufal', 'Putri',
]
const lastNames = ['Pratama', 'Lestari', 'Santoso', 'Wibowo', 'Nugraha', 'Permata', 'Ramadhan', 'Kusuma']
const players: Doc[] = []
const playersByClub = new Map<string | number, Doc[]>()
for (let index = 0; index < 80; index += 1) {
  const club = clubs[index % clubs.length]
  const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`
  const identificationNumber = `NGG26-${String(index + 1).padStart(3, '0')}`
  let player = await findOne('players', { identification_number: { equals: identificationNumber } })
  const data = {
    event_id: eventId,
    club_id: club.id,
    name,
    identification_number: identificationNumber,
    email: `${firstNames[index % firstNames.length].toLowerCase()}.${String(index + 1).padStart(3, '0')}@athlete.nusantara-games.test`,
    phone: `+6281200${String(index + 1).padStart(4, '0')}`,
    gender: index % 2 === 0 ? 'male' : 'female',
    bio: `Multi-sport athlete representing ${club.name}.`,
    metadata: { bib: `NGG-${String(index + 1).padStart(3, '0')}`, city: clubSeeds[index % clubs.length][1] },
  }
  player = player
    ? ((await db.update({ collection: 'players', id: player.id, data })) as Doc)
    : ((await db.create({ collection: 'players', data })) as Doc)
  players.push(player)
  const clubPlayers = playersByClub.get(club.id) || []
  clubPlayers.push(player)
  playersByClub.set(club.id, clubPlayers)
}

const teamsByKind = new Map<string, Doc[]>()
const ensureTeam = async (club: Doc, kind: string, suffix: string): Promise<Doc> => {
  const name = `${club.name} ${suffix}`
  const slug = `${kind}-${String(club.name).toLowerCase().replaceAll(' ', '-')}`
  return ensureBySlug(
    'teams',
    slug,
    {
      event_id: eventId,
      club_id: club.id,
      name,
      description: `${suffix} representing ${club.name}.`,
      contact_email: `${kind}.${String(club.name).toLowerCase().replaceAll(' ', '.')}@nusantara-games.test`,
    },
    eventId,
  )
}

for (const [kind, suffix, teamClubs] of [
  ['futsal', 'Futsal Squad', clubs],
  ['mlbb', 'MLBB Squad', clubs],
  ['basketball', '3x3 Team', clubs.slice(0, 6)],
  ['badminton-pair', 'Mixed Pair', clubs.slice(0, 6)],
] as const) {
  const teamDocs: Doc[] = []
  for (const club of teamClubs) teamDocs.push(await ensureTeam(club, kind, suffix))
  teamsByKind.set(kind, teamDocs)
}

const ensureRoster = async (team: Doc, player: Doc, category: Doc | undefined, role: string) => {
  const existing = await findOne('rosters', {
    and: [
      { event_id: { equals: eventId } },
      { team_id: { equals: team.id } },
      { player_id: { equals: player.id } },
      ...(category ? [{ category_id: { equals: category.id } }] : []),
    ],
  })
  const data = {
    event_id: eventId,
    team_id: team.id,
    player_id: player.id,
    category_id: category?.id,
    role,
    status: 'active',
  }
  if (existing) await db.update({ collection: 'rosters', id: existing.id, data })
  else await db.create({ collection: 'rosters', data })
}

for (const [kind, categoryName, rosterSize] of [
  ['futsal', 'Futsal Open Championship', 5],
  ['mlbb', 'MLBB Open', 5],
  ['basketball', 'Basketball 3x3 Open', 3],
  ['badminton-pair', 'Badminton Mixed Doubles', 2],
] as const) {
  const category = categories.get(categoryName)!
  for (const team of teamsByKind.get(kind)!) {
    const clubPlayers = playersByClub.get(team.club_id) || playersByClub.get(team.club_id?.id) || []
    for (let index = 0; index < Math.min(rosterSize, clubPlayers.length); index += 1) {
      await ensureRoster(team, clubPlayers[index], category, index === 0 ? 'captain' : 'player')
    }
    if (clubPlayers[0]) await db.update({ collection: 'teams', id: team.id, data: { captain_player_id: clubPlayers[0].id } })
  }
}

const ensureEntry = async (
  category: Doc,
  displayName: string,
  entryType: string,
  seedNumber: number,
  links: Record<string, unknown>,
): Promise<Doc> => {
  const existing = await findOne('competition-entries', {
    and: [{ category_id: { equals: category.id } }, { display_name: { equals: displayName } }],
  })
  const data = {
    event_id: eventId,
    category_id: category.id,
    display_name: displayName,
    entry_type: entryType,
    seed_number: seedNumber,
    status: 'confirmed',
    ...links,
  }
  return existing
    ? ((await db.update({ collection: 'competition-entries', id: existing.id, data })) as Doc)
    : ((await db.create({ collection: 'competition-entries', data })) as Doc)
}

const entriesByCategory = new Map<string, Doc[]>()
const addPlayerEntries = async (categoryName: string, selected: Doc[]) => {
  const category = categories.get(categoryName)!
  const entries: Doc[] = []
  for (let index = 0; index < selected.length; index += 1) {
    const player = selected[index]
    entries.push(await ensureEntry(category, player.name, 'individual', index + 1, { player_id: player.id, club_id: player.club_id }))
  }
  entriesByCategory.set(categoryName, entries)
}
const addTeamEntries = async (categoryName: string, kind: string, entryType = 'team') => {
  const category = categories.get(categoryName)!
  const teams = teamsByKind.get(kind)!
  const entries: Doc[] = []
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index]
    entries.push(await ensureEntry(category, team.name, entryType, index + 1, { team_id: team.id, club_id: team.club_id }))
  }
  entriesByCategory.set(categoryName, entries)
}

await addPlayerEntries('Badminton Men Singles', players.filter((_, index) => index % 2 === 0).slice(0, 16))
await addTeamEntries('Badminton Mixed Doubles', 'badminton-pair', 'pair')
await addTeamEntries('Futsal Open Championship', 'futsal')
await addTeamEntries('Basketball 3x3 Open', 'basketball')
await addPlayerEntries('Table Tennis Open Singles', players.slice(16, 28))
await addPlayerEntries('Rapid Chess League', players.slice(28, 36))
await addPlayerEntries('100m Sprint Open', players.slice(36, 52))
await addTeamEntries('MLBB Open', 'mlbb')
await addPlayerEntries('Archery Open Ranking', players.slice(52, 68))

const friendlyCategory = categories.get('Futsal Friendship Showcase')!
const friendlyEntries: Doc[] = []
for (let index = 0; index < 4; index += 1) {
  friendlyEntries.push(await ensureEntry(friendlyCategory, clubs[index].name, 'club', index + 1, { club_id: clubs[index].id }))
}
entriesByCategory.set('Futsal Friendship Showcase', friendlyEntries)

const venues = new Map<string, Doc>()
for (const [name, address, description] of [
  ['Gelora Bung Karno Complex', 'Jl. Pintu Satu Senayan, Jakarta', 'Main stadium, futsal arenas, track, and ceremony venue.'],
  ['Istora Multi-Sport Hall', 'Senayan, Jakarta', 'Badminton and basketball competition hall.'],
  ['JIExpo Competition Hall', 'Kemayoran, Jakarta', 'Table tennis, chess, and esports hall.'],
  ['Nusantara Archery Ground', 'Jakarta International Sports Complex', 'Outdoor ranking and finals range.'],
] as const) {
  venues.set(
    name,
    await ensureByEventName('venues', eventId, name, {
      event_id: eventId,
      name,
      address,
      description,
      map_url: 'https://maps.google.com/?q=Jakarta+International+Sports+Complex',
      is_virtual: false,
    }),
  )
}

const courts = new Map<string, Doc>()
const courtSeeds: Array<[string, string, string, number]> = [
  ...[1, 2, 3, 4].map((n) => [`Badminton Court ${n}`, 'Istora Multi-Sport Hall', 'Badminton', 800] as [string, string, string, number]),
  ...[1, 2].map((n) => [`Futsal Arena ${n}`, 'Gelora Bung Karno Complex', 'Futsal', 2500] as [string, string, string, number]),
  ...[1, 2, 3].map((n) => [`Basketball 3x3 Court ${n}`, 'Istora Multi-Sport Hall', 'Basketball 3x3', 1000] as [string, string, string, number]),
  ...[1, 2, 3, 4].map((n) => [`Table Tennis Table ${n}`, 'JIExpo Competition Hall', 'Table Tennis', 250] as [string, string, string, number]),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`Chess Board ${n}`, 'JIExpo Competition Hall', 'Chess', 40] as [string, string, string, number]),
  ['Athletics Track', 'Gelora Bung Karno Complex', 'Athletics', 12000],
  ...[1, 2, 3, 4].map((n) => [`Esports Stage ${n}`, 'JIExpo Competition Hall', 'Mobile Legends', 500] as [string, string, string, number]),
  ...[1, 2].map((n) => [`Archery Range ${n}`, 'Nusantara Archery Ground', 'Archery', 700] as [string, string, string, number]),
]
for (const [name, venueName, sportName, capacity] of courtSeeds) {
  const court = await ensureByEventName('courts', eventId, name, {
    event_id: eventId,
    venue_id: venues.get(venueName)!.id,
    sport_id: sports.get(sportName)!.id,
    name,
    capacity,
    is_active: true,
  })
  courts.set(name, court)
}

const ensureStage = async (categoryName: string, name: string, stageType: string, order: number, status = 'published') => {
  const category = categories.get(categoryName)!
  const existing = await findOne('stages', {
    and: [{ category_id: { equals: category.id } }, { order: { equals: order } }],
  })
  const data = { event_id: eventId, category_id: category.id, name, stage_type: stageType, order, status }
  return existing
    ? ((await db.update({ collection: 'stages', id: existing.id, data })) as Doc)
    : ((await db.create({ collection: 'stages', data })) as Doc)
}

const ensureGroup = async (stage: Doc, name: string, order: number) => {
  const existing = await findOne('groups', {
    and: [{ stage_id: { equals: stage.id } }, { name: { equals: name } }],
  })
  const data = { event_id: eventId, stage_id: stage.id, name, order }
  return existing
    ? ((await db.update({ collection: 'groups', id: existing.id, data })) as Doc)
    : ((await db.create({ collection: 'groups', data })) as Doc)
}

const jakartaIso = (dayOffset: number, hour: number, minute = 0) => {
  const calendarDay = new Date(Date.UTC(2026, 6, 15 + dayOffset))
  const date = [
    calendarDay.getUTCFullYear(),
    String(calendarDay.getUTCMonth() + 1).padStart(2, '0'),
    String(calendarDay.getUTCDate()).padStart(2, '0'),
  ].join('-')
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`
}
const addMinutes = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()

const ensureMatch = async (generationKey: string, data: Record<string, unknown>): Promise<Doc> => {
  const existing = await findOne('matches', { generation_key: { equals: generationKey } })
  if (existing) {
    return (await db.update({
      collection: 'matches',
      id: existing.id,
      data: { ...data, match_number: existing.match_number },
      overrideAccess: true,
      user: adminUser,
    })) as Doc
  }
  return (await db.create({ collection: 'matches', data: { ...data, generation_key: generationKey } })) as Doc
}

const categoryCode = new Map([
  ['Badminton Men Singles', 'BMS'], ['Badminton Mixed Doubles', 'BMD'],
  ['Futsal Open Championship', 'FUT'], ['Basketball 3x3 Open', 'B3X3'],
  ['Table Tennis Open Singles', 'TTO'], ['Rapid Chess League', 'CHS'],
  ['Futsal Friendship Showcase', 'FRI'],
])

const generateSingleElimination = async (
  categoryName: string,
  stage: Doc,
  entryDocs: Doc[],
  courtNames: string[],
  roundDayOffsets: number[],
  startHour = 9,
) => {
  const category = categories.get(categoryName)!
  const sport = sports.get(categoryName.startsWith('Badminton') ? 'Badminton' : categoryName.startsWith('Table') ? 'Table Tennis' : 'Futsal')!
  const schedulable = getSchedulableEntries(entryDocs as MatchGenerationEntry[])
  const plan = buildSingleEliminationBracketPlan(schedulable)
  const bracketSize = Math.max(2, 2 ** Math.ceil(Math.log2(schedulable.length)))
  const totalRounds = Math.log2(bracketSize)
  const ids = new Map<string, string | number>()
  const byeWinners: Array<{ match: Doc; winnerId: string | number }> = []
  for (let round = 0; round < totalRounds; round += 1) {
    const roundPlans = plan.filter((item) => item.round === round)
    const remaining = totalRounds - 1 - round
    const roundName = remaining === 0 ? 'Final' : remaining === 1 ? 'Semifinal' : remaining === 2 ? 'Quarterfinal' : `Round of ${2 ** (remaining + 1)}`
    for (const item of roundPlans) {
      const court = courts.get(courtNames[item.matchIndex % courtNames.length])!
      const start = jakartaIso(
        roundDayOffsets[round] ?? roundDayOffsets.at(-1) ?? 0,
        startHour + Math.floor(item.matchIndex / courtNames.length),
      )
      const winner = item.isBye ? (item.participantA || item.participantB)!.id : undefined
      const key = `${EVENT_SLUG}:${category.slug}:${stage.id}:r${round}:m${item.matchIndex}`
      const match = await ensureMatch(key, {
        event_id: eventId,
        sport_id: sport.id,
        category_id: category.id,
        stage_id: stage.id,
        round_name: roundName,
        match_number: `NGG26-${categoryCode.get(categoryName)}-R${round + 1}-M${String(item.matchIndex + 1).padStart(2, '0')}`,
        participant_a_entry_id: item.participantA?.id,
        participant_b_entry_id: item.participantB?.id,
        scheduled_start_at: item.isBye ? null : new Date(start).toISOString(),
        scheduled_end_at: item.isBye ? null : addMinutes(start, categoryName.startsWith('Futsal') ? 60 : 50),
        venue_id: item.isBye ? null : court.venue_id,
        court_id: item.isBye ? null : court.id,
        status: item.isBye ? 'walkover' : 'published',
        winner_entry_id: winner,
        score_summary: item.isBye ? 'Bye' : undefined,
        generation_source: 'single_elimination',
        is_public: true,
        documentation_status: item.isBye ? 'not_required' : 'not_started',
      })
      ids.set(`${round}:${item.matchIndex}`, match.id)
      if (winner) byeWinners.push({ match, winnerId: winner })
      if (round > 0) {
        for (const [parentIndex, slot] of [[item.matchIndex * 2, 'a'], [item.matchIndex * 2 + 1, 'b']] as const) {
          const parentId = ids.get(`${round - 1}:${parentIndex}`)
          if (parentId) await db.update({ collection: 'matches', id: parentId, data: { next_match_id: match.id, next_match_slot: slot } })
        }
      }
    }
  }
  for (const { match, winnerId } of byeWinners) {
    const refreshed = await db.findByID({ collection: 'matches', id: match.id, depth: 0 })
    if (refreshed.next_match_id && refreshed.next_match_slot) {
      await db.update({
        collection: 'matches',
        id: refreshed.next_match_id,
        data: refreshed.next_match_slot === 'a' ? { participant_a_entry_id: winnerId } : { participant_b_entry_id: winnerId },
      })
    }
  }
  await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
}

const generateRoundRobin = async (
  categoryName: string,
  stage: Doc,
  entryDocs: Doc[],
  courtNames: string[],
  roundDayOffsets: number[],
  group?: Doc,
  startHour = 8,
) => {
  const category = categories.get(categoryName)!
  const sportName = categoryName.startsWith('Badminton') ? 'Badminton'
    : categoryName.startsWith('Basketball') ? 'Basketball 3x3'
    : categoryName.startsWith('Rapid Chess') ? 'Chess'
    : 'Futsal'
  const sport = sports.get(sportName)!
  const ordered = getSchedulableEntries(entryDocs as MatchGenerationEntry[])
  const rotating: Array<MatchGenerationEntry | null> = ordered.length % 2 === 0 ? [...ordered] : [...ordered, null]
  const pairings: Array<{ participantA: MatchGenerationEntry; participantB: MatchGenerationEntry; roundName: string; roundIndex: number; position: number }> = []
  for (let roundIndex = 0; roundIndex < rotating.length - 1; roundIndex += 1) {
    for (let position = 0; position < rotating.length / 2; position += 1) {
      const participantA = rotating[position]
      const participantB = rotating[rotating.length - 1 - position]
      if (participantA && participantB) {
        pairings.push({ participantA, participantB, roundName: `Round Robin Round ${roundIndex + 1}`, roundIndex, position })
      }
    }
    const fixed = rotating[0]
    const moved = rotating.pop()!
    rotating.splice(1, 0, moved)
    rotating[0] = fixed
  }
  for (let index = 0; index < pairings.length; index += 1) {
    const pairing = pairings[index]
    const court = courts.get(courtNames[pairing.position % courtNames.length])!
    const roundIntervalMinutes = sportName === 'Futsal' ? 75 : 60
    const start = addMinutes(
      jakartaIso(roundDayOffsets[pairing.roundIndex] ?? roundDayOffsets.at(-1) ?? 0, startHour),
      pairing.position * roundIntervalMinutes,
    )
    const groupCode = group ? `-${String(group.name).replaceAll(' ', '').toUpperCase()}` : ''
    const pairKey = [String(pairing.participantA.id), String(pairing.participantB.id)]
      .sort((a, b) => Number(a) - Number(b))
      .join('-')
    await ensureMatch(`${EVENT_SLUG}:${category.slug}:${stage.id}:${group?.id || 'all'}:${pairKey}`, {
      event_id: eventId,
      sport_id: sport.id,
      category_id: category.id,
      stage_id: stage.id,
      group_id: group?.id,
      round_name: pairing.roundName,
      match_number: `NGG26-${categoryCode.get(categoryName)}${groupCode}-M${String(index + 1).padStart(2, '0')}`,
      participant_a_entry_id: pairing.participantA.id,
      participant_b_entry_id: pairing.participantB.id,
      scheduled_start_at: new Date(start).toISOString(),
      scheduled_end_at: addMinutes(start, sportName === 'Chess' ? 45 : sportName === 'Futsal' ? 60 : 40),
      venue_id: court.venue_id,
      court_id: court.id,
      status: 'published',
      generation_source: 'round_robin',
      is_public: true,
      documentation_status: 'not_started',
    })
  }
  await recalculateStandingsForScope(payload, {
    eventId,
    categoryId: category.id,
    stageId: stage.id,
    groupId: group?.id,
  })
}

const bmsStage = await ensureStage('Badminton Men Singles', 'Men Singles Main Draw', 'single_elimination', 1)
await generateSingleElimination('Badminton Men Singles', bmsStage, entriesByCategory.get('Badminton Men Singles')!, ['Badminton Court 1', 'Badminton Court 2', 'Badminton Court 3', 'Badminton Court 4'], [0, 9, 25, 47])

const bmdStage = await ensureStage('Badminton Mixed Doubles', 'Mixed Doubles Round Robin', 'round_robin', 1)
await generateRoundRobin('Badminton Mixed Doubles', bmdStage, entriesByCategory.get('Badminton Mixed Doubles')!, ['Badminton Court 1', 'Badminton Court 2', 'Badminton Court 3'], [2, 9, 16, 23, 30], undefined, 14)

const futsalGroupStage = await ensureStage('Futsal Open Championship', 'Futsal Group Stage', 'group_stage', 1)
const futsalEntries = entriesByCategory.get('Futsal Open Championship')!
const groupA = await ensureGroup(futsalGroupStage, 'Group A', 1)
const groupB = await ensureGroup(futsalGroupStage, 'Group B', 2)
await generateRoundRobin('Futsal Open Championship', futsalGroupStage, futsalEntries.slice(0, 4), ['Futsal Arena 1', 'Futsal Arena 2'], [1, 8, 15], groupA, 8)
await generateRoundRobin('Futsal Open Championship', futsalGroupStage, futsalEntries.slice(4, 8), ['Futsal Arena 1', 'Futsal Arena 2'], [1, 8, 15], groupB, 12)
const futsalKnockout = await ensureStage('Futsal Open Championship', 'Futsal Championship Knockout', 'single_elimination', 2)
await generateSingleElimination('Futsal Open Championship', futsalKnockout, [futsalEntries[0], futsalEntries[4], futsalEntries[1], futsalEntries[5]], ['Futsal Arena 1', 'Futsal Arena 2'], [32, 47])

const basketballStage = await ensureStage('Basketball 3x3 Open', 'Basketball 3x3 Round Robin', 'round_robin', 1)
await generateRoundRobin('Basketball 3x3 Open', basketballStage, entriesByCategory.get('Basketball 3x3 Open')!, ['Basketball 3x3 Court 1', 'Basketball 3x3 Court 2', 'Basketball 3x3 Court 3'], [3, 10, 18, 26, 34])

const tableStage = await ensureStage('Table Tennis Open Singles', 'Table Tennis Main Draw', 'single_elimination', 1)
await generateSingleElimination('Table Tennis Open Singles', tableStage, entriesByCategory.get('Table Tennis Open Singles')!, ['Table Tennis Table 1', 'Table Tennis Table 2', 'Table Tennis Table 3', 'Table Tennis Table 4'], [1, 10, 31, 46])

const chessStage = await ensureStage('Rapid Chess League', 'Rapid Chess League', 'league', 1)
await generateRoundRobin('Rapid Chess League', chessStage, entriesByCategory.get('Rapid Chess League')!, ['Chess Board 1', 'Chess Board 2', 'Chess Board 3', 'Chess Board 4', 'Chess Board 5', 'Chess Board 6', 'Chess Board 7', 'Chess Board 8'], [0, 7, 14, 18, 25, 32, 42])

await ensureStage('100m Sprint Open', '100m Qualification Heats', 'time_trial', 1, 'draft')
await ensureStage('MLBB Open', 'MLBB Double Elimination', 'double_elimination', 1, 'draft')
await ensureStage('Archery Open Ranking', 'Archery Ranking Round', 'score_ranking', 1, 'draft')

const friendlyStage = await ensureStage('Futsal Friendship Showcase', 'Friendship Showcase', 'friendly', 1)
for (let index = 0; index < 2; index += 1) {
  const court = courts.get(`Futsal Arena ${index + 1}`)!
  const start = jakartaIso(0, 19)
  await ensureMatch(`${EVENT_SLUG}:friendly:${index + 1}`, {
    event_id: eventId,
    sport_id: sports.get('Futsal')!.id,
    category_id: friendlyCategory.id,
    stage_id: friendlyStage.id,
    round_name: 'Exhibition',
    match_number: `NGG26-FRI-M0${index + 1}`,
    participant_a_entry_id: friendlyEntries[index * 2].id,
    participant_b_entry_id: friendlyEntries[index * 2 + 1].id,
    scheduled_start_at: new Date(start).toISOString(),
    scheduled_end_at: addMinutes(start, 60),
    venue_id: court.venue_id,
    court_id: court.id,
    status: 'published',
    generation_source: 'manual',
    is_public: true,
    documentation_status: 'not_required',
  })
}

// Seed a deterministic "tournament in progress" snapshot as of 2 August 2026. The event runs
// from 15 July through 31 August: early rounds have official results, today's programme contains
// live/paused/finished-but-unpublished matches, a few fixtures are postponed, and later rounds
// remain published but unplayed. Keeping this in the main idempotent seed makes a rerun restore the
// same credible operational state instead of silently returning every match to "published".
type SeededSetScore = {
  participantAScore: number
  participantBScore: number
  winnerSide?: 'a' | 'b'
  notes?: string
}

const relationshipId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return (value as { id?: string | number }).id
  }
  return undefined
}

const replaceSeededMatchSets = async (match: Doc, setScores: SeededSetScore[]) => {
  const existing = await db.find({
    collection: 'match-sets',
    depth: 0,
    limit: 50,
    where: { match_id: { equals: match.id } },
    sort: 'set_number',
  })
  const participantAId = relationshipId(match.participant_a_entry_id)
  const participantBId = relationshipId(match.participant_b_entry_id)

  for (let index = 0; index < setScores.length; index += 1) {
    const score = setScores[index]
    const winnerId =
      score.winnerSide === 'a' ? participantAId
      : score.winnerSide === 'b' ? participantBId
      : null
    const data = {
      event_id: eventId,
      match_id: match.id,
      set_number: index + 1,
      participant_a_score: score.participantAScore,
      participant_b_score: score.participantBScore,
      winner_entry_id: winnerId,
      notes: score.notes || 'Seeded Nusantara live-tournament scenario.',
    }
    const current = existing.docs.find((set: Doc) => Number(set.set_number) === index + 1)
    if (current) {
      await db.update({
        collection: 'match-sets',
        id: current.id,
        data,
        overrideAccess: true,
        user: adminUser,
      })
    } else {
      await db.create({
        collection: 'match-sets',
        data,
        overrideAccess: true,
        user: adminUser,
      })
    }
  }

  for (const staleSet of existing.docs.filter((set: Doc) => Number(set.set_number) > setScores.length)) {
    await db.delete({
      collection: 'match-sets',
      id: staleSet.id,
      overrideAccess: true,
      user: adminUser,
    })
  }
}

const scoreSeedForMatch = (
  categoryName: string,
  match: Doc,
  serial: number,
): { sets: SeededSetScore[]; summary: string; winnerId?: string | number } => {
  const participantAId = relationshipId(match.participant_a_entry_id)
  const participantBId = relationshipId(match.participant_b_entry_id)
  const winnerSide: 'a' | 'b' = serial % 2 === 0 ? 'b' : 'a'
  const winnerId = winnerSide === 'a' ? participantAId : participantBId

  if (categoryName.startsWith('Badminton')) {
    const base = serial % 3 === 0
      ? [[21, 16], [18, 21], [21, 14]]
      : [[21, 17], [21, 19]]
    const scores = winnerSide === 'a' ? base : base.map(([a, b]) => [b, a])
    return {
      sets: scores.map(([a, b]) => ({
        participantAScore: a,
        participantBScore: b,
        winnerSide: a > b ? 'a' : 'b',
      })),
      summary: scores.map(([a, b]) => `${a}-${b}`).join(', '),
      winnerId,
    }
  }

  if (categoryName.startsWith('Table Tennis')) {
    const base = serial % 2 === 0
      ? [[11, 7], [8, 11], [11, 6], [11, 9]]
      : [[11, 5], [11, 8], [11, 9]]
    const scores = winnerSide === 'a' ? base : base.map(([a, b]) => [b, a])
    return {
      sets: scores.map(([a, b]) => ({
        participantAScore: a,
        participantBScore: b,
        winnerSide: a > b ? 'a' : 'b',
      })),
      summary: scores.map(([a, b]) => `${a}-${b}`).join(', '),
      winnerId,
    }
  }

  if (categoryName.startsWith('Basketball')) {
    const [a, b] = winnerSide === 'a' ? [21, 17] : [18, 21]
    return {
      sets: [{ participantAScore: a, participantBScore: b, winnerSide }],
      summary: `${a}-${b}`,
      winnerId,
    }
  }

  if (categoryName.startsWith('Rapid Chess')) {
    if (serial % 3 === 0) {
      return {
        sets: [{ participantAScore: 0.5, participantBScore: 0.5 }],
        summary: '½-½',
      }
    }
    const [a, b] = winnerSide === 'a' ? [1, 0] : [0, 1]
    return {
      sets: [{ participantAScore: a, participantBScore: b, winnerSide }],
      summary: `${a}-${b}`,
      winnerId,
    }
  }

  const isGroupStage = String(relationshipId(match.stage_id)) === String(futsalGroupStage.id)
  if (isGroupStage && serial % 4 === 0) {
    return {
      sets: [{ participantAScore: 2, participantBScore: 2 }],
      summary: '2-2',
    }
  }
  const [a, b] = winnerSide === 'a' ? [3, 1] : [1, 2]
  return {
    sets: [{ participantAScore: a, participantBScore: b, winnerSide }],
    summary: `${a}-${b}`,
    winnerId,
  }
}

type ScenarioStatus =
  | 'result_published'
  | 'ongoing'
  | 'paused'
  | 'finished'
  | 'under_review'
  | 'ready_to_start'
  | 'postponed'
  | 'published'

const scenarioStatusForMatch = (
  categoryName: string,
  match: Doc,
  roundPosition: number,
): ScenarioStatus => {
  const eliminationRound = Number(/-R(\d+)-M/.exec(String(match.match_number))?.[1] || 0)
  const serial = Number(/-M(\d+)$/.exec(String(match.match_number))?.[1] || 0)
  const roundRobinRound = Number(/Round (\d+)$/.exec(String(match.round_name))?.[1] || 0)
  const stageId = String(relationshipId(match.stage_id) || '')

  if (categoryName === 'Badminton Men Singles') {
    if (eliminationRound === 1) return 'result_published'
    if (eliminationRound === 2 && roundPosition <= 1) return 'result_published'
    if (eliminationRound === 2 && roundPosition === 2) return 'under_review'
    if (eliminationRound === 2 && roundPosition === 3) return 'postponed'
    return 'published'
  }
  if (categoryName === 'Badminton Mixed Doubles') {
    return roundRobinRound <= 3 ? 'result_published' : 'published'
  }
  if (categoryName === 'Futsal Open Championship') {
    return stageId === String(futsalGroupStage.id) ? 'result_published' : 'published'
  }
  if (categoryName === 'Basketball 3x3 Open') {
    if (roundRobinRound <= 2) return 'result_published'
    if (roundRobinRound === 3) {
      return roundPosition === 0 ? 'ongoing' : roundPosition === 1 ? 'paused' : 'ready_to_start'
    }
    return 'published'
  }
  if (categoryName === 'Table Tennis Open Singles') {
    return eliminationRound <= 2 ? 'result_published' : 'published'
  }
  if (categoryName === 'Rapid Chess League') {
    if (roundRobinRound <= 3) return 'result_published'
    if (roundRobinRound === 4) {
      return roundPosition === 0 ? 'ongoing' : roundPosition === 1 ? 'paused' : roundPosition === 2 ? 'finished' : 'postponed'
    }
    return 'published'
  }
  if (categoryName === 'Futsal Friendship Showcase') {
    return serial === 1 ? 'result_published' : 'postponed'
  }
  return 'published'
}

const categoryNameById = new Map(
  Array.from(categories.entries()).map(([name, category]) => [String(category.id), name]),
)
const seededMatches = await db.find({
  collection: 'matches',
  depth: 0,
  limit: 500,
  pagination: false,
  where: { event_id: { equals: eventId } },
  sort: ['scheduled_start_at', 'match_number'],
})
const matchesByRound = new Map<string, Doc[]>()
for (const match of seededMatches.docs as Doc[]) {
  const key = [
    relationshipId(match.category_id),
    relationshipId(match.stage_id),
    match.round_name || 'no-round',
  ].join(':')
  const roundMatches = matchesByRound.get(key) || []
  roundMatches.push(match)
  matchesByRound.set(key, roundMatches)
}
const roundPositionByMatchId = new Map<string, number>()
for (const roundMatches of matchesByRound.values()) {
  roundMatches
    .sort((left, right) => String(left.match_number).localeCompare(String(right.match_number)))
    .forEach((match, index) => roundPositionByMatchId.set(String(match.id), index))
}

for (const initialMatch of seededMatches.docs as Doc[]) {
  const match = (await db.findByID({ collection: 'matches', id: initialMatch.id, depth: 0 })) as Doc
  if (match.status === 'walkover') continue

  const categoryName = categoryNameById.get(String(relationshipId(match.category_id)))
  if (!categoryName) continue
  const scenarioStatus = scenarioStatusForMatch(
    categoryName,
    match,
    roundPositionByMatchId.get(String(match.id)) || 0,
  )
  const serial = Number(/-M(\d+)$/.exec(String(match.match_number))?.[1] || 1)
  const scheduledStart = match.scheduled_start_at ? new Date(match.scheduled_start_at).getTime() : Date.now()
  const actualStartAt = new Date(scheduledStart + 2 * 60_000).toISOString()
  const fullScore = scoreSeedForMatch(categoryName, match, serial)

  let scoreSummary: string | null = null
  let winnerEntryId: string | number | null = null
  let actualEndAt: string | null = null
  let documentationStatus = 'not_started'
  let setScores: SeededSetScore[] = []

  if (scenarioStatus === 'result_published') {
    scoreSummary = fullScore.summary
    winnerEntryId = fullScore.winnerId || null
    actualEndAt = new Date(scheduledStart + 43 * 60_000).toISOString()
    documentationStatus = 'approved'
    setScores = fullScore.sets
  } else if (scenarioStatus === 'under_review' || scenarioStatus === 'finished') {
    scoreSummary = `${fullScore.summary} · ${scenarioStatus === 'under_review' ? 'under review' : 'awaiting publication'}`
    actualEndAt = new Date(scheduledStart + 48 * 60_000).toISOString()
    documentationStatus = 'submitted'
    setScores = fullScore.sets
  } else if (scenarioStatus === 'ongoing') {
    scoreSummary = categoryName.startsWith('Basketball') ? '14-12 · 06:21 remaining' : 'Live · 24 minutes played'
    documentationStatus = 'needed'
    setScores = categoryName.startsWith('Basketball')
      ? [{ participantAScore: 14, participantBScore: 12, notes: 'Live partial score.' }]
      : []
  } else if (scenarioStatus === 'paused') {
    scoreSummary = categoryName.startsWith('Basketball') ? '9-9 · paused' : 'Paused after 18 minutes'
    documentationStatus = 'needed'
    setScores = categoryName.startsWith('Basketball')
      ? [{ participantAScore: 9, participantBScore: 9, notes: 'Paused partial score.' }]
      : []
  } else if (scenarioStatus === 'postponed') {
    scoreSummary = 'Postponed · revised time to be announced'
    documentationStatus = 'needed'
  }

  await replaceSeededMatchSets(match, setScores)
  await db.update({
    collection: 'matches',
    id: match.id,
    data: {
      status: scenarioStatus,
      actual_start_at:
        ['result_published', 'under_review', 'finished', 'ongoing', 'paused'].includes(scenarioStatus)
          ? actualStartAt
          : null,
      actual_end_at: actualEndAt,
      winner_entry_id: winnerEntryId,
      score_summary: scoreSummary,
      documentation_status: documentationStatus,
    },
    overrideAccess: true,
    user: adminUser,
  })

  if (scenarioStatus === 'result_published') {
    await attemptSingleEliminationWinnerAdvancement(payload, match.id)
  }
}

await db.update({
  collection: 'stages',
  id: futsalGroupStage.id,
  data: { status: 'completed' },
})

for (const stage of [bmdStage, basketballStage, chessStage]) {
  await recalculateStandingsForScope(payload, {
    eventId,
    categoryId: relationshipId(stage.category_id)!,
    stageId: stage.id,
  })
}
for (const group of [groupA, groupB]) {
  await recalculateStandingsForScope(payload, {
    eventId,
    categoryId: relationshipId(futsalGroupStage.category_id)!,
    stageId: futsalGroupStage.id,
    groupId: group.id,
  })
}
for (const stage of [bmsStage, tableStage, futsalKnockout]) {
  await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
}

await ensureBySlug('announcements', `${PREFIX}welcome`, {
  event_id: eventId,
  title: 'Welcome to Nusantara Grand Games 2026',
  summary: 'The official event hub is open for athletes, clubs, families, and supporters.',
  body: 'Use this website to follow schedules, venues, standings, brackets, and official tournament updates throughout the seven-week festival.',
  urgency: 'info',
  display_mode: 'feed',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-06-15T02:00:00.000Z',
  expires_at: '2026-09-01T16:59:00.000Z',
  cta_label: 'Explore the sports',
  cta_url: `/events/${EVENT_SLUG}/sports`,
  share_title: 'Nusantara Grand Games 2026',
  share_description: 'Follow schedules, standings, and brackets from 15 July-31 August 2026.',
})

await ensureBySlug('announcements', `${PREFIX}schedule-published`, {
  event_id: eventId,
  title: 'Competition schedule is now available',
  summary: 'Match times and venues for the supported competition formats have been published.',
  body: 'Teams and athletes should review their match pages and arrive at the assigned venue at least 30 minutes before the scheduled start.',
  urgency: 'info',
  display_mode: 'banner',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-07-10T03:00:00.000Z',
  expires_at: '2026-08-31T14:00:00.000Z',
  cta_label: 'View the schedule',
  cta_url: `/events/${EVENT_SLUG}/schedule`,
  share_title: 'Nusantara Grand Games schedule published',
  share_description: 'Check the official match schedule and venue assignments.',
})

await ensureBySlug('announcements', `${PREFIX}opening-week-complete`, {
  event_id: eventId,
  title: 'Opening week results are official',
  summary: 'The first badminton, table-tennis, basketball, chess, and futsal results are now available.',
  body: 'Nusantara Grand Games has been underway since 15 July. Follow each category page for official scores, updated standings, and the road to the finals on 31 August.',
  urgency: 'info',
  display_mode: 'feed',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-07-21T12:00:00.000Z',
  expires_at: '2026-09-01T16:59:00.000Z',
  cta_label: 'View results',
  cta_url: `/events/${EVENT_SLUG}/schedule`,
  share_title: 'Opening week results are official',
  share_description: 'See the first official Nusantara Grand Games results and standings.',
})

await ensureBySlug('announcements', `${PREFIX}mid-event-update`, {
  event_id: eventId,
  title: 'Nusantara Grand Games reaches the halfway mark',
  summary: 'Group play is taking shape while knockout contenders continue their run toward the finals.',
  body: 'Official results have been published across the active categories. Some matches remain live or under review, and upcoming rounds continue through 31 August.',
  urgency: 'info',
  display_mode: 'feed',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-08-01T10:00:00.000Z',
  expires_at: '2026-09-01T16:59:00.000Z',
  cta_label: 'Follow live progress',
  cta_url: `/events/${EVENT_SLUG}/schedule`,
  share_title: 'Nusantara Grand Games halfway update',
  share_description: 'Results, live matches, and upcoming fixtures through 31 August 2026.',
})

await ensureBySlug('announcements', `${PREFIX}postponed-fixtures`, {
  event_id: eventId,
  title: 'Selected fixtures postponed',
  summary: 'A small number of fixtures are awaiting revised times. All other published matches continue as scheduled.',
  body: 'Affected participants will receive a revised schedule after venue and official availability is confirmed. Please use the official schedule page as the source of truth.',
  urgency: 'warning',
  display_mode: 'banner',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-08-02T03:30:00.000Z',
  expires_at: '2026-08-07T16:59:00.000Z',
  cta_label: 'Check match status',
  cta_url: `/events/${EVENT_SLUG}/schedule`,
  share_title: 'Nusantara Grand Games fixture update',
  share_description: 'Check the official schedule for postponed fixtures and revised times.',
})

const summaryCollections = [
  'sports', 'rulesets', 'competition-categories', 'clubs', 'teams', 'players', 'rosters',
  'competition-entries', 'venues', 'courts', 'stages', 'groups', 'matches', 'match-sets', 'standings', 'brackets',
  'announcements',
]
const summary: Record<string, number> = {}
for (const collection of summaryCollections) {
  const result = await db.count({ collection, where: { event_id: { equals: eventId } } })
  summary[collection] = result.totalDocs
}

const finalMatches = await db.find({
  collection: 'matches',
  depth: 0,
  limit: 500,
  pagination: false,
  where: { event_id: { equals: eventId } },
})
const matchStatusSummary = (finalMatches.docs as Doc[]).reduce<Record<string, number>>((counts, match) => {
  const status = String(match.status)
  counts[status] = (counts[status] || 0) + 1
  return counts
}, {})

console.log(JSON.stringify({
  event: {
    id: eventId,
    name: event.name,
    slug: event.slug,
    period: '15 July-31 August 2026',
    status: 'live',
    scenario_as_of: '2026-08-02',
  },
  summary,
  matchStatusSummary,
}, null, 2))
process.exit(0)
