import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type { CollectionConfig } from 'payload'

import { canManageContent } from '@/access/roles'

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Review', value: 'review' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    defaultColumns: ['title', 'status', 'event_id', 'published_at', 'updatedAt'],
    group: 'Content',
    useAsTitle: 'title',
  },
  access: {
    create: canManageContent,
    delete: canManageContent,
    read: () => true,
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
      name: 'excerpt',
      type: 'textarea',
      required: true,
    },
    {
      name: 'cover_image',
      type: 'relationship',
      relationTo: 'media',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      editor: lexicalEditor(),
    },
    {
      name: 'author_user_id',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Optional until workspace authentication is applied consistently.',
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
          index: true,
          options: statusOptions,
        },
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
    {
      name: 'canonical_url',
      type: 'text',
      admin: {
        description: 'Optional public URL override for future sharing metadata.',
      },
    },
    {
      name: 'comments_enabled',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
  timestamps: true,
}
