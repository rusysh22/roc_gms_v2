import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import {
  ArrowRight,
  Calendar,
  ChevronRight,
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

import type { Metadata } from 'next'

import config from '@payload-config'
import { buildShareMetadata, getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { AutoRefresh } from '@/components/auto-refresh'
import { Countdown } from '@/components/countdown'
import { Button } from '@/components/ui/button'
import { Card, CardDescription } from '@/components/ui/card'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { ShareEventPanel } from '@/components/share-event-panel'
import { SponsorStrip, type SponsorDoc } from '@/components/sponsor-strip'
import { ArticleCard, CompactAnnouncementList } from '../../contentComponents'
import { getPublicArticles, getScopedPublicAnnouncements } from '../../contentData'
import { EditableRegion, EventPublicEditor, PublicEditToolbar } from '../../publicEditComponents'
import { getPublicEditState } from '../../publicEditState'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  formatStatus,
  getDateKey,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../publicEvents'

export const dynamic = 'force-dynamic'

// The event home page is the main indexable surface per tournament. The parent layout only sets
// the browser-tab title; this adds the description, canonical URL and social image (the event
// banner, falling back to the site default) that search + unfurls actually use.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}): Promise<Metadata> {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  if (!event) {
    return buildShareMetadata({
      title: 'Event not found',
      description: 'This event is not available.',
      path: `/events/${eventSlug}`,
    })
  }

  const banner =
    event.banner_image && typeof event.banner_image === 'object' ? event.banner_image : undefined
  const logo = event.logo && typeof event.logo === 'object' ? event.logo : undefined
  const description =
    event.description?.trim() ||
    event.hero_tagline?.trim() ||
    `Schedule, results, standings, brackets and medals for ${event.name}${
      event.location ? ` in ${event.location}` : ''
    }, powered by InTourney.`

  return buildShareMetadata({
    title: event.name,
    description,
    path: `/events/${event.slug}`,
    imageUrl: banner?.url || logo?.url || '/og.png',
  })
}

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

const formatMatchTime = (value: string | null | undefined, tz: string) => {
  if (!value) {
    return 'Time TBD'
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(value))
}

// A single line summary of when the event runs, e.g. "12-14 Feb 2026" or "28 Feb - 2 Mar 2026" -
// used in the hero's "at a glance" line instead of the raw start/end timestamps.
const formatEventDateRange = (startIso: string, endIso: string, tz: string) => {
  const start = new Date(startIso)
  const end = new Date(endIso)
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
  const timezone = resolveEventTimezone(event.timezone)
  const eventPath = `/events/${event.slug}`
  const bannerImage =
    event.banner_image && typeof event.banner_image === 'object' ? event.banner_image : undefined
  const logoImage = event.logo && typeof event.logo === 'object' ? event.logo : undefined

  const eventWhere = { event_id: { equals: event.id } }
  const [liveNextResult, sportsResult, articles, upcomingMatchesResult, sponsorsResult] =
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
      collection: 'matches',
      depth: 0,
      limit: 200,
      where: {
        and: [eventWhere, { is_public: { equals: true } }, { scheduled_start_at: { exists: true } }],
      },
    }),
    payload.find({
      collection: 'sponsors',
      depth: 1,
      limit: 50,
      sort: ['tier', 'display_order', 'name'],
      where: eventWhere,
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

  const calendarDayCounts = (upcomingMatchesResult.docs as ScheduledMatch[]).reduce<Map<string, number>>(
    (map, match) => {
      const dateKey = getDateKey(match.scheduled_start_at, timezone)
      if (!dateKey) return map
      map.set(dateKey, (map.get(dateKey) || 0) + 1)
      return map
    },
    new Map(),
  )
  const todayKey = getDateKey(new Date().toISOString(), timezone)
  // Weekday and calendar date as two separate strings (not one "Sunday, August 9" label split by
  // the card's own line-wrapping, which wraps unpredictably mid-phrase depending on how long the
  // weekday name is) - each gets its own line, sized for what it is.
  const calendarDays = Array.from(calendarDayCounts.entries())
    .filter(([dateKey]) => !todayKey || dateKey >= todayKey)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 7)
    .map(([dateKey, count]) => {
      const date = new Date(`${dateKey}T00:00:00`)
      return {
        dateKey,
        weekday: new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: timezone }).format(date),
        dateLabel: new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: timezone }).format(
          date,
        ),
        count,
      }
    })

  // Structured data so Google can render the tournament as an event (dates, venue, organizer)
  // rather than a plain blue link. https://schema.org/SportsEvent
  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.name,
    description: event.description?.trim() || event.hero_tagline?.trim() || undefined,
    startDate: event.event_start_at,
    endDate: event.event_end_at,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: getAbsolutePublicUrl(eventPath),
    image: bannerImage?.url || logoImage?.url || undefined,
    location: event.location
      ? { '@type': 'Place', name: event.location, address: event.location }
      : undefined,
    organizer: event.organizer_name
      ? { '@type': 'Organization', name: event.organizer_name }
      : undefined,
  }

  return (
    <main className="font-sans text-ink">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- server-built from our own data, no user HTML
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <PublicEditToolbar state={editState} path={eventPath} />
      <AutoRefresh />
      {/* The floating nav pill is `position: sticky`, which still reserves its own height in
          normal flow (measured: ~62px on mobile below the `md:` nav breakpoint where the full
          item row collapses to a hamburger, ~54px at `md:` and up) - on top of PublicChrome's own
          `pt-6` (24px) content-wrapper padding. Left uncancelled, min-h-svh on this section would
          make it exactly one viewport tall starting *after* that ~78-86px of reserved space, so
          its bottom (the CTA row) would sit that far past the fold instead of the section filling
          the actual first screen with the pill floating over the image. Negative margin equal to
          reserved-space + padding pulls the section's top back up to y=0 so the two - together -
          fill exactly one screen; the pill still renders on top via its own z-50. */}
      <section className="relative -mt-[5.375rem] flex min-h-svh items-end overflow-hidden px-4 pb-14 pt-28 md:-mt-[4.875rem]">
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
              className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-primary/30 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-24 -right-16 h-80 w-80 rounded-full bg-brand-secondary/25 blur-3xl"
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
                <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
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
                <Calendar className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                {formatEventDateRange(event.event_start_at, event.event_end_at, timezone)}
              </span>
              {event.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  {event.location}
                </span>
              ) : null}
              {sportsSummary ? (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                  {sportsSummary}
                </span>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* AUDIT_UI_UX_CSS CSS-06/CSS-07: the one CTA on this page meant to reflect the
                  event's own chosen theme, not the fixed "primary action" green. */}
              <Button asChild variant="brand">
                <Link href={`${eventPath}/schedule`}>
                  View Schedule
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`${eventPath}/schedule?tab=standings`}>See Standings</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={`${eventPath}/register`}>Register</Link>
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

      {/* A subtle tint (not another hard border) breaks up an otherwise unbroken run of white
          sections without adding more visual noise than the content itself needs. */}
      <section className="bg-mist/40 px-4 py-14" aria-labelledby="live-next-title">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="live-next-title" className="text-xl font-bold text-ink sm:text-2xl">
              Live Now &amp; Next Up
            </h2>
            <Link
              href={`${eventPath}/schedule`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
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
            // The fade hints there's more to scroll to - without it, a row that just ends at the
            // viewport edge doesn't read as a carousel at all, it reads as a cut-off list.
            <div className="relative -mx-4">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-paper to-transparent"
              />
              <div className="flex snap-x gap-4 overflow-x-auto px-4 py-2">
              {orderedMatches.map((match) => {
                const isLive = LIVE_STATUSES.includes(match.status)

                return (
                  <Link
                    key={match.id}
                    href={`${eventPath}/matches/${match.match_number}`}
                    className="block w-80 shrink-0 snap-start"
                  >
                    <Card interactive accent={isLive ? 'green' : 'blue'} className="flex h-full flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* line-clamp-2 (not truncate) - "what competition" matters as much as
                            "who's playing", so it gets to wrap onto a second line instead of
                            being cut off mid-word. */}
                        <CardDescription className="line-clamp-2">
                          {getRelationshipLabel(match.sport_id)} /{' '}
                          {getRelationshipLabel(match.category_id)}
                        </CardDescription>
                        <StatusBadge tone={isLive ? 'gold' : getMatchStatusTone(match.status)} className="shrink-0">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2" aria-hidden="true">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                              </span>
                              Live
                            </span>
                          ) : (
                            formatStatus(match.status)
                          )}
                        </StatusBadge>
                      </div>

                      {/* Name / "vs" / name stacked on their own lines - "A vs B" run together in
                          one line reads fine for two short names, but the moment either side gets
                          long (a full team name, a doubles pair) it stops being obvious at a
                          glance which words belong to which side. */}
                      <div className="flex flex-col items-start gap-1">
                        <p className="w-full truncate text-base font-extrabold text-ink">
                          {getRelationshipLabel(match.participant_a_entry_id)}
                        </p>
                        <p className="text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase">vs</p>
                        <p className="w-full truncate text-base font-extrabold text-ink">
                          {getRelationshipLabel(match.participant_b_entry_id)}
                        </p>
                      </div>

                      <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-sm text-ink-soft">
                        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {formatMatchTime(match.scheduled_start_at, timezone)}
                      </div>
                    </Card>
                  </Link>
                )
              })}
              </div>
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
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
            >
              Full schedule
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {calendarDays.length === 0 ? (
            <Card className="text-sm text-ink-soft">No match days are scheduled yet.</Card>
          ) : (
            <div className="relative -mx-4">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-paper to-transparent"
              />
              <div className="flex gap-3 overflow-x-auto px-4 py-2">
                {calendarDays.map((day) => (
                  <Link
                    key={day.dateKey}
                    href={`${eventPath}/schedule`}
                    className="block w-40 shrink-0"
                  >
                    <Card interactive accent="blue" className="flex h-full flex-col items-center gap-1 py-5 text-center">
                      <Calendar className="mb-1 h-5 w-5 text-blue" aria-hidden="true" />
                      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">{day.weekday}</p>
                      <p className="text-base font-extrabold text-ink">{day.dateLabel}</p>
                      <p className="mt-1 text-xs font-semibold text-ink-soft">
                        {day.count} {day.count === 1 ? 'match' : 'matches'}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* One clickable destination per card instead of a card full of separate nested
                  links - a sport with one category jumps straight there, otherwise to the sport
                  browser. Simpler to scan, and there's nothing left to click "wrong". */}
              {sports.map((sport) => {
                const Icon = SPORT_ICONS[sport.sport_type] || Trophy
                const sportCategories = categoriesBySport.get(String(sport.id)) || []
                const primaryCategoryHref =
                  sportCategories.length === 1 ?
                    `${eventPath}/sports/${sport.slug}/${sportCategories[0].slug}`
                  : `${eventPath}/sports`

                return (
                  <Link key={sport.id} href={primaryCategoryHref} className="block no-underline">
                    <Card interactive accent="blue" className="flex items-center gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mist text-brand-primary">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-ink">{sport.name}</p>
                        <p className="text-sm text-ink-soft">
                          {sportCategories.length}{' '}
                          {sportCategories.length === 1 ? 'category' : 'categories'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden="true" />
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-mist/40 px-4 py-14" aria-labelledby="updates-title">
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
                <CompactAnnouncementList
                  announcements={announcements}
                  title="Announcements"
                  basePath={`${eventPath}/updates?tab=announcements`}
                  timezone={timezone}
                />
              ) : null}

              {articles.length > 0 ? (
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
                      Articles
                    </h3>
                    <Link
                      href={`${eventPath}/updates?tab=articles`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
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

      {sponsorsResult.docs.length > 0 ? (
        <section className="px-4 pb-10" aria-label="Sponsors and partners">
          <div className="mx-auto max-w-5xl">
            <SponsorStrip sponsors={sponsorsResult.docs as SponsorDoc[]} />
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-10" aria-label="Share this event">
        <div className="mx-auto max-w-5xl">
          <ShareEventPanel eventName={event.name} eventPath={eventPath} />
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
                <a href={`mailto:${event.contact_email}`} className="font-semibold text-brand-secondary hover:underline">
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
            {event.medal_tally_enabled ? (
              <Link href={`${eventPath}/medals`} className="text-ink-soft no-underline hover:text-ink">
                Medal Tally
              </Link>
            ) : null}
            <Link href={`${eventPath}/updates`} className="text-ink-soft no-underline hover:text-ink">
              Updates
            </Link>
          </nav>
        </div>
      </section>
    </main>
  )
}
