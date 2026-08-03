import type { CollectionConfig } from 'payload'

import { canManageEventStructure } from '@/access/roles'

export const Courts: CollectionConfig = {
  slug: 'courts',
  admin: {
    defaultColumns: ['name', 'venue_id', 'sport_id', 'capacity', 'is_active'],
    group: 'Event Setup',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: () => true,
    update: canManageEventStructure,
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
