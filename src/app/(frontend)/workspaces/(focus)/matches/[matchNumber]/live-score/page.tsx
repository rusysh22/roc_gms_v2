import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronDown, Flag, Maximize, Minimize, Pause, Play, Plus, Trash2, Trophy } from 'lucide-react'

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
import { loadRulesetForMatch } from '@/lib/ruleValidation'
import { deriveMatchOutcome, setWinnerSide, type OutcomeSet } from '@/lib/matchResult'
import { cn } from '@/lib/utils'
import { ConfirmSubmitButton } from '../../../../matches/ConfirmSubmitButton'
import { addMatchCommentAction } from '../../../../matches/commentActions'
import {
  addMatchSetAction,
  deleteMatchSetAction,
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
  const quickTransitions = allowedTransitions.filter(
    (transition) => !transition.reverse && ['ongoing', 'paused', 'finished'].includes(transition.to),
  )
  const publishTransition = allowedTransitions.find((transition) => transition.to === 'result_published')
  const startTransition = quickTransitions.find((transition) => transition.to === 'ongoing')
  const stageType =
    match.stage_id && typeof match.stage_id === 'object'
      ? (match.stage_id as { stage_type?: string }).stage_type
      : undefined
  const participantAName = getRelationshipLabel(match.participant_a_entry_id)
  const participantBName = getRelationshipLabel(match.participant_b_entry_id)

  // Ruleset-derived result: who won each set, and is the match decided. The set-score UI never
  // asks the officer to pick - it follows the score. Uses the stage override if one is set.
  const outcomeRuleset = await loadRulesetForMatch(access.payload, {
    categoryId,
    stageId: getRelationshipId(match.stage_id),
  })
  const entryAId = getRelationshipId(match.participant_a_entry_id)
  const entryBId = getRelationshipId(match.participant_b_entry_id)
  const outcomeSets: OutcomeSet[] = matchSets.map((set) => {
    const winnerId = getRelationshipId(set.winner_entry_id)
    return {
      participant_a_score: set.participant_a_score,
      participant_b_score: set.participant_b_score,
      winner_side:
        winnerId == null
          ? null
          : String(winnerId) === String(entryAId)
            ? 'a'
            : String(winnerId) === String(entryBId)
              ? 'b'
              : null,
    }
  })
  const matchOutcome = deriveMatchOutcome(outcomeRuleset, outcomeSets)
  const lastSetNumber = matchSets.reduce((max, set) => Math.max(max, set.set_number), 0)
  const canDeleteSets = !['finished', 'result_published', 'walkover', 'disputed'].includes(match.status)
  const canPublishResult = (access.user.roles ?? []).some(
    (role) => role === 'super_admin' || role === 'event_admin',
  )

  const scoreable = isScoreableStatus(match.status)
  const sideDotClass = { a: 'bg-green', b: 'bg-blue' } as const

  const banners = (
    <>
      {matchUpdated ? (
        <p className="mb-3 inline-flex items-center gap-2 self-start rounded-full border border-green/30 bg-green/[0.06] px-3 py-1 text-xs font-bold text-green">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Saved
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
      scoreable={scoreable}
      matchStatusLabel={formatStatus(match.status)}
      notScoreableAction={
        startTransition ? (
          <form action={transitionMatchStatusAction}>
            <input type="hidden" name="matchNumber" value={match.match_number} />
            <input type="hidden" name="targetStatus" value={startTransition.to} />
            <SubmitButton className="w-full justify-center sm:w-auto">
              {lifecycleIcon(startTransition.to)}
              {startTransition.label}
            </SubmitButton>
          </form>
        ) : null
      }
      ruleset={
        outcomeRuleset
          ? {
              best_of: outcomeRuleset.best_of ?? null,
              target_score: outcomeRuleset.target_score ?? null,
              max_score: outcomeRuleset.max_score ?? null,
              deuce_enabled: outcomeRuleset.deuce_enabled ?? null,
            }
          : null
      }
      priorSets={matchSets.slice(0, -1).map((set, index) => ({
        setNumber: set.set_number,
        a: set.participant_a_score ?? 0,
        b: set.participant_b_score ?? 0,
        winnerSide: outcomeSets[index].winner_side ?? null,
      }))}
      canPublish={canPublishResult}
      returnTo={returnTo}
    />
  ) : (
    <div className="grid flex-1 place-items-center text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mist text-green">
          <Plus className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold text-ink">Ready to score</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {participantAName} vs {participantBName}. Add the first set to open the scoreboard.
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

  const matchControlSection = (
    <section className="rounded-panel border border-line bg-paper p-4">
      <h2 className="text-sm font-extrabold text-ink">Match control</h2>
      {quickTransitions.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">
          No match-flow actions while the match is {formatStatus(match.status).toLowerCase()}.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
          {quickTransitions.map((transition) => (
            <form key={transition.to} action={transitionMatchStatusAction}>
              <input type="hidden" name="matchNumber" value={match.match_number} />
              <input type="hidden" name="targetStatus" value={transition.to} />
              <SubmitButton
                variant={transition.to === 'ongoing' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full justify-center"
              >
                {lifecycleIcon(transition.to)}
                {transition.label}
              </SubmitButton>
            </form>
          ))}
        </div>
      )}
    </section>
  )

  const derivedWinnerName =
    matchOutcome.winnerSide === 'a'
      ? participantAName
      : matchOutcome.winnerSide === 'b'
        ? participantBName
        : null

  // Only shown once there's something to do with the result - before that, the scoreboard's own
  // "Finish & publish" prompt covers the happy path and an empty placeholder card is just noise.
  const showResultSection =
    Boolean(publishTransition) || ['finished', 'result_published', 'under_review'].includes(match.status)

  const resultSection = showResultSection ? (
    <section className="rounded-panel border border-line bg-paper p-4">
      <h2 className="text-sm font-extrabold text-ink">Result</h2>
      {publishTransition ? (
        <form id="publish-result-form" action={transitionMatchStatusAction} className="mt-3 grid gap-3">
          <input type="hidden" name="matchNumber" value={match.match_number} />
          <input type="hidden" name="targetStatus" value={publishTransition.to} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {derivedWinnerName ? (
            <p className="flex items-center gap-2 rounded-card bg-green/[0.06] px-3 py-2 text-sm font-bold text-ink">
              <Trophy className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
              <span className="min-w-0">
                {derivedWinnerName} <span className="font-semibold text-ink-soft">wins (from the score)</span>
              </span>
            </p>
          ) : (
            <p className="rounded-card border border-gold/40 bg-gold/[0.06] px-3 py-2 text-sm font-semibold text-ink-soft">
              The score doesn&apos;t show a winner yet. Enter the deciding set, or set it under
              &ldquo;Correct manually&rdquo;.
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-bold text-ink-soft select-none">Correct manually</summary>
            <label className="mt-2 grid gap-1 font-bold text-ink">
              Winner
              <select
                name="winnerSide"
                defaultValue=""
                className="h-11 rounded-[10px] border border-line bg-paper px-3 text-sm font-semibold"
              >
                <option value="">Use the score</option>
                <option value="a">{participantAName}</option>
                <option value="b">{participantBName}</option>
              </select>
            </label>
            {/* SKD-07: required only when the picked winner contradicts the entered score. */}
            <label className="mt-2 grid gap-1 font-bold text-ink">
              Override reason (only if winner &ne; score)
              <input
                name="winnerOverrideReason"
                placeholder="e.g. opponent retired injured"
                className="h-11 rounded-[10px] border border-line bg-paper px-3 text-sm font-semibold"
              />
            </label>
          </details>
          <ConfirmSubmitButton
            formId="publish-result-form"
            tone="default"
            className="w-full justify-center"
            confirmMessage={`${getPublishResultConfirmMessage(stageType)} This also makes it visible on the public match page.`}
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Publish result
          </ConfirmSubmitButton>
        </form>
      ) : null}
      {/* MATCH-06: Send for Review / Mark Disputed only live on the full Match Details page, which
          the live-score kiosk otherwise doesn't point to prominently. */}
      {['finished', 'result_published', 'under_review'].includes(match.status) ? (
        <p className="mt-3 text-xs text-ink-soft">
          Need to dispute or send this result for review?{' '}
          <Link
            href={`/workspaces/matches/${match.match_number}`}
            className="font-semibold text-ink underline underline-offset-2"
          >
            Open Match Details
          </Link>
          .
        </p>
      ) : null}
    </section>
  ) : null

  const setsSection = (
    <section className="rounded-panel border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">Sets</h2>
        {matchOutcome.neededWins > 1 ? (
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {matchOutcome.setsWonA}–{matchOutcome.setsWonB} in sets
          </span>
        ) : null}
      </div>
      {/* The client score queue (useOfflineScoreSync.ts) refreshes this list once a burst of taps
          has fully synced, so it tracks the big display within a few seconds rather than only on a
          manual reload. */}
      {matchSets.length > 0 ? (
        <ol className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line">
          {matchSets.map((set, index) => {
            const winnerSide = setWinnerSide(outcomeRuleset, outcomeSets[index])
            const isCurrent = index === matchSets.length - 1 && scoreable
            return (
              <li key={set.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-bold text-ink">
                  Set {set.set_number}
                  {isCurrent ? (
                    <span className="rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-green">
                      Live
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 font-bold tabular-nums text-ink">
                  {set.participant_a_score ?? 0}–{set.participant_b_score ?? 0}
                  <span
                    className={cn('h-2 w-2 rounded-full', winnerSide ? sideDotClass[winnerSide] : 'bg-transparent')}
                    aria-label={winnerSide ? `Won by ${winnerSide === 'a' ? participantAName : participantBName}` : undefined}
                  />
                </span>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">No sets yet.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={addMatchSetAction} className="flex-1">
          <input type="hidden" name="matchNumber" value={match.match_number} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton variant="secondary" size="sm" className="w-full">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Set {matchSets.length + 1}
          </SubmitButton>
        </form>
        {matchSets.length > 0 && canDeleteSets ? (
          <form id="delete-last-set-form" action={deleteMatchSetAction}>
            <input type="hidden" name="matchNumber" value={match.match_number} />
            <input type="hidden" name="matchSetId" value={String(matchSets[matchSets.length - 1].id)} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <ConfirmSubmitButton
              formId="delete-last-set-form"
              tone="destructive"
              variant="ghost"
              size="sm"
              className="text-danger"
              confirmMessage={`Delete Set ${lastSetNumber}? Its scores will be removed.`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete Set {lastSetNumber}
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>
    </section>
  )

  const detailRows: Array<{ label: string; value: string }> = [
    { label: 'Starts', value: formatDateTime(match.scheduled_start_at, timezone) },
    {
      label: 'Venue',
      value: `${getRelationshipLabel(match.venue_id)} / ${getRelationshipLabel(match.court_id)}`,
    },
  ]
  if (ruleset?.best_of) detailRows.push({ label: 'Best of', value: String(ruleset.best_of) })
  if (ruleset?.target_score) {
    detailRows.push({
      label: 'Target',
      value: `${ruleset.target_score}${ruleset.max_score ? ` (max ${ruleset.max_score})` : ''}`,
    })
  }
  if (ruleset) detailRows.push({ label: 'Deuce', value: ruleset.deuce_enabled ? 'Win by 2' : 'Off' })
  if (ruleset?.timer_enabled) {
    detailRows.push({
      label: 'Periods',
      value: `${ruleset.period_count || '—'}${ruleset.period_duration ? ` × ${ruleset.period_duration}min` : ''}`,
    })
  }

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.2: "aturan target/deuce/timer terlihat
  // kontekstual" - venue, time and the category's rules in one glanceable card.
  const detailsSection = (
    <section className="rounded-panel border border-line bg-paper p-4">
      <h2 className="text-sm font-extrabold text-ink">Details</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {detailRows.map((row) => (
          <div key={row.label} className={row.label === 'Venue' || row.label === 'Starts' ? 'col-span-2' : undefined}>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{row.label}</dt>
            <dd className="font-semibold text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )

  const incidentSection = (
    <details className="group rounded-panel border border-line bg-paper p-4" open={commentUpdated}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 select-none [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-extrabold text-ink">Incident note</span>
        <ChevronDown className="h-4 w-4 text-ink-soft transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <p className="mt-2 text-xs text-ink-soft">
        Logged internally for the event admin - not shown on the public match page. For photo
        evidence, use Documentation on the full match details page.
      </p>
      {commentUpdated ? <p className="mt-2 text-xs font-bold text-green">Incident note logged.</p> : null}
      <form action={addMatchCommentAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="matchNumber" value={match.match_number} />
        <input type="hidden" name="commentType" value="official_note" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Textarea name="body" required placeholder="What happened, and when." rows={3} />
        <SubmitButton variant="secondary" size="sm">
          Log incident note
        </SubmitButton>
      </form>
    </details>
  )

  const scoreboardCard = (
    <div className="flex min-h-[calc(100svh-140px)] flex-col rounded-panel border border-line bg-paper p-3 shadow-sm sm:p-5">
      {banners}
      {scoreArea}
    </div>
  )

  if (kioskMode) {
    return (
      <main className="flex min-h-svh flex-col bg-mist">
        <KioskWakeLock />
        <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold text-ink sm:text-xl">
              {participantAName} <span className="font-semibold text-ink-soft">vs</span> {participantBName}
            </h1>
            <p className="text-xs font-semibold text-ink-soft">{match.match_number}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
            <Button asChild variant="secondary" size="sm">
              <Link href={returnTo} aria-label="Exit kiosk mode">
                <Minimize className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Exit kiosk</span>
              </Link>
            </Button>
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          {scoreboardCard}
          <aside className="grid content-start gap-4">
            {matchControlSection}
            {resultSection}
            {setsSection}
          </aside>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col bg-mist">
      <FocusHeader
        maxWidthClassName="max-w-6xl"
        backHref={`/workspaces/matches/${match.match_number}`}
        backLabel="Match details"
        title={
          <>
            {participantAName} <span className="font-semibold text-ink-soft">vs</span> {participantBName}
          </>
        }
        subtitle={[
          match.match_number,
          getRelationshipLabel(match.sport_id),
          getRelationshipLabel(match.category_id),
          match.round_name,
        ]
          .filter(Boolean)
          .join(' · ')}
        right={
          <>
            <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
            <Button asChild variant="secondary" size="sm">
              <Link href={kioskHref}>
                <Maximize className="h-3.5 w-3.5" aria-hidden="true" />
                Kiosk mode
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workspaces/match-officer">Officer list</Link>
            </Button>
          </>
        }
      />

      <section className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {scoreboardCard}
        <aside className="grid content-start gap-4">
          {matchControlSection}
          {resultSection}
          {setsSection}
          {detailsSection}
          {incidentSection}
        </aside>
      </section>
    </main>
  )
}
