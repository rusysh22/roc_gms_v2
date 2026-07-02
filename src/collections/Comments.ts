import type { CollectionConfig } from 'payload'

import { canManageMatches, canReadEventBackoffice } from '@/access/roles'

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    defaultColumns: [
      'entity_type',
      'entity_id',
      'comment_type',
      'status',
      'author_name',
      'is_pinned',
      'createdAt',
    ],
    group: 'Content',
    useAsTitle: 'body',
  },
  access: {
    create: canManageMatches,
    delete: canManageMatches,
    read: canReadEventBackoffice,
    update: canManageMatches,
  },
  fields: [
    {
      name: 'entity_type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Match', value: 'matches' },
        { label: 'Article', value: 'articles' },
        { label: 'Announcement', value: 'announcements' },
        { label: 'Documentation Asset', value: 'documentation-assets' },
        { label: 'Event', value: 'events' },
      ],
    },
    {
      name: 'entity_id',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Stores the target document id as text so comments can target multiple entity types.',
      },
    },
    {
      name: 'comment_type',
      type: 'select',
      required: true,
      defaultValue: 'internal',
      index: true,
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Internal', value: 'internal' },
        { label: 'Official Note', value: 'official_note' },
      ],
    },
    {
      name: 'author_name',
      type: 'text',
      required: true,
      defaultValue: 'System / Unknown',
    },
    {
      name: 'author_user_id',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Left empty when the author has no authenticated backoffice session.',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Hidden', value: 'hidden' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Deleted', value: 'deleted' },
      ],
    },
    {
      name: 'is_pinned',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'resolved_at',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'parent_comment_id',
      type: 'relationship',
      relationTo: 'comments',
      index: true,
    },
  ],
  timestamps: true,
}
