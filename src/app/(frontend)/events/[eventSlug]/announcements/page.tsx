import { redirect } from 'next/navigation'

// Articles + Announcements now live together on one "Updates" page - this listing route stays
// alive as a redirect so old bookmarks/shared links don't break.
export default async function AnnouncementsListRedirect({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  redirect(`/events/${eventSlug}/updates?tab=announcements`)
}
