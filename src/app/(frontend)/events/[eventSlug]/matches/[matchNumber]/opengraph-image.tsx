import { getPayload } from 'payload'

import config from '@payload-config'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/ogCard'
import { matchShareCopy } from '@/lib/shareMessages'
import { getEventThemePreset } from '@/lib/eventTheme'
import { getPublicEventBySlug } from '../../../publicEvents'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Match on InTourney'

type Params = { params: Promise<{ eventSlug: string; matchNumber: string }> }

const LIVE_STATUSES = new Set([
  'ongoing',
  'paused',
  'check_in_open',
  'ready_to_start',
  'under_review',
])

const label = (value: unknown, fallback = 'TBD') => {
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    return String(rec.display_name || rec.name || fallback)
  }
  return fallback
}

export default async function MatchOpengraphImage({ params }: Params) {
  const { eventSlug, matchNumber } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  const fallback = () => {
    const copy = matchShareCopy('TBD', 'TBD', { eventName: event?.name })
    return renderOgCard({ eyebrow: copy.eyebrow, title: copy.title, subtitle: copy.description })
  }

  if (!event) return fallback()

  const found = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 1,
    where: {
      and: [{ match_number: { equals: matchNumber } }, { event_id: { equals: event.id } }],
    },
  })
  const match = found.docs[0] as unknown as Record<string, unknown> | undefined
  if (!match || match.is_public === false) return fallback()

  const a = label(match.participant_a_entry_id)
  const b = label(match.participant_b_entry_id)
  const status = String(match.status || '')
  const isLive = LIVE_STATUSES.has(status)
  const aScore = match.participant_a_score
  const bScore = match.participant_b_score
  const scoreLabel =
    typeof aScore === 'number' && typeof bScore === 'number'
      ? `${aScore}–${bScore}`
      : typeof match.score_summary === 'string' && match.score_summary
        ? match.score_summary
        : null

  const copy = matchShareCopy(a, b, {
    eventName: event.name,
    roundLabel: typeof match.round_name === 'string' ? match.round_name : null,
    scoreLabel: status === 'result_published' || status === 'completed' ? scoreLabel : null,
    isLive,
  })

  return renderOgCard({
    eyebrow: copy.eyebrow,
    title: copy.title,
    subtitle: copy.description,
    accent: getEventThemePreset(event.theme_config?.preset).colors.primary,
  })
}
