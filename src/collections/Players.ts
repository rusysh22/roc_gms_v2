import type { CollectionConfig } from 'payload'

import { canManageEventStructure, canReadEventBackoffice } from '@/access/roles'

export const Players: CollectionConfig = {
  slug: 'players',
  admin: {
    defaultColumns: ['name', 'club_id', 'employee_id', 'email', 'gender'],
    group: 'Participants',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: canReadEventBackoffice,
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
      name: 'club_id',
      type: 'relationship',
      relationTo: 'clubs',
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'employee_id',
      type: 'text',
      unique: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'phone',
          type: 'text',
        },
      ],
    },
    {
      name: 'photo',
      type: 'text',
      admin: {
        description: 'Temporary URL field until the media collection is added.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Prefer Not To Say', value: 'prefer_not_to_say' },
      ],
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  timestamps: true,
}
