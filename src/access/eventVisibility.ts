import type { Access, Payload, Where } from 'payload'

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
 * REST/GraphQL call read hidden/preview-only events directly. Authenticated staff still get full
 * read (workspace pages apply their own role/event gating); only anonymous callers are scoped. */
export const publicReadEvents: Access = ({ req }) => {
  if (req.user) {
    return true
  }

  return { visibility: { in: [...PUBLIC_EVENT_VISIBILITY_VALUES] } } satisfies Where
}

const getVisibleEventIds = async (payload: Payload): Promise<(string | number)[]> => {
  const result = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 500,
    where: { visibility: { in: [...PUBLIC_EVENT_VISIBILITY_VALUES] } },
  })

  return result.docs.map((doc) => doc.id)
}

/** Factory for every event-scoped structural collection that was `read: () => true` with no
 * visibility check of its own (sports, categories, rulesets, stages, groups, clubs, teams,
 * entries, standings - AUDIT_E2E PUB-01). Anonymous callers only ever see rows whose event is
 * currently coming_soon/published/archived; authenticated staff keep full read. */
export const publicReadScopedToEvent = (eventField = 'event_id'): Access => {
  return async ({ req }) => {
    if (req.user) {
      return true
    }

    const visibleEventIds = await getVisibleEventIds(req.payload)
    if (visibleEventIds.length === 0) {
      return false
    }

    return { [eventField]: { in: visibleEventIds } } satisfies Where
  }
}

/** Brackets additionally have their own draft/ready/published/locked/archived lifecycle - a
 * publicly-visible event must not leak a bracket that hasn't been published yet (AUDIT_E2E
 * PUB-01's "standings/bracket draft" finding). */
export const publicReadPublishedBracket: Access = async ({ req }) => {
  if (req.user) {
    return true
  }

  const visibleEventIds = await getVisibleEventIds(req.payload)
  if (visibleEventIds.length === 0) {
    return false
  }

  return {
    and: [
      { event_id: { in: visibleEventIds } },
      { status: { in: ['published', 'locked'] } },
    ],
  } satisfies Where
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
    if (req.user) {
      return true
    }

    const visibleEventIds = await getVisibleEventIds(req.payload)
    if (visibleEventIds.length === 0) {
      return false
    }

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

    return { and: conditions } satisfies Where
  }
}
