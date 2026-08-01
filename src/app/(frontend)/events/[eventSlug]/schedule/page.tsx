import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowRight, BarChart3, Calendar, Clock, Crown, MapPin } from 'lucide-react'

import config from '@payload-config'
import { cn } from '@/lib/utils'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import { AutoRefresh } from '@/components/auto-refresh'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone, type StatusTone } from '@/components/ui/status-badge'
import {
  formatDateLabel,
  formatStatus,
  formatTimeOnly,
  getDateKey,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../../publicEvents'

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
  sport_id?: SportDoc | string | number | null
  category_id?: CategoryDoc | string | number | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
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
  searchParams: Promise<{ sport?: string; tab?: string }>
}

const getActiveTab = (value?: string): ActiveTab => {
  if (value === 'standings' || value === 'champions') {
    return value
  }
  return 'schedule'
}

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
  const { sport: sportSlug, tab } = await searchParams
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const eventPath = `/events/${event.slug}`
  const schedulePath = `${eventPath}/schedule`
  const activeTab = getActiveTab(tab)

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
  const sports = sportsResult.docs as SportDoc[]
  const activeSport = sportSlug ? sports.find((sport) => sport.slug === sportSlug) : undefined

  const matches =
    activeSport ?
      allMatches.filter(
        (match) => typeof match.sport_id === 'object' && match.sport_id?.slug === activeSport.slug,
      )
    : allMatches

  const groups = matches.reduce<Map<string, ScheduleMatch[]>>((map, match) => {
    const dateKey = getDateKey(match.scheduled_start_at) || 'unscheduled'
    const rows = map.get(dateKey) || []
    rows.push(match)
    map.set(dateKey, rows)
    return map
  }, new Map())
  const orderedDateKeys = Array.from(groups.keys()).sort((left, right) => {
    if (left === 'unscheduled') return 1
    if (right === 'unscheduled') return -1
    return left.localeCompare(right)
  })
  const getCategoryHref = (match: ScheduleMatch) => {
    if (
      match.sport_id &&
      typeof match.sport_id === 'object' &&
      match.sport_id.slug &&
      match.category_id &&
      typeof match.category_id === 'object' &&
      match.category_id.slug
    ) {
      return `${eventPath}/sports/${match.sport_id.slug}/${match.category_id.slug}`
    }

    return ''
  }

  const standings = standingsResult.docs as StandingDoc[]
  const standingScopes = standings.reduce<Map<string, StandingDoc[]>>((map, standing) => {
    const scopeKey = getStandingScopeKey(standing)
    const rows = map.get(scopeKey) || []
    rows.push(standing)
    map.set(scopeKey, rows)
    return map
  }, new Map())

  const brackets = bracketsResult.docs as ChampionBracket[]

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              Schedule, Standings &amp; Champions
            </p>
            <AutoRefresh showIndicator className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-soft" />
          </div>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{event.name}</h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Every published match, live rankings, and decided champions for this event, in one
            place.
          </p>
        </div>
      </section>

      <div className="sticky top-20 z-40 border-y border-line bg-paper px-4 py-3">
        <nav className="mx-auto flex max-w-4xl gap-2 overflow-x-auto" aria-label="Sections">
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
                  'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold no-underline transition-colors',
                  isActive ?
                    'border-green bg-green text-paper'
                  : 'border-line bg-paper text-ink-soft hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {activeTab === 'schedule' ? (
        <>
          <div className="border-b border-line bg-mist/50 px-4 py-3">
            <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto">
              <Link
                href={`${schedulePath}?tab=schedule`}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold no-underline transition-colors',
                  !activeSport ?
                    'border-green bg-green text-paper'
                  : 'border-line bg-paper text-ink-soft hover:text-ink',
                )}
              >
                All Sports
              </Link>
              {sports.map((sport) => (
                <Link
                  key={sport.id}
                  href={`${schedulePath}?tab=schedule&sport=${sport.slug}`}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold no-underline transition-colors',
                    activeSport?.slug === sport.slug ?
                      'border-green bg-green text-paper'
                    : 'border-line bg-paper text-ink-soft hover:text-ink',
                  )}
                >
                  {sport.name}
                </Link>
              ))}
            </div>
          </div>

          <section className="px-4 py-8" aria-label="Published matches">
            <div className="mx-auto max-w-4xl">
              {matches.length === 0 ? (
                <Card className="text-sm text-ink-soft">
                  No public matches match this filter yet. Check back closer to the event.
                </Card>
              ) : (
                <div className="flex flex-col gap-8">
                  {orderedDateKeys.map((dateKey) => {
                    const rows = groups.get(dateKey) || []
                    const label =
                      dateKey === 'unscheduled' ? 'Date to be confirmed' : (
                        formatDateLabel(rows[0]?.scheduled_start_at)
                      )

                    return (
                      <div key={dateKey}>
                        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                          {label}
                        </h2>
                        <div className="flex flex-col gap-3">
                          {rows.map((match) => {
                            const categoryHref = getCategoryHref(match)

                            return (
                              <Card key={match.id} interactive accent="blue">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <CardDescription>
                                      {getRelationshipLabel(match.sport_id)} /{' '}
                                      {getRelationshipLabel(match.category_id)}
                                    </CardDescription>
                                    <CardTitle className="mt-1">
                                      {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                                      {getRelationshipLabel(match.participant_b_entry_id)}
                                    </CardTitle>
                                    <p className="mt-1 text-xs font-semibold text-ink-soft">
                                      {match.match_number} / {match.round_name || 'Scheduled Match'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-start gap-2 sm:items-end">
                                    <StatusBadge tone={getMatchStatusTone(match.status)}>
                                      {formatStatus(match.status)}
                                    </StatusBadge>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                        {formatTimeOnly(match.scheduled_start_at)}
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                        {getRelationshipLabel(match.venue_id)} /{' '}
                                        {getRelationshipLabel(match.court_id)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button asChild variant="secondary" size="sm">
                                        <Link href={`${eventPath}/matches/${match.match_number}`}>
                                          Match detail
                                        </Link>
                                      </Button>
                                      {categoryHref ? (
                                        <Button asChild variant="ghost" size="sm">
                                          <Link href={categoryHref}>Category page</Link>
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </Card>
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
                        {rows.map((standing) => (
                          <tr key={standing.id} className="border-b border-line last:border-0">
                            <td className="px-4 py-3 font-bold tabular-nums">{standing.rank}</td>
                            <td className="px-4 py-3 font-semibold">
                              {getRelationshipLabel(standing.entry_id)}
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
                        ))}
                      </tbody>
                    </table>
                  </Card>

                  <div className="flex flex-col gap-3 sm:hidden">
                    {rows.map((standing) => (
                      <Card key={standing.id}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-extrabold tabular-nums text-ink">
                              {standing.rank}
                            </span>
                            <CardTitle>{getRelationshipLabel(standing.entry_id)}</CardTitle>
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
                    ))}
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
                      <p className="text-sm text-ink-soft">{champion.reason}</p>

                      {champion.match_number ? (
                        <Link
                          href={`${eventPath}/matches/${champion.match_number}`}
                          className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
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
