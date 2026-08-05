import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowRight, BarChart3, Calendar, Clock, Crown, MapPin } from 'lucide-react'

import config from '@payload-config'
import { cn } from '@/lib/utils'
import { collectEntryClubLabels, type SingleEliminationBracketData } from '@/lib/brackets'
import { resolveEventTimezone } from '@/lib/timezone'
import { AutoRefresh } from '@/components/auto-refresh'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone, type StatusTone } from '@/components/ui/status-badge'
import {
  formatDateLabel,
  formatStatus,
  formatTimeOnly,
  getDateKey,
  getRelationshipId,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../../publicEvents'
import { FavoriteStar } from '@/components/favorite-star'
import { ScheduleFavoritesToggle } from '@/components/schedule-favorites-toggle'

export const dynamic = 'force-dynamic'

type ActiveTab = 'schedule' | 'standings' | 'champions'

type SportDoc = RelationshipDoc & { slug?: string }
type CategoryDoc = RelationshipDoc & { slug?: string }

type ScheduleMatch = {
  id: string | number
  match_number: string
  round_name?: string | null
  scheduled_start_at?: string | null
  status: string
  score_summary?: string | null
  sport_id?: SportDoc | string | number | null
  category_id?: CategoryDoc | string | number | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
  winner_entry_id?: RelationshipDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
}

type MatchSetRow = {
  id: string | number
  match_id?: RelationshipDoc | string | number | null
  set_number: number
  participant_a_score?: number | null
  participant_b_score?: number | null
}

type StandingDoc = {
  id: string | number
  rank: number
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  score_difference: number
  set_for: number
  set_against: number
  qualified_status: string
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
  group_id?: string | number | { name?: string } | null
  entry_id?: string | number | { display_name?: string; name?: string } | null
}

type ChampionBracket = {
  id: string | number
  name: string
  status: string
  bracket_data?: SingleEliminationBracketData | null
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
}

type SchedulePageProps = {
  params: Promise<{ eventSlug: string }>
  searchParams: Promise<{ sport?: string; tab?: string; status?: string }>
}

const getActiveTab = (value?: string): ActiveTab => {
  if (value === 'standings' || value === 'champions') {
    return value
  }
  return 'schedule'
}

// "Schedule" should mean matches still to be played by default - a match list that mixes
// finished results into an undifferentiated feed reads wrong under that name. Statuses that mean
// the match has already been decided (or is otherwise concluded, e.g. cancelled/walkover) bucket
// into "results"; everything else - draft through ongoing/paused - is still "upcoming" (a live
// match is still part of today's schedule, not a result yet).
type ScheduleStatusFilter = 'upcoming' | 'results' | 'all'

const RESULT_STATUSES = new Set([
  'finished',
  'result_published',
  'under_review',
  'disputed',
  'cancelled',
  'walkover',
])

const isResultStatus = (status: string) => RESULT_STATUSES.has(status)

const getStatusFilter = (value?: string): ScheduleStatusFilter => {
  if (value === 'results' || value === 'all') {
    return value
  }
  return 'upcoming'
}

const SCHEDULE_STATUS_FILTERS: { key: ScheduleStatusFilter; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'results', label: 'Results' },
  { key: 'all', label: 'All' },
]

const getStandingScopeKey = (standing: StandingDoc) =>
  [
    getRelationshipLabel(standing.category_id, 'Category'),
    getRelationshipLabel(standing.stage_id, 'Stage'),
    getRelationshipLabel(standing.group_id, 'No group'),
  ].join(' / ')

// Global tone mapping per prd/redesign/README.md section 4.1 extended to standings: qualified is
// the "winner/positive" state (green), champion gets the sparse gold accent, everything else
// (eliminated, pending) is neutral rather than a red/error color.
const getQualifiedTone = (status: string): StatusTone => {
  switch (status) {
    case 'qualified':
      return 'green'
    case 'champion':
      return 'gold'
    case 'runner_up':
      return 'blue'
    default:
      return 'neutral'
  }
}

const getChampion = (bracketData?: SingleEliminationBracketData | null) =>
  bracketData?.champion || {
    status: 'pending' as const,
    reason: 'Champion metadata has not been generated yet.',
  }

export default async function PublicSchedulePage({ params, searchParams }: SchedulePageProps) {
  const { eventSlug } = await params
  const { sport: sportSlug, tab, status: statusParam } = await searchParams
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const timezone = resolveEventTimezone(event.timezone)
  const eventPath = `/events/${event.slug}`
  const schedulePath = `${eventPath}/schedule`
  const activeTab = getActiveTab(tab)
  const statusFilter = getStatusFilter(statusParam)

  const buildScheduleHref = (opts: { sport?: string; status?: ScheduleStatusFilter }) => {
    const query = new URLSearchParams({ tab: 'schedule' })
    if (opts.sport) query.set('sport', opts.sport)
    if (opts.status && opts.status !== 'upcoming') query.set('status', opts.status)
    return `${schedulePath}?${query.toString()}`
  }

  const [matchesResult, sportsResult, standingsResult, bracketsResult] = await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 100,
      sort: 'scheduled_start_at',
      where: { and: [{ event_id: { equals: event.id } }, { is_public: { equals: true } }] },
    }),
    payload.find({
      collection: 'sports',
      depth: 0,
      limit: 20,
      sort: 'name',
      where: { event_id: { equals: event.id } },
    }),
    payload.find({
      collection: 'standings',
      depth: 1,
      limit: 200,
      sort: ['category_id', 'stage_id', 'group_id', 'rank'],
      where: { event_id: { equals: event.id } },
    }),
    payload.find({
      collection: 'brackets',
      depth: 1,
      limit: 50,
      sort: ['category_id', 'stage_id'],
      where: { and: [{ event_id: { equals: event.id } }, { status: { in: ['published', 'locked'] } }] },
    }),
  ])

  const allMatches = matchesResult.docs as ScheduleMatch[]

  // MSG follow-up: `score_summary` is a freeform string ("17-21, 19-21") - fine for a single line,
  // but comma-joining sets reads as one ambiguous number sequence rather than two participants'
  // actual per-set scores. Fetching the real match-sets rows lets the card render one row per
  // participant with one column per set (e.g. Rusy 21/19/21 vs Roza 11/21/13), which is how a
  // multi-set scoreline is actually read. One batched query for every visible match instead of one
  // per card.
  const matchIdsWithSets = allMatches.filter((match) => match.score_summary).map((match) => match.id)
  const matchSetsResult =
    matchIdsWithSets.length > 0
      ? await payload.find({
          collection: 'match-sets',
          depth: 0,
          limit: 500,
          sort: 'set_number',
          where: { match_id: { in: matchIdsWithSets } },
        })
      : null
  const setsByMatch = new Map<string, MatchSetRow[]>()
  for (const set of (matchSetsResult?.docs ?? []) as MatchSetRow[]) {
    const matchKey = String(getRelationshipId(set.match_id))
    const rows = setsByMatch.get(matchKey) || []
    rows.push(set)
    setsByMatch.set(matchKey, rows)
  }

  const sports = sportsResult.docs as SportDoc[]
  const activeSport = sportSlug ? sports.find((sport) => sport.slug === sportSlug) : undefined

  const matches =
    activeSport ?
      allMatches.filter(
        (match) => typeof match.sport_id === 'object' && match.sport_id?.slug === activeSport.slug,
      )
    : allMatches

  const upcomingMatches = matches.filter((match) => !isResultStatus(match.status))
  const resultMatches = matches.filter((match) => isResultStatus(match.status))
  const statusFilterCounts: Record<ScheduleStatusFilter, number> = {
    upcoming: upcomingMatches.length,
    results: resultMatches.length,
    all: matches.length,
  }
  const visibleMatches =
    statusFilter === 'results' ? resultMatches
    : statusFilter === 'all' ? matches
    : upcomingMatches

  const groups = visibleMatches.reduce<Map<string, ScheduleMatch[]>>((map, match) => {
    const dateKey = getDateKey(match.scheduled_start_at, timezone) || 'unscheduled'
    const rows = map.get(dateKey) || []
    rows.push(match)
    map.set(dateKey, rows)
    return map
  }, new Map())
  // Results read naturally newest-first (what just happened, at the top); an upcoming/all queue
  // reads naturally soonest-first. "Unscheduled" (no date yet) always sinks to the bottom either
  // way - it isn't part of either chronology.
  const orderedDateKeys = Array.from(groups.keys()).sort((left, right) => {
    if (left === 'unscheduled') return 1
    if (right === 'unscheduled') return -1
    return statusFilter === 'results' ? right.localeCompare(left) : left.localeCompare(right)
  })
  const standings = standingsResult.docs as StandingDoc[]
  const standingScopes = standings.reduce<Map<string, StandingDoc[]>>((map, standing) => {
    const scopeKey = getStandingScopeKey(standing)
    const rows = map.get(scopeKey) || []
    rows.push(standing)
    map.set(scopeKey, rows)
    return map
  }, new Map())

  const brackets = bracketsResult.docs as ChampionBracket[]
  const championEntryIds = brackets
    .map((bracket) => getChampion(bracket.bracket_data).entry_id)
    .filter((id): id is string | number => Boolean(id))

  // Parent club (team_id.club_id / player_id.club_id) for every participant/standing-row/champion
  // entry this page is about to render - one batched lookup covering the whole page rather than
  // one query per card/row. See collectEntryClubLabels (src/lib/brackets.ts): absent from the map
  // means "no club to show" (a club-mode entry, or a team/player with no club_id set).
  const clubLookupEntryIds = [
    ...allMatches.flatMap((match) => [
      getRelationshipId(match.participant_a_entry_id),
      getRelationshipId(match.participant_b_entry_id),
    ]),
    ...standings.map((standing) => getRelationshipId(standing.entry_id)),
    ...championEntryIds,
  ].filter((id): id is string | number => Boolean(id))
  const clubLabelByEntryId = await collectEntryClubLabels(payload, clubLookupEntryIds)

  return (
    <main className="font-sans text-ink">
      <div className="sticky top-20 z-40 bg-paper">
        <section className="border-b border-line px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-lg font-extrabold sm:text-xl">{event.name}</h1>
            <AutoRefresh
              showIndicator
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-soft"
            />
          </div>
        </section>

        <nav className="flex border-b border-line bg-paper" aria-label="Sections">
          <div className="mx-auto flex w-full max-w-4xl">
            {[
              { key: 'schedule' as const, label: 'Schedule', icon: Calendar },
              { key: 'standings' as const, label: 'Standings', icon: BarChart3 },
              { key: 'champions' as const, label: 'Champions', icon: Crown },
            ].map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.key
              return (
                <Link
                  key={item.key}
                  href={`${schedulePath}?tab=${item.key}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-sm font-bold no-underline transition-colors',
                    isActive ?
                      'border-brand-primary text-ink'
                    : 'border-transparent text-ink-soft hover:border-line hover:text-ink',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>

      {activeTab === 'schedule' ? (
        <>
          <div className="border-b border-line bg-mist/50 px-4 py-3">
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter by status">
                {SCHEDULE_STATUS_FILTERS.map((filter) => (
                  <Link
                    key={filter.key}
                    href={buildScheduleHref({ sport: activeSport?.slug, status: filter.key })}
                    aria-current={statusFilter === filter.key ? 'true' : undefined}
                    className={cn(
                      'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold no-underline transition-colors',
                      statusFilter === filter.key ?
                        'bg-ink text-paper'
                      : 'bg-paper text-ink-soft ring-1 ring-inset ring-line hover:text-ink',
                    )}
                  >
                    {filter.label} · {statusFilterCounts[filter.key]}
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2 overflow-x-auto">
                  <Link
                    href={buildScheduleHref({ status: statusFilter })}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold no-underline transition-colors',
                      !activeSport ?
                        'border-brand-primary bg-brand-primary text-paper'
                      : 'border-line bg-paper text-ink-soft hover:text-ink',
                    )}
                  >
                    All Sports
                  </Link>
                  {sports.map((sport) => (
                    <Link
                      key={sport.id}
                      href={buildScheduleHref({ sport: sport.slug, status: statusFilter })}
                      className={cn(
                        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold no-underline transition-colors',
                        activeSport?.slug === sport.slug ?
                          'border-brand-primary bg-brand-primary text-paper'
                        : 'border-line bg-paper text-ink-soft hover:text-ink',
                      )}
                    >
                      {sport.name}
                    </Link>
                  ))}
                </div>
                <ScheduleFavoritesToggle eventSlug={event.slug} containerId="schedule-matches" />
              </div>
            </div>
          </div>

          <section className="px-4 py-8" aria-label="Published matches">
            <div className="mx-auto max-w-4xl" id="schedule-matches">
              {visibleMatches.length === 0 ? (
                <Card className="text-sm text-ink-soft">
                  {statusFilter === 'results' ?
                    'No results published yet for this filter. Check back once matches are finished.'
                  : statusFilter === 'upcoming' ?
                    'No upcoming matches for this filter right now.'
                  : 'No public matches match this filter yet. Check back closer to the event.'}
                </Card>
              ) : (
                <div className="flex flex-col gap-8">
                  {orderedDateKeys.map((dateKey) => {
                    const rows = groups.get(dateKey) || []
                    const label =
                      dateKey === 'unscheduled' ? 'Date to be confirmed' : (
                        formatDateLabel(rows[0]?.scheduled_start_at, timezone)
                      )

                    return (
                      <div key={dateKey}>
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                          {label}
                        </h2>
                        <div className="flex flex-col gap-3">
                          {rows.map((match) => {
                            const entryAId = getRelationshipId(match.participant_a_entry_id)
                            const entryBId = getRelationshipId(match.participant_b_entry_id)
                            const winnerId = getRelationshipId(match.winner_entry_id)
                            const aIsWinner = Boolean(winnerId) && winnerId === entryAId
                            const bIsWinner = Boolean(winnerId) && winnerId === entryBId
                            const matchSets = (setsByMatch.get(String(match.id)) || [])
                              .slice()
                              .sort((left, right) => left.set_number - right.set_number)
                            const hasSets = matchSets.length > 0
                            // Which side won each individual set - independent of who won the
                            // match overall (the eventual loser can still take a set or two in a
                            // multi-set match), so each set-score gets its own winner highlight
                            // rather than inheriting the whole row's winner styling.
                            const setWinners = matchSets.map((set) => {
                              const aScore = set.participant_a_score ?? 0
                              const bScore = set.participant_b_score ?? 0
                              if (aScore > bScore) return 'a'
                              if (bScore > aScore) return 'b'
                              return null
                            })
                            const rowsData = [
                              {
                                key: 'a',
                                id: entryAId,
                                label: getRelationshipLabel(match.participant_a_entry_id),
                                clubLabel: entryAId !== undefined ? clubLabelByEntryId.get(String(entryAId)) : undefined,
                                isWinner: aIsWinner,
                                scores: matchSets.map((set) => set.participant_a_score),
                              },
                              {
                                key: 'b',
                                id: entryBId,
                                label: getRelationshipLabel(match.participant_b_entry_id),
                                clubLabel: entryBId !== undefined ? clubLabelByEntryId.get(String(entryBId)) : undefined,
                                isWinner: bIsWinner,
                                scores: matchSets.map((set) => set.participant_b_score),
                              },
                            ]

                            return (
                              <Link
                                key={match.id}
                                href={`${eventPath}/matches/${match.match_number}`}
                                data-match-entries={[entryAId, entryBId].filter(Boolean).join(',')}
                                className="block no-underline"
                              >
                                <Card interactive accent="blue" className="flex flex-col gap-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardDescription>
                                      {getRelationshipLabel(match.sport_id)} /{' '}
                                      {getRelationshipLabel(match.category_id)}
                                    </CardDescription>
                                    <StatusBadge tone={getMatchStatusTone(match.status)}>
                                      {formatStatus(match.status)}
                                    </StatusBadge>
                                  </div>

                                  {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.6 + the redesigned
                                      match-detail scoreboard: a real scoreline, not a comma-joined
                                      string ("17-21, 19-21" reads as one ambiguous number sequence,
                                      not two participants' per-set scores). One row per participant,
                                      one column per set - "Rusy 21 19 21 / Roza 11 21 13" instead of
                                      "17-21, 19-21". A match with no recorded sets yet falls back to a
                                      plain "vs" pill (not a misleading "0-0"). Winner's row is bold in
                                      `text-ink`; loser's dims to `font-semibold text-ink-soft`. */}
                                  {hasSets ? (
                                    <div className="flex flex-col divide-y divide-line rounded-card border border-line">
                                      {rowsData.map((row) => (
                                        <div
                                          key={row.key}
                                          className={cn(
                                            'flex items-center justify-between gap-3 px-3 py-1.5',
                                            row.isWinner && 'bg-mist',
                                          )}
                                        >
                                          <span className="flex min-w-0 flex-col">
                                            <span className="flex min-w-0 items-center gap-1">
                                              <span
                                                className={cn(
                                                  'truncate text-sm sm:text-base',
                                                  row.isWinner ? 'font-extrabold text-ink' : 'font-semibold text-ink-soft',
                                                )}
                                                title={row.label}
                                              >
                                                {row.label}
                                              </span>
                                              {row.id ? (
                                                <FavoriteStar eventSlug={event.slug} entryId={row.id} label={row.label} />
                                              ) : null}
                                            </span>
                                            {row.clubLabel ? (
                                              <span className="truncate text-xs text-ink-soft" title={row.clubLabel}>
                                                {row.clubLabel}
                                              </span>
                                            ) : null}
                                          </span>
                                          <div className="flex shrink-0 gap-1.5">
                                            {row.scores.map((score, index) => {
                                              const wonThisSet = setWinners[index] === row.key
                                              return (
                                                <span
                                                  key={index}
                                                  className={cn(
                                                    'flex w-6 items-center justify-center rounded-full text-center text-sm font-bold tabular-nums sm:text-base',
                                                    wonThisSet ?
                                                      'bg-green/15 text-green'
                                                    : row.isWinner ? 'text-ink'
                                                    : 'text-ink-soft',
                                                  )}
                                                >
                                                  {score ?? '–'}
                                                </span>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 sm:gap-3">
                                      <div className="flex min-w-0 flex-1 flex-col">
                                        <div className="flex min-w-0 items-center gap-1">
                                          <span
                                            className="truncate text-sm font-bold text-ink sm:text-base"
                                            title={rowsData[0].label}
                                          >
                                            {rowsData[0].label}
                                          </span>
                                          {entryAId ? (
                                            <FavoriteStar eventSlug={event.slug} entryId={entryAId} label={rowsData[0].label} />
                                          ) : null}
                                        </div>
                                        {rowsData[0].clubLabel ? (
                                          <span className="truncate text-xs text-ink-soft" title={rowsData[0].clubLabel}>
                                            {rowsData[0].clubLabel}
                                          </span>
                                        ) : null}
                                      </div>
                                      <span className="shrink-0 rounded-full border border-line bg-mist px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase">
                                        vs
                                      </span>
                                      <div className="flex min-w-0 flex-1 flex-col items-end">
                                        <div className="flex min-w-0 items-center gap-1">
                                          {entryBId ? (
                                            <FavoriteStar eventSlug={event.slug} entryId={entryBId} label={rowsData[1].label} />
                                          ) : null}
                                          <span
                                            className="truncate text-right text-sm font-bold text-ink sm:text-base"
                                            title={rowsData[1].label}
                                          >
                                            {rowsData[1].label}
                                          </span>
                                        </div>
                                        {rowsData[1].clubLabel ? (
                                          <span className="truncate text-right text-xs text-ink-soft" title={rowsData[1].clubLabel}>
                                            {rowsData[1].clubLabel}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                  {hasSets && match.status === 'finished' ? (
                                    <p className="text-[0.65rem] font-semibold text-ink-soft">
                                      Provisional - pending official publication
                                    </p>
                                  ) : null}

                                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink-soft">
                                    <span>{match.match_number} / {match.round_name || 'Scheduled Match'}</span>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                        {formatTimeOnly(match.scheduled_start_at, timezone)}
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                        {getRelationshipLabel(match.venue_id)} /{' '}
                                        {getRelationshipLabel(match.court_id)}
                                      </span>
                                    </div>
                                  </div>
                                </Card>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'standings' ? (
        <section className="px-4 py-8" aria-label="Competition standings">
          <div className="mx-auto flex max-w-4xl flex-col gap-8">
            {standingScopes.size === 0 ? (
              <Card className="text-sm text-ink-soft">
                No standings are available yet. Standings appear after a group or round-robin match
                has a finished result.
              </Card>
            ) : (
              Array.from(standingScopes.entries()).map(([scopeKey, rows]) => (
                <div key={scopeKey}>
                  <p className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                    {scopeKey}
                  </p>

                  <Card className="hidden overflow-x-auto p-0 sm:block">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-ink-soft">
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Entry</th>
                          <th className="px-3 py-3 text-right">P</th>
                          <th className="px-3 py-3 text-right">W</th>
                          <th className="px-3 py-3 text-right">D</th>
                          <th className="px-3 py-3 text-right">L</th>
                          <th className="px-3 py-3 text-right">Pts</th>
                          <th className="px-3 py-3 text-right">SD</th>
                          <th className="px-3 py-3 text-right">Set</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((standing) => {
                          const standingEntryId = getRelationshipId(standing.entry_id)
                          const standingClub =
                            standingEntryId !== undefined ? clubLabelByEntryId.get(String(standingEntryId)) : undefined
                          return (
                          <tr key={standing.id} className="border-b border-line last:border-0">
                            <td className="px-4 py-3 font-bold tabular-nums">{standing.rank}</td>
                            <td className="px-4 py-3 font-semibold">
                              {getRelationshipLabel(standing.entry_id)}
                              {standingClub ? (
                                <span className="block text-xs font-semibold text-ink-soft">{standingClub}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">{standing.played}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{standing.won}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{standing.drawn}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{standing.lost}</td>
                            <td className="px-3 py-3 text-right font-bold tabular-nums">
                              {standing.points}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {standing.score_difference}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {standing.set_for}-{standing.set_against}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge tone={getQualifiedTone(standing.qualified_status)}>
                                {formatStatus(standing.qualified_status)}
                              </StatusBadge>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </Card>

                  <div className="flex flex-col gap-3 sm:hidden">
                    {rows.map((standing) => {
                      const standingEntryId = getRelationshipId(standing.entry_id)
                      const standingClub =
                        standingEntryId !== undefined ? clubLabelByEntryId.get(String(standingEntryId)) : undefined
                      return (
                      <Card key={standing.id}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-extrabold tabular-nums text-ink">
                              {standing.rank}
                            </span>
                            <div>
                              <CardTitle>{getRelationshipLabel(standing.entry_id)}</CardTitle>
                              {standingClub ? (
                                <p className="text-xs font-semibold text-ink-soft">{standingClub}</p>
                              ) : null}
                            </div>
                          </div>
                          <StatusBadge tone={getQualifiedTone(standing.qualified_status)}>
                            {formatStatus(standing.qualified_status)}
                          </StatusBadge>
                        </div>
                        <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                          <div>
                            <dt className="font-bold uppercase tracking-wide text-ink-soft">P</dt>
                            <dd className="mt-0.5 font-bold tabular-nums text-ink">{standing.played}</dd>
                          </div>
                          <div>
                            <dt className="font-bold uppercase tracking-wide text-ink-soft">W-D-L</dt>
                            <dd className="mt-0.5 font-bold tabular-nums text-ink">
                              {standing.won}-{standing.drawn}-{standing.lost}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-bold uppercase tracking-wide text-ink-soft">Pts</dt>
                            <dd className="mt-0.5 font-bold tabular-nums text-ink">{standing.points}</dd>
                          </div>
                          <div>
                            <dt className="font-bold uppercase tracking-wide text-ink-soft">SD</dt>
                            <dd className="mt-0.5 font-bold tabular-nums text-ink">
                              {standing.score_difference}
                            </dd>
                          </div>
                        </dl>
                      </Card>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab === 'champions' ? (
        <section className="px-4 py-8" aria-label="Champion list">
          <div className="mx-auto max-w-4xl">
            {brackets.length === 0 ? (
              <Card className="text-sm text-ink-soft">
                No bracket caches are available yet. Champions will appear after elimination
                brackets are generated.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {brackets.map((bracket) => {
                  const champion = getChampion(bracket.bracket_data)
                  const isDecided = champion.status === 'decided'
                  const championClub =
                    isDecided && champion.entry_id !== undefined
                      ? clubLabelByEntryId.get(String(champion.entry_id))
                      : undefined

                  return (
                    <Card
                      key={bracket.id}
                      className={cn(
                        'flex flex-col gap-3',
                        isDecided && 'border-gold bg-gradient-to-br from-paper to-mist',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                          {getRelationshipLabel(bracket.category_id)} /{' '}
                          {getRelationshipLabel(bracket.stage_id)}
                        </p>
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            isDecided ? 'bg-gold text-paper' : 'bg-mist text-ink-soft',
                          )}
                        >
                          <Crown className="h-5 w-5" aria-hidden="true" />
                        </span>
                      </div>

                      <h2 className={cn('text-2xl font-extrabold', !isDecided && 'text-ink-soft')}>
                        {isDecided ? champion.label : 'Not decided yet'}
                      </h2>
                      {championClub ? (
                        <p className="-mt-2 text-sm font-semibold text-ink-soft">{championClub}</p>
                      ) : null}
                      <p className="text-sm text-ink-soft">{champion.reason}</p>

                      {champion.match_number ? (
                        <Link
                          href={`${eventPath}/matches/${champion.match_number}`}
                          className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
                        >
                          View deciding match
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

    </main>
  )
}
