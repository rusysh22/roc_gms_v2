import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Circle,
  Clock,
  CircleDot,
  Crown,
  Gamepad2,
  Goal,
  MapPin,
  Sparkles,
  Table2,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

import config from '@payload-config'
import { AutoRefresh } from '@/components/auto-refresh'
import { Countdown } from '@/components/countdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { AnnouncementFeed, ArticleCard } from '../../contentComponents'
import { getPublicArticles, getScopedPublicAnnouncements } from '../../contentData'
import { EditableRegion, EventPublicEditor, PublicEditToolbar } from '../../publicEditComponents'
import { getPublicEditState } from '../../publicEditState'
import {
  formatDateLabel,
  formatStatus,
  getDateKey,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../publicEvents'

export const dynamic = 'force-dynamic'

type SportDoc = {
  id: string | number
  name: string
  slug: string
  sport_type: string
}

type CategoryDoc = {
  id: string | number
  name: string
  slug: string
  sport_id: string | number | { id: string | number }
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

type ScheduledMatch = {
  id: string | number
  scheduled_start_at?: string | null
}

type StandingPreviewRow = {
  id: string | number
  rank: number
  points: number
  category_id?: RelationshipDoc | string | number | null
  entry_id?: RelationshipDoc | string | number | null
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

// A single line summary of when the event runs, e.g. "12-14 Feb 2026" or "28 Feb - 2 Mar 2026" -
// used in the hero's "at a glance" line instead of the raw start/end timestamps.
const formatEventDateRange = (startIso: string, endIso: string) => {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const tz = 'Asia/Bangkok'
  const day = (date: Date) => new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: tz }).format(date)
  const monthYear = (date: Date) =>
    new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: tz }).format(date)
  const sameMonth =
    new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: tz }).format(start) ===
    monthYear(end)

  if (start.toDateString() === end.toDateString()) {
    return new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    }).format(start)
  }

  if (sameMonth) {
    return `${day(start)}-${day(end)} ${monthYear(end)}`
  }

  return `${day(start)} ${monthYear(start)} - ${day(end)} ${monthYear(end)}`
}

// A short, human sentence of what's on offer, e.g. "Badminton, Futsal & 3 more sports" - the
// "to the point" replacement for the old raw sports/categories/clubs/teams/players counter row.
const formatSportsSummary = (sportNames: string[]) => {
  if (sportNames.length === 0) return null
  if (sportNames.length <= 2) return sportNames.join(' & ')
  const [first, second] = sportNames
  return `${first}, ${second} & ${sportNames.length - 2} more ${sportNames.length - 2 === 1 ? 'sport' : 'sports'}`
}

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function EventHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>
  searchParams: HomeSearchParams
}) {
  const { eventSlug } = await params
  const editState = await getPublicEditState(await searchParams)
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const eventPath = `/events/${event.slug}`
  const bannerImage =
    event.banner_image && typeof event.banner_image === 'object' ? event.banner_image : undefined
  const logoImage = event.logo && typeof event.logo === 'object' ? event.logo : undefined

  const eventWhere = { event_id: { equals: event.id } }
  const [liveNextResult, sportsResult, articles, standingsResult, upcomingMatchesResult] =
    await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 6,
      sort: 'scheduled_start_at',
      where: {
        and: [
          eventWhere,
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
      where: { and: [eventWhere, { is_active: { equals: true } }] },
    }),
    getPublicArticles(3, event.id),
    payload.find({
      collection: 'standings',
      depth: 1,
      limit: 5,
      sort: 'rank',
      where: eventWhere,
    }),
    payload.find({
      collection: 'matches',
      depth: 0,
      limit: 200,
      where: {
        and: [eventWhere, { is_public: { equals: true } }, { scheduled_start_at: { exists: true } }],
      },
    }),
  ])

  const matches = liveNextResult.docs as HomeMatch[]
  const sports = sportsResult.docs as SportDoc[]
  const sportsSummary = formatSportsSummary(sports.map((sport) => sport.name))

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 12: this query had no status filter at all, so a
  // category still in `draft` (never confirmed ready by the event admin) rendered on the public
  // event page right alongside published ones - the same open/locked/published allowlist
  // src/app/(frontend)/sports/publicSportData.ts already uses for the sports/category browse page.
  const categoriesResult = sports.length
    ? await payload.find({
        collection: 'competition-categories',
        depth: 0,
        limit: 200,
        where: {
          and: [
            { sport_id: { in: sports.map((sport) => sport.id) } },
            { status: { in: ['open', 'locked', 'published'] } },
          ],
        },
      })
    : null

  const categories = (categoriesResult?.docs ?? []) as unknown as CategoryDoc[]
  const categoriesBySport = new Map<string, CategoryDoc[]>()
  for (const category of categories) {
    const sportId = typeof category.sport_id === 'object' ? category.sport_id.id : category.sport_id
    const key = String(sportId)
    const rows = categoriesBySport.get(key) || []
    rows.push(category)
    categoriesBySport.set(key, rows)
  }

  const liveMatches = matches.filter((match) => LIVE_STATUSES.includes(match.status))
  const nextMatches = matches.filter((match) => !LIVE_STATUSES.includes(match.status))
  const orderedMatches = [...liveMatches, ...nextMatches]
  const announcements = await getScopedPublicAnnouncements({
    eventId: event.id,
    limit: 3,
  })

  const standings = standingsResult.docs as StandingPreviewRow[]

  const calendarDayCounts = (upcomingMatchesResult.docs as ScheduledMatch[]).reduce<Map<string, number>>(
    (map, match) => {
      const dateKey = getDateKey(match.scheduled_start_at)
      if (!dateKey) return map
      map.set(dateKey, (map.get(dateKey) || 0) + 1)
      return map
    },
    new Map(),
  )
  const todayKey = getDateKey(new Date().toISOString())
  const calendarDays = Array.from(calendarDayCounts.entries())
    .filter(([dateKey]) => !todayKey || dateKey >= todayKey)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 7)
    .map(([dateKey, count]) => ({
      dateKey,
      label: formatDateLabel(`${dateKey}T00:00:00`),
      count,
    }))

  return (
    <main className="font-sans text-ink">
      <PublicEditToolbar state={editState} path={eventPath} />
      <AutoRefresh />
      <section className="relative flex min-h-[85vh] items-end overflow-hidden px-4 pb-14 pt-28 sm:min-h-[90vh]">
        {bannerImage?.url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions */}
            <img
              src={bannerImage.url}
              alt={bannerImage.alt || event.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-paper via-paper/75 to-paper/10"
            />
          </>
        ) : (
          <>
            <div aria-hidden="true" className="absolute inset-0 bg-mist" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-green/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-24 -right-16 h-80 w-80 rounded-full bg-blue/25 blur-3xl"
            />
          </>
        )}

        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
              {logoImage?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions
                <img
                  src={logoImage.url}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-full object-cover"
                />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-green" aria-hidden="true" />
              )}
              {event.name}
            </p>

            <EditableRegion
              state={editState}
              label="Hero tagline"
              editor={
                <EventPublicEditor
                  id={event.id}
                  heroTagline={event.hero_tagline}
                  description={event.description}
                  visibility={event.visibility}
                  returnTo={eventPath}
                />
              }
            >
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
                {event.hero_tagline || event.name}
              </h1>
            </EditableRegion>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-green" aria-hidden="true" />
                {formatEventDateRange(event.event_start_at, event.event_end_at)}
              </span>
              {event.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-green" aria-hidden="true" />
                  {event.location}
                </span>
              ) : null}
              {sportsSummary ? (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-green" aria-hidden="true" />
                  {sportsSummary}
                </span>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href={`${eventPath}/schedule`}>
                  View Schedule
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`${eventPath}/schedule?tab=standings`}>See Standings</Link>
              </Button>
            </div>
          </div>

          <Countdown startIso={event.event_start_at} endIso={event.event_end_at} className="lg:shrink-0" />
        </div>
      </section>

      <section className="px-4 py-14" aria-labelledby="about-title">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="about-title" className="text-xl font-bold text-ink sm:text-2xl">
            About {event.name}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
            {event.description ||
              'Follow every match, standing, and bracket from this event - live scores, schedules, and results in one place.'}
          </p>
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="live-next-title">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="live-next-title" className="text-xl font-bold text-ink sm:text-2xl">
              Live Now &amp; Next Up
            </h2>
            <Link
              href={`${eventPath}/schedule`}
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
                    href={`${eventPath}/matches/${match.match_number}`}
                    className="block w-72 shrink-0 snap-start"
                  >
                    <Card interactive accent={isLive ? 'green' : 'blue'} className="h-full">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardDescription>
                            {getRelationshipLabel(match.sport_id)} /{' '}
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

        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="calendar-title" className="text-xl font-bold text-ink sm:text-2xl">
              Upcoming Match Days
            </h2>
            <Link
              href={`${eventPath}/schedule`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
            >
              Full schedule
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {calendarDays.length === 0 ? (
            <Card className="text-sm text-ink-soft">No match days are scheduled yet.</Card>
          ) : (
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {calendarDays.map((day) => (
                <Link
                  key={day.dateKey}
                  href={`${eventPath}/schedule`}
                  className="block w-36 shrink-0"
                >
                  <Card interactive accent="blue" className="flex h-full flex-col items-center gap-2 py-5 text-center">
                    <Calendar className="h-5 w-5 text-blue" aria-hidden="true" />
                    <p className="text-sm font-bold text-ink">{day.label}</p>
                    <p className="text-xs font-semibold text-ink-soft">
                      {day.count} {day.count === 1 ? 'match' : 'matches'}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="sports-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="sports-title" className="mb-5 text-xl font-bold text-ink sm:text-2xl">
            Sports at {event.name}
          </h2>

          {sports.length === 0 ? (
            <Card className="text-sm text-ink-soft">Sports have not been published yet.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sports.map((sport) => {
                const Icon = SPORT_ICONS[sport.sport_type] || Trophy
                const sportCategories = categoriesBySport.get(String(sport.id)) || []
                const primaryCategoryHref =
                  sportCategories.length === 1 ?
                    `${eventPath}/sports/${sport.slug}/${sportCategories[0].slug}`
                  : `${eventPath}/sports`

                return (
                  <Card key={sport.id} className="h-full">
                    <CardHeader>
                      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-mist text-green">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <CardTitle>{sport.name}</CardTitle>
                      <CardDescription>
                        {sportCategories.length}{' '}
                        {sportCategories.length === 1 ? 'category' : 'categories'}
                      </CardDescription>
                    </CardHeader>
                    <div className="mt-3 flex flex-col gap-2">
                      {sportCategories.slice(0, 3).map((category) => (
                        <Link
                          key={category.id}
                          href={`${eventPath}/sports/${sport.slug}/${category.slug}`}
                          className="group flex items-center justify-between gap-2 rounded-card border border-line px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-blue"
                        >
                          <span className="truncate">{category.name}</span>
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-ink-soft group-hover:text-blue"
                            aria-hidden="true"
                          />
                        </Link>
                      ))}
                    </div>
                    <CardFooter className="gap-4 text-sm font-semibold">
                      <Link href={primaryCategoryHref} className="text-blue hover:underline">
                        View categories
                      </Link>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="standings-title">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="standings-title" className="text-xl font-bold text-ink sm:text-2xl">
              Top Standings
            </h2>
            <Link
              href={`${eventPath}/schedule?tab=standings`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
            >
              Full standings
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {standings.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              Standings will appear here once group or round-robin results are ready.
            </Card>
          ) : (
            <Card className="flex flex-col divide-y divide-line p-0">
              {standings.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-extrabold tabular-nums text-ink">
                      {row.rank}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {getRelationshipLabel(row.entry_id)}
                      </p>
                      <p className="truncate text-xs text-ink-soft">
                        {getRelationshipLabel(row.category_id)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink">{row.points} pts</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </section>

      <section className="px-4 pb-16" aria-labelledby="updates-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="updates-title" className="mb-6 text-xl font-bold text-ink sm:text-2xl">
            Latest Updates
          </h2>

          {announcements.length === 0 && articles.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              Announcements and articles will appear here once published.
            </Card>
          ) : (
            <div className="flex flex-col gap-10">
              {announcements.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                      Announcements
                    </h3>
                    <Link
                      href={`${eventPath}/updates?tab=announcements`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
                    >
                      View all
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <AnnouncementFeed
                    announcements={announcements}
                    compact
                    basePath={`${eventPath}/updates?tab=announcements`}
                  />
                </div>
              ) : null}

              {articles.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                      Articles
                    </h3>
                    <Link
                      href={`${eventPath}/updates?tab=articles`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
                    >
                      View all
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {articles.map((article) => (
                      <ArticleCard key={article.id} article={article} basePath={`${eventPath}/articles`} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-line bg-mist px-4 py-10" aria-labelledby="event-info-title">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="event-info-title" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Organized by
            </h2>
            <p className="mt-1 text-lg font-extrabold text-ink">
              {event.organizer_name || event.name}
            </p>
            {event.location ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-soft">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {event.location}
              </p>
            ) : null}
            {event.contact_email ? (
              <p className="mt-1 text-sm text-ink-soft">
                Questions?{' '}
                <a href={`mailto:${event.contact_email}`} className="font-semibold text-blue hover:underline">
                  {event.contact_email}
                </a>
              </p>
            ) : null}
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold" aria-label="Event quick links">
            <Link href={`${eventPath}/sports`} className="text-ink-soft no-underline hover:text-ink">
              Sports
            </Link>
            <Link href={`${eventPath}/schedule`} className="text-ink-soft no-underline hover:text-ink">
              Schedule
            </Link>
            <Link href={`${eventPath}/schedule?tab=standings`} className="text-ink-soft no-underline hover:text-ink">
              Standings
            </Link>
            <Link href={`${eventPath}/updates`} className="text-ink-soft no-underline hover:text-ink">
              Updates
            </Link>
          </nav>
        </div>
      </section>
    </main>
  )
}
