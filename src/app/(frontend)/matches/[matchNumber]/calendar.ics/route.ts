import { notFound } from 'next/navigation'

import { buildMatchIcs } from '@/lib/calendar'
import { getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { getMatchDetail } from '../../../matchDetailData'
import { getRelationshipLabel } from '../../../workspaces/workspaceComponents'

type RouteParams = Promise<{ matchNumber: string }>

export async function GET(_request: Request, { params }: { params: RouteParams }) {
  const { matchNumber } = await params
  const result = await getMatchDetail(matchNumber)

  const startsAt = result?.match.scheduled_start_at

  if (!result || !result.match.is_public || !startsAt) {
    notFound()
  }

  const { match } = result
  const title = `${getRelationshipLabel(match.participant_a_entry_id)} vs ${getRelationshipLabel(
    match.participant_b_entry_id,
  )}`
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
    url: getAbsolutePublicUrl(`/matches/${match.match_number}`),
  })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${match.match_number}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
