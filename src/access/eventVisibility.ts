import type { Access, Payload, PayloadRequest, Where } from 'payload'

import { getAccessibleEventIds } from './eventMembership'
import type { UserRole } from './roles'

// Visibility states that are safe to expose through the public API/portal. "hidden" (the default,
// never-published state) and "preview_only" (admin/member preview before the public teaser) must
// never be readable by an anonymous caller - see AUDIT_E2E EVT-01, which found both were being
// treated as fully public. Kept as an array (not just a Set) because Payload `where` clauses need
// a plain array for `in`.
export const PUBLIC_EVENT_VISIBILITY_VALUES = ['coming_soon', 'published', 'archived'] as const

const PUBLIC_EVENT_VISIBILITY_SET = new Set<string>(PUBLIC_EVENT_VISIBILITY_VALUES)

export const isPubliclyVisibleEventVisibility = (visibility: string | null | undefined) =>
  PUBLIC_EVENT_VISIBILITY_SET.has(visibility || '')

/** Events collection's own `read` access - was `() => true` (AUDIT_E2E PUB-01), which let a raw
 * REST/GraphQL call read hidden/preview-only events directly. */
export const publicReadEvents: Access = async ({ req }) => {
  const publicWhere = { visibility: { in: [...PUBLIC_EVENT_VISIBILITY_VALUES] } } satisfies Where
  if (!req.user) {
    return publicWhere
  }
  return staffOrPublicWhere(req, 'id', publicWhere)
}

export const getVisibleEventIds = async (payload: Payload): Promise<(string | number)[]> => {
  const result = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 500,
    where: { visibility: { in: [...PUBLIC_EVENT_VISIBILITY_VALUES] } },
  })

  return result.docs.map((doc) => doc.id)
}

type ScopeUser = { id: string | number; roles?: UserRole[] | null }

/** Used by every read-access function below that used to grant blanket `true` to any
 * authenticated caller (AUDIT_E2E AUTH-01 follow-up "per-user event access"): staff should never
 * see LESS than an anonymous visitor already can (`fallbackWhere` is that same public-visibility
 * filter), but their own event-memberships additionally grant *full* read - including
 * hidden/draft/internal rows - on events they're actually a member of (an explicit
 * EventMemberships row is required; there is no "unscoped event" fallback). This matters more now
 * that self-registration hands out an authenticated, event_admin-capable account to anyone -
 * "authenticated" alone is no longer a meaningful trust boundary on its own. */
export const staffOrPublicWhere = async (
  req: PayloadRequest,
  eventIdField: string,
  fallbackWhere: Where,
): Promise<Where | true> => {
  const user = req.user as ScopeUser
  if (user.roles?.includes('super_admin')) {
    return true
  }

  const accessibleIds = await getAccessibleEventIds(req.payload, user)
  if (accessibleIds === 'all') {
    return true
  }

  return { or: [{ [eventIdField]: { in: accessibleIds } }, fallbackWhere] } satisfies Where
}

/** Factory for every event-scoped structural collection that was `read: () => true` with no
 * visibility check of its own (sports, categories, rulesets, stages, groups, clubs, teams,
 * entries, standings - AUDIT_E2E PUB-01). Anonymous callers only ever see rows whose event is
 * currently coming_soon/published/archived. */
export const publicReadScopedToEvent = (eventField = 'event_id'): Access => {
  return async ({ req }) => {
    const visibleEventIds = await getVisibleEventIds(req.payload)
    const publicWhere = { [eventField]: { in: visibleEventIds } } satisfies Where

    if (!req.user) {
      return visibleEventIds.length === 0 ? false : publicWhere
    }
    return staffOrPublicWhere(req, eventField, publicWhere)
  }
}

/** Brackets additionally have their own draft/ready/published/locked/archived lifecycle - a
 * publicly-visible event must not leak a bracket that hasn't been published yet (AUDIT_E2E
 * PUB-01's "standings/bracket draft" finding). */
export const publicReadPublishedBracket: Access = async ({ req }) => {
  const visibleEventIds = await getVisibleEventIds(req.payload)
  const conditions: Where[] = [
    { event_id: { in: visibleEventIds } },
    { status: { in: ['published', 'locked'] } },
  ]
  const publicWhere = { and: conditions } satisfies Where

  if (!req.user) {
    return visibleEventIds.length === 0 ? false : publicWhere
  }
  return staffOrPublicWhere(req, 'event_id', publicWhere)
}

/** Articles/Announcements were `read: () => true` with status/draft filtering only applied by the
 * frontend helper functions, not the collection boundary itself (AUDIT_E2E CNT-01) - a direct
 * `/api/articles` call could read drafts/review copy. Anonymous callers now only ever see
 * `status: 'published'` rows (with `published_at` in the past, if set) for a publicly-visible
 * event; authenticated staff keep full read for editorial workflows. */
export const publicReadPublishedContent = (options?: {
  eventField?: string
  statusField?: string
  publishedAtField?: string
  expiresAtField?: string
}): Access => {
  const eventField = options?.eventField ?? 'event_id'
  const statusField = options?.statusField ?? 'status'
  const publishedAtField = options?.publishedAtField ?? 'published_at'
  const expiresAtField = options?.expiresAtField

  return async ({ req }) => {
    const visibleEventIds = await getVisibleEventIds(req.payload)

    const now = new Date().toISOString()
    const conditions: Where[] = [
      { [eventField]: { in: visibleEventIds } },
      { [statusField]: { equals: 'published' } },
      {
        or: [
          { [publishedAtField]: { exists: false } },
          { [publishedAtField]: { less_than_equal: now } },
        ],
      },
    ]

    if (expiresAtField) {
      conditions.push({
        or: [{ [expiresAtField]: { exists: false } }, { [expiresAtField]: { greater_than: now } }],
      })
    }

    const publicWhere = { and: conditions } satisfies Where

    if (!req.user) {
      return visibleEventIds.length === 0 ? false : publicWhere
    }
    return staffOrPublicWhere(req, eventField, publicWhere)
  }
}
