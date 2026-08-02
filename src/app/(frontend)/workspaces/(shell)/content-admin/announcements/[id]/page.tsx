import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getContentTaggingOptions } from '../../../../../contentData'
import { getRelationshipId, PageHero, type RelationshipDoc } from '../../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../../workspaceAuth'
import { deleteAnnouncementAction, updateAnnouncementAction } from '../announcementActions'

export const dynamic = 'force-dynamic'

const announcementErrorMessages: Record<string, string> = {
  invalid_announcement: 'Fill in the title, slug, summary, and body with valid options.',
  duplicate_slug: 'That slug is already used by another announcement.',
}

type AnnouncementDoc = {
  id: string | number
  title: string
  slug: string
  summary: string
  body: string
  urgency: string
  display_mode: string
  status: string
  target_scope: string
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  match_id?: RelationshipDoc | string | number | null
  published_at?: string | null
  expires_at?: string | null
  cta_label?: string | null
  cta_url?: string | null
  share_title?: string | null
  share_description?: string | null
  event_id: RelationshipDoc | string | number
}

type PageParams = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

const toDateTimeLocalValue = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default async function EditAnnouncementPage({
  params,
  searchParams,
}: {
  params: PageParams
  searchParams?: SearchParams
}) {
  const { id } = await params
  const editPage = `/workspaces/content-admin/announcements/${id}`
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: editPage,
    workspaceName: 'Content Desk',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  let announcement: AnnouncementDoc
  try {
    announcement = (await access.payload.findByID({
      collection: 'announcements',
      id,
      depth: 1,
    })) as AnnouncementDoc
  } catch {
    notFound()
  }

  const searchQuery = searchParams ? await searchParams : {}
  const announcementError = get(searchQuery, 'announcementError')
  const announcementUpdated = get(searchQuery, 'announcementUpdated') === '1'
  const tagging = await getContentTaggingOptions(access.payload, getRelationshipId(announcement.event_id))

  return (
    <>
      <PageHero
        eyebrow="Content Desk"
        title={announcement.title}
        summary="Edit this announcement's delivery, tagging, and status - no Payload Admin required."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/workspaces/content-admin/announcements">Back to announcements</Link>
          </Button>
        }
      />

      {announcementError && announcementErrorMessages[announcementError] ? (
        <AlertBanner tone="error" className="mb-4">
          {announcementErrorMessages[announcementError]}
        </AlertBanner>
      ) : null}
      {announcementUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <form action={updateAnnouncementAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={String(announcement.id)} />
        <Card className="flex flex-col gap-4">
          <CardTitle>Announcement</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" required defaultValue={announcement.title} />
            </Field>
            <Field label="Slug" className="sm:col-span-2">
              <Input name="slug" defaultValue={announcement.slug} />
            </Field>
            <Field label="Summary" className="sm:col-span-2">
              <Textarea name="summary" required rows={2} defaultValue={announcement.summary} />
            </Field>
            <Field label="Body" className="sm:col-span-2">
              <Textarea name="body" required rows={6} defaultValue={announcement.body} />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Delivery</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Urgency">
              <Select name="urgency" defaultValue={announcement.urgency}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="urgent">Urgent</option>
                <option value="result">Result</option>
                <option value="schedule_change">Schedule Change</option>
              </Select>
            </Field>
            <Field label="Display mode">
              <Select name="displayMode" defaultValue={announcement.display_mode}>
                <option value="feed">Feed Item</option>
                <option value="banner">Banner</option>
                <option value="urgent_alert">Urgent Alert</option>
              </Select>
            </Field>
            <Field label="Target scope">
              <Select name="targetScope" defaultValue={announcement.target_scope}>
                <option value="event">Event</option>
                <option value="sport">Sport</option>
                <option value="category">Category</option>
                <option value="match">Match</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={announcement.status}>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Publishes at (optional)">
              <Input name="publishedAt" type="datetime-local" defaultValue={toDateTimeLocalValue(announcement.published_at)} />
            </Field>
            <Field label="Expires at (optional)">
              <Input name="expiresAt" type="datetime-local" defaultValue={toDateTimeLocalValue(announcement.expires_at)} />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Tagging (matches target scope)</CardTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sport">
              <Select name="sportId" defaultValue={getRelationshipId(announcement.sport_id)}>
                <option value="">None</option>
                {tagging.sports.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select name="categoryId" defaultValue={getRelationshipId(announcement.category_id)}>
                <option value="">None</option>
                {tagging.categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Match">
              <Select name="matchId" defaultValue={getRelationshipId(announcement.match_id)}>
                <option value="">None</option>
                {tagging.matches.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Call to action &amp; sharing (optional)</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CTA label">
              <Input name="ctaLabel" defaultValue={announcement.cta_label || ''} />
            </Field>
            <Field label="CTA URL">
              <Input name="ctaUrl" defaultValue={announcement.cta_url || ''} />
            </Field>
            <Field label="Share title">
              <Input name="shareTitle" defaultValue={announcement.share_title || ''} />
            </Field>
            <Field label="Share description">
              <Input name="shareDescription" defaultValue={announcement.share_description || ''} />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <SubmitButton>Save announcement</SubmitButton>
        </div>
      </form>

      <form id="delete-announcement-form" action={deleteAnnouncementAction} className="mt-6">
        <input type="hidden" name="id" value={String(announcement.id)} />
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive">
              Delete announcement
            </Button>
          }
          description={`Delete "${announcement.title}"? This can't be undone.`}
          confirmLabel="Delete announcement"
          confirmButtonProps={{ type: 'submit', form: 'delete-announcement-form' }}
        />
      </form>
    </>
  )
}
