import type { CollectionConfig } from 'payload'

import { publicReadPublishedContent } from '@/access/eventVisibility'
import { canManageContent } from '@/access/roles'

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Review', value: 'review' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  admin: {
    defaultColumns: ['title', 'urgency', 'target_scope', 'display_mode', 'status', 'published_at'],
    group: 'Content',
    useAsTitle: 'title',
  },
  access: {
    create: canManageContent,
    delete: canManageContent,
    read: publicReadPublishedContent({ expiresAtField: 'expires_at' }),
    update: canManageContent,
  },
  fields: [
    {
      name: 'title',
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
      name: 'summary',
      type: 'textarea',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'urgency',
          type: 'select',
          required: true,
          defaultValue: 'info',
          index: true,
          options: [
            { label: 'Info', value: 'info' },
            { label: 'Warning', value: 'warning' },
            { label: 'Urgent', value: 'urgent' },
            { label: 'Result', value: 'result' },
            { label: 'Schedule Change', value: 'schedule_change' },
          ],
        },
        {
          name: 'display_mode',
          type: 'select',
          required: true,
          defaultValue: 'feed',
          index: true,
          options: [
            { label: 'Feed Item', value: 'feed' },
            { label: 'Banner', value: 'banner' },
            { label: 'Urgent Alert', value: 'urgent_alert' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          index: true,
          options: statusOptions,
        },
        {
          name: 'target_scope',
          type: 'select',
          required: true,
          defaultValue: 'event',
          index: true,
          options: [
            { label: 'Event', value: 'event' },
            { label: 'Sport', value: 'sport' },
            { label: 'Category', value: 'category' },
            { label: 'Match', value: 'match' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'published_at',
          type: 'date',
          index: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'expires_at',
          type: 'date',
          index: true,
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
          name: 'event_id',
          type: 'relationship',
          relationTo: 'events',
          required: true,
          index: true,
        },
        {
          name: 'sport_id',
          type: 'relationship',
          relationTo: 'sports',
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'category_id',
          type: 'relationship',
          relationTo: 'competition-categories',
          index: true,
        },
        {
          name: 'match_id',
          type: 'relationship',
          relationTo: 'matches',
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cta_label',
          type: 'text',
        },
        {
          name: 'cta_url',
          type: 'text',
        },
      ],
    },
    {
      name: 'share_title',
      type: 'text',
    },
    {
      name: 'share_description',
      type: 'textarea',
    },
    {
      name: 'share_image',
      type: 'relationship',
      relationTo: 'media',
    },
  ],
  timestamps: true,
}
