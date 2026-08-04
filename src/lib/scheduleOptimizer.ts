import type { Payload } from 'payload'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 1: "Cross-sport schedule optimizer berbasis
// player/roster identity" - proposes venue/court/time assignments for every currently-unscheduled
// match at once, considering rest time between matches for the same person (even across
// different sports/categories), venue/court capacity (one match per court at a time), and
// broadcast priority (is_featured matches prefer is_featured courts). Deliberately a *proposal*
// engine, same "suggest, don't silently rewrite" convention as src/lib/delayPropagation.ts -
// nothing here writes to the database; the workspace page's apply action re-validates and writes
// each accepted assignment through the normal conflict-checked/audited path.
//
// Scope decisions (kept deliberately simple - this is a heuristic, not a constraint solver):
// - Greedy first-fit: matches are sorted once (featured first, then by category, then by match
//   number) and each is placed into the first court+time slot that satisfies every constraint, in
//   the order courts/slots are scanned. This is not globally optimal (a different match order
//   could pack tighter), but it's fast, deterministic, and easy for an admin to reason about.
// - Only matches with no scheduled_start_at are candidates - already-scheduled matches are left
//   alone (that's what Delay Impact is for) rather than being re-shuffled by every run.
// - Court "capacity" here means exactly one match at a time - the existing Courts.capacity field
//   (spectator/participant headcount) is a different concept and is not read by this engine.

type Id = string | number

export type RelationshipDoc = { id?: Id; name?: string; display_name?: string }

export type EntryDoc = RelationshipDoc & {
  entry_type?: string | null
  club_id?: RelationshipDoc | Id | null
  team_id?: RelationshipDoc | Id | null
  player_id?: RelationshipDoc | Id | null
}

export type OptimizerMatch = {
  id: Id
  match_number: string
  is_featured?: boolean | null
  sport_id?: RelationshipDoc | Id | null
  category_id?: RelationshipDoc | Id | null
  // MSG-03: needed to look up a per-stage ruleset override (e.g. a knockout stage's best-of-5
  // overriding its category's best-of-3 default) - without this, computeSchedulePlan/
  // buildExistingOccupancy can only ever see the category-level duration/rest, silently ignoring
  // any stage override even though loadRulesetForMatch (src/lib/ruleValidation.ts) already applies
  // it for score validation.
  stage_id?: RelationshipDoc | Id | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  venue_id?: RelationshipDoc | Id | null
  court_id?: RelationshipDoc | Id | null
  participant_a_entry_id?: EntryDoc | Id | null
  participant_b_entry_id?: EntryDoc | Id | null
  // Bracket-advancement edge (see src/collections/Matches.ts) - a knockout final must never be
  // placed at or before its own semifinal feeders. Only the forward winner edge matters here (not
  // next_loser_match_id): a losers-bracket match becoming schedulable doesn't depend on a
  // parallel winners-bracket match finishing first.
  next_match_id?: RelationshipDoc | Id | null
}

export type OptimizerCourt = {
  id: Id
  venue_id: RelationshipDoc | Id
  sport_id?: RelationshipDoc | Id | null
  is_active?: boolean | null
  is_featured?: boolean | null
}

export type CategoryRulesetInfo = {
  defaultDurationMinutes?: number
  minRestMinutes?: number
}

// MSG-03: buildCategoryRulesetIndex keys entries as `category:<id>` and `stage:<id>` in the same
// map (a stage entry only exists when that stage has its own ruleset_id override) - this resolves
// a match's effective info by checking its stage key first, falling back to its category key,
// mirroring loadRulesetForMatch's own stage-then-category resolution order exactly.
const resolveRulesetInfo = (
  rulesetIndex: Map<string, CategoryRulesetInfo>,
  categoryId: string | undefined,
  stageId: string | undefined,
): CategoryRulesetInfo => {
  if (stageId) {
    const stageInfo = rulesetIndex.get(`stage:${stageId}`)
    if (stageInfo) return stageInfo
  }
  if (categoryId) {
    return rulesetIndex.get(`category:${categoryId}`) || {}
  }
  return {}
}

// team_id (stringified) -> active roster player_ids (stringified). Built by the caller from the
// `rosters` collection (event-scoped, status: active) - see buildRosterIndex.
export type RosterIndex = Map<string, string[]>

const getRelationshipId = (value: RelationshipDoc | Id | null | undefined): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value.id !== undefined ? String(value.id) : undefined
}

// ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md F-10 (see
// src/app/(frontend)/workspaces/(shell)/scheduler/conflicts.ts's getEntryIdentities) established
// individual->player_id / pair|team->team_id / club->club_id. This extends that: a pair/team
// entry's identity ALSO includes every active roster player's own player_id, so the same person
// entered individually in one category and on a team roster in another is correctly recognized as
// the same participant for cross-category rest-time purposes - the exact gap the optimizer exists
// to close. Kept as a separate function (not a change to conflicts.ts's synchronous, roster-blind
// version) because that function is relied on by the existing single-match
// create/reschedule-conflict gate and changing its semantics there is a separate, riskier change
// than this new, additive feature.
export const getExpandedIdentities = (
  entry: EntryDoc | RelationshipDoc | Id | null | undefined,
  rosterIndex: RosterIndex,
): Set<string> => {
  const identities = new Set<string>()
  const entryId = getRelationshipId(entry)
  if (!entryId) return identities

  identities.add(`entry:${entryId}`)

  if (entry && typeof entry === 'object') {
    const entryType = (entry as EntryDoc).entry_type

    if (entryType === 'club') {
      const clubId = getRelationshipId((entry as EntryDoc).club_id)
      if (clubId) identities.add(`club:${clubId}`)
    } else if (entryType === 'pair' || entryType === 'team') {
      const teamId = getRelationshipId((entry as EntryDoc).team_id)
      if (teamId) {
        identities.add(`team:${teamId}`)
        for (const playerId of rosterIndex.get(teamId) || []) {
          identities.add(`player:${playerId}`)
        }
      }
    } else if (entryType === 'individual') {
      const playerId = getRelationshipId((entry as EntryDoc).player_id)
      if (playerId) identities.add(`player:${playerId}`)
    }
  }

  return identities
}

export const buildRosterIndex = async (payload: Payload, eventId: Id): Promise<RosterIndex> => {
  const index: RosterIndex = new Map()
  const rosters = await payload.find({
    collection: 'rosters',
    depth: 0,
    limit: 5000,
    where: { and: [{ event_id: { equals: eventId } }, { status: { equals: 'active' } }] },
  })

  for (const roster of rosters.docs) {
    const teamId = getRelationshipId(roster.team_id as RelationshipDoc | Id | null)
    const playerId = getRelationshipId(roster.player_id as RelationshipDoc | Id | null)
    if (!teamId || !playerId) continue
    const players = index.get(teamId) || []
    players.push(playerId)
    index.set(teamId, players)
  }

  return index
}

type OccupancyEntry = { start: number; end: number; restMinutes: number }

export type ScheduleAssignment = {
  matchId: Id
  matchNumber: string
  venueId: Id
  courtId: Id
  startAt: string
  endAt: string
  isFeatured: boolean
}

export type UnplacedMatch = {
  matchId: Id
  matchNumber: string
  reason: string
}

export type SchedulePlan = {
  assignments: ScheduleAssignment[]
  unplaced: UnplacedMatch[]
}

export type SchedulePlanParams = {
  // 'YYYY-MM-DD', inclusive on both ends, interpreted in the server's local time zone.
  rangeStartDate: string
  rangeEndDate: string
  // Minutes from local midnight.
  dailyStartMinute: number
  dailyEndMinute: number
  slotStepMinutes: number
  defaultDurationMinutes: number
  defaultMinRestMinutes: number
}

const MAX_DAYS = 62 // sanity cap so a fat-fingered date range can't spin the slot search forever

// `Date#toISOString()` converts to UTC, which silently shifts the calendar day for any positive
// UTC-offset server time zone (e.g. local midnight Aug 10 in WIB/UTC+7 is Aug 9 17:00 UTC) - the
// day keys this function produces must stay in the server's local calendar, matched by
// dateAtMinute's own local-time construction below, or slots end up computed a day off from what
// the admin actually selected.
const formatLocalDayKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dayKeysInRange = (startDate: string, endDate: string): string[] => {
  const keys: string[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return keys

  for (let i = 0; cursor.getTime() <= end.getTime() && i < MAX_DAYS; i += 1) {
    keys.push(formatLocalDayKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return keys
}

const dateAtMinute = (dayKey: string, minuteOfDay: number): Date => {
  const date = new Date(`${dayKey}T00:00:00`)
  date.setMinutes(date.getMinutes() + minuteOfDay)
  return date
}

const overlapsWithRest = (candidate: { start: number; end: number }, entry: OccupancyEntry, restMinutesForCandidate: number) => {
  const restMs = Math.max(entry.restMinutes, restMinutesForCandidate) * 60_000
  return candidate.start < entry.end + restMs && entry.start < candidate.end + restMs
}

export const computeSchedulePlan = (input: {
  candidates: OptimizerMatch[]
  courts: OptimizerCourt[]
  rosterIndex: RosterIndex
  categoryRulesets: Map<string, CategoryRulesetInfo>
  existingCourtOccupancy: Map<string, Array<{ start: number; end: number }>>
  existingIdentityOccupancy: Map<string, OccupancyEntry[]>
  params: SchedulePlanParams
  // Earliest-allowed-start floor (ms) per candidate id, from feeder matches that are already
  // scheduled (outside this batch) - see buildDependencyFloors. Feeders that are themselves
  // candidates in this same batch are handled internally via next_match_id, not through this map.
  initialDependencyFloors?: Map<string, number>
}): SchedulePlan => {
  const { candidates, courts, rosterIndex, categoryRulesets, params } = input

  const courtOccupancy = new Map<string, Array<{ start: number; end: number }>>()
  for (const [key, entries] of input.existingCourtOccupancy) {
    courtOccupancy.set(key, [...entries])
  }
  const identityOccupancy = new Map<string, OccupancyEntry[]>()
  for (const [key, entries] of input.existingIdentityOccupancy) {
    identityOccupancy.set(key, [...entries])
  }

  const eligibleCourts = courts.filter((court) => court.is_active !== false)
  const dayKeys = dayKeysInRange(params.rangeStartDate, params.rangeEndDate)

  const sortOrder = (a: OptimizerMatch, b: OptimizerMatch) => {
    if (Boolean(a.is_featured) !== Boolean(b.is_featured)) return a.is_featured ? -1 : 1
    const categoryA = getRelationshipId(a.category_id) || ''
    const categoryB = getRelationshipId(b.category_id) || ''
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB)
    return a.match_number.localeCompare(b.match_number, 'en')
  }

  // ADMIN_EVENT_CREATION_NUSANTARA_GRAND_GAMES_2026.md-style bug found by testing against the
  // live Futsal Open Championship knockout (a semifinal and its final were both unscheduled at
  // once): without this, the greedy loop happily placed the final at the same time as its own
  // semifinals, since nothing connected them. next_match_id (see Matches.ts) is the same
  // bracket-advancement edge single/double elimination already wire up - a candidate whose
  // next_match_id points at ANOTHER candidate in this batch must not be placed before that
  // dependent, and once a feeder is placed, its end time becomes the dependent's new floor.
  const candidateIds = new Set(candidates.map((match) => String(match.id)))
  const dependentIdOf = new Map<string, string>() // candidateId -> the candidate it feeds into
  for (const match of candidates) {
    const nextId = getRelationshipId(match.next_match_id)
    if (nextId && candidateIds.has(nextId)) {
      dependentIdOf.set(String(match.id), nextId)
    }
  }
  const inBatchFeederCountOf = new Map<string, number>()
  for (const [, dependentId] of dependentIdOf) {
    inBatchFeederCountOf.set(dependentId, (inBatchFeederCountOf.get(dependentId) || 0) + 1)
  }

  const floorMs = new Map<string, number>(input.initialDependencyFloors ?? [])
  const remaining = new Map(candidates.map((match) => [String(match.id), match]))
  const assignments: ScheduleAssignment[] = []
  const unplaced: UnplacedMatch[] = []

  // Processed in dependency-respecting waves: every match with no *unresolved* in-batch feeder is
  // "ready" this round. A DAG (bracket advancement never cycles back) always makes progress every
  // wave; the `remaining.size` guard below is just a safety net against a malformed/cyclic
  // next_match_id graph, which should never occur from any of this app's own generators.
  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((match) => (inBatchFeederCountOf.get(String(match.id)) || 0) === 0)

    if (ready.length === 0) {
      for (const match of remaining.values()) {
        unplaced.push({ matchId: match.id, matchNumber: match.match_number, reason: 'Unresolved scheduling dependency (possible next_match_id cycle).' })
      }
      break
    }

    ready.sort(sortOrder)

    for (const match of ready) {
      remaining.delete(String(match.id))
      const notBeforeMs = floorMs.get(String(match.id)) ?? 0

      const sportId = getRelationshipId(match.sport_id)
      const categoryId = getRelationshipId(match.category_id)
      const stageId = getRelationshipId(match.stage_id)
      const rulesetInfo = resolveRulesetInfo(categoryRulesets, categoryId, stageId)
      const durationMinutes = rulesetInfo.defaultDurationMinutes || params.defaultDurationMinutes
      const restMinutes = rulesetInfo.minRestMinutes ?? params.defaultMinRestMinutes
      const durationMs = durationMinutes * 60_000

      const identities = new Set<string>([
        ...getExpandedIdentities(match.participant_a_entry_id, rosterIndex),
        ...getExpandedIdentities(match.participant_b_entry_id, rosterIndex),
      ])

      const matchCourts = eligibleCourts
        .filter((court) => !court.sport_id || getRelationshipId(court.sport_id) === sportId)
        .sort((a, b) => {
          const aMatchesFeatured = Boolean(a.is_featured) === Boolean(match.is_featured)
          const bMatchesFeatured = Boolean(b.is_featured) === Boolean(match.is_featured)
          if (aMatchesFeatured !== bMatchesFeatured) return aMatchesFeatured ? -1 : 1
          return 0
        })

      const markDependentReady = () => {
        const dependentId = dependentIdOf.get(String(match.id))
        if (!dependentId) return
        inBatchFeederCountOf.set(dependentId, Math.max(0, (inBatchFeederCountOf.get(dependentId) || 1) - 1))
      }

      if (matchCourts.length === 0) {
        unplaced.push({ matchId: match.id, matchNumber: match.match_number, reason: 'No active court is available for this sport.' })
        markDependentReady()
        continue
      }

    let placed = false

    dayLoop: for (const dayKey of dayKeys) {
      for (
        let minuteOfDay = params.dailyStartMinute;
        minuteOfDay + durationMinutes <= params.dailyEndMinute;
        minuteOfDay += params.slotStepMinutes
      ) {
        const start = dateAtMinute(dayKey, minuteOfDay).getTime()
        if (start < notBeforeMs) continue
        const end = start + durationMs

        for (const court of matchCourts) {
          const courtKey = `court:${court.id}`
          const courtBusy = (courtOccupancy.get(courtKey) || []).some(
            (entry) => start < entry.end && entry.start < end,
          )
          if (courtBusy) continue

          const identityBusy = [...identities].some((identity) =>
            (identityOccupancy.get(identity) || []).some((entry) => overlapsWithRest({ start, end }, entry, restMinutes)),
          )
          if (identityBusy) continue

          const startAt = new Date(start).toISOString()
          const endAt = new Date(end).toISOString()
          assignments.push({
            matchId: match.id,
            matchNumber: match.match_number,
            venueId: getRelationshipId(court.venue_id) || '',
            courtId: court.id,
            startAt,
            endAt,
            isFeatured: Boolean(match.is_featured),
          })

          courtOccupancy.set(courtKey, [...(courtOccupancy.get(courtKey) || []), { start, end }])
          for (const identity of identities) {
            identityOccupancy.set(identity, [...(identityOccupancy.get(identity) || []), { start, end, restMinutes }])
          }

          const dependentId = dependentIdOf.get(String(match.id))
          if (dependentId) {
            floorMs.set(dependentId, Math.max(floorMs.get(dependentId) ?? 0, end))
          }

          placed = true
          break dayLoop
        }
      }
    }

      if (!placed) {
        unplaced.push({
          matchId: match.id,
          matchNumber: match.match_number,
          reason: 'No court/time slot in the selected range and hours satisfies venue and rest-time constraints.',
        })
      }

      markDependentReady()
    }
  }

  return { assignments, unplaced }
}

export const buildCategoryRulesetIndex = async (payload: Payload, eventId: Id): Promise<Map<string, CategoryRulesetInfo>> => {
  const [categories, stages] = await Promise.all([
    payload.find({
      collection: 'competition-categories',
      depth: 1,
      limit: 500,
      where: { event_id: { equals: eventId } },
    }),
    payload.find({
      collection: 'stages',
      depth: 1,
      limit: 500,
      where: { event_id: { equals: eventId } },
    }),
  ])

  const index = new Map<string, CategoryRulesetInfo>()
  for (const category of categories.docs) {
    const ruleset = category.ruleset_id
    if (ruleset && typeof ruleset === 'object') {
      index.set(`category:${category.id}`, {
        defaultDurationMinutes: ruleset.default_duration_minutes ?? undefined,
        minRestMinutes: ruleset.min_rest_minutes ?? undefined,
      })
    }
  }
  // MSG-03: only present when the stage has its own override - resolveRulesetInfo checks this key
  // first and falls back to the category key above when it's absent.
  for (const stage of stages.docs) {
    const ruleset = stage.ruleset_id
    if (ruleset && typeof ruleset === 'object') {
      index.set(`stage:${stage.id}`, {
        defaultDurationMinutes: ruleset.default_duration_minutes ?? undefined,
        minRestMinutes: ruleset.min_rest_minutes ?? undefined,
      })
    }
  }

  return index
}

// Seeds courtOccupancy/identityOccupancy from matches that already have a schedule - the
// optimizer must not double-book a court or a person against a match it isn't touching.
export const buildExistingOccupancy = (
  scheduledMatches: OptimizerMatch[],
  rosterIndex: RosterIndex,
  categoryRulesets: Map<string, CategoryRulesetInfo>,
  defaultMinRestMinutes: number,
) => {
  const courtOccupancy = new Map<string, Array<{ start: number; end: number }>>()
  const identityOccupancy = new Map<string, OccupancyEntry[]>()

  for (const match of scheduledMatches) {
    if (!match.scheduled_start_at) continue
    const start = new Date(match.scheduled_start_at).getTime()
    const end = match.scheduled_end_at ? new Date(match.scheduled_end_at).getTime() : start
    if (!Number.isFinite(start)) continue

    const courtId = getRelationshipId(match.court_id)
    if (courtId) {
      const key = `court:${courtId}`
      courtOccupancy.set(key, [...(courtOccupancy.get(key) || []), { start, end }])
    }

    const categoryId = getRelationshipId(match.category_id)
    const stageId = getRelationshipId(match.stage_id)
    const restMinutes = resolveRulesetInfo(categoryRulesets, categoryId, stageId).minRestMinutes ?? defaultMinRestMinutes
    const identities = new Set<string>([
      ...getExpandedIdentities(match.participant_a_entry_id, rosterIndex),
      ...getExpandedIdentities(match.participant_b_entry_id, rosterIndex),
    ])
    for (const identity of identities) {
      identityOccupancy.set(identity, [...(identityOccupancy.get(identity) || []), { start, end, restMinutes }])
    }
  }

  return { courtOccupancy, identityOccupancy }
}

export type GenerateSchedulePlanInput = {
  eventId: Id
  params: SchedulePlanParams
}

// Orchestrates the DB reads computeSchedulePlan needs and calls it - kept separate from the pure
// function above so the actual placement logic stays unit-testable without a database.
export const generateSchedulePlan = async (payload: Payload, input: GenerateSchedulePlanInput): Promise<SchedulePlan> => {
  const { eventId, params } = input

  const [allMatchesResult, courtsResult, rosterIndex, categoryRulesets] = await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 1,
      limit: 2000,
      where: { event_id: { equals: eventId } },
    }),
    payload.find({
      collection: 'courts',
      depth: 0,
      limit: 200,
      where: { event_id: { equals: eventId } },
    }),
    buildRosterIndex(payload, eventId),
    buildCategoryRulesetIndex(payload, eventId),
  ])

  const allMatches = allMatchesResult.docs as unknown as (OptimizerMatch & { status?: string })[]
  // Only matches that are actually waiting on a slot: a bye/walkover, cancelled, or disqualified
  // match has no scheduled_start_at either, but it's already decided and needs no court time.
  const candidates = allMatches.filter(
    (match) => !match.scheduled_start_at && (match.status === 'draft' || match.status === 'ready_for_scheduling'),
  )
  const scheduledMatches = allMatches.filter((match) => Boolean(match.scheduled_start_at))
  const courts = courtsResult.docs as unknown as OptimizerCourt[]

  const { courtOccupancy, identityOccupancy } = buildExistingOccupancy(
    scheduledMatches,
    rosterIndex,
    categoryRulesets,
    params.defaultMinRestMinutes,
  )

  // A candidate whose feeder match is already scheduled (outside this batch) must not be placed
  // before that feeder finishes - the in-batch case (both feeder and dependent unscheduled
  // together) is handled inside computeSchedulePlan itself via next_match_id.
  const candidateIds = new Set(candidates.map((match) => String(match.id)))
  const initialDependencyFloors = new Map<string, number>()
  for (const match of scheduledMatches) {
    const nextId = getRelationshipId(match.next_match_id)
    if (!nextId || !candidateIds.has(nextId) || !match.scheduled_end_at) continue
    const endMs = new Date(match.scheduled_end_at).getTime()
    if (!Number.isFinite(endMs)) continue
    initialDependencyFloors.set(nextId, Math.max(initialDependencyFloors.get(nextId) ?? 0, endMs))
  }

  return computeSchedulePlan({
    candidates,
    courts,
    rosterIndex,
    categoryRulesets,
    existingCourtOccupancy: courtOccupancy,
    existingIdentityOccupancy: identityOccupancy,
    params,
    initialDependencyFloors,
  })
}
