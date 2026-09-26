import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { getRelationId } from '@/access/eventMembership'
import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageParticipants, canReadEventBackoffice } from '@/access/roles'

// AUDIT_TOURNAMENT_STANDARDS REG-04: max_roster_size was only ever checked in the public
// registration form - workspace CRUD, the Excel importer, and registration approval could all put
// 1 or 20 players into a 5-a-side team. This hook runs on every write path (it fires regardless of
// overrideAccess) so the limit holds everywhere. Only `max` is enforceable per-insert; `min`
// (completeness) is a bracket-generation gate instead - see REG-05 in generateActions.ts.
const enforceMaxRosterSize: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  const status = (data.status ?? originalDoc?.status ?? 'active') as string
  if (status !== 'active') return data

  const teamId = getRelationId(data.team_id ?? originalDoc?.team_id)
  const categoryId = getRelationId(data.category_id ?? originalDoc?.category_id)
  if (!teamId || !categoryId) return data

  const category = await req.payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  const max = category?.max_roster_size
  if (!max || max <= 0) return data

  const currentId = operation === 'update' ? originalDoc?.id : undefined
  const existing = await req.payload.count({
    collection: 'rosters',
    where: {
      and: [
        { team_id: { equals: teamId } },
        { category_id: { equals: categoryId } },
        { status: { equals: 'active' } },
        ...(currentId != null ? [{ id: { not_equals: currentId } }] : []),
      ],
    },
  })

  if (existing.totalDocs + 1 > max) {
    throw new APIError(
      `Roster is full - ${(category?.name as string) || 'this category'} allows at most ${max} active players per team.`,
      400,
      null,
      true,
    )
  }
  return data
}

export const Rosters: CollectionConfig = {
  slug: 'rosters',
  admin: {
    defaultColumns: ['team_id', 'player_id', 'category_id', 'role', 'status'],
    group: 'Participants',
    useAsTitle: 'role',
  },
  access: {
    create: scopedCreateToUserEvents(canManageParticipants),
    delete: scopedToUserEvents(canManageParticipants),
    read: scopedToUserEvents(canReadEventBackoffice),
    update: scopedToUserEvents(canManageParticipants),
  },
  hooks: {
    beforeChange: [enforceMaxRosterSize],
  },
  fields: [
    {
      name: 'event_id',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
    },
    {
      name: 'team_id',
      type: 'relationship',
      relationTo: 'teams',
      required: true,
      index: true,
    },
    {
      name: 'player_id',
      type: 'relationship',
      relationTo: 'players',
      required: true,
      index: true,
    },
    {
      name: 'category_id',
      type: 'relationship',
      relationTo: 'competition-categories',
      index: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'player',
      options: [
        { label: 'Player', value: 'player' },
        { label: 'Captain', value: 'captain' },
        { label: 'Coach', value: 'coach' },
        { label: 'Manager', value: 'manager' },
        { label: 'Substitute', value: 'substitute' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
  ],
  timestamps: true,
}
