import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin } from 'lucide-react'

import { getMatchDetail } from '../../matchDetailData'
import { Card, CardTitle } from '@/components/ui/card'
import { ShareButtons } from '@/components/share-buttons'
import { formatDateTime, getRelationshipLabel } from '../../workspaces/workspaceComponents'
import {
  DocumentationGallery,
  PublicBracketImpactPanel,
  PublicCommentList,
  PublicStandingImpactPanel,
  ScoreCard,
} from './publicMatchComponents'

export const dynamic = 'force-dynamic'

type MatchPageParams = Promise<{ matchNumber: string }>

export default async function PublicMatchDetailPage({ params }: { params: MatchPageParams }) {
  const { matchNumber } = await params
  const result = await getMatchDetail(matchNumber)

  if (!result || !result.match.is_public) {
    notFound()
  }

  const { match, matchSets, documentationAssets, comments, standingImpact, bracketImpact } = result
  const publicDocumentationAssets = documentationAssets.filter(
    (asset) => asset.visibility === 'public',
  )
  const publicComments = comments.filter(
    (comment) => comment.comment_type === 'public' && comment.status === 'approved',
  )
  const shareTitle = `${getRelationshipLabel(match.participant_a_entry_id)} vs ${getRelationshipLabel(
    match.participant_b_entry_id,
  )} · ${match.match_number}`

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/schedule"
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to schedule
          </Link>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            {getRelationshipLabel(match.sport_id)} · {getRelationshipLabel(match.category_id)}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">
            {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
            {getRelationshipLabel(match.participant_b_entry_id)}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {match.match_number} · {match.round_name || 'Match'}
          </p>
        </div>
      </section>

      <section className="px-4 pb-8" aria-label="Score">
        <div className="mx-auto max-w-3xl">
          <ScoreCard match={match} matchSets={matchSets} />
        </div>
      </section>

      <section className="px-4 pb-8" aria-label="Schedule and venue">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>Schedule</CardTitle>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Starts</dt>
                <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_start_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Ends</dt>
                <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_end_at)}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardTitle>Venue</CardTitle>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
              {getRelationshipLabel(match.venue_id)} · {getRelationshipLabel(match.court_id)}
            </p>
          </Card>
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

      <section className="px-4 pb-8" aria-label="Documentation">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-xl font-bold text-ink">Documentation</h2>
          <DocumentationGallery assets={publicDocumentationAssets} />
        </div>
      </section>

      <section className="px-4 pb-8" aria-label="Comments">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-3 text-xl font-bold text-ink">Comments</h2>
          <PublicCommentList comments={publicComments} />
        </div>
      </section>

      <section className="px-4 pb-16" aria-label="Share this match">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Share</p>
          <ShareButtons title={shareTitle} />
        </div>
      </section>
    </main>
  )
}
