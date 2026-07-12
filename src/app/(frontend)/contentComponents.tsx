import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bell, CalendarDays, Megaphone } from 'lucide-react'

import { ShareButtons } from '@/components/share-buttons'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import {
  formatContentDate,
  getMedia,
  getMediaUrl,
  renderLexicalParagraphs,
  type PublicAnnouncement,
  type PublicArticle,
} from './contentData'
import { formatStatus, getRelationshipLabel } from './workspaces/workspaceComponents'

const urgencyTone = (urgency: string): StatusTone => {
  switch (urgency) {
    case 'urgent':
      return 'gold'
    case 'result':
      return 'green'
    case 'schedule_change':
      return 'blue'
    default:
      return 'neutral'
  }
}

export const ArticleCard = ({
  article,
  basePath = '/articles',
}: {
  article: PublicArticle
  basePath?: string
}) => {
  const cover = getMedia(article.cover_image)
  const coverUrl = getMediaUrl(article.cover_image)

  return (
    <Link href={`${basePath}/${article.slug}`} className="block h-full">
      <Card interactive accent="blue" className="flex h-full flex-col overflow-hidden p-0">
        {coverUrl ? (
          <div className="aspect-[16/9] overflow-hidden bg-mist">
            {/* eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions */}
            <img
              src={coverUrl}
              alt={cover?.alt || article.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col p-4">
          <CardDescription>{formatContentDate(article.published_at)}</CardDescription>
          <CardTitle className="mt-1 text-lg">{article.title}</CardTitle>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
            {article.excerpt}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-soft">
            {article.sport_id ? <span>{getRelationshipLabel(article.sport_id)}</span> : null}
            {article.category_id ? <span>{getRelationshipLabel(article.category_id)}</span> : null}
            {article.match_id ? <span>{getRelationshipLabel(article.match_id)}</span> : null}
          </div>
        </div>
      </Card>
    </Link>
  )
}

export const ArticleRichText = ({ article }: { article: PublicArticle }) => {
  const paragraphs = renderLexicalParagraphs(article.content)

  if (paragraphs.length === 0) {
    return <p className="text-base leading-8 text-ink-soft">{article.excerpt}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-base leading-8 text-ink">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

export const AnnouncementCard = ({
  announcement,
  compact = false,
  basePath = '/announcements',
}: {
  announcement: PublicAnnouncement
  compact?: boolean
  basePath?: string
}) => {
  const Icon = announcement.urgency === 'urgent' ? AlertTriangle : Megaphone

  return (
    <Card
      className={`${
        announcement.display_mode === 'urgent_alert' ? 'border-gold bg-paper' : ''
      } ${compact ? 'p-3' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist text-green">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge tone={urgencyTone(announcement.urgency)}>
              {formatStatus(announcement.urgency)}
            </StatusBadge>
            <span className="text-xs font-semibold text-ink-soft">
              {formatContentDate(announcement.published_at)}
            </span>
          </div>
          <CardTitle className={compact ? 'text-sm' : 'text-lg'}>{announcement.title}</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {compact ? announcement.summary : announcement.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
            {announcement.cta_label && announcement.cta_url ? (
              <Link
                href={announcement.cta_url}
                className="inline-flex items-center gap-1 text-blue hover:underline"
              >
                {announcement.cta_label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <Link href={basePath} className="text-ink-soft no-underline hover:text-ink hover:underline">
              All announcements
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}

export const AnnouncementFeed = ({
  announcements,
  title = 'Announcements',
  compact = false,
  basePath = '/announcements',
}: {
  announcements: PublicAnnouncement[]
  title?: string
  compact?: boolean
  basePath?: string
}) => {
  if (announcements.length === 0) {
    return null
  }

  return (
    <section className={compact ? '' : 'px-4 py-8'} aria-labelledby={`${title}-title`}>
      <div className={compact ? '' : 'mx-auto max-w-5xl'}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={`${title}-title`} className="flex items-center gap-2 text-xl font-bold text-ink">
            <Bell className="h-5 w-5 text-green" aria-hidden="true" />
            {title}
          </h2>
          {!compact ? (
            <Link href={basePath} className="text-sm font-semibold text-blue hover:underline">
              View all
            </Link>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              compact={compact}
              basePath={basePath}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export const ArticleSharePanel = ({
  article,
  url,
}: {
  article: PublicArticle
  url: string
}) => (
  <Card>
    <div className="mb-3 flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-green" aria-hidden="true" />
      <CardTitle>Share this story</CardTitle>
    </div>
    <ShareButtons
      title={article.share_title || article.title}
      description={article.share_description || article.excerpt}
      url={url}
    />
  </Card>
)
