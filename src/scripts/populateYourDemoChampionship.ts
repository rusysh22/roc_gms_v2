/**
 * Seed script: "YDC 2026 - Your Demo Championship 2026".
 *
 * A full demo event held in Jakarta from 1-30 September 2026, organised by "YDC Event Organizer".
 * It materialises every sport + event from the New Event wizard's category-suggestion catalog
 * (src/lib/sportCatalog.ts) as real Sports / Rulesets / Competition Categories, then fills them
 * with a deep set of clubs, players, teams, pairs, competition entries, stages, groups, fixtures,
 * scores and standings.
 *
 * Operational snapshot the script freezes:
 *   - matches played on 1 September 2026 are finished (result_published, with scores + winner)
 *   - matches on 2 September 2026 are in progress (ongoing / paused, with a live partial score)
 *   - later fixtures stay published/scheduled and unplayed
 *
 * Idempotent: every write is find-or-create / update keyed by slug, name or generation_key, so a
 * rerun converges to the same state instead of duplicating rows.
 *
 * Run with:  npx payload run src/scripts/populateYourDemoChampionship.ts
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  buildSingleEliminationBracketPlan,
  getSchedulableEntries,
  type MatchGenerationEntry,
} from '@/lib/matchGeneration'
import { recalculateStandingsForScope } from '@/lib/standings'
import { SPORT_CATALOG } from '@/lib/sportCatalog'
import { attemptSingleEliminationWinnerAdvancement } from '@/lib/winnerAdvancement'

type Doc = Record<string, any> & { id: number | string }

const EVENT_SLUG = 'ydc-2026'
const PREFIX = `${EVENT_SLUG}-`
const CODE = 'YDC26'

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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

const relationshipId = (value: unknown): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id?: string | number }).id
  return undefined
}

const findOne = async (collection: string, where: Record<string, unknown>): Promise<Doc | undefined> => {
  const result = await db.find({ collection, depth: 0, limit: 1, where })
  return result.docs[0] as Doc | undefined
}

const ensureBySlug = async (
  collection: string,
  slug: string,
  data: Record<string, unknown>,
  scopeEventId?: number | string,
): Promise<Doc> => {
  const where =
    scopeEventId !== undefined
      ? { and: [{ event_id: { equals: scopeEventId } }, { slug: { equals: slug } }] }
      : { slug: { equals: slug } }
  const existing = await findOne(collection, where)
  if (existing) return (await db.update({ collection, id: existing.id, data })) as Doc
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
  if (existing) return (await db.update({ collection, id: existing.id, data })) as Doc
  return (await db.create({ collection, data: { ...data, event_id: eventId, name } })) as Doc
}

// --------------------------------------------------------------------------------------------------
// Event
// --------------------------------------------------------------------------------------------------
let event = await findOne('events', { slug: { equals: EVENT_SLUG } })
const eventData = {
  name: 'YDC 2026 (Your Demo Championship 2026)',
  slug: EVENT_SLUG,
  description:
    'Your Demo Championship 2026 is a month-long multi-sport festival staged across Jakarta through September 2026, featuring every sport and event offered in the InTourney category catalog - from racket sports and team ball games to mind sports, track, aquatics and esports.',
  hero_tagline: 'Every Sport. One Championship. One City.',
  event_start_at: '2026-09-01T00:00:00.000Z',
  event_end_at: '2026-09-30T15:00:00.000Z',
  public_open_at: '2026-07-01T00:00:00.000Z',
  registration_open_at: '2026-07-01T00:00:00.000Z',
  registration_close_at: '2026-08-20T16:59:00.000Z',
  schedule_publish_at: '2026-08-25T00:00:00.000Z',
  archive_at: '2026-10-31T16:59:00.000Z',
  timezone: 'Asia/Jakarta',
  status: 'live',
  visibility: 'published',
  location: 'Various venues across Jakarta, Indonesia',
  organizer_name: 'YDC Event Organizer',
  contact_email: 'committee@ydc-championship.test',
  rules_summary:
    'Participants must check in 45 minutes before their first fixture. Each sport follows its published ruleset. The tournament director may revise schedules for venue, safety or broadcast reasons. Disputes are handled by the competition jury and are final.',
  theme_config: { preset: 'sunrise' },
  medal_tally_enabled: true,
}
if (!event) {
  event = (await db.create({ collection: 'events', data: eventData })) as Doc
} else {
  event = (await db.update({ collection: 'events', id: event.id, data: eventData })) as Doc
}
const eventId = event.id

// --------------------------------------------------------------------------------------------------
// Sports + Rulesets + Categories, straight from the wizard catalog
// --------------------------------------------------------------------------------------------------
type FormatType =
  | 'single_elimination'
  | 'round_robin'
  | 'group_stage_to_knockout'
  | 'time_trial'
  | 'league'

const scoreTypeMap: Record<string, string> = {
  points: 'points',
  goals: 'goals',
  sets: 'sets',
  time: 'time',
  result: 'result',
  custom: 'custom',
}

const pickFormat = (
  catalogKey: string,
  mode: 'individual' | 'pair' | 'team' | 'club',
  scoreType: string,
): FormatType => {
  if (scoreType === 'time') return 'time_trial'
  if (catalogKey === 'chess' && mode === 'individual') return 'league'
  if (mode === 'team') {
    // The larger team ball games get a group stage then a knockout; smaller squads play a league.
    if (['futsal', 'football', 'volleyball', 'basketball'].includes(catalogKey)) {
      return 'group_stage_to_knockout'
    }
    return 'round_robin'
  }
  if (mode === 'pair') {
    return catalogKey === 'petanque' ? 'round_robin' : 'single_elimination'
  }
  return 'single_elimination'
}

const sportDocs = new Map<string, Doc>() // catalog key -> sport doc
const rulesetDocs = new Map<string, Doc>() // catalog key -> ruleset doc

type CategoryInfo = {
  doc: Doc
  code: string
  catalogKey: string
  mode: 'individual' | 'pair' | 'team' | 'club'
  format: FormatType
  gender: 'male' | 'female' | 'mixed'
  rosterSize: number
}
const categoryInfos: CategoryInfo[] = []
const usedCodes = new Set<string>()

const deriveCode = (base: string) => {
  let code = base.slice(0, 6)
  let suffix = 1
  while (usedCodes.has(code)) {
    code = `${base.slice(0, 4)}${suffix}`
    suffix += 1
  }
  usedCodes.add(code)
  return code
}

const genderOf = (eventName: string): 'male' | 'female' | 'mixed' => {
  const n = eventName.toLowerCase()
  if (n.includes('women') || n.includes("women's")) return 'female'
  if (n.includes('mixed')) return 'mixed'
  if (n.includes('men') || n.includes("men's")) return 'male'
  return 'mixed'
}

for (const sport of SPORT_CATALOG) {
  const sportDoc = await ensureBySlug(
    'sports',
    sport.key,
    {
      event_id: eventId,
      name: sport.name,
      description: `${sport.name} competition at YDC 2026.`,
      icon: sport.icon,
      sport_type: sport.sportType,
      is_active: true,
    },
    eventId,
  )
  sportDocs.set(sport.key, sportDoc)

  const r = sport.ruleset
  const rulesetDoc = await ensureBySlug(
    'rulesets',
    slugify(`${sport.key}-${r.name}`),
    {
      event_id: eventId,
      sport_id: sportDoc.id,
      name: r.name,
      description: `${r.summary}. Standard ruleset for ${sport.name} at YDC 2026.`,
      score_type: scoreTypeMap[r.scoreType] ?? 'points',
      set_based: r.setBased,
      best_of: r.bestOf,
      target_score: r.targetScore,
      max_score: r.maxScore,
      deuce_enabled: r.deuceEnabled ?? false,
      allow_draw: r.allowDraw ?? false,
      period_count: r.periodCount,
      period_duration: r.periodDuration,
      timer_enabled: Boolean(r.periodDuration) || r.scoreType === 'time',
      points_win: r.pointsWin,
      points_draw: r.pointsDraw,
      points_loss: r.pointsLoss,
      tie_breakers: r.tieBreakers,
    },
    eventId,
  )
  rulesetDocs.set(sport.key, rulesetDoc)
  await db.update({ collection: 'sports', id: sportDoc.id, data: { default_ruleset_id: rulesetDoc.id } })

  for (const catEvent of sport.events) {
    const name = `${sport.name} ${catEvent.name}`
    const format = pickFormat(sport.key, catEvent.participantMode, r.scoreType)
    const rosterSize = catEvent.minRosterSize ?? (catEvent.participantMode === 'pair' ? 2 : 1)
    const categoryDoc = await ensureBySlug(
      'competition-categories',
      slugify(name),
      {
        event_id: eventId,
        sport_id: sportDoc.id,
        name,
        participant_mode: catEvent.participantMode,
        format_type: format,
        roster_required: catEvent.rosterRequired ?? catEvent.participantMode !== 'individual',
        min_roster_size: catEvent.minRosterSize ?? (catEvent.participantMode === 'pair' ? 2 : 0),
        max_roster_size: catEvent.maxRosterSize ?? (catEvent.participantMode === 'pair' ? 2 : 1),
        ruleset_id: rulesetDoc.id,
        group_qualify_count: format === 'group_stage_to_knockout' ? 2 : undefined,
        third_place_policy: 'none',
        status: 'published',
      },
      eventId,
    )
    categoryInfos.push({
      doc: categoryDoc,
      code: deriveCode(CODE + slugify(catEvent.name).replaceAll('-', '').toUpperCase()).replace(CODE, `${CODE}-`),
      catalogKey: sport.key,
      mode: catEvent.participantMode,
      format,
      gender: genderOf(catEvent.name),
      rosterSize,
    })
  }
}

// Give every category a compact, unique match-number code: YDC26-<sportInitials><n>
const catCodeByCategoryId = new Map<string, string>()
{
  const seen = new Set<string>()
  for (const info of categoryInfos) {
    const sportInitials = SPORT_CATALOG.find((s) => s.key === info.catalogKey)!
      .name.replaceAll(/[^A-Za-z ]/g, '')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
    let n = 1
    let code = `${CODE}-${sportInitials}${n}`
    while (seen.has(code)) {
      n += 1
      code = `${CODE}-${sportInitials}${n}`
    }
    seen.add(code)
    catCodeByCategoryId.set(String(info.doc.id), code)
  }
}

// --------------------------------------------------------------------------------------------------
// Clubs + Players
// --------------------------------------------------------------------------------------------------
const clubSeeds: Array<[string, string]> = [
  ['Menteng Athletic Club', 'Jakarta Pusat'],
  ['Kemang United', 'Jakarta Selatan'],
  ['Kelapa Gading Stars', 'Jakarta Utara'],
  ['Cempaka Putih Raptors', 'Jakarta Pusat'],
  ['Senayan Elite', 'Jakarta Pusat'],
  ['Kuningan Falcons', 'Jakarta Selatan'],
  ['Pluit Mariners', 'Jakarta Utara'],
  ['Cakung Thunder', 'Jakarta Timur'],
  ['Grogol Panthers', 'Jakarta Barat'],
  ['Tebet Titans', 'Jakarta Selatan'],
  ['Sunter Waves', 'Jakarta Utara'],
  ['Matraman Bulls', 'Jakarta Timur'],
  ['Palmerah Rangers', 'Jakarta Barat'],
  ['Setiabudi Sabres', 'Jakarta Selatan'],
  ['Cilandak Cheetahs', 'Jakarta Selatan'],
  ['Cengkareng Eagles', 'Jakarta Barat'],
  ['Duren Sawit Dragons', 'Jakarta Timur'],
  ['Gambir Guardians', 'Jakarta Pusat'],
  ['Pademangan Pirates', 'Jakarta Utara'],
  ['Pesanggrahan Phoenix', 'Jakarta Selatan'],
]

const clubs: Doc[] = []
for (const [name, area] of clubSeeds) {
  clubs.push(
    await ensureBySlug(
      'clubs',
      slugify(name),
      {
        event_id: eventId,
        name,
        description: `${area}-based sports club fielding athletes across YDC 2026 disciplines.`,
        contact_person: `${name} Team Manager`,
        contact_email: `${slugify(name)}@ydc-championship.test`,
      },
      eventId,
    ),
  )
}

const maleFirst = [
  'Adit', 'Bagus', 'Candra', 'Dimas', 'Eka', 'Fajar', 'Gilang', 'Hendra', 'Irfan', 'Joko',
  'Krisna', 'Lucky', 'Miko', 'Nanda', 'Oka', 'Panji', 'Rangga', 'Satria', 'Teguh', 'Umar',
]
const femaleFirst = [
  'Ayu', 'Bunga', 'Cindy', 'Dewi', 'Elsa', 'Fitri', 'Gita', 'Hesti', 'Indah', 'Jelita',
  'Kartika', 'Laras', 'Mira', 'Nadia', 'Okta', 'Prita', 'Rani', 'Sari', 'Tari', 'Uni',
]
const lastNames = [
  'Wijaya', 'Saputra', 'Hidayat', 'Nugroho', 'Halim', 'Kurniawan', 'Susanto', 'Pranata',
  'Maulana', 'Firmansyah', 'Gunawan', 'Setiawan', 'Utami', 'Anggraini', 'Puspita', 'Rahayu',
]

// 12 players per club: 6 male, 6 female. -> 240 players total.
const playersByClubGender = new Map<string, { male: Doc[]; female: Doc[] }>()
const allPlayers: Doc[] = []
let playerCounter = 0
for (let c = 0; c < clubs.length; c += 1) {
  const club = clubs[c]
  const bucket = { male: [] as Doc[], female: [] as Doc[] }
  for (let g = 0; g < 12; g += 1) {
    const gender: 'male' | 'female' = g < 6 ? 'male' : 'female'
    const first = gender === 'male' ? maleFirst[(c + g) % maleFirst.length] : femaleFirst[(c + g) % femaleFirst.length]
    const last = lastNames[(c * 3 + g) % lastNames.length]
    playerCounter += 1
    const identification_number = `${CODE}-${String(playerCounter).padStart(4, '0')}`
    const name = `${first} ${last}`
    const data = {
      event_id: eventId,
      club_id: club.id,
      name,
      identification_number,
      email: `${slugify(name)}.${playerCounter}@athlete.ydc-championship.test`,
      phone: `+62812${String(3000000 + playerCounter).padStart(7, '0')}`,
      gender,
      bio: `Athlete for ${club.name} at YDC 2026.`,
      metadata: { bib: `${CODE}-${String(playerCounter).padStart(4, '0')}`, area: clubSeeds[c][1] },
    }
    const existing = await findOne('players', {
      and: [{ event_id: { equals: eventId } }, { identification_number: { equals: identification_number } }],
    })
    const player = existing
      ? ((await db.update({ collection: 'players', id: existing.id, data })) as Doc)
      : ((await db.create({ collection: 'players', data })) as Doc)
    bucket[gender].push(player)
    allPlayers.push(player)
  }
  playersByClubGender.set(String(club.id), bucket)
}

// --------------------------------------------------------------------------------------------------
// Venues + Courts (Jakarta)
// --------------------------------------------------------------------------------------------------
const venueSeeds: Array<[string, string, string, string]> = [
  [
    'Gelora Bung Karno Main Complex',
    'Jl. Pintu Satu Senayan, Gelora, Kec. Tanah Abang, Jakarta Pusat 10270',
    'Main stadium, outdoor football and futsal pitches, and the athletics track.',
    'https://maps.google.com/?q=Gelora+Bung+Karno+Stadium+Jakarta',
  ],
  [
    'Istora Senayan',
    'Jl. Pintu Satu Senayan, Gelora, Jakarta Pusat 10270',
    'Indoor arena for badminton, basketball and volleyball.',
    'https://maps.google.com/?q=Istora+Senayan+Jakarta',
  ],
  [
    'JIExpo Kemayoran Hall D',
    'Jl. Benyamin Sueb, Kemayoran, Jakarta Pusat 10620',
    'Exhibition hall for table tennis, chess, petanque and esports.',
    'https://maps.google.com/?q=JIExpo+Kemayoran+Jakarta',
  ],
  [
    'Stadion Akuatik GBK',
    'Kompleks Gelora Bung Karno, Jakarta Pusat 10270',
    'Olympic aquatics venue for the swimming programme.',
    'https://maps.google.com/?q=Stadion+Akuatik+Gelora+Bung+Karno',
  ],
  [
    'Lapangan Panahan Senayan',
    'Kompleks Gelora Bung Karno, Jakarta Pusat 10270',
    'Outdoor courts used for the tennis draw.',
    'https://maps.google.com/?q=Lapangan+Tenis+Senayan+Jakarta',
  ],
  [
    'GOR Ciracas',
    'Jl. Pendidikan No.1, Ciracas, Jakarta Timur 13740',
    'Community sports hall hosting overflow basketball and volleyball fixtures.',
    'https://maps.google.com/?q=GOR+Ciracas+Jakarta+Timur',
  ],
]

const venues = new Map<string, Doc>()
for (const [name, address, description, map_url] of venueSeeds) {
  venues.set(
    name,
    await ensureByEventName('venues', eventId, name, {
      event_id: eventId,
      name,
      address,
      description,
      map_url,
      is_virtual: false,
    }),
  )
}

// sport key -> [venueName, courtLabel, courtCount, capacity]
const courtPlan: Record<string, [string, string, number, number]> = {
  badminton: ['Istora Senayan', 'Badminton Court', 6, 500],
  table_tennis: ['JIExpo Kemayoran Hall D', 'Table Tennis Table', 8, 150],
  tennis: ['Lapangan Panahan Senayan', 'Tennis Court', 4, 600],
  volleyball: ['Istora Senayan', 'Volleyball Court', 2, 1200],
  futsal: ['Gelora Bung Karno Main Complex', 'Futsal Pitch', 3, 800],
  football: ['Gelora Bung Karno Main Complex', 'Football Field', 2, 30000],
  basketball: ['GOR Ciracas', 'Basketball Court', 4, 1000],
  petanque: ['JIExpo Kemayoran Hall D', 'Petanque Lane', 6, 100],
  chess: ['JIExpo Kemayoran Hall D', 'Chess Board', 10, 40],
  athletics: ['Gelora Bung Karno Main Complex', 'Athletics Track', 1, 12000],
  swimming: ['Stadion Akuatik GBK', 'Pool Lane', 1, 8000],
  esports: ['JIExpo Kemayoran Hall D', 'Esports Stage', 3, 400],
}

const courtsBySport = new Map<string, Doc[]>()
for (const [key, [venueName, label, count, capacity]] of Object.entries(courtPlan)) {
  const list: Doc[] = []
  for (let i = 1; i <= count; i += 1) {
    const courtName = count === 1 ? label : `${label} ${i}`
    list.push(
      await ensureByEventName('courts', eventId, courtName, {
        event_id: eventId,
        venue_id: venues.get(venueName)!.id,
        sport_id: sportDocs.get(key)!.id,
        name: courtName,
        capacity,
        is_active: true,
      }),
    )
  }
  courtsBySport.set(key, list)
}

// --------------------------------------------------------------------------------------------------
// Teams / pairs + rosters + competition entries per category
// --------------------------------------------------------------------------------------------------
const ensureTeam = async (
  club: Doc,
  info: CategoryInfo,
  suffix: string,
): Promise<Doc> => {
  const name = `${club.name} ${suffix}`
  return ensureBySlug(
    'teams',
    slugify(`${catCodeByCategoryId.get(String(info.doc.id))}-${club.name}`),
    {
      event_id: eventId,
      club_id: club.id,
      name,
      description: `${club.name} entry for ${info.doc.name}.`,
      contact_email: `${slugify(club.name)}@ydc-championship.test`,
    },
    eventId,
  )
}

const ensureRoster = async (team: Doc, player: Doc, categoryId: string | number, role: string) => {
  const existing = await findOne('rosters', {
    and: [
      { event_id: { equals: eventId } },
      { team_id: { equals: team.id } },
      { player_id: { equals: player.id } },
      { category_id: { equals: categoryId } },
    ],
  })
  const data = {
    event_id: eventId,
    team_id: team.id,
    player_id: player.id,
    category_id: categoryId,
    role,
    status: 'active',
  }
  if (existing) await db.update({ collection: 'rosters', id: existing.id, data })
  else await db.create({ collection: 'rosters', data })
}

const ensureEntry = async (
  info: CategoryInfo,
  displayName: string,
  seedNumber: number,
  links: Record<string, unknown>,
): Promise<Doc> => {
  const existing = await findOne('competition-entries', {
    and: [{ category_id: { equals: info.doc.id } }, { display_name: { equals: displayName } }],
  })
  const entryType = info.mode === 'individual' ? 'individual' : info.mode
  const data = {
    event_id: eventId,
    category_id: info.doc.id,
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

const pickPlayers = (clubIndex: number, gender: 'male' | 'female' | 'mixed', count: number): Doc[] => {
  const club = clubs[clubIndex % clubs.length]
  const bucket = playersByClubGender.get(String(club.id))!
  if (gender === 'mixed') {
    const mixed: Doc[] = []
    for (let i = 0; i < count; i += 1) mixed.push(i % 2 === 0 ? bucket.male[i % 6] : bucket.female[i % 6])
    return mixed
  }
  return bucket[gender].slice(0, count).length >= count
    ? bucket[gender].slice(0, count)
    : [...bucket[gender], ...bucket[gender]].slice(0, count)
}

const entriesByCategoryId = new Map<string, Doc[]>()

const SIZE_INDIVIDUAL = 8
const SIZE_GSK = 8
const SIZE_RR = 6

for (const info of categoryInfos) {
  const catId = String(info.doc.id)
  const suffix = info.doc.name.split(' ').slice(-2).join(' ')
  const entries: Doc[] = []

  if (info.mode === 'individual') {
    const size = info.format === 'time_trial' ? SIZE_INDIVIDUAL : SIZE_INDIVIDUAL
    for (let i = 0; i < size; i += 1) {
      const club = clubs[i % clubs.length]
      const bucket = playersByClubGender.get(String(club.id))!
      const pool = info.gender === 'female' ? bucket.female : bucket.male
      const player = pool[Math.floor(i / clubs.length) % pool.length]
      entries.push(
        await ensureEntry(info, `${player.name} (${club.name})`, i + 1, {
          player_id: player.id,
          club_id: club.id,
        }),
      )
    }
  } else {
    const size = info.format === 'round_robin' ? SIZE_RR : SIZE_GSK
    for (let i = 0; i < size; i += 1) {
      const club = clubs[i % clubs.length]
      const team = await ensureTeam(club, info, suffix)
      const roster = pickPlayers(i, info.gender, Math.max(2, info.rosterSize))
      for (let r = 0; r < roster.length; r += 1) {
        await ensureRoster(team, roster[r], info.doc.id, r === 0 ? 'captain' : 'player')
      }
      if (roster[0]) {
        await db.update({ collection: 'teams', id: team.id, data: { captain_player_id: roster[0].id } })
      }
      entries.push(
        await ensureEntry(info, team.name, i + 1, { team_id: team.id, club_id: club.id }),
      )
    }
  }
  entriesByCategoryId.set(catId, entries)
}

// --------------------------------------------------------------------------------------------------
// Stages, groups, fixtures + the 1-2 September operational snapshot
// --------------------------------------------------------------------------------------------------
const SEP = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(Date.UTC(2026, 8, 1 + dayOffset, hour - 7, minute)) // Asia/Jakarta = UTC+7
  return d.toISOString()
}
const addMinutes = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()

const ensureStage = async (
  categoryId: string | number,
  name: string,
  stageType: string,
  order: number,
  status = 'published',
): Promise<Doc> => {
  const existing = await findOne('stages', {
    and: [{ category_id: { equals: categoryId } }, { order: { equals: order } }],
  })
  const data = { event_id: eventId, category_id: categoryId, name, stage_type: stageType, order, status }
  return existing
    ? ((await db.update({ collection: 'stages', id: existing.id, data })) as Doc)
    : ((await db.create({ collection: 'stages', data })) as Doc)
}

const ensureGroup = async (stage: Doc, name: string, order: number): Promise<Doc> => {
  const existing = await findOne('groups', {
    and: [{ stage_id: { equals: stage.id } }, { name: { equals: name } }],
  })
  const data = { event_id: eventId, stage_id: stage.id, name, order }
  return existing
    ? ((await db.update({ collection: 'groups', id: existing.id, data })) as Doc)
    : ((await db.create({ collection: 'groups', data })) as Doc)
}

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
  return (await db.create({
    collection: 'matches',
    data: { ...data, generation_key: generationKey },
    overrideAccess: true,
    user: adminUser,
  })) as Doc
}

type SeededSet = { a: number; b: number; winnerSide?: 'a' | 'b'; notes?: string }

const replaceMatchSets = async (match: Doc, sets: SeededSet[]) => {
  const existing = await db.find({
    collection: 'match-sets',
    depth: 0,
    limit: 50,
    where: { match_id: { equals: match.id } },
    sort: 'set_number',
  })
  const aId = relationshipId(match.participant_a_entry_id)
  const bId = relationshipId(match.participant_b_entry_id)
  for (let i = 0; i < sets.length; i += 1) {
    const s = sets[i]
    const data = {
      event_id: eventId,
      match_id: match.id,
      set_number: i + 1,
      participant_a_score: s.a,
      participant_b_score: s.b,
      winner_entry_id: s.winnerSide === 'a' ? aId : s.winnerSide === 'b' ? bId : null,
      notes: s.notes || 'Seeded YDC 2026 scenario.',
    }
    const current = existing.docs.find((set: Doc) => Number(set.set_number) === i + 1)
    if (current) {
      await db.update({ collection: 'match-sets', id: current.id, data, overrideAccess: true, user: adminUser })
    } else {
      await db.create({ collection: 'match-sets', data, overrideAccess: true, user: adminUser })
    }
  }
  for (const stale of existing.docs.filter((set: Doc) => Number(set.set_number) > sets.length)) {
    await db.delete({ collection: 'match-sets', id: stale.id, overrideAccess: true, user: adminUser })
  }
}

// Scenario is a pure function of which September day a fixture is scheduled on.
const scenarioForDay = (dayOffset: number, indexInRound: number): string => {
  if (dayOffset <= 0) return 'result_published' // 1 September -> finished
  if (dayOffset === 1) return indexInRound % 3 === 2 ? 'paused' : 'ongoing' // 2 September -> live
  return 'published'
}

const scoreForSport = (
  catalogKey: string,
  winnerSide: 'a' | 'b',
): { sets: SeededSet[]; summary: string } => {
  const flip = (rows: number[][]) => (winnerSide === 'a' ? rows : rows.map(([a, b]) => [b, a]))
  if (catalogKey === 'badminton') {
    const rows = flip([[21, 15], [19, 21], [21, 17]])
    return { sets: rows.map(([a, b]) => ({ a, b, winnerSide: a > b ? 'a' : 'b' })), summary: rows.map(([a, b]) => `${a}-${b}`).join(', ') }
  }
  if (catalogKey === 'table_tennis') {
    const rows = flip([[11, 7], [9, 11], [11, 8], [11, 6]])
    return { sets: rows.map(([a, b]) => ({ a, b, winnerSide: a > b ? 'a' : 'b' })), summary: rows.map(([a, b]) => `${a}-${b}`).join(', ') }
  }
  if (catalogKey === 'tennis') {
    const rows = flip([[6, 3], [4, 6], [6, 2]])
    return { sets: rows.map(([a, b]) => ({ a, b, winnerSide: a > b ? 'a' : 'b' })), summary: rows.map(([a, b]) => `${a}-${b}`).join(', ') }
  }
  if (catalogKey === 'volleyball') {
    const rows = flip([[25, 20], [23, 25], [25, 18]])
    return { sets: rows.map(([a, b]) => ({ a, b, winnerSide: a > b ? 'a' : 'b' })), summary: rows.map(([a, b]) => `${a}-${b}`).join(', ') }
  }
  if (catalogKey === 'chess') {
    const [a, b] = winnerSide === 'a' ? [1, 0] : [0, 1]
    return { sets: [{ a, b, winnerSide }], summary: winnerSide === 'a' ? '1-0' : '0-1' }
  }
  if (catalogKey === 'esports') {
    const rows = flip([[1, 0], [0, 1], [1, 0]])
    return { sets: rows.map(([a, b]) => ({ a, b, winnerSide: a > b ? 'a' : 'b' })), summary: `${winnerSide === 'a' ? 2 : 1}-${winnerSide === 'a' ? 1 : 2}` }
  }
  if (catalogKey === 'petanque') {
    const [a, b] = winnerSide === 'a' ? [13, 8] : [8, 13]
    return { sets: [{ a, b, winnerSide }], summary: `${a}-${b}` }
  }
  if (catalogKey === 'basketball') {
    const [a, b] = winnerSide === 'a' ? [21, 16] : [16, 21]
    return { sets: [{ a, b, winnerSide }], summary: `${a}-${b}` }
  }
  // futsal / football
  const [a, b] = winnerSide === 'a' ? [3, 1] : [1, 3]
  return { sets: [{ a, b, winnerSide }], summary: `${a}-${b}` }
}

const livePartial = (catalogKey: string): { sets: SeededSet[]; summary: string } => {
  if (['badminton', 'table_tennis', 'tennis', 'volleyball', 'esports'].includes(catalogKey)) {
    return { sets: [{ a: catalogKey === 'volleyball' ? 18 : 15, b: catalogKey === 'volleyball' ? 16 : 12, notes: 'Live partial score.' }], summary: 'Live · set 1 in progress' }
  }
  if (catalogKey === 'chess') return { sets: [], summary: 'Live · move 24' }
  if (catalogKey === 'basketball') return { sets: [{ a: 12, b: 10, notes: 'Live partial score.' }], summary: '12-10 · Q2' }
  return { sets: [{ a: 1, b: 1, notes: 'Live partial score.' }], summary: '1-1 · 28′' }
}

const applyScenario = async (
  match: Doc,
  catalogKey: string,
  dayOffset: number,
  indexInRound: number,
  isKnockout: boolean,
) => {
  if (match.status === 'walkover') return
  const scenario = scenarioForDay(dayOffset, indexInRound)
  const aId = relationshipId(match.participant_a_entry_id)
  const bId = relationshipId(match.participant_b_entry_id)
  if (!aId || !bId) return
  const winnerSide: 'a' | 'b' = indexInRound % 2 === 0 ? 'a' : 'b'
  const start = match.scheduled_start_at ? new Date(match.scheduled_start_at).getTime() : Date.now()

  if (scenario === 'result_published') {
    const { sets, summary } = scoreForSport(catalogKey, winnerSide)
    await replaceMatchSets(match, sets)
    await db.update({
      collection: 'matches',
      id: match.id,
      data: {
        status: 'result_published',
        actual_start_at: new Date(start + 120_000).toISOString(),
        actual_end_at: new Date(start + 55 * 60_000).toISOString(),
        winner_entry_id: winnerSide === 'a' ? aId : bId,
        score_summary: summary,
        documentation_status: 'approved',
      },
      overrideAccess: true,
      user: adminUser,
    })
    if (isKnockout) await attemptSingleEliminationWinnerAdvancement(payload, match.id)
    return
  }

  if (scenario === 'ongoing' || scenario === 'paused') {
    const { sets, summary } = livePartial(catalogKey)
    await replaceMatchSets(match, sets)
    await db.update({
      collection: 'matches',
      id: match.id,
      data: {
        status: scenario,
        actual_start_at: new Date(start + 120_000).toISOString(),
        actual_end_at: null,
        winner_entry_id: null,
        score_summary: scenario === 'paused' ? `${summary} · paused` : summary,
        documentation_status: 'needed',
      },
      overrideAccess: true,
      user: adminUser,
    })
  }
}

const categoryCode = (info: CategoryInfo) => catCodeByCategoryId.get(String(info.doc.id))!

// --- single elimination -------------------------------------------------------------------------
const roundNameFor = (remaining: number) =>
  remaining === 0 ? 'Final' : remaining === 1 ? 'Semifinal' : remaining === 2 ? 'Quarterfinal' : `Round of ${2 ** (remaining + 1)}`

const generateSingleElimination = async (
  info: CategoryInfo,
  stage: Doc,
  entryDocs: Doc[],
  firstRoundStartDay: number,
  roundSpacingDays: number,
) => {
  const sport = sportDocs.get(info.catalogKey)!
  const courts = courtsBySport.get(info.catalogKey)!
  const schedulable = getSchedulableEntries(entryDocs as MatchGenerationEntry[])
  const plan = buildSingleEliminationBracketPlan(schedulable)
  const bracketSize = Math.max(2, 2 ** Math.ceil(Math.log2(schedulable.length)))
  const totalRounds = Math.log2(bracketSize)
  const idByRoundIndex = new Map<string, string | number>()
  const code = categoryCode(info)

  for (let round = 0; round < totalRounds; round += 1) {
    const roundPlans = plan.filter((p) => p.round === round)
    const remaining = totalRounds - 1 - round
    const roundName = roundNameFor(remaining)
    for (let i = 0; i < roundPlans.length; i += 1) {
      const item = roundPlans[i]
      // Round 0 is split across 1-2 September: first half finished, second half live.
      const dayOffset =
        round === 0
          ? i < Math.ceil(roundPlans.length / 2)
            ? firstRoundStartDay
            : firstRoundStartDay + 1
          : firstRoundStartDay + 1 + round * roundSpacingDays
      const court = courts[i % courts.length]
      const start = SEP(dayOffset, 8 + Math.floor(i / courts.length) * 2)
      const winner = item.isBye ? (item.participantA || item.participantB)?.id : undefined
      const key = `${EVENT_SLUG}:${info.doc.slug}:${stage.id}:r${round}:m${item.matchIndex}`
      const match = await ensureMatch(key, {
        event_id: eventId,
        sport_id: sport.id,
        category_id: info.doc.id,
        stage_id: stage.id,
        round_name: roundName,
        match_number: `${code}-R${round + 1}M${String(item.matchIndex + 1).padStart(2, '0')}`,
        participant_a_entry_id: item.participantA?.id ?? null,
        participant_b_entry_id: item.participantB?.id ?? null,
        scheduled_start_at: item.isBye ? null : start,
        scheduled_end_at: item.isBye ? null : addMinutes(start, 60),
        venue_id: item.isBye ? null : court.venue_id,
        court_id: item.isBye ? null : court.id,
        status: item.isBye ? 'walkover' : 'published',
        winner_entry_id: winner ?? null,
        score_summary: item.isBye ? 'Bye' : null,
        generation_source: 'single_elimination',
        is_public: true,
        documentation_status: item.isBye ? 'not_required' : 'not_started',
      })
      idByRoundIndex.set(`${round}:${item.matchIndex}`, match.id)
      if (round > 0) {
        for (const [parentIndex, slot] of [
          [item.matchIndex * 2, 'a'],
          [item.matchIndex * 2 + 1, 'b'],
        ] as const) {
          const parentId = idByRoundIndex.get(`${round - 1}:${parentIndex}`)
          if (parentId) {
            await db.update({
              collection: 'matches',
              id: parentId,
              data: { next_match_id: match.id, next_match_slot: slot },
            })
          }
        }
      }
    }
  }

  // Propagate byes forward, then apply the day-based scenario in round order.
  await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
  for (let round = 0; round < totalRounds; round += 1) {
    const roundPlans = plan.filter((p) => p.round === round)
    for (let i = 0; i < roundPlans.length; i += 1) {
      const matchId = idByRoundIndex.get(`${round}:${roundPlans[i].matchIndex}`)
      if (!matchId) continue
      const fresh = (await db.findByID({ collection: 'matches', id: matchId, depth: 0 })) as Doc
      const dayOffset = fresh.scheduled_start_at
        ? Math.round((new Date(fresh.scheduled_start_at).getTime() - new Date(SEP(0, 12)).getTime()) / 86_400_000)
        : 99
      await applyScenario(fresh, info.catalogKey, dayOffset, i, true)
    }
  }
  await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
}

// --- round robin (optionally within a group) ----------------------------------------------------
const generateRoundRobin = async (
  info: CategoryInfo,
  stage: Doc,
  entryDocs: Doc[],
  startDay: number,
  group?: Doc,
) => {
  const sport = sportDocs.get(info.catalogKey)!
  const courts = courtsBySport.get(info.catalogKey)!
  const ordered = getSchedulableEntries(entryDocs as MatchGenerationEntry[])
  const rotating: Array<MatchGenerationEntry | null> = ordered.length % 2 === 0 ? [...ordered] : [...ordered, null]
  const roundDayOffsets = [startDay, startDay + 1, startDay + 5, startDay + 9, startDay + 13, startDay + 17, startDay + 21]
  const code = categoryCode(info)
  const groupCode = group ? `-${String(group.name).replaceAll(' ', '').toUpperCase()}` : ''
  let serial = 0

  for (let roundIndex = 0; roundIndex < rotating.length - 1; roundIndex += 1) {
    const dayOffset = roundDayOffsets[roundIndex] ?? roundDayOffsets.at(-1)!
    for (let position = 0; position < rotating.length / 2; position += 1) {
      const a = rotating[position]
      const b = rotating[rotating.length - 1 - position]
      if (!a || !b) continue
      serial += 1
      const court = courts[position % courts.length]
      const start = SEP(dayOffset, 8 + position * 2)
      const pairKey = [String(a.id), String(b.id)].sort((x, y) => Number(x) - Number(y)).join('-')
      const match = await ensureMatch(`${EVENT_SLUG}:${info.doc.slug}:${stage.id}:${group?.id || 'all'}:${pairKey}`, {
        event_id: eventId,
        sport_id: sport.id,
        category_id: info.doc.id,
        stage_id: stage.id,
        group_id: group?.id,
        round_name: `Round ${roundIndex + 1}`,
        match_number: `${code}${groupCode}-M${String(serial).padStart(2, '0')}`,
        participant_a_entry_id: a.id,
        participant_b_entry_id: b.id,
        scheduled_start_at: start,
        scheduled_end_at: addMinutes(start, 60),
        venue_id: court.venue_id,
        court_id: court.id,
        status: 'published',
        generation_source: 'round_robin',
        is_public: true,
        documentation_status: 'not_started',
      })
      await applyScenario(match, info.catalogKey, dayOffset, position, false)
    }
    const fixed = rotating[0]
    const moved = rotating.pop()!
    rotating.splice(1, 0, moved)
    rotating[0] = fixed
  }

  await recalculateStandingsForScope(payload, {
    eventId,
    categoryId: info.doc.id,
    stageId: stage.id,
    groupId: group?.id,
  })
}

// --- drive every category ----------------------------------------------------------------------
let categoryOrdinal = 0
for (const info of categoryInfos) {
  categoryOrdinal += 1
  const entries = entriesByCategoryId.get(String(info.doc.id))!
  // Every category opens on 1 September; the single-elimination and round-robin generators each
  // split their opening round across 1-2 September so finished and live fixtures coexist everywhere.
  const openDay = 0
  void categoryOrdinal

  if (info.format === 'single_elimination') {
    const stage = await ensureStage(info.doc.id, `${info.doc.name} Main Draw`, 'single_elimination', 1)
    await generateSingleElimination(info, stage, entries, openDay, 3)
  } else if (info.format === 'league' || info.format === 'round_robin') {
    const stage = await ensureStage(
      info.doc.id,
      info.format === 'league' ? `${info.doc.name} League` : `${info.doc.name} Round Robin`,
      info.format === 'league' ? 'league' : 'round_robin',
      1,
    )
    await generateRoundRobin(info, stage, entries, openDay)
  } else if (info.format === 'group_stage_to_knockout') {
    const groupStage = await ensureStage(info.doc.id, `${info.doc.name} Group Stage`, 'group_stage', 1)
    const groupA = await ensureGroup(groupStage, 'Group A', 1)
    const groupB = await ensureGroup(groupStage, 'Group B', 2)
    const half = Math.ceil(entries.length / 2)
    await generateRoundRobin(info, groupStage, entries.slice(0, half), openDay, groupA)
    await generateRoundRobin(info, groupStage, entries.slice(half), openDay, groupB)
    const knockout = await ensureStage(info.doc.id, `${info.doc.name} Knockout`, 'single_elimination', 2)
    // Top-2-of-each-group placeholder seeding for the demo bracket.
    const knockoutEntries = [entries[0], entries[half + 1], entries[1], entries[half]].filter(Boolean)
    await generateSingleElimination(info, knockout, knockoutEntries, openDay + 12, 3)
    await db.update({ collection: 'stages', id: groupStage.id, data: { status: 'completed' } })
  } else if (info.format === 'time_trial') {
    // Track / pool events: structure + confirmed entries only; heats are run on the day.
    await ensureStage(info.doc.id, `${info.doc.name} Timed Finals`, 'time_trial', 1)
  }
}

// --------------------------------------------------------------------------------------------------
// Announcements
// --------------------------------------------------------------------------------------------------
await ensureBySlug('announcements', `${PREFIX}welcome`, {
  event_id: eventId,
  title: 'Welcome to YDC 2026 - Your Demo Championship',
  summary: 'The official hub for Your Demo Championship 2026 is live for athletes, clubs and supporters.',
  body: 'Follow schedules, venues, brackets, standings and results across every sport throughout September 2026 in Jakarta.',
  urgency: 'info',
  display_mode: 'feed',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-08-25T02:00:00.000Z',
  expires_at: '2026-10-01T16:59:00.000Z',
  cta_label: 'Explore the sports',
  cta_url: `/events/${EVENT_SLUG}/sports`,
  share_title: 'YDC 2026 - Your Demo Championship',
  share_description: 'Every sport, one championship, across Jakarta in September 2026.',
})

await ensureBySlug('announcements', `${PREFIX}day-one-results`, {
  event_id: eventId,
  title: 'Opening day results are official',
  summary: 'First-round results from 1 September are published across every discipline.',
  body: 'Your Demo Championship 2026 is underway. Day-one fixtures are complete and their results and standings are live. Day-two matches are now in progress.',
  urgency: 'result',
  display_mode: 'banner',
  status: 'published',
  target_scope: 'event',
  published_at: '2026-09-01T14:00:00.000Z',
  expires_at: '2026-09-10T16:59:00.000Z',
  cta_label: 'View results',
  cta_url: `/events/${EVENT_SLUG}/schedule`,
  share_title: 'YDC 2026 opening day results',
  share_description: 'See the first official results and standings from Your Demo Championship 2026.',
})

// --------------------------------------------------------------------------------------------------
// Summary
// --------------------------------------------------------------------------------------------------
const summaryCollections = [
  'sports', 'rulesets', 'competition-categories', 'clubs', 'teams', 'players', 'rosters',
  'competition-entries', 'venues', 'courts', 'stages', 'groups', 'matches', 'match-sets',
  'standings', 'brackets', 'announcements',
]
const summary: Record<string, number> = {}
for (const collection of summaryCollections) {
  summary[collection] = (await db.count({ collection, where: { event_id: { equals: eventId } } })).totalDocs
}

const finalMatches = await db.find({
  collection: 'matches',
  depth: 0,
  limit: 2000,
  pagination: false,
  where: { event_id: { equals: eventId } },
})
const matchStatusSummary = (finalMatches.docs as Doc[]).reduce<Record<string, number>>((counts, m) => {
  counts[String(m.status)] = (counts[String(m.status)] || 0) + 1
  return counts
}, {})

console.log(
  JSON.stringify(
    {
      event: { id: eventId, name: event.name, slug: event.slug, period: '1-30 September 2026', location: 'Jakarta' },
      categories: categoryInfos.length,
      summary,
      matchStatusSummary,
    },
    null,
    2,
  ),
)
process.exit(0)
