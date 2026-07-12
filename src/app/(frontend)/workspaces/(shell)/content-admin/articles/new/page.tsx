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
import { createArticleAction } from '../articleActions'

export const dynamic = 'force-dynamic'

const articleErrorMessages: Record<string, string> = {
  invalid_article: 'Fill in the title, slug, excerpt, and a valid status.',
  duplicate_slug: 'That slug is already used by another article.',
  invalid_cover_image: 'Cover image must be an image file.',
  missing_event: 'No active event to attach this article to.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function NewArticlePage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: '/workspaces/content-admin/articles/new',
    workspaceName: 'Content Desk',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Content Desk" title="New Article" summary="Write a new event story." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const articleError = get(params, 'articleError')
  const tagging = await getContentTaggingOptions(access.payload, activeEvent.id)

  return (
    <>
      <PageHero eyebrow="Content Desk" title="New Article" summary="Write, tag, and publish a new event story." />

      {articleError && articleErrorMessages[articleError] ? (
        <AlertBanner tone="error" className="mb-4">
          {articleErrorMessages[articleError]}
        </AlertBanner>
      ) : null}

      <form action={createArticleAction} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <CardTitle>Story</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" required />
            </Field>
            <Field label="Slug (optional - generated from title)" className="sm:col-span-2">
              <Input name="slug" />
            </Field>
            <Field label="Excerpt" className="sm:col-span-2">
              <Textarea name="excerpt" required rows={2} />
            </Field>
            <Field label="Content" className="sm:col-span-2">
              <Textarea name="content" rows={10} placeholder="Leave a blank line between paragraphs." />
            </Field>
            <Field label="Cover image (optional)" className="sm:col-span-2">
              <input
                type="file"
                name="coverImage"
                accept="image/*"
                className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink file:mr-3 file:rounded-full file:border-0 file:bg-green file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-paper"
              />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Tagging</CardTitle>
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
          <CardTitle>Status &amp; sharing</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Comments">
              <label className="flex h-11 items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" name="commentsEnabled" className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
                Allow comments
              </label>
            </Field>
            <Field label="Share title (optional)">
              <Input name="shareTitle" />
            </Field>
            <Field label="Share description (optional)">
              <Input name="shareDescription" />
            </Field>
          </div>
        </Card>

        <div>
          <Button type="submit">Create article</Button>
        </div>
      </form>
    </>
  )
}
