import type { CollectionConfig } from 'payload'

import { canManageSchedule } from '@/access/roles'

export const Groups: CollectionConfig = {
  slug: 'groups',
  admin: {
    defaultColumns: ['name', 'stage_id', 'order'],
    group: 'Competition Setup',
    useAsTitle: 'name',
  },
  access: {
    create: canManageSchedule,
    delete: canManageSchedule,
    read: () => true,
    update: canManageSchedule,
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
      name: 'stage_id',
      type: 'relationship',
      relationTo: 'stages',
      required: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
    },
  ],
  timestamps: true,
}
