import { notFound } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import { Clock, MapPin, Radio } from 'lucide-react'

import config from '@payload-config'
import { AutoRefresh } from '@/components/auto-refresh'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  formatTimeOnly,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../../publicEvents'

export const dynamic = 'force-dynamic'

type DisplayMatch = {
  id: string | number
  match_number: string
  round_name?: string | null
  status: string
  score_summary?: string | null
  scheduled_start_at?: string | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
  venue_id?: RelationshipDoc | string | number | null
  court_id?: RelationshipDoc | string | number | null
}

// AUDIT_UI_UX_CSS PUB-17/P2 item 4: "no venue display/slideshow mode" - a TV or projector at a
// venue had nothing built for it, only the same web page a phone would use. This is a plain
// auto-refreshing dashboard (live matches + what's next) rather than a JS-driven rotating
// slideshow between single-match views - the simpler version still solves the actual problem
// ("what's happening right now at this venue") without needing client-side rotation logic, and a
// human can still just point a browser at this URL and leave it running on any screen.
export default async function VenueDisplayPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const timezone = resolveEventTimezone(event.timezone)

  const eventWhere: Where = { and: [{ event_id: { equals: event.id } }, { is_public: { equals: true } }] }
  const [liveResult, nextUpResult] = await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 12,
      sort: 'scheduled_start_at',
      where: { and: [eventWhere, { status: { in: ['ongoing', 'paused'] } }] },
    }),
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 8,
      sort: 'scheduled_start_at',
      where: {
        and: [
          eventWhere,
          { status: { in: ['scheduled', 'ready_to_start', 'check_in_open'] } },
          { scheduled_start_at: { greater_than_equal: new Date().toISOString() } },
        ],
      },
    }),
  ])

  const liveMatches = liveResult.docs as DisplayMatch[]
  const nextUpMatches = nextUpResult.docs as DisplayMatch[]

  return (
    <main className="min-h-svh bg-ink px-8 py-10 font-sans text-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-widest text-paper/60 uppercase">Live Display</p>
            <h1 className="mt-1 text-4xl font-extrabold">{event.name}</h1>
          </div>
          <AutoRefresh
            intervalMs={20000}
            showIndicator
            className="inline-flex items-center gap-2 rounded-full border border-paper/20 bg-paper/10 px-4 py-2 text-sm font-semibold text-paper/80"
          />
        </header>

        <section aria-label="Live matches">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-gold">
            <Radio className="h-6 w-6" aria-hidden="true" />
            Live Now
          </h2>
          {liveMatches.length === 0 ? (
            <p className="text-lg text-paper/60">No matches are currently live.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {liveMatches.map((match) => (
                <div key={match.id} className="rounded-panel border border-paper/20 bg-paper/5 p-6">
                  <p className="text-sm font-bold tracking-wide text-paper/60 uppercase">
                    {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
                  </p>
                  <p className="mt-2 text-3xl font-extrabold">
                    {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                    {getRelationshipLabel(match.participant_b_entry_id)}
                  </p>
                  {match.score_summary ? (
                    <p className="mt-2 text-2xl font-bold text-gold tabular-nums">{match.score_summary}</p>
                  ) : null}
                  <p className="mt-3 flex items-center gap-2 text-base text-paper/70">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Next up">
          <h2 className="mb-4 text-2xl font-extrabold text-paper/90">Next Up</h2>
          {nextUpMatches.length === 0 ? (
            <p className="text-lg text-paper/60">No more matches scheduled.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {nextUpMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-paper/10 bg-paper/5 px-5 py-3"
                >
                  <p className="text-lg font-bold">
                    {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                    {getRelationshipLabel(match.participant_b_entry_id)}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-paper/70">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {formatTimeOnly(match.scheduled_start_at, timezone)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
