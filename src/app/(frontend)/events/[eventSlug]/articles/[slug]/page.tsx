import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowLeft } from 'lucide-react'

import config from '@payload-config'
import { Card } from '@/components/ui/card'
import { buildShareMetadata, getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { ArticleRichText, ArticleSharePanel } from '../../../../contentComponents'
import {
  formatContentDate,
  getMedia,
  getMediaUrl,
  getPlainTextFromLexical,
  getPublicArticleBySlug,
  getPublicArticleBySlugForMode,
} from '../../../../contentData'
import { ArticlePublicEditor, EditableRegion, PublicEditToolbar } from '../../../../publicEditComponents'
import { getPublicEditState } from '../../../../publicEditState'
import { getRelationshipLabel } from '../../../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../../../publicEvents'

export const dynamic = 'force-dynamic'

type PageParams = Promise<{ eventSlug: string; slug: string }>
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { eventSlug, slug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  const article = event ? await getPublicArticleBySlug(slug, event.id) : undefined

  if (!article) {
    return buildShareMetadata({
      title: `Article not found / ${event?.name || 'Event'}`,
      description: `This ${event?.name || 'event'} article is not available.`,
      path: `/events/${eventSlug}/articles/${slug}`,
    })
  }

  const imageUrl = getMediaUrl(article.share_image) || getMediaUrl(article.cover_image)

  return buildShareMetadata({
    title: article.share_title || article.title,
    description:
      article.share_description || article.excerpt || getPlainTextFromLexical(article.content),
    path: article.canonical_url || `/events/${eventSlug}/articles/${article.slug}`,
    imageUrl,
  })
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: PageParams
  searchParams: PageSearchParams
}) {
  const [{ eventSlug, slug }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const editState = await getPublicEditState(resolvedSearchParams, event.id)
  const eventPath = `/events/${event.slug}`

  const article = await getPublicArticleBySlugForMode({
    slug,
    includeUnpublished: editState.isPreview,
    eventId: event.id,
  })

  if (!article) {
    notFound()
  }

  const cover = getMedia(article.cover_image)
  const coverUrl = getMediaUrl(article.cover_image)
  const articlePath = `${eventPath}/articles/${article.slug}`
  const shareUrl = getAbsolutePublicUrl(article.canonical_url || articlePath)

  return (
    <main className="font-sans text-ink">
      <PublicEditToolbar state={editState} path={articlePath} />
      <section className="px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`${eventPath}/updates?tab=articles`}
            className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to articles
          </Link>
          <EditableRegion
            state={editState}
            label="Article header"
            editor={
              <ArticlePublicEditor
                id={article.id}
                title={article.title}
                excerpt={article.excerpt}
                status={article.status}
                shareTitle={article.share_title}
                shareDescription={article.share_description}
                returnTo={articlePath}
              />
            }
          >
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {formatContentDate(article.published_at)}
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
              {article.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">{article.excerpt}</p>
          </EditableRegion>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-ink-soft">
            {article.event_id ? <span>{getRelationshipLabel(article.event_id)}</span> : null}
            {article.sport_id ? <span>{getRelationshipLabel(article.sport_id)}</span> : null}
            {article.category_id ? <span>{getRelationshipLabel(article.category_id)}</span> : null}
            {article.match_id ? <span>{getRelationshipLabel(article.match_id)}</span> : null}
          </div>
        </div>
      </section>

      {coverUrl ? (
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-panel border border-line bg-mist">
            {/* eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions */}
            <img src={coverUrl} alt={cover?.alt || article.title} className="w-full object-cover" />
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-8">
        <article className="mx-auto max-w-3xl">
          <ArticleRichText article={article} />
        </article>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <ArticleSharePanel article={article} url={shareUrl} />
          {article.comments_enabled ? (
            <Card className="mt-4 text-sm text-ink-soft">
              Comments are enabled for this article. Public comment submission and moderation are
              scheduled for a later phase.
            </Card>
          ) : null}
        </div>
      </section>
    </main>
  )
}
