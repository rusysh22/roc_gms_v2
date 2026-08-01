import path from 'path'
import type { CollectionBeforeOperationHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { canManageMatches, canReadDocumentation } from '@/access/roles'
import {
  validateImageBuffer,
  validateMp4Buffer,
  validatePdfBuffer,
  validateUploadSize,
} from '@/lib/uploadValidation'

const DOCUMENTATION_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4']

// AUDIT_E2E CNT-04: src/lib/documentationValidation.ts already checked size/MIME/extension, but
// only inside the addDocumentationAssetAction Server Action - a direct Payload Admin/REST/GraphQL/
// Local API create bypassed it entirely (the collection itself enforced nothing). This runs for
// every entry point and, for image/PDF/MP4 uploads, checks the actual file bytes instead of
// trusting the declared Content-Type. Payload's own `File` type (src/uploads/types.ts) is the
// classic express-fileupload shape - `{ data: Buffer, mimetype, name, size }` - not a Web File.
const validateDocumentationUpload: CollectionBeforeOperationHook<'documentation-assets'> = async ({
  req,
  operation,
}) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) {
    return
  }

  const sizeCheck = validateUploadSize(req.file.size)
  if (!sizeCheck.valid) {
    throw new APIError(sizeCheck.reason, 400, null, true)
  }

  const mimeType = req.file.mimetype?.toLowerCase() || ''
  if (!DOCUMENTATION_MIME_TYPES.includes(mimeType)) {
    throw new APIError('Unsupported file type for documentation assets.', 400, null, true)
  }

  const buffer = req.file.data
  const contentCheck =
    mimeType === 'application/pdf' ? validatePdfBuffer(buffer)
    : mimeType === 'video/mp4' ? validateMp4Buffer(buffer)
    : await validateImageBuffer(buffer)

  if (!contentCheck.valid) {
    throw new APIError(contentCheck.reason, 400, null, true)
  }
}

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
  hooks: {
    beforeOperation: [validateDocumentationUpload],
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'media/documentation-assets'),
    mimeTypes: DOCUMENTATION_MIME_TYPES,
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
