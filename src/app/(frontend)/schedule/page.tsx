import Link from 'next/link'
import { getPayload } from 'payload'
import { Calendar, Clock, MapPin } from 'lucide-react'

import config from '@payload-config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import {
  formatDateLabel,
  formatStatus,
  formatTimeOnly,
  getDateKey,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

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

type SchedulePageProps = {
  searchParams: Promise<{ sport?: string }>
}

export default async function PublicSchedulePage({ searchParams }: SchedulePageProps) {
  const { sport: sportSlug } = await searchParams
  const payload = await getPayload({ config })

  const [matchesResult, sportsResult] = await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 100,
      sort: 'scheduled_start_at',
      where: { is_public: { equals: true } },
    }),
    payload.find({
      collection: 'sports',
      depth: 0,
      limit: 20,
      sort: 'name',
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
      return `/sports/${match.sport_id.slug}/${match.category_id.slug}`
    }

    return ''
  }

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Public Schedule
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">ROC Olympic 2026 Schedule</h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Every published match for this event, grouped by day. Filter by sport to find what
            you're looking for faster.
          </p>
        </div>
      </section>

      <div className="sticky top-20 z-40 border-y border-line bg-paper px-4 py-3">
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto">
          <Link
            href="/schedule"
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold no-underline transition-colors',
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
              href={`/schedule?sport=${sport.slug}`}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold no-underline transition-colors',
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
                                    <Link href={`/matches/${match.match_number}`}>Match detail</Link>
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

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-4xl">
          <Card className="flex items-center gap-3 text-sm text-ink-soft">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            Need the raw data? The backoffice keeps the full record at{' '}
            <a className="font-semibold text-blue hover:underline" href="/admin/collections/matches">
              /admin/collections/matches
            </a>
            .
          </Card>
        </div>
      </section>
    </main>
  )
}
