import path from 'path'
import type { Access, CollectionBeforeOperationHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { getAccessibleEventIds } from '@/access/eventMembership'
import { canManageContent } from '@/access/roles'
import { validateImageBuffer, validateUploadSize } from '@/lib/uploadValidation'

// AUDIT_TOURNAMENT_STANDARDS SEC-06: Media had no event scoping, so any content_admin could
// overwrite or delete another organizer's banners/logos/article images via REST/GraphQL/Admin.
// Uploads through the workspace now stamp the active event (mediaActions.ts); this narrows
// mutation to media the caller's events own. `read` stays public (images are served on the public
// site). Media with a null event_id - legacy rows, or shared assets - stays editable by any
// content_admin so this doesn't strand anything; a backfill isn't required.
const scopedMediaMutation: Access = async (args) => {
  if (!(await canManageContent(args))) return false
  const { req } = args
  if (!req.user) return false
  const ids = await getAccessibleEventIds(req.payload, req.user)
  if (ids === 'all') return true
  return { or: [{ event_id: { in: ids } }, { event_id: { exists: false } }] }
}

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
    delete: scopedMediaMutation,
    read: () => true,
    update: scopedMediaMutation,
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
      name: 'event_id',
      type: 'relationship',
      relationTo: 'events',
      index: true,
      admin: {
        description: 'Owning event - set when uploaded through the Content Desk. Null for shared/legacy assets.',
      },
    },
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
