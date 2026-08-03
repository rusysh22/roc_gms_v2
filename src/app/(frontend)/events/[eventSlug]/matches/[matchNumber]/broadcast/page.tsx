import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { AutoRefresh } from '@/components/auto-refresh'
import { getMatchDetail } from '../../../../../matchDetailData'
import { formatStatus, getRelationshipLabel } from '../../../../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../../../../publicEvents'

export const dynamic = 'force-dynamic'

type BroadcastPageParams = Promise<{ eventSlug: string; matchNumber: string }>
type BroadcastSearchParams = Promise<Record<string, string | string[] | undefined>>

const LIVE_POLL_STATUSES = new Set(['ongoing', 'paused', 'under_review'])

const BG_CLASS: Record<string, string> = {
  transparent: 'bg-transparent',
  green: 'bg-[#00b140]',
  blue: 'bg-[#0047ff]',
  black: 'bg-black',
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15 P2 "broadcast overlays": a minimal scorebug for an
// OBS/vMix browser source, not a themed page - no site chrome, no nav, a background that's either
// genuinely transparent (OBS Browser Source supports real alpha, no green screen needed) or a
// solid chroma-key color for capture hardware that doesn't. Sized to fit its content rather than
// the full viewport, so the operator crops the browser source to the graphic instead of the other
// way around.
export default async function BroadcastOverlayPage({
  params,
  searchParams,
}: {
  params: BroadcastPageParams
  searchParams?: BroadcastSearchParams
}) {
  const { eventSlug, matchNumber } = await params
  const query = searchParams ? await searchParams : {}
  const bgParam = typeof query.bg === 'string' ? query.bg : 'transparent'
  const bgClass = BG_CLASS[bgParam] || BG_CLASS.transparent

  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }

  const result = await getMatchDetail(matchNumber, event.id, `/events/${event.slug}/matches`)
  if (!result || !result.match.is_public) {
    notFound()
  }

  const { match, matchSets } = result
  const participantAName = getRelationshipLabel(match.participant_a_entry_id)
  const participantBName = getRelationshipLabel(match.participant_b_entry_id)
  const isLive = LIVE_POLL_STATUSES.has(match.status)
  // score_summary is a freeform display string ("1-0", "3-1 · awaiting publication", ...) - safe
  // to show as one line, but not safe to split on "-" and treat as two separate numbers. While
  // live, the current set's running point score is the more useful (and reliably numeric) value.
  const currentSet = matchSets[matchSets.length - 1]
  const scoreA = isLive && currentSet ? String(currentSet.participant_a_score ?? 0) : null
  const scoreB = isLive && currentSet ? String(currentSet.participant_b_score ?? 0) : null

  return (
    <main className={`flex min-h-svh items-end justify-center p-6 ${bgClass}`}>
      {isLive ? <AutoRefresh intervalMs={10000} /> : null}
      <div className="flex items-stretch overflow-hidden rounded-md border-2 border-white/20 bg-black/85 font-sans text-white shadow-2xl">
        <div className="flex flex-col justify-center gap-1 px-6 py-3">
          <span className="text-xl font-extrabold leading-none whitespace-nowrap">{participantAName}</span>
          <span className="text-xl font-extrabold leading-none whitespace-nowrap">{participantBName}</span>
        </div>
        <div className="flex flex-col justify-center gap-1 border-l border-white/20 bg-white/10 px-5 py-3 text-center">
          {scoreA !== null && scoreB !== null ? (
            <>
              <span className="text-xl font-extrabold leading-none tabular-nums">{scoreA}</span>
              <span className="text-xl font-extrabold leading-none tabular-nums">{scoreB}</span>
            </>
          ) : (
            <span className="text-sm font-bold whitespace-nowrap">{match.score_summary || '—'}</span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-1 border-l border-white/20 px-4 py-3">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-red-400 uppercase">
              <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
              Live
            </span>
          ) : (
            <span className="text-xs font-bold tracking-wide text-white/70 uppercase">
              {formatStatus(match.status)}
            </span>
          )}
          <span className="text-[11px] font-semibold text-white/60 whitespace-nowrap">{match.match_number}</span>
        </div>
      </div>
    </main>
  )
}
