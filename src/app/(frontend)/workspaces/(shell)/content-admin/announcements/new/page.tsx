import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getContentTaggingOptions } from '../../../../../contentData'
import { getActiveEvent } from '../../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../../workspaceAuth'
import { createAnnouncementAction } from '../announcementActions'

export const dynamic = 'force-dynamic'

const announcementErrorMessages: Record<string, string> = {
  invalid_announcement: 'Fill in the title, slug, summary, and body with valid options.',
  duplicate_slug: 'That slug is already used by another announcement.',
  missing_event: 'No active event to attach this announcement to.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function NewAnnouncementPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: '/workspaces/content-admin/announcements/new',
    workspaceName: 'Content Desk',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Content Desk" title="New Announcement" summary="Post a new event update." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const announcementError = get(params, 'announcementError')
  const tagging = await getContentTaggingOptions(access.payload, activeEvent.id)

  return (
    <>
      <PageHero eyebrow="Content Desk" title="New Announcement" summary="Post a new event update or alert." />

      {announcementError && announcementErrorMessages[announcementError] ? (
        <AlertBanner tone="error" className="mb-4">
          {announcementErrorMessages[announcementError]}
        </AlertBanner>
      ) : null}

      <form action={createAnnouncementAction} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <CardTitle>Announcement</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" required />
            </Field>
            <Field label="Slug (optional - generated from title)" className="sm:col-span-2">
              <Input name="slug" />
            </Field>
            <Field label="Summary" className="sm:col-span-2">
              <Textarea name="summary" required rows={2} />
            </Field>
            <Field label="Body" className="sm:col-span-2">
              <Textarea name="body" required rows={6} />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Delivery</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Urgency">
              <Select name="urgency" defaultValue="info">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="urgent">Urgent</option>
                <option value="result">Result</option>
                <option value="schedule_change">Schedule Change</option>
              </Select>
            </Field>
            <Field label="Display mode">
              <Select name="displayMode" defaultValue="feed">
                <option value="feed">Feed Item</option>
                <option value="banner">Banner</option>
                <option value="urgent_alert">Urgent Alert</option>
              </Select>
            </Field>
            <Field label="Target scope">
              <Select name="targetScope" defaultValue="event">
                <option value="event">Event</option>
                <option value="sport">Sport</option>
                <option value="category">Category</option>
                <option value="match">Match</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Publishes at (optional)">
              <Input name="publishedAt" type="datetime-local" />
            </Field>
            <Field label="Expires at (optional)">
              <Input name="expiresAt" type="datetime-local" />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Tagging (matches target scope)</CardTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sport">
              <Select name="sportId" defaultValue="">
                <option value="">None</option>
                {tagging.sports.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select name="categoryId" defaultValue="">
                <option value="">None</option>
                {tagging.categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Match">
              <Select name="matchId" defaultValue="">
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
              <Input name="ctaLabel" />
            </Field>
            <Field label="CTA URL">
              <Input name="ctaUrl" />
            </Field>
            <Field label="Share title">
              <Input name="shareTitle" />
            </Field>
            <Field label="Share description">
              <Input name="shareDescription" />
            </Field>
          </div>
        </Card>

        <div>
          <Button type="submit">Create announcement</Button>
        </div>
      </form>
    </>
  )
}
