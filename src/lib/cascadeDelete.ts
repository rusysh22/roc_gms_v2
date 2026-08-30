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
