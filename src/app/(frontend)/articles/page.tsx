import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Newspaper } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { buildShareMetadata } from '@/lib/shareMetadata'
import { ArticleCard } from '../contentComponents'
import { getPublicArticles } from '../contentData'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildShareMetadata({
  title: 'Articles / ROC Olympic 2026',
  description: 'Stories, recaps, and highlights from ROC Olympic 2026.',
  path: '/articles',
})

export default async function ArticlesPage() {
  const articles = await getPublicArticles(24)
  const featured = articles[0]
  const rest = articles.slice(1)

  return (
    <main className="font-sans text-ink">
      <section className="px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Newspaper className="h-3.5 w-3.5 text-green" aria-hidden="true" />
            Event stories
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Articles, recaps, and highlights
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
            Follow committee updates and match stories as ROC Olympic 2026 moves from preparation
            to finals week.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-5xl">
          {articles.length === 0 ? (
            <Card className="text-sm text-ink-soft">No published articles are available yet.</Card>
          ) : (
            <div className="flex flex-col gap-6">
              {featured ? (
                <Link href={`/articles/${featured.slug}`} className="block">
                  <Card interactive accent="green" className="p-6">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      Latest story
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                      {featured.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                      {featured.excerpt}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-green">
                      Read article
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Card>
                </Link>
              ) : null}
              {rest.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {rest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
