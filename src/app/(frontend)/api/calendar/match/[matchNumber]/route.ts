import { NextResponse } from 'next/server'

import { getMatchDetail } from '../../../../matchDetailData'
import { getRelationshipLabel } from '../../../../workspaces/workspaceComponents'
import { getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { buildIcsEvent } from '@/lib/ics'

// AUDIT_UI_UX_CSS PUB-18: serves the .ics as a real file response (correct
// Content-Type/Content-Disposition) rather than a data: URI - some calendar apps and email
// clients handle a fetchable URL far more reliably than an inline data URI link.
export async function GET(_request: Request, { params }: { params: Promise<{ matchNumber: string }> }) {
  const { matchNumber } = await params
  const result = await getMatchDetail(matchNumber)
  const match = result?.match

  if (!match || !match.is_public || !match.scheduled_start_at) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const eventSlug =
    match.event_id && typeof match.event_id === 'object' && 'slug' in match.event_id
      ? String((match.event_id as { slug?: string }).slug || '')
      : ''
  const matchPath = eventSlug ? `/events/${eventSlug}/matches/${match.match_number}` : undefined

  const title = `${getRelationshipLabel(match.participant_a_entry_id)} vs ${getRelationshipLabel(match.participant_b_entry_id)}`
  const ics = buildIcsEvent({
    uid: `match-${match.id}@intourney`,
    title: `${title} (${match.match_number})`,
    description: `${getRelationshipLabel(match.sport_id)} / ${getRelationshipLabel(match.category_id)}${matchPath ? `\n${getAbsolutePublicUrl(matchPath)}` : ''}`,
    location: [getRelationshipLabel(match.venue_id, ''), getRelationshipLabel(match.court_id, '')]
      .filter(Boolean)
      .join(' - '),
    url: matchPath ? getAbsolutePublicUrl(matchPath) : undefined,
    startAt: match.scheduled_start_at,
    endAt: match.scheduled_end_at || undefined,
  })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${match.match_number}.ics"`,
    },
  })
}
