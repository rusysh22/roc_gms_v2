import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { buildShareMetadata, getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { ArticleRichText, ArticleSharePanel } from '../../contentComponents'
import {
  formatContentDate,
  getMedia,
  getMediaUrl,
  getPlainTextFromLexical,
  getPublicArticleBySlug,
} from '../../contentData'
import { getRelationshipLabel } from '../../workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

type PageParams = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublicArticleBySlug(slug)

  if (!article) {
    return buildShareMetadata({
      title: 'Article not found / ROC Olympic 2026',
      description: 'This ROC Olympic 2026 article is not available.',
      path: `/articles/${slug}`,
    })
  }

  const imageUrl = getMediaUrl(article.share_image) || getMediaUrl(article.cover_image)

  return buildShareMetadata({
    title: article.share_title || article.title,
    description:
      article.share_description || article.excerpt || getPlainTextFromLexical(article.content),
    path: article.canonical_url || `/articles/${article.slug}`,
    imageUrl,
  })
}

export default async function ArticleDetailPage({ params }: { params: PageParams }) {
  const { slug } = await params
  const article = await getPublicArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const cover = getMedia(article.cover_image)
  const coverUrl = getMediaUrl(article.cover_image)
  const shareUrl = getAbsolutePublicUrl(article.canonical_url || `/articles/${article.slug}`)

  return (
    <main className="font-sans text-ink">
      <section className="px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/articles"
            className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to articles
          </Link>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {formatContentDate(article.published_at)}
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">{article.excerpt}</p>
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
