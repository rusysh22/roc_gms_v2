import path from 'path'
import type { CollectionBeforeOperationHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { canManageContent } from '@/access/roles'
import { validateImageBuffer, validateUploadSize } from '@/lib/uploadValidation'

// AUDIT_E2E CNT-04: the only prior check was a client-supplied `File.type.startsWith('image/')`
// string comparison in the calling Server Actions - trivially spoofed, not enforced at the
// collection boundary, and with no size limit at all. This runs for every entry point (Local API,
// REST, GraphQL, Admin), decodes the actual bytes with sharp, and rejects anything that isn't
// really a decodable image. Payload's own `File` type (src/uploads/types.ts) is the classic
// express-fileupload shape - `{ data: Buffer, mimetype, name, size }` - not a Web File, so the
// bytes are already available synchronously on `req.file.data`.
const validateMediaUpload: CollectionBeforeOperationHook<'media'> = async ({ req, operation }) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) {
    return
  }

  const sizeCheck = validateUploadSize(req.file.size)
  if (!sizeCheck.valid) {
    throw new APIError(sizeCheck.reason, 400, null, true)
  }

  const imageCheck = await validateImageBuffer(req.file.data)
  if (!imageCheck.valid) {
    throw new APIError(imageCheck.reason, 400, null, true)
  }
}

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
  hooks: {
    beforeOperation: [validateMediaUpload],
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media/content'),
    mimeTypes: ['image/*'],
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
