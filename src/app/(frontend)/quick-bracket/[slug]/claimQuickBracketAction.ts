'use server'

import { cookies, headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import { recalculateSingleEliminationBracket } from '@/lib/brackets'
import {
  createDoubleEliminationBracketMatches,
  recalculateDoubleEliminationBracket,
} from '@/lib/doubleElimination'
import { createSingleEliminationBracketMatches, type MatchGenerationEntry } from '@/lib/matchGeneration'
import { QUICK_BRACKET_OWNER_COOKIE } from '@/lib/quickBracketCookies'
import { DEFAULT_EVENT_TIMEZONE, type EventTimezone } from '@/lib/timezone'
import { ACTIVE_EVENT_COOKIE } from '../../workspaces/activeEvent'

// Phase 2 of prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md: converts a guest quick-bracket into a
// real Events/Sports/CompetitionCategories/Stages/(CompetitionEntries/Matches) chain, owned by the
// account that just signed up/logged in. Called from ClaimOnLoad.tsx as a direct client->server
// action invocation (not a <form action>) so it can run right after auth completes, on the
// `/quick-bracket/[slug]?claim=1` redirect target that register/login already land on via their
// existing `?redirect=` plumbing - no changes needed to RegisterForm/LoginPanel/Google SSO.

export type ClaimQuickBracketResult =
  | { ok: true; eventId: string | number }
  | { ok: false; reason: 'not_signed_in' | 'not_found' | 'not_active' | 'expired' | 'not_owner' | 'failed' }

type QuickBracketDoc = {
  id: string | number
  name: string
  format: 'single_elimination' | 'double_elimination'
  third_place?: boolean | null
  bracket_size_mode: 'from_participants' | 'manual_size'
  participants?: { name: string; seed: number }[] | null
  owner_token?: string | null
  status: 'active' | 'claimed' | 'expired'
  expires_at: string
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tournament'

// Events.slug is globally unique (unlike Sports/Categories, which scope uniqueness to their
// parent event) - same probe-a-suffix shape as eventActions.ts's own findAvailableSlug.
const findAvailableEventSlug = async (payload: Payload, base: string): Promise<string> => {
  const baseTaken = await payload.count({ collection: 'events', where: { slug: { equals: base } } })
  if (baseTaken.totalDocs === 0) {
    return base
  }
  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80)
    const taken = await payload.count({ collection: 'events', where: { slug: { equals: candidate } } })
    if (taken.totalDocs === 0) {
      return candidate
    }
  }
  return `${base}-${Date.now()}`
}

export async function claimQuickBracketAction(slug: string): Promise<ClaimQuickBracketResult> {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) {
    return { ok: false, reason: 'not_signed_in' }
  }

  const cookieStore = await cookies()
  const ownerToken = cookieStore.get(QUICK_BRACKET_OWNER_COOKIE)?.value

  const found = await payload.find({
    collection: 'quick-brackets',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  const bracket = (found.docs[0] as QuickBracketDoc | undefined) ?? null
  if (!bracket) {
    return { ok: false, reason: 'not_found' }
  }
  if (bracket.status !== 'active') {
    return { ok: false, reason: 'not_active' }
  }
  if (new Date(bracket.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  // Only the browser that created this guest bracket can claim it - otherwise anyone who receives
  // a shared link could sign up and take ownership of someone else's tournament. Matches
  // wizardAccess.ts's verifyAnonDraft token-matching pattern for the anonymous event draft flow.
  if (!ownerToken || ownerToken !== bracket.owner_token) {
    return { ok: false, reason: 'not_owner' }
  }

  try {
    const now = new Date()
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const eventSlug = await findAvailableEventSlug(payload, slugify(bracket.name))

    const eventData = {
      name: bracket.name,
      slug: eventSlug,
      // Placeholder dates - the organizer fixes these on the wizard's Event step, which is
      // exactly where the claim redirects them next.
      event_start_at: now.toISOString(),
      event_end_at: oneWeekLater.toISOString(),
      timezone: DEFAULT_EVENT_TIMEZONE as EventTimezone,
      status: 'draft' as const,
      visibility: 'hidden' as const,
    }
    const event = await payload.create({ collection: 'events', data: eventData })

    // Local API create() has no req.user here, so Events.ts's enrollCreatorAsMember afterChange
    // hook can't fire (it no-ops without req.user) - enroll explicitly, same as createEventAction
    // and claimDraftIfPending both already do for this exact reason.
    try {
      await payload.create({
        collection: 'event-memberships',
        data: { event_id: Number(event.id), user_id: Number(user.id) },
      })
    } catch (error) {
      payload.logger.error(`Failed to enrol claimer as member of event ${event.id}: ${error}`)
    }

    const sport = await payload.create({
      collection: 'sports',
      data: {
        event_id: Number(event.id),
        name: 'General',
        slug: 'general',
        sport_type: 'other',
        is_active: true,
      },
    })

    const category = await payload.create({
      collection: 'competition-categories',
      data: {
        event_id: Number(event.id),
        sport_id: Number(sport.id),
        name: bracket.name,
        slug: 'bracket',
        participant_mode: 'individual',
        format_type: bracket.format,
        third_place_policy:
          bracket.format === 'single_elimination' && bracket.third_place ? 'match' : 'none',
        status: 'open',
      },
    })

    const formatLabel = bracket.format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination'
    const stage = await payload.create({
      collection: 'stages',
      data: {
        event_id: Number(event.id),
        category_id: Number(category.id),
        name: `${bracket.name} - ${formatLabel}`,
        stage_type: bracket.format,
        order: 1,
        status: 'ready',
      },
    })

    // A blank/manual-size bracket has only "TBD" placeholders, not real participants - creating
    // real CompetitionEntries/Matches from those would be a degenerate, unusable stage. Give the
    // organizer a clean, empty category/stage instead and let them add real participants through
    // the normal wizard (Participants step) rather than fabricating placeholder rows here.
    const hasRealParticipants = bracket.bracket_size_mode === 'from_participants'
    if (hasRealParticipants) {
      const participants = bracket.participants || []
      const entries: MatchGenerationEntry[] = []
      for (const participant of participants) {
        const entry = await payload.create({
          collection: 'competition-entries',
          data: {
            event_id: Number(event.id),
            category_id: Number(category.id),
            entry_type: 'individual',
            display_name: participant.name,
            seed_number: participant.seed,
            status: 'confirmed',
          },
        })
        entries.push({ id: entry.id, display_name: participant.name, seed_number: participant.seed })
      }

      let sequence = 1
      const nextMatchNumber = (prefix: string) =>
        `${category.slug}-${prefix}-${String(sequence++).padStart(3, '0')}`

      if (bracket.format === 'single_elimination') {
        await createSingleEliminationBracketMatches({
          payload,
          eventId: event.id,
          eventSlug: event.slug,
          sportId: sport.id,
          categoryId: category.id,
          categorySlug: category.slug,
          stageId: stage.id,
          entries,
          thirdPlacePolicy: bracket.third_place ? 'match' : 'none',
          nextMatchNumber,
        })
        await recalculateSingleEliminationBracket(payload, { stageId: stage.id })
      } else {
        await createDoubleEliminationBracketMatches({
          payload,
          eventId: event.id,
          eventSlug: event.slug,
          sportId: sport.id,
          categoryId: category.id,
          categorySlug: category.slug,
          stageId: stage.id,
          entries,
          nextMatchNumber,
        })
        await recalculateDoubleEliminationBracket(payload, { stageId: stage.id })
      }
    }

    await payload.update({
      collection: 'quick-brackets',
      id: bracket.id,
      data: { status: 'claimed', claimed_event_id: Number(event.id) },
    })

    cookieStore.set(ACTIVE_EVENT_COOKIE, String(event.id), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    })

    return { ok: true, eventId: event.id }
  } catch (error) {
    payload.logger.error(`Failed to claim quick bracket ${bracket.id}: ${error}`)
    return { ok: false, reason: 'failed' }
  }
}
