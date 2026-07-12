import path from 'path'
import type { CollectionConfig } from 'payload'

import { canManageMatches, canReadDocumentation } from '@/access/roles'

export const DocumentationAssets: CollectionConfig = {
  slug: 'documentation-assets',
  admin: {
    defaultColumns: ['match_id', 'asset_type', 'visibility', 'caption', 'createdAt'],
    group: 'Schedule',
    useAsTitle: 'caption',
  },
  access: {
    create: canManageMatches,
    delete: canManageMatches,
    read: canReadDocumentation,
    update: canManageMatches,
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media/documentation-assets'),
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
      name: 'match_id',
      type: 'relationship',
      relationTo: 'matches',
      required: true,
      index: true,
    },
    {
      name: 'uploaded_by',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Left empty when the uploader has no authenticated backoffice session.',
      },
    },
    {
      name: 'asset_type',
      type: 'select',
      required: true,
      defaultValue: 'other',
      options: [
        { label: 'Photo', value: 'photo' },
        { label: 'Video', value: 'video' },
        { label: 'File', value: 'file' },
        { label: 'Score Sheet', value: 'score_sheet' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'internal',
      index: true,
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Internal', value: 'internal' },
      ],
    },
  ],
  timestamps: true,
}
