import type { CollectionConfig } from 'payload'

import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageParticipants, canReadEventBackoffice } from '@/access/roles'

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
