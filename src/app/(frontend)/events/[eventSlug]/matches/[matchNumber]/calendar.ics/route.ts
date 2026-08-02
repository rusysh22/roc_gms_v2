import { notFound } from 'next/navigation'

import { buildMatchIcs } from '@/lib/calendar'
import { getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { getMatchDetail } from '../../../../../matchDetailData'
import { getRelationshipLabel } from '../../../../../workspaces/workspaceComponents'

type RouteParams = Promise<{ eventSlug: string; matchNumber: string }>

// AUDIT_UI_UX_CSS PUB-18: mirrors the pre-existing (but unlinked - superseded by this
// event-scoped route tree) src/app/(frontend)/matches/[matchNumber]/calendar.ics/route.ts,
// reusing the same buildMatchIcs helper rather than a second bespoke ICS builder - only the
// canonical URL differs (points at the live /events/[eventSlug]/matches/... path this page
// actually lives at, not the orphaned non-event-scoped one).
export async function GET(_request: Request, { params }: { params: RouteParams }) {
  const { eventSlug, matchNumber } = await params
  const result = await getMatchDetail(matchNumber)

  const startsAt = result?.match.scheduled_start_at
  if (!result || !result.match.is_public || !startsAt) {
    notFound()
  }

  const { match } = result
  const title = `${getRelationshipLabel(match.participant_a_entry_id)} vs ${getRelationshipLabel(match.participant_b_entry_id)}`
  const description = [
    `${getRelationshipLabel(match.sport_id)} / ${getRelationshipLabel(match.category_id)}`,
    match.round_name || match.match_number,
    match.score_summary,
  ]
    .filter(Boolean)
    .join('\n')

  const ics = buildMatchIcs({
    id: match.id,
    matchNumber: match.match_number,
    title,
    description,
    startsAt,
    endsAt: match.scheduled_end_at,
    venue: getRelationshipLabel(match.venue_id, ''),
    court: getRelationshipLabel(match.court_id, ''),
    url: getAbsolutePublicUrl(`/events/${eventSlug}/matches/${match.match_number}`),
  })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${match.match_number}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
