import type { CollectionConfig } from 'payload'

import { canManageEventStructure } from '@/access/roles'

export const Sports: CollectionConfig = {
  slug: 'sports',
  admin: {
    defaultColumns: ['name', 'event_id', 'sport_type', 'is_active'],
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Icon key or temporary URL until the media/icon system is added.',
      },
    },
    {
      name: 'sport_type',
      type: 'select',
      required: true,
      defaultValue: 'court',
      options: [
        { label: 'Court', value: 'court' },
        { label: 'Field', value: 'field' },
        { label: 'Table', value: 'table' },
        { label: 'Board', value: 'board' },
        { label: 'Esport', value: 'esport' },
        { label: 'Track', value: 'track' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'default_ruleset_id',
      type: 'text',
      admin: {
        description: 'Temporary identifier until the Ruleset collection is added in Phase 2.',
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  timestamps: true,
}
