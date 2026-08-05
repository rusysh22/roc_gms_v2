import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowLeft, ChevronRight } from 'lucide-react'

import config from '@payload-config'
import { getMatchDetail } from '../../../../matchDetailData'
import { AutoRefresh } from '@/components/auto-refresh'
import { ShareButtons } from '@/components/share-buttons'
import { AnnouncementFeed, ArticleCard } from '../../../../contentComponents'
import {
  getRelatedPublicArticles,
  getRelationshipId,
  getScopedPublicAnnouncements,
} from '../../../../contentData'
import { getRelationshipLabel } from '../../../../workspaces/workspaceComponents'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  DocumentationGallery,
  MatchInfoStrip,
  PublicBracketImpactPanel,
  PublicCommentList,
  PublicStandingImpactPanel,
  ScoreCard,
} from '../../../../matches/[matchNumber]/publicMatchComponents'
import { getPublicEventBySlug } from '../../../publicEvents'

export const dynamic = 'force-dynamic'

type MatchPageParams = Promise<{ eventSlug: string; matchNumber: string }>

// AUDIT_E2E MAT-08: only worth polling while the match can still change - a finished/
// result_published match's public page is effectively static.
const LIVE_POLL_STATUSES = new Set(['ongoing', 'paused', 'check_in_open', 'ready_to_start', 'under_review'])

const getCategoryHref = (eventPath: string, sport: unknown, category: unknown) => {
  const sportSlug =
    sport && typeof sport === 'object' && 'slug' in sport ? String(sport.slug || '') : ''
  const categorySlug =
    category && typeof category === 'object' && 'slug' in category ? String(category.slug || '') : ''

  return sportSlug && categorySlug ? `${eventPath}/sports/${sportSlug}/${categorySlug}` : ''
}

export default async function PublicMatchDetailPage({ params }: { params: MatchPageParams }) {
  const { eventSlug, matchNumber } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const timezone = resolveEventTimezone(event.timezone)
  const eventPath = `/events/${event.slug}`
  const matchBasePath = `${eventPath}/matches`

  const result = await getMatchDetail(matchNumber, event.id, matchBasePath)

  if (!result || !result.match.is_public) {
    notFound()
  }

  const {
    match,
    matchSets,
    documentationAssets,
    comments,
    standingImpact,
    bracketImpact,
    participantAClub,
    participantBClub,
  } = result
  const publicDocumentationAssets = documentationAssets.filter(
    (asset) => asset.visibility === 'public',
  )
  const publicComments = comments.filter(
    (comment) => comment.comment_type === 'public' && comment.status === 'approved',
  )
  const shareTitle = `${getRelationshipLabel(match.participant_a_entry_id)} vs ${getRelationshipLabel(
    match.participant_b_entry_id,
  )} / ${match.match_number}`
  const categoryHref = getCategoryHref(eventPath, match.sport_id, match.category_id)
  const sportId = getRelationshipId(match.sport_id)
  const categoryId = getRelationshipId(match.category_id)
  const [announcements, relatedArticles] = await Promise.all([
    getScopedPublicAnnouncements({
      eventId: event.id,
      sportId,
      categoryId,
      matchId: match.id,
      limit: 4,
    }),
    getRelatedPublicArticles({
      eventId: event.id,
      sportId,
      categoryId,
      matchId: match.id,
      limit: 3,
    }),
  ])

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm">
            <Link
              href={`${eventPath}/schedule`}
              className="inline-flex items-center gap-1 font-semibold text-brand-secondary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Schedule
            </Link>
            {categoryHref ? (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
                <Link href={categoryHref} className="font-semibold text-brand-secondary hover:underline">
                  {getRelationshipLabel(match.category_id)}
                </Link>
              </>
            ) : null}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
            </p>
            {LIVE_POLL_STATUSES.has(match.status) ? (
              <AutoRefresh
                showIndicator
                intervalMs={10000}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-soft"
              />
            ) : null}
          </div>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">
            {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
            {getRelationshipLabel(match.participant_b_entry_id)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-bold text-ink-soft">
              {match.match_number}
            </span>
            {match.round_name ? (
              <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-bold text-ink-soft">
                {match.round_name}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="px-4 pb-6" aria-label="Score">
        <div className="mx-auto max-w-3xl">
          <ScoreCard
            match={match}
            matchSets={matchSets}
            participantAClub={participantAClub}
            participantBClub={participantBClub}
          />
        </div>
      </section>

      <section className="px-4 pb-8" aria-label="Schedule and venue">
        <div className="mx-auto max-w-3xl">
          <MatchInfoStrip match={match} eventPath={eventPath} timezone={timezone} />
        </div>
      </section>

      {standingImpact || bracketImpact ? (
        <section className="px-4 pb-8" aria-label="Competition impact">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <PublicStandingImpactPanel impact={standingImpact} />
            <PublicBracketImpactPanel impact={bracketImpact} />
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-8" aria-label="Match announcements">
        <div className="mx-auto max-w-3xl">
          <AnnouncementFeed
            announcements={announcements}
            title="Match Updates"
            compact
            basePath={`${eventPath}/updates?tab=announcements`}
          />
        </div>
      </section>

      <section className="px-4 pb-8" aria-label="Documentation">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-xl font-bold text-ink">Documentation</h2>
          <DocumentationGallery assets={publicDocumentationAssets} />
        </div>
      </section>

      <section className="px-4 pb-8" aria-label="Comments">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-xl font-bold text-ink">Comments</h2>
          <PublicCommentList comments={publicComments} timezone={timezone} />
        </div>
      </section>

      {relatedArticles.length > 0 ? (
        <section className="px-4 pb-8" aria-label="Related articles">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 text-xl font-bold text-ink">Related Articles</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {relatedArticles.map((article) => (
                <ArticleCard key={article.id} article={article} basePath={`${eventPath}/articles`} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-4 pb-16" aria-label="Share this match">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Share</p>
          <ShareButtons title={shareTitle} />
        </div>
      </section>
    </main>
  )
}
