// Central, flexible copy for every social/share surface (Open Graph + Twitter/X cards, the
// WhatsApp/Teams/Email/native-share buttons, Instagram link previews, ...). Keeping the wording
// here - rather than inline at each call site - means the "voice" of a shared link stays
// consistent and is easy to tune in one place.
//
// Every builder returns { title, description } and, where useful, an `eyebrow` (the small
// kicker line drawn above the title on the generated share image).

const BRAND = 'InTourney'
export const BRAND_TAGLINE = 'Hosting your tournament'

export type ShareCopy = {
  eyebrow?: string
  title: string
  description: string
}

const cleanList = (parts: Array<string | null | undefined>) =>
  parts.map((p) => (p ?? '').trim()).filter(Boolean)

// The marketing / company homepage.
export const marketingShareCopy = (): ShareCopy => ({
  eyebrow: BRAND,
  title: BRAND_TAGLINE,
  description:
    'Guided setup, auto brackets and standings, live scoring, and a public page for every tournament.',
})

// An event's public home / any event sub-page that has nothing more specific to say.
export const eventShareCopy = (
  eventName: string,
  opts: { dateLabel?: string | null; location?: string | null; tagline?: string | null } = {},
): ShareCopy => {
  const context = cleanList([opts.dateLabel, opts.location]).join(' | ')
  const description =
    cleanList([opts.tagline]).join('') ||
    [context, `Follow the schedule, live scores, and standings on ${BRAND}.`]
      .filter(Boolean)
      .join(' - ')
  return {
    eyebrow: context || 'Tournament',
    title: eventName,
    description,
  }
}

// A single match / fixture.
export const matchShareCopy = (
  sideA: string,
  sideB: string,
  opts: {
    eventName?: string | null
    roundLabel?: string | null
    scoreLabel?: string | null
    isLive?: boolean
  } = {},
): ShareCopy => {
  const matchup = `${sideA} vs ${sideB}`
  const tail = opts.isLive
    ? `Live now on ${BRAND}`
    : opts.scoreLabel
      ? `${opts.scoreLabel} - full result on ${BRAND}`
      : `Follow this match live on ${BRAND}`
  return {
    eyebrow: cleanList([opts.eventName, opts.roundLabel]).join(' | ') || 'Match',
    title: matchup,
    description: cleanList([opts.roundLabel, tail]).join(' - '),
  }
}

// Generic "section of an event" (Updates, Standings, Schedule, ...).
export const eventSectionShareCopy = (section: string, eventName: string, blurb: string): ShareCopy => ({
  eyebrow: eventName,
  title: `${section} - ${eventName}`,
  description: blurb,
})
