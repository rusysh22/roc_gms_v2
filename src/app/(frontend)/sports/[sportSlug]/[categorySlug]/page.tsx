import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock, Info, MapPin, ScrollText, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone, type StatusTone } from '@/components/ui/status-badge'
import { AnnouncementFeed, ArticleCard } from '../../../contentComponents'
import {
  getRelatedPublicArticles,
  getRelationshipId,
  getScopedPublicAnnouncements,
} from '../../../contentData'
import { BracketTree } from '../../../brackets/bracketTree'
import {
  formatDateLabel,
  formatDateTime,
  formatStatus,
  formatTimeOnly,
  getDateKey,
  getRelationshipLabel,
} from '../../../workspaces/workspaceComponents'
import {
  getCategoryDetail,
  standingFormatTypes,
  type PublicMatch,
  type RulesetDoc,
  type StandingRow,
} from '../../publicSportData'

export const dynamic = 'force-dynamic'

type PageParams = Promise<{ sportSlug: string; categorySlug: string }>
type PageSearchParams = Promise<{ tab?: string }>
type ActiveTab = 'competition' | 'schedule' | 'details'

const getActiveTab = (value?: string): ActiveTab => {
  if (value === 'schedule' || value === 'details') {
    return value
  }

  return 'competition'
}

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

const getRuleset = (value: RulesetDoc | string | number | null | undefined) =>
  value && typeof value === 'object' ? value : undefined

const getRulesetFacts = (ruleset?: RulesetDoc) => {
  if (!ruleset) {
    return []
  }

  return [
    ruleset.score_type ? ['Scoring', formatStatus(ruleset.score_type)] : null,
    ruleset.set_based ? ['Format', ruleset.best_of ? `Best of ${ruleset.best_of}` : 'Set based'] : null,
    ruleset.target_score ? ['Target score', ruleset.target_score] : null,
    ruleset.allow_draw ? ['Draws', 'Allowed'] : ['Draws', 'Not expected'],
    typeof ruleset.points_win === 'number' ? ['Win points', ruleset.points_win] : null,
    typeof ruleset.points_draw === 'number' ? ['Draw points', ruleset.points_draw] : null,
    typeof ruleset.points_loss === 'number' ? ['Loss points', ruleset.points_loss] : null,
    ruleset.period_count && ruleset.period_duration ?
      ['Match time', `${ruleset.period_count} x ${ruleset.period_duration} min`]
    : null,
  ].filter(Boolean) as Array<[string, string | number]>
}

const groupMatchesByDate = (matches: PublicMatch[]) =>
  matches.reduce<Map<string, PublicMatch[]>>((map, match) => {
    const dateKey = getDateKey(match.scheduled_start_at) || 'unscheduled'
    const rows = map.get(dateKey) || []
    rows.push(match)
    map.set(dateKey, rows)
    return map
  }, new Map())

const getStandingScopeKey = (standing: StandingRow) =>
  [
    getRelationshipLabel(standing.stage_id, 'Stage'),
    getRelationshipLabel(standing.group_id, 'No group'),
  ].join(' / ')

const CategoryStandings = ({ standings }: { standings: StandingRow[] }) => {
  if (standings.length === 0) {
    return (
      <Card className="text-sm text-ink-soft">
        Standings will appear here once group, round-robin, or league results are ready.
      </Card>
    )
  }

  const scopes = standings.reduce<Map<string, StandingRow[]>>((map, standing) => {
    const scopeKey = getStandingScopeKey(standing)
    const rows = map.get(scopeKey) || []
    rows.push(standing)
    map.set(scopeKey, rows)
    return map
  }, new Map())

  return (
    <div className="flex flex-col gap-6">
      {Array.from(scopes.entries()).map(([scopeKey, rows]) => (
        <div key={scopeKey}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
            {scopeKey}
          </p>
          <Card className="hidden overflow-x-auto p-0 md:block">
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
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-bold tabular-nums">{row.rank}</td>
                    <td className="px-4 py-3 font-semibold">{getRelationshipLabel(row.entry_id)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.played}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.won}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.drawn}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.lost}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{row.points}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.score_difference}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={getQualifiedTone(row.qualified_status)}>
                        {formatStatus(row.qualified_status)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <Card key={row.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      #{row.rank} {getRelationshipLabel(row.entry_id)}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {row.played} played / {row.won}-{row.drawn}-{row.lost} / {row.points} pts
                    </p>
                  </div>
                  <StatusBadge tone={getQualifiedTone(row.qualified_status)}>
                    {formatStatus(row.qualified_status)}
                  </StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const CategorySchedule = ({
  matches,
  sportSlug,
  categorySlug,
}: {
  matches: PublicMatch[]
  sportSlug: string
  categorySlug: string
}) => {
  if (matches.length === 0) {
    return (
      <Card className="text-sm text-ink-soft">
        No public matches are scheduled for this category yet. Please check again closer to match
        day.
      </Card>
    )
  }

  const groups = groupMatchesByDate(matches)
  const orderedDateKeys = Array.from(groups.keys()).sort((left, right) => {
    if (left === 'unscheduled') return 1
    if (right === 'unscheduled') return -1
    return left.localeCompare(right)
  })

  return (
    <div className="flex flex-col gap-6">
      {orderedDateKeys.map((dateKey) => {
        const rows = groups.get(dateKey) || []
        const label =
          dateKey === 'unscheduled' ? 'Date to be confirmed' : formatDateLabel(rows[0]?.scheduled_start_at)

        return (
          <div key={dateKey}>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">{label}</h3>
            <div className="flex flex-col gap-3">
              {rows.map((match) => (
                <Card key={match.id} interactive accent="blue">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <CardDescription>{match.round_name || 'Match'}</CardDescription>
                      <CardTitle className="mt-1">
                        {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                        {getRelationshipLabel(match.participant_b_entry_id)}
                      </CardTitle>
                      <p className="mt-1 text-xs font-semibold text-ink-soft">
                        {match.match_number} /{' '}
                        <Link
                          href={`/sports/${sportSlug}/${categorySlug}`}
                          className="text-blue hover:underline"
                        >
                          category page
                        </Link>
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 lg:items-end">
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
                          {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
                        </span>
                      </div>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/matches/${match.match_number}`}>Match detail</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function PublicSportCategoryPage({
  params,
  searchParams,
}: {
  params: PageParams
  searchParams: PageSearchParams
}) {
  const [{ sportSlug, categorySlug }, { tab }] = await Promise.all([params, searchParams])
  const data = await getCategoryDetail(sportSlug, categorySlug)
  if (!data) {
    notFound()
  }

  const { sport, category, stages, matches, standings, bracket } = data
  const activeTab = getActiveTab(tab)
  const ruleset = getRuleset(category.ruleset_id)
  const usesBracket = category.format_type === 'single_elimination'
  const usesStandings = standingFormatTypes.has(category.format_type)
  const competitionLabel = usesBracket ? 'Bracket' : 'Standings'
  const rulesetFacts = getRulesetFacts(ruleset)
  const eventId = getRelationshipId(category.event_id) || getRelationshipId(sport.event_id)
  const sportId = getRelationshipId(sport)
  const categoryId = getRelationshipId(category)
  const [announcements, relatedArticles] = await Promise.all([
    getScopedPublicAnnouncements({
      eventId,
      sportId,
      categoryId,
      limit: 4,
    }),
    getRelatedPublicArticles({
      eventId,
      sportId,
      categoryId,
      limit: 3,
    }),
  ])

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/sports"
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-blue no-underline hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sports
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{sport.name}</p>
              <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{category.name}</h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
                {sport.description ||
                  'Follow this category from the first scheduled match through the final result.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={category.status === 'published' ? 'green' : 'blue'}>
                {formatStatus(category.status)}
              </StatusBadge>
              <StatusBadge tone="neutral">{formatStatus(category.participant_mode)}</StatusBadge>
              <StatusBadge tone="neutral">{formatStatus(category.format_type)}</StatusBadge>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="mx-auto max-w-7xl">
          <AnnouncementFeed
            announcements={announcements}
            title="Category Announcements"
            compact
          />
        </div>
      </section>

      <div className="sticky top-20 z-40 border-y border-line bg-paper px-4 py-3">
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto" aria-label="Category sections">
          {[
            { key: 'competition', label: competitionLabel, icon: Trophy },
            { key: 'schedule', label: 'Schedule', icon: CalendarDays },
            { key: 'details', label: 'Details & Rules', icon: ScrollText },
          ].map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.key
            return (
              <Link
                key={item.key}
                href={`/sports/${sportSlug}/${categorySlug}?tab=${item.key}`}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold no-underline transition-colors ${
                  isActive ?
                    'border-green bg-green text-paper'
                  : 'border-line bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {activeTab === 'competition' ? (
        <section className="px-4 py-8" aria-label={competitionLabel}>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    Primary view
                  </p>
                  <h2 className="text-2xl font-extrabold">{competitionLabel}</h2>
                </div>
                {usesBracket && bracket ? (
                  <StatusBadge tone={bracket.status === 'published' ? 'green' : 'neutral'}>
                    {formatStatus(bracket.status)}
                  </StatusBadge>
                ) : null}
              </div>

              {usesBracket ?
                bracket?.bracket_data?.rounds?.length ?
                  <BracketTree
                    rounds={bracket.bracket_data.rounds}
                    champion={bracket.bracket_data.champion}
                  />
                : <Card className="text-sm text-ink-soft">
                    This bracket is not available yet. It will appear once the category is seeded.
                  </Card>
              : usesStandings ?
                <CategoryStandings standings={standings} />
              : <Card className="text-sm text-ink-soft">
                  This category format does not use a bracket or standings table yet. Follow the
                  schedule for match-by-match updates.
                </Card>}
            </div>

            <aside className="flex flex-col gap-4">
              <Card>
                <CardTitle>Category Overview</CardTitle>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Format</dt>
                    <dd className="text-right font-semibold text-ink">{formatStatus(category.format_type)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Participants</dt>
                    <dd className="text-right font-semibold text-ink">{formatStatus(category.participant_mode)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Roster</dt>
                    <dd className="text-right font-semibold text-ink">
                      {category.roster_required ? 'Required' : 'Flexible'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Stages</dt>
                    <dd className="text-right font-semibold text-ink">{stages.length}</dd>
                  </div>
                </dl>
              </Card>
              <Card>
                <CardTitle>Next Matches</CardTitle>
                <div className="mt-3 flex flex-col gap-3">
                  {matches.slice(0, 4).map((match) => (
                    <Link
                      key={match.id}
                      href={`/matches/${match.match_number}`}
                      className="rounded-card border border-line px-3 py-2 transition-colors hover:border-blue"
                    >
                      <p className="truncate text-sm font-bold text-ink">
                        {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                        {getRelationshipLabel(match.participant_b_entry_id)}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {formatDateTime(match.scheduled_start_at)}
                      </p>
                    </Link>
                  ))}
                  {matches.length === 0 ? (
                    <p className="text-sm text-ink-soft">No public matches yet.</p>
                  ) : null}
                </div>
              </Card>
            </aside>
          </div>
        </section>
      ) : null}

      {activeTab === 'schedule' ? (
        <section className="px-4 py-8" aria-label="Category schedule">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Schedule</p>
              <h2 className="text-2xl font-extrabold">Matches in This Category</h2>
            </div>
            <CategorySchedule matches={matches} sportSlug={sportSlug} categorySlug={categorySlug} />
          </div>
        </section>
      ) : null}

      {activeTab === 'details' ? (
        <section className="px-4 py-8 pb-16" aria-label="Details and rules">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-green" aria-hidden="true" />
                <CardTitle>Details</CardTitle>
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">
                {sport.description ||
                  'This page collects the important public information for this category so players and supporters can follow along easily.'}
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-card border border-line px-3 py-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Sport</dt>
                  <dd className="mt-1 font-semibold text-ink">{sport.name}</dd>
                </div>
                <div className="rounded-card border border-line px-3 py-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Category</dt>
                  <dd className="mt-1 font-semibold text-ink">{category.name}</dd>
                </div>
                <div className="rounded-card border border-line px-3 py-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Format</dt>
                  <dd className="mt-1 font-semibold text-ink">{formatStatus(category.format_type)}</dd>
                </div>
                <div className="rounded-card border border-line px-3 py-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Roster</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {category.roster_required ?
                      `${category.min_roster_size || 0}-${category.max_roster_size || 'many'} players`
                    : 'Roster is flexible'}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-green" aria-hidden="true" />
                <CardTitle>Rules &amp; T&amp;C</CardTitle>
              </div>
              {ruleset?.description ? (
                <p className="text-sm leading-relaxed text-ink-soft">{ruleset.description}</p>
              ) : (
                <p className="text-sm leading-relaxed text-ink-soft">
                  Please follow committee instructions, arrive before your match time, and keep the
                  game fair and friendly. Final decisions follow the published committee rules for
                  this category.
                </p>
              )}
              {rulesetFacts.length > 0 ? (
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {rulesetFacts.map(([label, value]) => (
                    <div key={label} className="rounded-card border border-line px-3 py-2">
                      <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                        {label}
                      </dt>
                      <dd className="mt-1 font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </Card>
          </div>
        </section>
      ) : null}

      {relatedArticles.length > 0 ? (
        <section className="px-4 pb-16" aria-labelledby="category-articles-title">
          <div className="mx-auto max-w-5xl">
            <h2 id="category-articles-title" className="mb-4 text-xl font-bold text-ink">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {relatedArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}
