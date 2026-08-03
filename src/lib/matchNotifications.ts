import type { Payload } from 'payload'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.4/15.6: "beri notifikasi kepada participant, official, dan
// spectator" for a court/time/status change. There is no participant/spectator account model in
// this app (Players/CompetitionEntries have no login, spectators have no identity at all) and no
// email adapter configured - a targeted push/email is not buildable without inventing accounts
// this app doesn't have. The Announcements collection is already a public, scoped, pull-based feed
// (target_scope: 'match' + match_id, already rendered as "Match Updates" on the match detail page)
// with an urgency value literally named 'schedule_change' that nothing populated automatically -
// this posts to that existing feed instead of building a second, parallel notification system.
type MatchAnnouncementParams = {
  payload: Payload
  eventId: string | number
  categoryId?: string | number | null
  matchId: string | number
  matchNumber: string
  title: string
  summary: string
  urgency: 'schedule_change' | 'urgent' | 'result' | 'warning' | 'info'
  displayMode?: 'feed' | 'banner' | 'urgent_alert'
}

export const postMatchAnnouncement = async ({
  payload,
  eventId,
  categoryId,
  matchId,
  matchNumber,
  title,
  summary,
  urgency,
  displayMode = 'feed',
}: MatchAnnouncementParams): Promise<void> => {
  try {
    await payload.create({
      collection: 'announcements',
      data: {
        title,
        slug: `match-${matchNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        summary,
        body: summary,
        urgency,
        display_mode: displayMode,
        status: 'published',
        published_at: new Date().toISOString(),
        target_scope: 'match',
        event_id: Number(eventId),
        category_id: categoryId ? Number(categoryId) : undefined,
        match_id: Number(matchId),
      },
    })
  } catch (error) {
    payload.logger.error(`Failed to post match announcement for ${matchNumber}: ${error}`)
  }
}
