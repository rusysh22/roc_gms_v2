import type { Payload } from 'payload'

import { getRelationId } from '@/access/eventMembership'

// AUDIT_TOURNAMENT_STANDARDS REG-05: generateMatchesAction blocked on the confirmed-entry count
// but never on roster completeness, so a bracket could be generated - and published - with "team"
// entries that have zero registered players. The readiness dashboard warned about it, but only if
// an admin remembered to open that page. This is the same check, callable as a hard gate.

/**
 * Team/pair entries in this category whose active roster is smaller than the category's
 * `min_roster_size`. Empty array means every entry is adequately rostered (or the category doesn't
 * require rosters). Individual entries are never included - they have no roster.
 */
export const findUnderRosteredEntries = async (
  payload: Payload,
  categoryId: string | number,
): Promise<{ entryId: string | number; displayName: string; rosterCount: number }[]> => {
  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  const minRoster = category?.min_roster_size ?? 0
  if (!category?.roster_required || minRoster <= 0) return []

  const entriesResult = await payload.find({
    collection: 'competition-entries',
    depth: 0,
    limit: 2000,
    where: {
      and: [{ category_id: { equals: categoryId } }, { status: { equals: 'confirmed' } }],
    },
  })

  const rostersResult = await payload.find({
    collection: 'rosters',
    depth: 0,
    limit: 5000,
    where: {
      and: [{ category_id: { equals: categoryId } }, { status: { equals: 'active' } }],
    },
  })

  const rosterCountByTeam = new Map<string, number>()
  for (const roster of rostersResult.docs) {
    const teamId = getRelationId(roster.team_id)
    if (teamId == null) continue
    rosterCountByTeam.set(String(teamId), (rosterCountByTeam.get(String(teamId)) ?? 0) + 1)
  }

  const under: { entryId: string | number; displayName: string; rosterCount: number }[] = []
  for (const entry of entriesResult.docs) {
    if (entry.entry_type !== 'team' && entry.entry_type !== 'pair') continue
    const teamId = getRelationId(entry.team_id)
    if (teamId == null) continue
    const count = rosterCountByTeam.get(String(teamId)) ?? 0
    if (count < minRoster) {
      under.push({ entryId: entry.id, displayName: String(entry.display_name ?? entry.id), rosterCount: count })
    }
  }
  return under
}
