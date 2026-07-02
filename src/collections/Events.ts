import type { CollectionConfig } from 'payload'

import { canManageEventStructure } from '@/access/roles'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    defaultColumns: ['name', 'status', 'visibility', 'event_start_at', 'event_end_at'],
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
      name: 'banner_image',
      type: 'text',
      admin: {
        description: 'Temporary URL field until the media collection is added.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'event_start_at',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'event_end_at',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'public_open_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'If empty, public access opens seven days before event_start_at.',
          },
        },
        {
          name: 'registration_open_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'registration_close_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'schedule_publish_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      name: 'archive_at',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Setup', value: 'setup' },
            { label: 'Coming Soon', value: 'coming_soon' },
            { label: 'Live', value: 'live' },
            { label: 'Completed', value: 'completed' },
            { label: 'Archived', value: 'archived' },
          ],
        },
        {
          name: 'visibility',
          type: 'select',
          required: true,
          defaultValue: 'hidden',
          options: [
            { label: 'Hidden', value: 'hidden' },
            { label: 'Coming Soon', value: 'coming_soon' },
            { label: 'Preview Only', value: 'preview_only' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived' },
          ],
        },
      ],
    },
    {
      name: 'location',
      type: 'text',
    },
    {
      name: 'organizer_name',
      type: 'text',
    },
    {
      name: 'rules_summary',
      type: 'textarea',
    },
    {
      name: 'theme_config',
      type: 'json',
    },
  ],
  timestamps: true,
}
