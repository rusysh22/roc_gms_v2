import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowRight, Bell, Newspaper } from 'lucide-react'

import config from '@payload-config'
import { Card } from '@/components/ui/card'
import { buildShareMetadata } from '@/lib/shareMetadata'
import { AnnouncementCard, ArticleCard } from '../../../contentComponents'
import { getPublicArticles, getPublicAnnouncementsForMode } from '../../../contentData'
import {
  AnnouncementPublicEditor,
  EditableRegion,
  PublicEditToolbar,
} from '../../../publicEditComponents'
import { getPublicEditState } from '../../../publicEditState'
import { getPublicEventBySlug } from '../../publicEvents'

export const dynamic = 'force-dynamic'

type ActiveTab = 'articles' | 'announcements'
type PageParams = Promise<{ eventSlug: string }>
type PageSearchParams = Promise<Record<string, string | string[] | undefined>>

const getActiveTab = (value?: string | string[]): ActiveTab =>
  (Array.isArray(value) ? value[0] : value) === 'announcements' ? 'announcements' : 'articles'

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)

  return buildShareMetadata({
    title: `Updates / ${event?.name || 'Event'}`,
    description: `Articles and announcements from ${event?.name || 'this event'}, in one place.`,
    path: `/events/${eventSlug}/updates`,
  })
}

export default async function UpdatesPage({
  params,
  searchParams,
}: {
  params: PageParams
  searchParams: PageSearchParams
}) {
  const [{ eventSlug }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const editState = await getPublicEditState(resolvedSearchParams, event.id)
  const eventPath = `/events/${event.slug}`
  const updatesPath = `${eventPath}/updates`
  const activeTab = getActiveTab(resolvedSearchParams.tab)

  const [articles, announcements] = await Promise.all([
    getPublicArticles(24, event.id),
    getPublicAnnouncementsForMode({ includeUnpublished: editState.isPreview, limit: 50, eventId: event.id }),
  ])
  const featured = articles[0]
  const restArticles = articles.slice(1)

  return (
    <main className="font-sans text-ink">
      <PublicEditToolbar state={editState} path={updatesPath} />
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Newspaper className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
            Updates
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Articles &amp; Announcements
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
            Stories, recaps, schedule changes, and committee notices for {event.name} in one place.
          </p>
        </div>
      </section>

      <div className="sticky top-20 z-40 border-y border-line bg-paper px-4 py-3">
        <nav className="mx-auto flex max-w-5xl gap-2" aria-label="Updates sections">
          {[
            { key: 'articles' as const, label: `Articles (${articles.length})`, icon: Newspaper },
            { key: 'announcements' as const, label: `Announcements (${announcements.length})`, icon: Bell },
          ].map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.key
            return (
              <Link
                key={item.key}
                href={`${updatesPath}?tab=${item.key}`}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold no-underline transition-colors ${
                  isActive ?
                    'border-brand-primary bg-brand-primary text-paper'
                  : 'border-line bg-paper text-ink-soft hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {activeTab === 'articles' ? (
        <section className="px-4 py-8 pb-16">
          <div className="mx-auto max-w-5xl">
            {articles.length === 0 ? (
              <Card className="text-sm text-ink-soft">No published articles are available yet.</Card>
            ) : (
              <div className="flex flex-col gap-6">
                {featured ? (
                  <Link href={`${eventPath}/articles/${featured.slug}`} className="block">
                    <Card interactive accent="green" className="p-6">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                        Latest story
                      </p>
                      <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{featured.title}</h2>
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
                {restArticles.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {restArticles.map((article) => (
                      <ArticleCard key={article.id} article={article} basePath={`${eventPath}/articles`} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="px-4 py-8 pb-16">
          <div className="mx-auto max-w-3xl">
            {announcements.length === 0 ? (
              <Card className="text-sm text-ink-soft">
                No active public announcements are available right now.
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {announcements.map((announcement) => (
                  <EditableRegion
                    key={announcement.id}
                    state={editState}
                    label="Announcement"
                    editor={
                      <AnnouncementPublicEditor
                        id={announcement.id}
                        title={announcement.title}
                        summary={announcement.summary}
                        body={announcement.body}
                        status={announcement.status}
                        shareTitle={announcement.share_title}
                        shareDescription={announcement.share_description}
                        returnTo={`${updatesPath}?tab=announcements`}
                      />
                    }
                  >
                    <AnnouncementCard announcement={announcement} basePath={updatesPath} />
                  </EditableRegion>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
