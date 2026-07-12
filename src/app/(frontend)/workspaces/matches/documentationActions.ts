'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../workspaceAuth'
import { validateDocumentationFile } from '@/lib/documentationValidation'

const ASSET_TYPES = new Set(['photo', 'video', 'file', 'score_sheet', 'other'])
const VISIBILITIES = new Set(['public', 'internal'])

const toStringField = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : ''

export async function addDocumentationAssetAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const assetType = toStringField(formData.get('assetType')) || 'other'
  const visibility = toStringField(formData.get('visibility')) || 'internal'
  const caption = toStringField(formData.get('caption'))
  const file = formData.get('file')

  if (!matchNumber || !ASSET_TYPES.has(assetType) || !VISIBILITIES.has(visibility)) {
    redirect(`/workspaces/matches/${matchNumber || ''}?docError=invalid_request`)
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/workspaces/matches/${matchNumber}?docError=missing_file`)
  }

  const fileValidation = validateDocumentationFile({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  })
  if (!fileValidation.valid) {
    redirect(`/workspaces/matches/${matchNumber}?docError=${fileValidation.reason}`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo: `/workspaces/matches/${matchNumber}`,
  })
  const matches = await payload.find({
    collection: 'matches',
    depth: 0,
    limit: 1,
    where: { match_number: { equals: matchNumber } },
  })
  const match = matches.docs[0]

  if (!match) {
    redirect(`/workspaces/matches/${matchNumber}?docError=not_found`)
  }

  const arrayBuffer = await file.arrayBuffer()

  await payload.create({
    collection: 'documentation-assets',
    data: {
      event_id: match.event_id,
      match_id: match.id,
      uploaded_by: user.id,
      asset_type: assetType,
      caption: caption || undefined,
      visibility,
    },
    file: {
      data: Buffer.from(arrayBuffer),
      mimetype: fileValidation.mimeType,
      name: fileValidation.filename,
      size: file.size,
    },
  })

  revalidatePath(`/workspaces/matches/${matchNumber}`)
  revalidatePath(`/matches/${matchNumber}`)
  redirect(`/workspaces/matches/${matchNumber}?docUpdated=1`)
}
