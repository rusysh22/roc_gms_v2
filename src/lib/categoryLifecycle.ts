import type { Payload } from 'payload'

import { recordAuditLog } from '@/lib/audit'

// A competition category moves through draft -> open -> locked -> published as the New Event Wizard
// does its work: it is born `draft`, opens once the first entry is registered, locks once its
// matches are generated / its draw is finalized, and publishes when the event goes live. `archived`
// is a manual end-state that automation never touches.
//
// The organizer can still override the status by hand on the Categories step (that Select is kept)
// - `advanceCategoryStatus` only ever moves *forward*, so a manual jump ahead is never walked back
// and a manual `archived` is respected.
export const CATEGORY_STATUS_ORDER = ['draft', 'open', 'locked', 'published', 'archived'] as const
export type CategoryStatus = (typeof CATEGORY_STATUS_ORDER)[number]

export type AutoAdvanceTarget = 'open' | 'locked' | 'published'

const rank = (status: string): number => {
  const index = CATEGORY_STATUS_ORDER.indexOf(status as CategoryStatus)
  return index < 0 ? 0 : index
}

/**
 * Move a category forward to `target` if it is currently behind it. No-op when the category is
 * already at/past `target`, or was manually set to `archived`. Status automation must never break
 * the action that triggered it, so every failure here is swallowed.
 */
export const advanceCategoryStatus = async (
  payload: Payload,
  categoryId: string | number,
  target: AutoAdvanceTarget,
  actorUserId?: string | number | null,
): Promise<void> => {
  try {
    const category = await payload.findByID({
      collection: 'competition-categories',
      id: categoryId,
      depth: 0,
    })
    const current = String(category.status || 'draft')
    if (current === 'archived' || rank(current) >= rank(target)) {
      return
    }
    await payload.update({
      collection: 'competition-categories',
      id: categoryId,
      data: { status: target },
    })
    await recordAuditLog({
      payload,
      action: 'competition_category.auto_advance',
      entityType: 'competition-categories',
      entityId: categoryId,
      before: { status: current },
      after: { status: target },
      actorUserId: actorUserId ?? null,
    })
  } catch {
    // ignore - a category whose status didn't advance is a cosmetic problem, not a failed import
  }
}

/** Same as `advanceCategoryStatus` for a set of ids, in parallel. */
export const advanceCategoriesStatus = async (
  payload: Payload,
  categoryIds: Iterable<string | number>,
  target: AutoAdvanceTarget,
  actorUserId?: string | number | null,
): Promise<void> => {
  await Promise.all(
    [...new Set([...categoryIds].map(String))].map((id) =>
      advanceCategoryStatus(payload, id, target, actorUserId),
    ),
  )
}
