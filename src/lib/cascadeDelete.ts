import type { Payload } from 'payload'

// Shared teardown helpers for the "delete has a matching create" work. Deletes run children-first
// so foreign keys never block mid-batch. Every caller has already done an auth/scope check and
// (where it matters) confirmed nothing has started playing.

const UNSTARTED_MATCH_STATUSES = [
  'draft',
  'ready_for_scheduling',
  'scheduled',
  'published',
  'check_in_open',
  'ready_to_start',
]

/** True if any match in the category has moved past the pre-match states - a decided or in-progress
 * result must go through the match lifecycle, never a bulk delete. */
export const categoryHasStartedMatch = async (
  payload: Payload,
  categoryId: string | number,
): Promise<boolean> => {
  const started = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: {
      and: [
        { category_id: { equals: categoryId } },
        { status: { not_in: UNSTARTED_MATCH_STATUSES } },
      ],
    },
  })
  return started.totalDocs > 0
}

/** Wipes everything a category's draw produced: matches + sets, stages, groups, and the cached
 * bracket/standings rows; also clears each entry's group assignment. Entries and the category
 * itself are left intact. */
export const clearCategoryGeneratedData = async (
  payload: Payload,
  categoryId: string | number,
): Promise<{ matchCount: number; stageCount: number }> => {
  const [matches, stages] = await Promise.all([
    payload.find({ collection: 'matches', depth: 0, limit: 5000, where: { category_id: { equals: categoryId } } }),
    payload.find({ collection: 'stages', depth: 0, limit: 50, where: { category_id: { equals: categoryId } } }),
  ])
  const matchIds = matches.docs.map((match) => match.id)
  const stageIds = stages.docs.map((stage) => stage.id)

  for (const match of matches.docs) {
    await payload.delete({ collection: 'match-sets', where: { match_id: { equals: match.id } } }).catch(() => null)
  }
  if (matchIds.length > 0) {
    await payload.delete({ collection: 'matches', where: { id: { in: matchIds } } })
  }

  await payload.delete({ collection: 'brackets', where: { category_id: { equals: categoryId } } }).catch(() => null)
  await payload.delete({ collection: 'standings', where: { category_id: { equals: categoryId } } }).catch(() => null)

  const groupedEntries = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 5000,
    where: { and: [{ category_id: { equals: categoryId } }, { group_id: { exists: true } }] },
  })
  for (const entry of groupedEntries.docs) {
    await payload.update({ collection: 'competition-entries', id: entry.id, data: { group_id: null } })
  }

  if (stageIds.length > 0) {
    await payload.delete({ collection: 'groups', where: { stage_id: { in: stageIds } } }).catch(() => null)
    await payload.delete({ collection: 'stages', where: { id: { in: stageIds } } })
  }

  return { matchCount: matches.totalDocs, stageCount: stages.totalDocs }
}

/** Full cascade: generated data, then rosters / medals / pending registrations / entries, then the
 * category. Content (announcements, articles) that was scoped to it is unscoped, not deleted. */
export const deleteCategoryCascade = async (payload: Payload, categoryId: string | number): Promise<void> => {
  await clearCategoryGeneratedData(payload, categoryId)

  await payload.delete({ collection: 'rosters', where: { category_id: { equals: categoryId } } }).catch(() => null)
  await payload.delete({ collection: 'medal-records', where: { category_id: { equals: categoryId } } }).catch(() => null)
  await payload
    .delete({ collection: 'registration-submissions', where: { category_id: { equals: categoryId } } })
    .catch(() => null)

  for (const collection of ['announcements', 'articles'] as const) {
    const scoped = await payload.find({
      collection,
      depth: 0,
      limit: 500,
      where: { category_id: { equals: categoryId } },
    })
    for (const doc of scoped.docs) {
      await payload.update({ collection, id: doc.id, data: { category_id: null } }).catch(() => null)
    }
  }

  await payload.delete({ collection: 'competition-entries', where: { category_id: { equals: categoryId } } }).catch(() => null)
  await payload.delete({ collection: 'competition-categories', id: categoryId })
}

/** Whether an event is safe to fully delete: it must still be a draft and have no matches (a match
 * means real scheduling/scoring work that should not vanish in a bulk delete). */
export const eventIsAbandonable = async (
  payload: Payload,
  eventId: string | number,
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const event = await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
  if (!event) return { ok: false, reason: 'not_found' }
  if (event.status !== 'draft') return { ok: false, reason: 'not_draft' }
  const matches = await payload.count({ collection: 'matches', where: { event_id: { equals: eventId } } })
  if (matches.totalDocs > 0) return { ok: false, reason: 'has_matches' }
  return { ok: true }
}

/** Deletes a draft event and every record scoped to it. Assumes eventIsAbandonable already
 * passed (no matches, so no stages/groups/standings/brackets/medals/match-sets to worry about).
 * FK-safe order: leaf tables first, then their parents, then the event. */
export const deleteEventCascade = async (payload: Payload, eventId: string | number): Promise<void> => {
  const where = { event_id: { equals: eventId } }

  // Leaf tables first, then their parents. Every name is a real collection slug.
  const order = [
    'rosters',
    'competition-entries',
    'registration-submissions',
    'competition-categories',
    'courts',
    'venues',
    'rulesets',
    'teams',
    'players',
    'clubs',
    'sports',
    'event-memberships',
    'sponsors',
    'announcements',
    'articles',
  ] as const

  for (const collection of order) {
    await payload.delete({ collection, where }).catch(() => null)
  }

  await payload.delete({ collection: 'events', id: eventId })
}
