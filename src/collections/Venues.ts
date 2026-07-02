import type { CollectionConfig } from 'payload'

import { canManageEventStructure } from '@/access/roles'

export const Venues: CollectionConfig = {
  slug: 'venues',
  admin: {
    defaultColumns: ['name', 'event_id', 'is_virtual', 'address'],
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
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'address',
      type: 'textarea',
    },
    {
      name: 'map_url',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'is_virtual',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'virtual_url',
      type: 'text',
    },
  ],
  timestamps: true,
}
