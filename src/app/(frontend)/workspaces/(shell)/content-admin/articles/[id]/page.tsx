import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  getContentTaggingOptions,
  getMediaUrl,
  lexicalContentToMarkdownLite,
  type LexicalContent,
  type MediaDoc,
} from '../../../../../contentData'
import { getRelationshipId, PageHero, type RelationshipDoc } from '../../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../../workspaceAuth'
import { deleteArticleAction, updateArticleAction } from '../articleActions'

export const dynamic = 'force-dynamic'

const articleErrorMessages: Record<string, string> = {
  invalid_article: 'Fill in the title, slug, excerpt, and a valid status.',
  duplicate_slug: 'That slug is already used by another article.',
  invalid_cover_image: 'Cover image must be an image file.',
}

type ArticleDoc = {
  id: string | number
  title: string
  slug: string
  excerpt: string
  content?: LexicalContent | null
  cover_image?: MediaDoc | string | number | null
  sport_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  match_id?: RelationshipDoc | string | number | null
  status: string
  share_title?: string | null
  share_description?: string | null
  comments_enabled?: boolean | null
  event_id: RelationshipDoc | string | number
}

type PageParams = Promise<{ id: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: PageParams
  searchParams?: SearchParams
}) {
  const { id } = await params
  const editPage = `/workspaces/content-admin/articles/${id}`
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: editPage,
    workspaceName: 'Content Desk',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  let article: ArticleDoc
  try {
    article = (await access.payload.findByID({ collection: 'articles', id, depth: 1 })) as ArticleDoc
  } catch {
    notFound()
  }

  const searchQuery = searchParams ? await searchParams : {}
  const articleError = get(searchQuery, 'articleError')
  const articleUpdated = get(searchQuery, 'articleUpdated') === '1'
  const tagging = await getContentTaggingOptions(access.payload, getRelationshipId(article.event_id))
  const contentPlainText = lexicalContentToMarkdownLite(article.content)
  const coverUrl = getMediaUrl(article.cover_image)

  return (
    <>
      <PageHero
        eyebrow="Content Desk"
        title={article.title}
        summary="Edit this article's story, tagging, and status - no Payload Admin required."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/workspaces/content-admin/articles">Back to articles</Link>
          </Button>
        }
      />

      {articleError && articleErrorMessages[articleError] ? (
        <AlertBanner tone="error" className="mb-4">
          {articleErrorMessages[articleError]}
        </AlertBanner>
      ) : null}
      {articleUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <form action={updateArticleAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={String(article.id)} />
        <Card className="flex flex-col gap-4">
          <CardTitle>Story</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" required defaultValue={article.title} />
            </Field>
            <Field label="Slug" className="sm:col-span-2">
              <Input name="slug" defaultValue={article.slug} />
            </Field>
            <Field label="Excerpt" className="sm:col-span-2">
              <Textarea name="excerpt" required rows={2} defaultValue={article.excerpt} />
            </Field>
            <Field label="Content" className="sm:col-span-2">
              <Textarea
                name="content"
                rows={10}
                defaultValue={contentPlainText}
                placeholder="Leave a blank line between paragraphs. Supports # Heading, - list item, **bold**, and [link text](https://...)."
              />
            </Field>
            <Field label={coverUrl ? 'Replace cover image (optional)' : 'Cover image (optional)'} className="sm:col-span-2">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions
                <img src={coverUrl} alt="" className="mb-2 h-32 w-full rounded-card border border-line object-cover" />
              ) : null}
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
              <Select name="sportId" defaultValue={getRelationshipId(article.sport_id )}>
                <option value="">None</option>
                {tagging.sports.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select name="categoryId" defaultValue={getRelationshipId(article.category_id )}>
                <option value="">None</option>
                {tagging.categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Match">
              <Select name="matchId" defaultValue={getRelationshipId(article.match_id )}>
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
              <Select name="status" defaultValue={article.status}>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Comments">
              <label className="flex h-11 items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  name="commentsEnabled"
                  defaultChecked={Boolean(article.comments_enabled)}
                  className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                />
                Allow comments
              </label>
            </Field>
            <Field label="Share title (optional)">
              <Input name="shareTitle" defaultValue={article.share_title || ''} />
            </Field>
            <Field label="Share description (optional)">
              <Input name="shareDescription" defaultValue={article.share_description || ''} />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Save article</Button>
        </div>
      </form>

      <form action={deleteArticleAction} className="mt-6">
        <input type="hidden" name="id" value={String(article.id)} />
        <Button type="submit" variant="secondary" className="text-red-700 hover:bg-red-50">
          Delete article
        </Button>
      </form>
    </>
  )
}
