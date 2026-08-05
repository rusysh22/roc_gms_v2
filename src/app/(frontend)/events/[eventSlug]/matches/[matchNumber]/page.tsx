import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowLeft, ChevronRight } from 'lucide-react'

import config from '@payload-config'
import { cn } from '@/lib/utils'
import { getMatchDetail } from '../../../../matchDetailData'
import { AutoRefresh } from '@/components/auto-refresh'
import { ShareButtons } from '@/components/share-buttons'
import { ArticleCard, CompactAnnouncementList } from '../../../../contentComponents'
import {
  getRelatedPublicArticles,
  getRelationshipId,
  getScopedPublicAnnouncements,
} from '../../../../contentData'
import { Card, CardTitle } from '@/components/ui/card'
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
      limit: 3,
    }),
    getRelatedPublicArticles({
      eventId: event.id,
      sportId,
      categoryId,
      matchId: match.id,
      limit: 3,
    }),
  ])
  const hasCompetitionImpact = Boolean(standingImpact || bracketImpact)
  const hasDocumentation = publicDocumentationAssets.length > 0
  const hasComments = publicComments.length > 0

  return (
    <main className="font-sans text-ink">
      {/* Breadcrumb + a single compact meta line stand in for what used to be a second full-size
          "Team A vs Team B" heading here - the ScoreCard right below already says that, bigger and
          with avatars/club names attached, so repeating it as a giant H1 only pushed the actual
          score further down the page for no new information. The H1 still carries the literal
          "Team A vs Team B" text (for accessibility/SEO), just sized as a page title rather than a
          second scoreboard. */}
      <section className="px-4 pt-4 pb-3">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
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
          <p className="truncate text-xs font-bold tracking-wide text-ink-soft uppercase">
            {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
            {match.round_name ? ` · ${match.round_name}` : ''} · {match.match_number}
          </p>
          <h1 className="mt-1 line-clamp-2 text-lg font-extrabold text-ink sm:text-xl">
            {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
            {getRelationshipLabel(match.participant_b_entry_id)}
          </h1>
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-2 pb-16">
        <section aria-label="Score">
          <ScoreCard
            match={match}
            matchSets={matchSets}
            participantAClub={participantAClub}
            participantBClub={participantBClub}
            liveIndicator={
              LIVE_POLL_STATUSES.has(match.status) ? (
                <AutoRefresh
                  showIndicator
                  compact
                  intervalMs={10000}
                  className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-ink-soft/80"
                />
              ) : null
            }
          />
        </section>

        <section aria-label="Schedule and venue">
          <MatchInfoStrip match={match} eventPath={eventPath} timezone={timezone} />
        </section>

        {hasCompetitionImpact ? (
          <section
            aria-label="Competition impact"
            className={cn('grid gap-4 grid-cols-1', standingImpact && bracketImpact && 'lg:grid-cols-2')}
          >
            <PublicStandingImpactPanel impact={standingImpact} />
            <PublicBracketImpactPanel impact={bracketImpact} />
          </section>
        ) : null}

        <CompactAnnouncementList
          announcements={announcements}
          title="Match Updates"
          basePath={`${eventPath}/updates?tab=announcements`}
          timezone={timezone}
        />

        {hasDocumentation ? (
          <section aria-label="Documentation">
            <Card>
              <CardTitle>Documentation</CardTitle>
              <div className="mt-3">
                <DocumentationGallery assets={publicDocumentationAssets} />
              </div>
            </Card>
          </section>
        ) : null}

        {hasComments ? (
          <section aria-label="Comments">
            <h2 className="mb-3 text-base font-bold text-ink">Comments</h2>
            <PublicCommentList comments={publicComments} timezone={timezone} />
          </section>
        ) : null}

        {relatedArticles.length > 0 ? (
          <section aria-label="Related articles">
            <h2 className="mb-3 text-base font-bold text-ink">Related Articles</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {relatedArticles.map((article) => (
                <ArticleCard key={article.id} article={article} basePath={`${eventPath}/articles`} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Share this match" className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Share</p>
          <ShareButtons title={shareTitle} />
        </section>
      </div>
    </main>
  )
}
