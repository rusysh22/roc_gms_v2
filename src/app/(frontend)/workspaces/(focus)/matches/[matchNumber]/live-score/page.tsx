import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Flag, Pause, Play, Plus, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { getMatchDetail } from '../../../../../matchDetailData'
import {
  WORKSPACE_ROLES,
  WorkspaceUnauthorized,
  requireWorkspaceAccess,
} from '../../../../workspaceAuth'
import {
  formatDateTime,
  formatStatus,
  getRelationshipLabel,
} from '../../../../workspaceComponents'
import { ConfirmSubmitButton } from '../../../../matches/ConfirmSubmitButton'
import {
  addMatchSetAction,
  transitionMatchStatusAction,
} from '../../../../matches/matchActions'
import {
  MATCH_ACTION_ERROR_MESSAGES,
  getAllowedTransitions,
  getPublishResultConfirmMessage,
} from '../../../../matches/matchLifecycle'
import { FocusHeader } from '../../../FocusHeader'
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
  const result = await getMatchDetail(matchNumber)

  if (!result) {
    notFound()
  }

  const { match, matchSets } = result
  const currentSet = matchSets[matchSets.length - 1]
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
              <Link href="/workspaces/match-officer">Officer list</Link>
            </Button>
          </>
        }
      />

      <section className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[calc(100svh-170px)] flex-col rounded-panel border border-line bg-paper p-4 shadow-sm">
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

          {currentSet ? (
            <LiveScoreControls
              matchNumber={match.match_number}
              matchSetId={currentSet.id}
              setNumber={currentSet.set_number}
              participantAName={participantAName}
              participantBName={participantBName}
              participantAScore={currentSet.participant_a_score ?? 0}
              participantBScore={currentSet.participant_b_score ?? 0}
              returnTo={returnTo}
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
          )}
        </div>

        <aside className="grid content-start gap-4">
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

          <section className="rounded-panel border border-line bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Sets</p>
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

          <section className="rounded-panel border border-line bg-paper p-4 text-sm text-ink-soft">
            <p className="font-bold text-ink">Match context</p>
            <dl className="mt-3 grid gap-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide">Starts</dt>
                <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_start_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide">Venue</dt>
                <dd className="font-semibold text-ink">
                  {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </section>
    </main>
  )
}
