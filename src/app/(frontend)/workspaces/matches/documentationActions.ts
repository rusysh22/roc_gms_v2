'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
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
      uploaded_by: Number(user.id),
      asset_type: assetType as 'photo' | 'video' | 'file' | 'score_sheet' | 'other',
      caption: caption || undefined,
      visibility: visibility as 'public' | 'internal',
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

// Remove a documentation asset uploaded by mistake. The uploader can delete their own; an
// event_admin / super_admin can delete any.
export async function deleteDocumentationAssetAction(formData: FormData): Promise<void> {
  const matchNumber = toStringField(formData.get('matchNumber'))
  const assetId = toStringField(formData.get('assetId'))
  const returnTo = `/workspaces/matches/${matchNumber || ''}`

  if (!matchNumber || !assetId) {
    redirect(`${returnTo}?docError=invalid_request`)
  }

  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
  })

  const asset = await payload
    .findByID({ collection: 'documentation-assets', id: assetId, depth: 0 })
    .catch(() => null)
  if (!asset) {
    redirect(`${returnTo}?docError=not_found`)
  }

  const isAdmin = (user.roles ?? []).some((role) => role === 'super_admin' || role === 'event_admin')
  const isUploader = asset!.uploaded_by != null && String(asset!.uploaded_by) === String(user.id)
  if (!isAdmin && !isUploader) {
    redirect(`${returnTo}?docError=not_allowed`)
  }

  await payload.delete({ collection: 'documentation-assets', id: assetId })
  await recordAuditLog({
    payload,
    action: 'documentation_asset.delete',
    entityType: 'documentation-assets',
    entityId: assetId,
    before: asset,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(`/workspaces/matches/${matchNumber}`)
  revalidatePath(`/matches/${matchNumber}`)
  redirect(`${returnTo}?docUpdated=1`)
}
