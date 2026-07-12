import { redirect } from 'next/navigation'

// Standings now live inside the Schedule page as a tab - this route stays alive as a redirect
// so old bookmarks/shared links don't break.
export default async function StandingsRedirect({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  redirect(`/events/${eventSlug}/schedule?tab=standings`)
}
