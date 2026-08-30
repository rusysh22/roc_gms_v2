import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Flag, Maximize, Minimize, Pause, Play, Plus, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { getMatchDetail } from '../../../../../matchDetailData'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  WORKSPACE_ROLES,
  WorkspaceUnauthorized,
  requireWorkspaceAccess,
} from '../../../../workspaceAuth'
import {
  formatDateTime,
  formatStatus,
  getRelationshipId,
  getRelationshipLabel,
} from '../../../../workspaceComponents'
import { ConfirmSubmitButton } from '../../../../matches/ConfirmSubmitButton'
import { addMatchCommentAction } from '../../../../matches/commentActions'
import {
  addMatchSetAction,
  transitionMatchStatusAction,
} from '../../../../matches/matchActions'
import {
  MATCH_ACTION_ERROR_MESSAGES,
  getAllowedTransitions,
  getPublishResultConfirmMessage,
  isScoreableStatus,
} from '../../../../matches/matchLifecycle'
import { FocusHeader } from '../../../FocusHeader'
import { KioskWakeLock } from './KioskWakeLock'
import { LiveScoreControls } from './LiveScoreControls'

export const dynamic = 'force-dynamic'

type LiveScorePageParams = Promise<{ matchNumber: string }>
type LiveScorePageSearchParams = Promise<Record<string, string | string[] | undefined>>

const lifecycleIcon = (targetStatus: string) => {
  switch (targetStatus) {
    case 'ongoing':
      return <Play className="h-4 w-4" aria-hidden="true" />
    case 'paused':
      return <Pause className="h-4 w-4" aria-hidden="true" />
    case 'finished':
      return <Flag className="h-4 w-4" aria-hidden="true" />
    case 'result_published':
      return <Trophy className="h-4 w-4" aria-hidden="true" />
    default:
      return null
  }
}

export default async function LiveScorePage({
  params,
  searchParams,
}: {
  params: LiveScorePageParams
  searchParams?: LiveScorePageSearchParams
}) {
  const { matchNumber } = await params
  const returnTo = `/workspaces/matches/${matchNumber}/live-score`
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
    workspaceName: 'Live Score Workspace',
  })
  if (!access.authorized) {
    return (
      <WorkspaceUnauthorized
        workspaceName={access.workspaceName}
        allowedRoles={access.allowedRoles}
      />
    )
  }

  const query = searchParams ? await searchParams : {}
  const matchUpdated = query.matchUpdated === '1'
  const matchError = typeof query.matchError === 'string' ? query.matchError : ''
  const commentUpdated = query.commentUpdated === '1'
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15 P2 "device/kiosk mode": a tablet propped up
  // courtside for the whole match, showing nothing but score entry and match flow - no way to
  // wander into event/participant/schedule structure, and no back link that could be tapped by
  // accident mid-match. A query flag on the same page (not a separate route) so it shares every
  // bit of data-loading/actions with the normal officer view - kiosk mode is a rendering choice,
  // not a different feature.
  const kioskMode = query.kiosk === '1'
  const kioskHref = `${returnTo}?kiosk=1`
  const result = await getMatchDetail(matchNumber)

  if (!result) {
    notFound()
  }

  const { match, matchSets } = result
  const currentSet = matchSets[matchSets.length - 1]
  const liveScoreEventId = getRelationshipId(match.event_id)
  const liveScoreEventDoc = liveScoreEventId
    ? await access.payload.findByID({ collection: 'events', id: liveScoreEventId, depth: 0 }).catch(() => null)
    : null
  const timezone = resolveEventTimezone(liveScoreEventDoc?.timezone)

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.2: "aturan target/deuce/timer terlihat
  // kontekstual" - a match officer entering scores shouldn't have to remember or go look up the
  // category's ruleset separately.
  const categoryId = getRelationshipId(match.category_id)
  const category = categoryId
    ? ((await access.payload.findByID({ collection: 'competition-categories', id: categoryId, depth: 1 }).catch(() => null)) as
        | { ruleset_id?: unknown }
        | null)
    : null
  const ruleset =
    category?.ruleset_id && typeof category.ruleset_id === 'object'
      ? (category.ruleset_id as {
          best_of?: number | null
          target_score?: number | null
          max_score?: number | null
          deuce_enabled?: boolean | null
          timer_enabled?: boolean | null
          period_count?: number | null
          period_duration?: number | null
        })
      : null
  const allowedTransitions = getAllowedTransitions(match.status)
  const quickTransitions = allowedTransitions.filter((transition) =>
    ['ongoing', 'paused', 'finished'].includes(transition.to),
  )
  const publishTransition = allowedTransitions.find((transition) => transition.to === 'result_published')
  const stageType =
    match.stage_id && typeof match.stage_id === 'object'
      ? (match.stage_id as { stage_type?: string }).stage_type
      : undefined
  const participantAName = getRelationshipLabel(match.participant_a_entry_id)
  const participantBName = getRelationshipLabel(match.participant_b_entry_id)

  const banners = (
    <>
      {matchUpdated ? (
        <p className="mb-3 rounded-card border border-green/30 bg-paper px-3 py-2 text-sm font-bold text-green">
          Score saved.
        </p>
      ) : null}
      {matchError ? (
        <p className="mb-3 rounded-card border border-danger/30 bg-danger-surface px-3 py-2 text-sm font-bold text-danger">
          {MATCH_ACTION_ERROR_MESSAGES[matchError] || 'The last live score action could not be completed.'}
        </p>
      ) : null}
    </>
  )

  const scoreArea = currentSet ? (
    <LiveScoreControls
      matchNumber={match.match_number}
      matchSetId={currentSet.id}
      setNumber={currentSet.set_number}
      participantAName={participantAName}
      participantBName={participantBName}
      participantAScore={currentSet.participant_a_score ?? 0}
      participantBScore={currentSet.participant_b_score ?? 0}
      scoreable={isScoreableStatus(match.status)}
      matchStatusLabel={formatStatus(match.status)}
    />
  ) : (
    <div className="grid flex-1 place-items-center text-center">
      <div className="max-w-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">No set yet</p>
        <h2 className="mt-2 text-3xl font-extrabold">Create the first set</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Live scoring needs one match set before point controls appear.
        </p>
        <form action={addMatchSetAction} className="mt-5">
          <input type="hidden" name="matchNumber" value={match.match_number} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Set 1
          </SubmitButton>
        </form>
      </div>
    </div>
  )

  const matchFlowSection = (
    <section className="rounded-panel border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Match flow</p>
      <div className="mt-3 grid gap-2">
        {quickTransitions.length === 0 ? (
          <p className="rounded-card border border-line bg-mist p-3 text-sm font-semibold text-ink-soft">
            No quick lifecycle actions for this status.
          </p>
        ) : (
          quickTransitions.map((transition) => (
            <form key={transition.to} action={transitionMatchStatusAction}>
              <input type="hidden" name="matchNumber" value={match.match_number} />
              <input type="hidden" name="targetStatus" value={transition.to} />
              <SubmitButton className="w-full justify-center">
                {lifecycleIcon(transition.to)}
                {transition.label}
              </SubmitButton>
            </form>
          ))
        )}
      </div>
    </section>
  )

  const publishSection = (
    <section className="rounded-panel border border-line bg-paper p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Finish result</p>
      {publishTransition ? (
        <form id="publish-result-form" action={transitionMatchStatusAction} className="mt-3 grid gap-3">
          <input type="hidden" name="matchNumber" value={match.match_number} />
          <input type="hidden" name="targetStatus" value={publishTransition.to} />
          <label className="grid gap-1 text-sm font-bold text-ink">
            Winner
            <select
              name="winnerSide"
              defaultValue=""
              className="h-11 rounded-[10px] border border-line bg-paper px-3 text-sm font-semibold"
            >
              <option value="">No winner / draw</option>
              <option value="a">{participantAName}</option>
              <option value="b">{participantBName}</option>
            </select>
          </label>
          <ConfirmSubmitButton
            formId="publish-result-form"
            tone="default"
            confirmMessage={`${getPublishResultConfirmMessage(stageType)} This also makes it visible on the public match page.`}
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Publish result
          </ConfirmSubmitButton>
        </form>
      ) : (
        <p className="mt-3 rounded-card border border-line bg-mist p-3 text-sm font-semibold text-ink-soft">
          Finish the match before publishing the final result.
        </p>
      )}
    </section>
  )

  if (kioskMode) {
    return (
      <main className="flex min-h-svh flex-col bg-paper">
        <KioskWakeLock />
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-ink">{match.match_number}</h1>
            <p className="text-sm font-semibold text-ink-soft">{participantAName} vs {participantBName}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
            <Button asChild variant="secondary" size="sm">
              <Link href={returnTo}>
                <Minimize className="h-3.5 w-3.5" aria-hidden="true" />
                Exit kiosk mode
              </Link>
            </Button>
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-[calc(100svh-170px)] flex-col rounded-panel border border-line bg-paper p-4 shadow-sm">
            {banners}
            {scoreArea}
          </div>
          <aside className="grid content-start gap-4">
            {matchFlowSection}
            {publishSection}
          </aside>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col">
      <FocusHeader
        backHref={`/workspaces/matches/${match.match_number}`}
        backLabel="Match details"
        title={match.match_number}
        subtitle={`${getRelationshipLabel(match.sport_id)} / ${getRelationshipLabel(match.category_id)} / ${match.round_name || 'Match'}`}
        right={
          <>
            <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
            <Button asChild variant="secondary" size="sm">
              <Link href={kioskHref}>
                <Maximize className="h-3.5 w-3.5" aria-hidden="true" />
                Kiosk mode
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/workspaces/match-officer">Officer list</Link>
            </Button>
          </>
        }
      />

      <section className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[calc(100svh-170px)] flex-col rounded-panel border border-line bg-paper p-4 shadow-sm">
          {banners}
          {scoreArea}
        </div>

        <aside className="grid content-start gap-4">
          {matchFlowSection}

          <section className="rounded-panel border border-line bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Sets</p>
            {/* Server-rendered as of last page load - LiveScoreControls now applies taps via a
                client-side queue (see useOfflineScoreSync.ts) instead of a full-page redirect per
                tap, so this list's current-set row can lag behind the big score display above
                until the next reload/add-set/publish. Deliberate tradeoff for offline resilience;
                the big display is the live source of truth while scoring. */}
            <div className="mt-3 grid gap-2">
              {matchSets.map((set) => (
                <div
                  key={set.id}
                  className="rounded-card border border-line bg-mist px-3 py-2 text-sm font-bold"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>Set {set.set_number}</span>
                    <span className="tabular-nums">
                      {set.participant_a_score ?? 0}-{set.participant_b_score ?? 0}
                    </span>
                  </div>
                </div>
              ))}
              <form action={addMatchSetAction}>
                <input type="hidden" name="matchNumber" value={match.match_number} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <SubmitButton variant="secondary" className="w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Set {matchSets.length + 1}
                </SubmitButton>
              </form>
            </div>
          </section>

          {publishSection}

          <section className="rounded-panel border border-line bg-paper p-4 text-sm text-ink-soft">
            <p className="font-bold text-ink">Match context</p>
            <dl className="mt-3 grid gap-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide">Starts</dt>
                <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_start_at, timezone)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide">Venue</dt>
                <dd className="font-semibold text-ink">
                  {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
                </dd>
              </div>
            </dl>
          </section>

          {ruleset ? (
            <section className="rounded-panel border border-line bg-paper p-4 text-sm text-ink-soft">
              <p className="font-bold text-ink">Rules</p>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {ruleset.best_of ? (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide">Best of</dt>
                    <dd className="font-semibold text-ink">{ruleset.best_of}</dd>
                  </div>
                ) : null}
                {ruleset.target_score ? (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide">Target</dt>
                    <dd className="font-semibold text-ink">
                      {ruleset.target_score}
                      {ruleset.max_score ? ` (max ${ruleset.max_score})` : ''}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide">Deuce</dt>
                  <dd className="font-semibold text-ink">{ruleset.deuce_enabled ? 'Enabled' : 'Off'}</dd>
                </div>
                {ruleset.timer_enabled ? (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide">Periods</dt>
                    <dd className="font-semibold text-ink">
                      {ruleset.period_count || '—'}
                      {ruleset.period_duration ? ` × ${ruleset.period_duration}min` : ''}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <section className="rounded-panel border border-line bg-paper p-4">
            <p className="text-sm font-bold text-ink">Incident note</p>
            <p className="mt-1 text-xs text-ink-soft">
              Logged internally for the event admin - not shown on the public match page. For
              photo evidence, use Documentation on the full match details page.
            </p>
            {commentUpdated ? (
              <p className="mt-2 text-xs font-bold text-green">Incident note logged.</p>
            ) : null}
            <form action={addMatchCommentAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="matchNumber" value={match.match_number} />
              <input type="hidden" name="commentType" value="official_note" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Textarea name="body" required placeholder="What happened, and when." rows={3} />
              <SubmitButton variant="secondary" size="sm">
                Log incident note
              </SubmitButton>
            </form>
          </section>
        </aside>
      </section>
    </main>
  )
}
