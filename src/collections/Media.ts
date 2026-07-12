import path from 'path'
import type { CollectionConfig } from 'payload'

import { canManageContent } from '@/access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    group: 'Content',
    useAsTitle: 'alt',
  },
  access: {
    create: canManageContent,
    delete: canManageContent,
    read: () => true,
    update: canManageContent,
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media/content'),
    // Every upload (hero images, article/announcement covers, ...) gets downsized and
    // re-encoded so nobody has to remember to compress an image before uploading it.
    resizeOptions: { width: 1920, withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      { name: 'thumbnail', width: 480, height: undefined, formatOptions: { format: 'webp', options: { quality: 82 } } },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Short accessible description for images used in articles and announcements.',
      },
    },
    {
      name: 'caption',
      type: 'text',
    },
  ],
  timestamps: true,
}
