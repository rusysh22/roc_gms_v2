import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteMediaAction, uploadMediaAction } from './mediaActions'

export const dynamic = 'force-dynamic'

const mediaErrorMessages: Record<string, string> = {
  invalid_upload: 'Choose a file and enter an alt description.',
  invalid_image: 'Only image files can be uploaded here.',
}

type MediaDoc = {
  id: string | number
  alt?: string | null
  caption?: string | null
  url?: string | null
  filename?: string | null
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function MediaLibraryPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: '/workspaces/content-admin/media',
    workspaceName: 'Content Desk',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const params = searchParams ? await searchParams : {}
  const mediaError = get(params, 'mediaError')
  const mediaUpdated = get(params, 'mediaUpdated') === '1'
  const mediaDeleted = get(params, 'mediaDeleted') === '1'

  const media = await access.payload.find({
    collection: 'media',
    depth: 0,
    limit: 60,
    sort: '-updatedAt',
  })

  return (
    <>
      <PageHero
        eyebrow="Content Desk"
        title="Media Library"
        summary="Upload reusable cover and share images - every upload is automatically resized and compressed. No Payload Admin required."
      />

      {mediaError && mediaErrorMessages[mediaError] ? (
        <AlertBanner tone="error" className="mb-4">
          {mediaErrorMessages[mediaError]}
        </AlertBanner>
      ) : null}
      {mediaUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Uploaded.
        </AlertBanner>
      ) : null}
      {mediaDeleted ? (
        <AlertBanner tone="success" className="mb-4">
          Deleted.
        </AlertBanner>
      ) : null}

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>Upload image</CardTitle>
        <form action={uploadMediaAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="File" className="sm:col-span-2">
            <FileUpload
              id="media-upload"
              name="file"
              accept="image/*"
              required
              maxSizeBytes={10 * 1024 * 1024}
            />
          </Field>
          <Field label="Alt text">
            <Input name="alt" required placeholder="Short accessible description" />
          </Field>
          <Field label="Caption (optional)">
            <Input name="caption" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Upload</SubmitButton>
          </div>
        </form>
      </Card>

      {(media.docs as MediaDoc[]).length === 0 ? (
        <EmptyState>No media uploaded yet.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(media.docs as MediaDoc[]).map((item) => (
            <Card key={item.id} className="flex flex-col gap-2">
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions
                <img src={item.url} alt={item.alt || ''} className="h-32 w-full rounded-card border border-line object-cover" />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-card border border-line bg-mist text-xs font-bold text-ink-soft uppercase">
                  No preview
                </div>
              )}
              <p className="truncate text-sm font-bold text-ink">{item.alt || item.filename}</p>
              {item.caption ? <p className="truncate text-xs text-ink-soft">{item.caption}</p> : null}
              <form id={`delete-media-${item.id}`} action={deleteMediaAction}>
                <input type="hidden" name="id" value={String(item.id)} />
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="destructive" size="sm" className="w-full">
                      Delete
                    </Button>
                  }
                  description={`Delete "${item.alt || item.filename}"? This removes it from the media library; any page still referencing it will show a broken image.`}
                  confirmLabel="Delete"
                  confirmButtonProps={{ type: 'submit', form: `delete-media-${item.id}` }}
                />
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
