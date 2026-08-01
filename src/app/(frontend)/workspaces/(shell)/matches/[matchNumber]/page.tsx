import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getMatchAuditLog, getMatchDetail } from '../../../../matchDetailData'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  AuditLogPanel,
  BracketImpactPanel,
  CommentList,
  DocumentationAssetList,
  MatchSetsTable,
  PageHero,
  StandingImpactPanel,
  formatDateTime,
  formatStatus,
  getRelationshipId,
  getRelationshipLabel,
  getSetWinnerSide,
} from '../../../workspaceComponents'
import { ConfirmSubmitButton } from '../../../matches/ConfirmSubmitButton'
import {
  addMatchSetAction,
  assignMatchOfficersAction,
  transitionMatchStatusAction,
  updateMatchSetScoreAction,
} from '../../../matches/matchActions'
import { MATCH_ACTION_ERROR_MESSAGES, getAllowedTransitions } from '../../../matches/matchLifecycle'
import { addDocumentationAssetAction } from '../../../matches/documentationActions'
import { DOCUMENTATION_ACTION_ERROR_MESSAGES } from '../../../matches/documentationErrors'
import { addMatchCommentAction } from '../../../matches/commentActions'
import { COMMENT_ACTION_ERROR_MESSAGES } from '../../../matches/commentErrors'

export const dynamic = 'force-dynamic'

const buttonClassName =
  'inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-green px-6 font-sans text-[0.95rem] font-semibold text-paper transition-all hover:bg-green/90 active:scale-95'

type MatchPageParams = Promise<{ matchNumber: string }>
type MatchPageSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminMatchDetailPage({
  params,
  searchParams,
}: {
  params: MatchPageParams
  searchParams?: MatchPageSearchParams
}) {
  const { matchNumber } = await params
  const returnTo = `/workspaces/matches/${matchNumber}`
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo,
    workspaceName: 'Match Detail Workspace',
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
  const matchErrorCode = typeof query.matchError === 'string' ? query.matchError : ''
  const docUpdated = query.docUpdated === '1'
  const docErrorCode = typeof query.docError === 'string' ? query.docError : ''
  const commentUpdated = query.commentUpdated === '1'
  const commentErrorCode = typeof query.commentError === 'string' ? query.commentError : ''

  const result = await getMatchDetail(matchNumber)

  if (!result) {
    notFound()
  }

  const {
    match,
    matchSets,
    documentationAssets,
    comments,
    advancement,
    champion,
    standingImpact,
    bracketImpact,
  } = result
  const allowedTransitions = getAllowedTransitions(match.status)
  const canAssignOfficers = access.user.roles?.some((role) =>
    ['super_admin', 'event_admin', 'scheduler'].includes(role),
  )
  const eligibleOfficersResult = canAssignOfficers
    ? await access.payload.find({
        collection: 'users',
        depth: 0,
        limit: 100,
        sort: 'name',
        where: { roles: { in: ['match_officer', 'event_admin', 'super_admin'] } },
      })
    : null
  const assignedOfficerIds = new Set(
    (match.officer_ids || []).map((officer) => String(getRelationshipId(officer))),
  )
  const auditLogEntries = await getMatchAuditLog(
    match.id,
    matchSets.map((set) => set.id),
    comments.map((comment) => comment.id),
  )
  const internalComments = comments.filter((comment) =>
    ['internal', 'official_note'].includes(comment.comment_type),
  )

  return (
    <>
      <PageHero
        eyebrow={`${getRelationshipLabel(match.sport_id)} / ${getRelationshipLabel(match.category_id)}`}
        title={match.match_number}
        summary={`${match.round_name || 'Match'} · ${formatStatus(match.status)}. Score input, lifecycle actions, documentation upload, internal comments, official notes, and audit history are available below.`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/workspaces/scheduler">Scheduler Workspace</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/workspaces/match-officer">Match Officer Workspace</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/workspaces/matches/${match.match_number}/live-score`}>Open Live Score</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/workspaces/standings">Standings Workspace</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/workspaces/brackets">Brackets Workspace</Link>
            </Button>
            {match.is_public ? (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={
                    match.event_id && typeof match.event_id === 'object' && 'slug' in match.event_id
                      ? `/events/${(match.event_id as { slug?: string }).slug}/matches/${match.match_number}`
                      : `/matches/${match.match_number}`
                  }
                >
                  View Public Page
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        {matchUpdated ? <AlertBanner tone="success">Match updated.</AlertBanner> : null}
        {matchErrorCode ? (
          <AlertBanner tone="error">
            {MATCH_ACTION_ERROR_MESSAGES[matchErrorCode] || 'The last action could not be completed.'}
          </AlertBanner>
        ) : null}
        {docUpdated ? <AlertBanner tone="success">Documentation uploaded.</AlertBanner> : null}
        {docErrorCode ? (
          <AlertBanner tone="error">
            {DOCUMENTATION_ACTION_ERROR_MESSAGES[docErrorCode] || 'The documentation upload could not be completed.'}
          </AlertBanner>
        ) : null}
        {commentUpdated ? <AlertBanner tone="success">Comment saved.</AlertBanner> : null}
        {commentErrorCode ? (
          <AlertBanner tone="error">
            {COMMENT_ACTION_ERROR_MESSAGES[commentErrorCode] || 'The comment could not be saved.'}
          </AlertBanner>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Match details">
        <Card className="flex flex-col gap-3">
          <CardTitle>Participants</CardTitle>
          <div className="flex items-center justify-between gap-3 rounded-card bg-mist px-3 py-2 text-sm font-bold text-ink">
            <span className="min-w-0 truncate">{getRelationshipLabel(match.participant_a_entry_id)}</span>
            <span className="shrink-0 text-xs text-ink-soft">vs</span>
            <span className="min-w-0 truncate text-right">{getRelationshipLabel(match.participant_b_entry_id)}</span>
          </div>
          {match.winner_entry_id ? (
            <p className="text-sm font-bold text-green">Winner: {getRelationshipLabel(match.winner_entry_id)}</p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Schedule</CardTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Starts</dt>
              <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_start_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Ends</dt>
              <dd className="font-semibold text-ink">{formatDateTime(match.scheduled_end_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Actual Start</dt>
              <dd className="font-semibold text-ink">{formatDateTime(match.actual_start_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Actual End</dt>
              <dd className="font-semibold text-ink">{formatDateTime(match.actual_end_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Venue</dt>
              <dd className="font-semibold text-ink">{getRelationshipLabel(match.venue_id)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Court</dt>
              <dd className="font-semibold text-ink">{getRelationshipLabel(match.court_id)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Competition Context</CardTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Event</dt>
              <dd className="font-semibold text-ink">{getRelationshipLabel(match.event_id)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Stage</dt>
              <dd className="font-semibold text-ink">{getRelationshipLabel(match.stage_id)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Group</dt>
              <dd className="font-semibold text-ink">{getRelationshipLabel(match.group_id, 'No group')}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Round</dt>
              <dd className="font-semibold text-ink">{match.round_name || 'Not set'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Operational Status</CardTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Status</dt>
              <dd className="font-semibold text-ink">{formatStatus(match.status)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Documentation</dt>
              <dd className="font-semibold text-ink">{formatStatus(match.documentation_status)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Generation Source</dt>
              <dd className="font-semibold text-ink">{formatStatus(match.generation_source || 'manual')}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Public Visibility</dt>
              <dd className="font-semibold text-ink">{match.is_public ? 'Public' : 'Internal only'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-col gap-3 md:col-span-2">
          <CardTitle>Assigned Officers</CardTitle>
          <p className="text-sm text-ink-soft">
            {match.officer_ids && match.officer_ids.length > 0
              ? 'Only these officers see this match in their "Assigned Match List".'
              : 'Open to any match officer on this event - no one has been specifically assigned yet.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {(match.officer_ids || []).length === 0 ? (
              <span className="rounded-full border border-line bg-mist px-3 py-1 text-xs font-bold text-ink-soft">
                Unassigned
              </span>
            ) : (
              (match.officer_ids || []).map((officer, index) => (
                <span
                  key={String(getRelationshipId(officer) ?? index)}
                  className="rounded-full border border-line bg-mist px-3 py-1 text-xs font-bold text-ink"
                >
                  {getRelationshipLabel(officer)}
                </span>
              ))
            )}
          </div>
          {canAssignOfficers && eligibleOfficersResult ? (
            <form action={assignMatchOfficersAction} className="mt-2 flex flex-col gap-3">
              <input type="hidden" name="matchNumber" value={match.match_number} />
              <div className="grid gap-2 sm:grid-cols-2">
                {eligibleOfficersResult.docs.map((officer) => (
                  <label
                    key={String(officer.id)}
                    className="flex items-center gap-2 rounded-card border border-line px-3 py-2 text-sm font-semibold text-ink"
                  >
                    <input
                      type="checkbox"
                      name="officerIds"
                      value={String(officer.id)}
                      defaultChecked={assignedOfficerIds.has(String(officer.id))}
                      className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                    />
                    {String(officer.name || officer.email)}
                  </label>
                ))}
              </div>
              <Button type="submit" variant="secondary" className="self-start">
                Save Assignment
              </Button>
            </form>
          ) : null}
        </Card>

        <div className="md:col-span-2">
          <StandingImpactPanel impact={standingImpact} />
        </div>
        <div className="md:col-span-2">
          <BracketImpactPanel impact={bracketImpact} workspace />
        </div>

        {advancement ? (
          <Card className="flex flex-col gap-3 md:col-span-2">
            <CardTitle>Advancement</CardTitle>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Outcome</dt>
                <dd className="font-semibold text-ink">{formatStatus(advancement.outcome)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Winner</dt>
                <dd className="font-semibold text-ink">{advancement.winnerLabel || 'No winner'}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Next Match</dt>
                <dd className="font-semibold text-ink">
                  {advancement.targetMatchNumber ? (
                    <Link
                      href={`/workspaces/matches/${advancement.targetMatchNumber}`}
                      className="text-blue no-underline hover:underline"
                    >
                      {advancement.targetMatchNumber}
                    </Link>
                  ) : (
                    'No deterministic target'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Target Slot</dt>
                <dd className="font-semibold text-ink">
                  {advancement.targetSlot ? advancement.targetSlot.toUpperCase() : 'Not set'}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-ink-soft">{advancement.reason}</p>
          </Card>
        ) : null}

        {champion ? (
          <Card className="flex flex-col gap-3 md:col-span-2">
            <CardTitle>Champion Context</CardTitle>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Status</dt>
                <dd className="font-semibold text-ink">{formatStatus(champion.status)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Champion</dt>
                <dd className="font-semibold text-ink">
                  {champion.status === 'decided' ? champion.label || 'Champion' : 'Not decided'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Deciding Match</dt>
                <dd className="font-semibold text-ink">
                  {champion.match_number ? (
                    <Link
                      href={`/workspaces/matches/${champion.match_number}`}
                      className="text-blue no-underline hover:underline"
                    >
                      {champion.match_number}
                    </Link>
                  ) : (
                    'Not available'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Round</dt>
                <dd className="font-semibold text-ink">{champion.round_name || 'Not available'}</dd>
              </div>
            </dl>
            <p className="text-sm text-ink-soft">{champion.reason}</p>
          </Card>
        ) : null}

        <Card className="flex flex-col gap-3 md:col-span-2">
          <CardTitle>Match Actions</CardTitle>
          {allowedTransitions.length === 0 ? (
            <EmptyState>No lifecycle actions available for the current status.</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-3">
              {allowedTransitions.map((transition) => (
                <form key={transition.to} action={transitionMatchStatusAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="matchNumber" value={match.match_number} />
                  <input type="hidden" name="targetStatus" value={transition.to} />
                  {transition.requiresWinnerSelection ? (
                    <Field label="Winner">
                      <Select name="winnerSide" defaultValue="">
                        <option value="">No winner / draw</option>
                        <option value="a">{getRelationshipLabel(match.participant_a_entry_id)}</option>
                        <option value="b">{getRelationshipLabel(match.participant_b_entry_id)}</option>
                      </Select>
                    </Field>
                  ) : null}
                  {transition.requiresConfirm ? (
                    <ConfirmSubmitButton
                      className={buttonClassName}
                      confirmMessage={`${transition.label}. Are you sure?`}
                    >
                      {transition.label}
                    </ConfirmSubmitButton>
                  ) : (
                    <Button type="submit">{transition.label}</Button>
                  )}
                </form>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4 md:col-span-2">
          <CardTitle>Score Input</CardTitle>
          {matchSets.length === 0 ? (
            <EmptyState>No match sets recorded yet.</EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {matchSets.map((set) => (
                <form
                  key={set.id}
                  action={updateMatchSetScoreAction}
                  className="flex flex-col gap-3 rounded-card border border-line bg-mist p-4"
                >
                  <input type="hidden" name="matchNumber" value={match.match_number} />
                  <input type="hidden" name="matchSetId" value={set.id} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-extrabold text-ink">Set {set.set_number}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={getRelationshipLabel(match.participant_a_entry_id)}>
                      <Input type="number" name="participantAScore" min={0} defaultValue={set.participant_a_score ?? 0} />
                    </Field>
                    <Field label={getRelationshipLabel(match.participant_b_entry_id)}>
                      <Input type="number" name="participantBScore" min={0} defaultValue={set.participant_b_score ?? 0} />
                    </Field>
                  </div>
                  <Field label="Set Winner">
                    <Select name="winnerSide" defaultValue={getSetWinnerSide(match, set)}>
                      <option value="">Not decided</option>
                      <option value="a">{getRelationshipLabel(match.participant_a_entry_id)}</option>
                      <option value="b">{getRelationshipLabel(match.participant_b_entry_id)}</option>
                    </Select>
                  </Field>
                  <Field label="Notes">
                    <Textarea name="notes" rows={2} defaultValue={set.notes || ''} />
                  </Field>
                  {['finished', 'result_published'].includes(match.status) ? (
                    <Field label="Revision reason (required for finished results)">
                      <Textarea name="revisionReason" rows={2} required />
                    </Field>
                  ) : null}
                  <Button type="submit">Save Set {set.set_number}</Button>
                </form>
              ))}
            </div>
          )}

          <form action={addMatchSetAction}>
            <input type="hidden" name="matchNumber" value={match.match_number} />
            <Button type="submit" variant="secondary">
              Add Set {matchSets.length + 1}
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-3 md:col-span-2">
          <CardTitle>Score Summary</CardTitle>
          <p className="text-sm text-ink-soft">{match.score_summary || 'Score summary not recorded yet.'}</p>
          <MatchSetsTable sets={matchSets} />
        </Card>

        <Card className="flex flex-col gap-4 md:col-span-2">
          <CardTitle>Documentation</CardTitle>
          <DocumentationAssetList assets={documentationAssets} showVisibility />
          <form action={addDocumentationAssetAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="matchNumber" value={match.match_number} />
            <Field label="Asset Type">
              <Select name="assetType" defaultValue="photo">
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="file">File</option>
                <option value="score_sheet">Score Sheet</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select name="visibility" defaultValue="internal">
                <option value="internal">Internal</option>
                <option value="public">Public</option>
              </Select>
            </Field>
            <Field label="Caption" className="sm:col-span-2">
              <Input type="text" name="caption" maxLength={200} />
            </Field>
            <Field label="File" className="sm:col-span-2">
              <FileUpload
                id="documentation-upload"
                name="file"
                variant="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                maxSizeBytes={10 * 1024 * 1024}
                helpText="Photo, PDF, or video. Up to 10MB."
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Upload Documentation</Button>
            </div>
          </form>
        </Card>

        <Card className="flex flex-col gap-4 md:col-span-2">
          <CardTitle>Internal Comments</CardTitle>
          <CommentList comments={internalComments} showStatus />
          <form action={addMatchCommentAction} className="flex flex-col gap-4">
            <input type="hidden" name="matchNumber" value={match.match_number} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Select name="commentType" defaultValue="internal">
                  <option value="internal">Internal Comment</option>
                  <option value="official_note">Official Note</option>
                </Select>
              </Field>
              <Field label="Author Name">
                <Input type="text" name="authorName" defaultValue="Match Desk" maxLength={120} />
              </Field>
            </div>
            <Field label="Body">
              <Textarea name="body" rows={4} maxLength={2000} required />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" name="isPinned" className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
              Pin this note
            </label>
            <Button type="submit">Save Comment</Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-3 md:col-span-2">
          <CardTitle>Audit History</CardTitle>
          <AuditLogPanel entries={auditLogEntries} />
        </Card>
      </section>
    </>
  )
}
