import type { CollectionConfig } from 'payload'

import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageEventStructure } from '@/access/roles'

export const Courts: CollectionConfig = {
  slug: 'courts',
  admin: {
    defaultColumns: ['name', 'venue_id', 'sport_id', 'capacity', 'is_active'],
    group: 'Event Setup',
    useAsTitle: 'name',
  },
  access: {
    create: scopedCreateToUserEvents(canManageEventStructure),
    delete: scopedToUserEvents(canManageEventStructure),
    // Unchanged: read stays fully public (schedule/venue info is meant to be visible site-wide),
    // separate from the per-user *write* scoping this pass adds.
    read: () => true,
    update: scopedToUserEvents(canManageEventStructure),
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
      name: 'venue_id',
      type: 'relationship',
      relationTo: 'venues',
      required: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'sport_id',
      type: 'relationship',
      relationTo: 'sports',
      index: true,
    },
    {
      name: 'capacity',
      type: 'number',
      min: 0,
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'is_featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Broadcast/feature court - the cross-sport schedule optimizer prioritizes is_featured matches onto featured courts first.',
      },
    },
  ],
  timestamps: true,
}
