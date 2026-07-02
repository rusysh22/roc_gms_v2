import type { CollectionConfig } from 'payload'

import { canManageMatches } from '@/access/roles'

export const MatchSets: CollectionConfig = {
  slug: 'match-sets',
  admin: {
    defaultColumns: ['match_id', 'set_number', 'participant_a_score', 'participant_b_score'],
    group: 'Schedule',
  },
  access: {
    create: canManageMatches,
    delete: canManageMatches,
    read: () => true,
    update: canManageMatches,
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
      name: 'match_id',
      type: 'relationship',
      relationTo: 'matches',
      required: true,
      index: true,
    },
    {
      name: 'set_number',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
    },
    {
      name: 'participant_a_score',
      type: 'number',
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'participant_b_score',
      type: 'number',
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'winner_entry_id',
      type: 'relationship',
      relationTo: 'competition-entries',
      index: true,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
