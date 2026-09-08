'use server'

import { randomUUID } from 'crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import type { MatchGenerationEntry } from '@/lib/matchGeneration'
import {
  QUICK_BRACKET_MAX_PARTICIPANTS,
  QUICK_BRACKET_MIN_PARTICIPANTS,
  buildQuickDoubleEliminationBracket,
  buildQuickSingleEliminationBracket,
  getNextPowerOfTwo,
  isExactPowerOfTwo,
  resolveQuickBracketSize,
  type QuickBracketSource,
} from '@/lib/quickBracketGeneration'
import { checkQuickBracketRateLimit } from '@/lib/quickBracketRateLimit'
import { QUICK_BRACKET_OWNER_COOKIE } from '@/lib/quickBracketCookies'
import { verifyQuickBracketTurnstileToken } from '@/lib/quickBracketTurnstile'

const NEW_QUICK_BRACKET_PAGE = '/quick-bracket/new'
const EXPIRY_DAYS = 30

const text = (formData: FormData, key: string) => String(formData.get(key) || '').trim()

const getClientIp = async (): Promise<string> => {
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return headersList.get('x-real-ip') || 'unknown'
}

// Short random slug for the shareable /quick-bracket/[slug] URL - same find-an-unused-candidate
// shape as eventActions.ts's findAvailableSlug, just against random ids instead of name suffixes.
const findAvailableSlug = async (payload: Payload): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomUUID().replace(/-/g, '').slice(0, 10)
    const existing = await payload.count({
      collection: 'quick-brackets',
      where: { slug: { equals: candidate } },
    })
    if (existing.totalDocs === 0) {
      return candidate
    }
  }
  throw new Error('Could not generate a unique quick bracket slug.')
}

export async function createQuickBracketAction(formData: FormData): Promise<void> {
  // Honeypot: a real visitor never fills the visually-hidden `website` field (same pattern as
  // createEventAction). Bounce to a benign state, write nothing, give no signal.
  if (text(formData, 'website')) {
    redirect(NEW_QUICK_BRACKET_PAGE)
  }

  const ip = await getClientIp()
  if (!checkQuickBracketRateLimit(ip)) {
    redirect(`${NEW_QUICK_BRACKET_PAGE}?error=rate_limited`)
  }

  const turnstileOk = await verifyQuickBracketTurnstileToken(
    text(formData, 'cf-turnstile-response') || null,
    ip,
  )
  if (!turnstileOk) {
    redirect(`${NEW_QUICK_BRACKET_PAGE}?error=bot_check_failed`)
  }

  const name = text(formData, 'name')
  const format = text(formData, 'format')
  const bracketSizeMode = text(formData, 'bracket_size_mode')
  const thirdPlace = text(formData, 'third_place') === 'on'
  // split_participants isn't read from formData at all: Phase 1 renders that toggle disabled
  // ("Coming soon" - prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md section 8 risk #1, no
  // bracket-topology support exists yet), and generation below never branches on it, so the stored
  // value is unconditionally false regardless of what a tampered request might post.

  if (!name) redirect(`${NEW_QUICK_BRACKET_PAGE}?error=missing_name`)
  if (format !== 'single_elimination' && format !== 'double_elimination') {
    redirect(`${NEW_QUICK_BRACKET_PAGE}?error=invalid_format`)
  }
  if (bracketSizeMode !== 'from_participants' && bracketSizeMode !== 'manual_size') {
    redirect(`${NEW_QUICK_BRACKET_PAGE}?error=invalid_size_mode`)
  }

  let participants: { name: string; seed: number }[]
  let source: QuickBracketSource

  if (bracketSizeMode === 'from_participants') {
    const names = text(formData, 'participants')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (names.length < QUICK_BRACKET_MIN_PARTICIPANTS || names.length > QUICK_BRACKET_MAX_PARTICIPANTS) {
      redirect(`${NEW_QUICK_BRACKET_PAGE}?error=invalid_participant_count`)
    }
    if (format === 'double_elimination' && !isExactPowerOfTwo(names.length)) {
      redirect(`${NEW_QUICK_BRACKET_PAGE}?error=double_elimination_requires_power_of_two`)
    }

    participants = names.map((participantName, index) => ({ name: participantName, seed: index + 1 }))
    const entries: MatchGenerationEntry[] = participants.map((participant) => ({
      id: participant.seed,
      display_name: participant.name,
      seed_number: participant.seed,
    }))
    source = { mode: 'from_participants', entries }
  } else {
    const manualSize = Number(text(formData, 'manual_size'))
    if (
      !Number.isFinite(manualSize) ||
      manualSize < QUICK_BRACKET_MIN_PARTICIPANTS ||
      manualSize > QUICK_BRACKET_MAX_PARTICIPANTS
    ) {
      redirect(`${NEW_QUICK_BRACKET_PAGE}?error=invalid_bracket_size`)
    }
    const bracketSize = getNextPowerOfTwo(manualSize)
    participants = Array.from({ length: bracketSize }, (_, index) => ({ name: 'TBD', seed: index + 1 }))
    source = { mode: 'manual_size', bracketSize: manualSize }
  }

  const bracketData =
    format === 'single_elimination'
      ? buildQuickSingleEliminationBracket(source, { thirdPlace })
      : buildQuickDoubleEliminationBracket(source)

  const payload = await getPayload({ config })
  const slug = await findAvailableSlug(payload)
  const ownerToken = randomUUID()
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60_000).toISOString()

  await payload.create({
    collection: 'quick-brackets',
    data: {
      name,
      slug,
      format,
      third_place: format === 'single_elimination' ? thirdPlace : false,
      split_participants: false,
      bracket_size_mode: bracketSizeMode,
      bracket_size: resolveQuickBracketSize(source),
      participants,
      bracket_data: bracketData,
      owner_token: ownerToken,
      creator_ip: ip,
      status: 'active',
      expires_at: expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(QUICK_BRACKET_OWNER_COOKIE, ownerToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect(`/quick-bracket/${slug}`)
}
