import Link from 'next/link'
import { getPayload } from 'payload'
import {
  ArrowRight,
  ChevronRight,
  Circle,
  Clock,
  CircleDot,
  Crown,
  Gamepad2,
  Goal,
  Sparkles,
  Table2,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

import config from '@payload-config'
import { Countdown } from '@/components/countdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { formatStatus, getRelationshipLabel, type RelationshipDoc } from './workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

type EventDoc = {
  id: string | number
  name: string
  description?: string | null
  event_start_at: string
  event_end_at: string
}

type SportDoc = {
  id: string | number
  name: string
  slug: string
  sport_type: string
}

type HomeMatch = {
  id: string | number
  match_number: string
  status: string
  scheduled_start_at?: string | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
}

const LIVE_STATUSES = ['ongoing', 'paused']
const UPCOMING_STATUSES = ['scheduled', 'published', 'ready_to_start', 'check_in_open']

const SPORT_ICONS: Record<string, LucideIcon> = {
  court: CircleDot,
  field: Goal,
  table: Table2,
  board: Crown,
  esport: Gamepad2,
  track: Timer,
  other: Trophy,
}

const formatMatchTime = (value?: string | null) => {
  if (!value) {
    return 'Time TBD'
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

export default async function HomePage() {
  const payload = await getPayload({ config })

  const [eventsResult, liveNextResult, sportsResult] = await Promise.all([
    payload.find({
      collection: 'events',
      limit: 1,
      sort: '-event_start_at',
    }),
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 6,
      sort: 'scheduled_start_at',
      where: {
        and: [
          { is_public: { equals: true } },
          {
            or: [
              { status: { in: LIVE_STATUSES } },
              {
                and: [
                  { status: { in: UPCOMING_STATUSES } },
                  { scheduled_start_at: { greater_than_equal: new Date().toISOString() } },
                ],
              },
            ],
          },
        ],
      },
    }),
    payload.find({
      collection: 'sports',
      depth: 0,
      limit: 20,
      sort: 'name',
      where: { is_active: { equals: true } },
    }),
  ])

  const event = eventsResult.docs[0] as EventDoc | undefined
  const matches = liveNextResult.docs as HomeMatch[]
  const sports = sportsResult.docs as SportDoc[]

  const categoriesResult = sports.length
    ? await payload.find({
        collection: 'competition-categories',
        depth: 0,
        limit: 200,
        where: { sport_id: { in: sports.map((sport) => sport.id) } },
      })
    : null

  const categoryCountBySport = new Map<string, number>()
  for (const category of (categoriesResult?.docs ?? []) as unknown as Array<{
    sport_id: string | number | { id: string | number }
  }>) {
    const sportId = typeof category.sport_id === 'object' ? category.sport_id.id : category.sport_id
    const key = String(sportId)
    categoryCountBySport.set(key, (categoryCountBySport.get(key) || 0) + 1)
  }

  const liveMatches = matches.filter((match) => LIVE_STATUSES.includes(match.status))
  const nextMatches = matches.filter((match) => !LIVE_STATUSES.includes(match.status))
  const orderedMatches = [...liveMatches, ...nextMatches]

  return (
    <main className="font-sans text-ink">
      <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-green/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-24 -right-16 h-80 w-80 rounded-full bg-blue/25 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-5xl flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
              <Sparkles className="h-3.5 w-3.5 text-green" aria-hidden="true" />
              {event?.name || 'ROC Olympic 2026'}
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Where Colleagues Become
              <br />
              <span className="bg-gradient-to-r from-green to-blue bg-clip-text text-transparent">
                Champions
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg">
              {event?.description ||
                'Follow every match, standing, and bracket from the office olympiad — live scores, schedules, and results in one place.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/schedule">
                  View Schedule
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/brackets">See Brackets</Link>
              </Button>
            </div>
          </div>

          {event ? (
            <Countdown
              startIso={event.event_start_at}
              endIso={event.event_end_at}
              className="lg:shrink-0"
            />
          ) : null}
        </div>
      </section>

      <section className="px-4 py-10" aria-labelledby="live-next-title">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="live-next-title" className="text-xl font-bold text-ink sm:text-2xl">
              Live Now &amp; Next Up
            </h2>
            <Link
              href="/schedule"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
            >
              Full schedule
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {orderedMatches.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              No public matches are live or upcoming right now. Check back closer to the event.
            </Card>
          ) : (
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
              {orderedMatches.map((match) => {
                const isLive = LIVE_STATUSES.includes(match.status)

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.match_number}`}
                    className="block w-72 shrink-0 snap-start"
                  >
                    <Card interactive accent={isLive ? 'green' : 'blue'} className="h-full">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardDescription>
                            {getRelationshipLabel(match.sport_id)} ·{' '}
                            {getRelationshipLabel(match.category_id)}
                          </CardDescription>
                          <StatusBadge tone={isLive ? 'gold' : getMatchStatusTone(match.status)}>
                            {isLive ? (
                              <span className="inline-flex items-center gap-1">
                                <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
                                Live
                              </span>
                            ) : (
                              formatStatus(match.status)
                            )}
                          </StatusBadge>
                        </div>
                        <CardTitle className="text-base">
                          {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                          {getRelationshipLabel(match.participant_b_entry_id)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-2 text-sm text-ink-soft">
                        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {formatMatchTime(match.scheduled_start_at)}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="sports-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="sports-title" className="mb-5 text-xl font-bold text-ink sm:text-2xl">
            Sports at {event?.name || 'ROC Olympic 2026'}
          </h2>

          {sports.length === 0 ? (
            <Card className="text-sm text-ink-soft">Sports have not been published yet.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sports.map((sport) => {
                const Icon = SPORT_ICONS[sport.sport_type] || Trophy
                const categoryCount = categoryCountBySport.get(String(sport.id)) || 0

                return (
                  <Link key={sport.id} href={`/schedule?sport=${sport.slug}`} className="block">
                    <Card interactive accent="blue" className="h-full">
                      <CardHeader>
                        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-mist text-green">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <CardTitle>{sport.name}</CardTitle>
                        <CardDescription>
                          {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="text-sm font-semibold text-blue">
                        View schedule
                        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                      </CardFooter>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
