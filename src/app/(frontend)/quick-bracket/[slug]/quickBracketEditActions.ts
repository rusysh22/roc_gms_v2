'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import {
  applyQuickDoubleEliminationResult,
  applyQuickSingleEliminationResult,
} from '@/lib/quickBracketAdvancement'
import { quickBracketOwnerCookieName } from '@/lib/quickBracketCookies'

// Phase 2 redesign (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md section 11): sign-in unlocks
// EDITOR access to a quick bracket - it does not create a real event. Ownership becomes
// account-based (owner_user_id) the first time a signed-in user opens their own guest-created
// bracket, verified against the owner_token cookie exactly like the old claim flow did - from
// then on that account can edit from any device, not just the original browser.

type QuickBracketDoc = {
  id: string | number
  slug: string
  name: string
  format: 'single_elimination' | 'double_elimination'
  owner_token?: string | null
  owner_user_id?: (string | number) | { id: string | number } | null
  status: 'active' | 'claimed' | 'expired'
  expires_at: string
  bracket_data?: SingleEliminationBracketData | DoubleEliminationBracketData | null
}

const getBracketBySlug = async (payload: Payload, slug: string): Promise<QuickBracketDoc | null> => {
  const result = await payload.find({
    collection: 'quick-brackets',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  return (result.docs[0] as QuickBracketDoc | undefined) ?? null
}

const resolveOwnerUserId = (bracket: QuickBracketDoc): string | number | null => {
  const raw = bracket.owner_user_id
  if (!raw) return null
  return typeof raw === 'object' ? raw.id : raw
}

const isExpired = (bracket: QuickBracketDoc) =>
  bracket.status === 'expired' || new Date(bracket.expires_at).getTime() < Date.now()

export type AttachEditorResult = { ok: true } | { ok: false; reason: string }

// Called once, right after a sign-in/sign-up redirect back to `/quick-bracket/[slug]?claim=1`
// (see EditorAccessOnLoad.tsx). Idempotent - safe to call again for an already-attached owner.
export async function attachQuickBracketEditorAction(slug: string): Promise<AttachEditorResult> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return { ok: false, reason: 'not_signed_in' }

  const bracket = await getBracketBySlug(payload, slug)
  if (!bracket) return { ok: false, reason: 'not_found' }
  if (isExpired(bracket)) return { ok: false, reason: 'expired' }

  const existingOwnerId = resolveOwnerUserId(bracket)
  if (existingOwnerId) {
    return String(existingOwnerId) === String(user.id) ? { ok: true } : { ok: false, reason: 'not_owner' }
  }

  const cookieStore = await cookies()
  const ownerToken = cookieStore.get(quickBracketOwnerCookieName(slug))?.value
  if (!ownerToken || ownerToken !== bracket.owner_token) {
    return { ok: false, reason: 'not_owner' }
  }

  await payload.update({
    collection: 'quick-brackets',
    id: bracket.id,
    data: { owner_user_id: Number(user.id) },
  })
  revalidatePath(`/quick-bracket/${slug}`)
  return { ok: true }
}

const assertEditorAccess = async (
  payload: Payload,
  slug: string,
): Promise<{ ok: true; bracket: QuickBracketDoc } | { ok: false; reason: string }> => {
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return { ok: false, reason: 'not_signed_in' }

  const bracket = await getBracketBySlug(payload, slug)
  if (!bracket) return { ok: false, reason: 'not_found' }
  if (String(resolveOwnerUserId(bracket)) !== String(user.id)) return { ok: false, reason: 'not_owner' }

  return { ok: true, bracket }
}

export type UpdateQuickBracketResult = { ok: true } | { ok: false; reason: string }

export async function updateQuickBracketMatchAction(
  slug: string,
  matchId: string,
  winnerSlot: 'a' | 'b',
  scoreSummary: string,
): Promise<UpdateQuickBracketResult> {
  const payload = await getPayload({ config })
  const access = await assertEditorAccess(payload, slug)
  if (!access.ok) return access

  const { bracket } = access
  if (!bracket.bracket_data) return { ok: false, reason: 'no_bracket_data' }

  const trimmedScore = scoreSummary.trim() || undefined
  const outcome =
    bracket.bracket_data.format === 'double_elimination'
      ? applyQuickDoubleEliminationResult(bracket.bracket_data, { matchId, winnerSlot, scoreSummary: trimmedScore })
      : applyQuickSingleEliminationResult(bracket.bracket_data, { matchId, winnerSlot, scoreSummary: trimmedScore })

  if (outcome.error) return { ok: false, reason: outcome.error }

  await payload.update({
    collection: 'quick-brackets',
    id: bracket.id,
    data: { bracket_data: outcome.data },
  })
  revalidatePath(`/quick-bracket/${slug}`)
  return { ok: true }
}

export async function renameQuickBracketAction(slug: string, name: string): Promise<UpdateQuickBracketResult> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, reason: 'Name cannot be empty.' }
  if (trimmed.length > 120) return { ok: false, reason: 'Name is too long.' }

  const payload = await getPayload({ config })
  const access = await assertEditorAccess(payload, slug)
  if (!access.ok) return access

  await payload.update({
    collection: 'quick-brackets',
    id: access.bracket.id,
    data: { name: trimmed },
  })
  revalidatePath(`/quick-bracket/${slug}`)
  return { ok: true }
}
