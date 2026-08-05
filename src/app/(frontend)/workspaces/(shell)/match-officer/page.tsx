import Link from 'next/link'

import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getActiveEvent } from '../../activeEvent'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  MatchCard,
  NoActiveEventNotice,
  StatBlock,
  StatGrid,
  PageHero,
  WorkspaceMatch,
  formatDateTime,
  getRelationshipLabel,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { transitionMatchStatusAction } from '../../matches/matchActions'
import { getAllowedTransitions } from '../../matches/matchLifecycle'

export const dynamic = 'force-dynamic'

const matchDayStatuses = ['published', 'scheduled', 'check_in_open', 'ready_to_start', 'ongoing']

export default async function MatchOfficerWorkspacePage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.matchOfficer,
    returnTo: '/workspaces/match-officer',
    workspaceName: 'Match Officer Workspace',
  })
  if (!access.authorized) {
    return (
      <WorkspaceUnauthorized
        workspaceName={access.workspaceName}
        allowedRoles={access.allowedRoles}
      />
    )
  }

  const payload = access.payload
  const activeEvent = await getActiveEvent(payload)
  const timezone = resolveEventTimezone(activeEvent?.timezone)
  if (!activeEvent) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHero
          eyebrow="Match Officer Workspace"
          title="Match-Day Flow"
          summary="Mobile-first match list for officers on venue duty."
        />
        <NoActiveEventNotice />
      </div>
    )
  }

  // AUDIT_E2E MAT-07: this used to show every scheduled match on the active event to every match
  // officer - "Assigned Match List" wasn't actually scoped to an assignment. A match with no
  // officer_ids stays open to any match officer (see Matches.ts field description); otherwise only
  // the officers actually listed on the match see it here.
  const matches = await payload.find({
    collection: 'matches',
    depth: 2,
    limit: 50,
    sort: 'scheduled_start_at',
    where: {
      and: [
        { event_id: { equals: activeEvent.id } },
        { scheduled_start_at: { exists: true } },
        {
          or: [
            { officer_ids: { exists: false } },
            { officer_ids: { in: access.user ? [access.user.id] : [] } },
          ],
        },
      ],
    },
  })

  const scheduledMatches = (matches.docs as WorkspaceMatch[]).filter((match) =>
    matchDayStatuses.includes(match.status),
  )
  const nextMatch = scheduledMatches[0]
  const quickTransitions = nextMatch
    ? getAllowedTransitions(nextMatch.status).filter((transition) => !transition.requiresConfirm)
    : []

  return (
    <div className="mx-auto max-w-2xl">
      <PageHero
        eyebrow="Match Officer Workspace"
        title="Match-Day Flow"
        summary="Mobile-first match list for officers on venue duty. Quick status actions for the next match are available below; open Live Score for the full-screen scoring surface, or Match Details for documentation, comments, and the full lifecycle action set."
      />

      <StatGrid>
        <StatBlock label="Ready Today" value={scheduledMatches.length} tone="good" />
        <StatBlock
          label="Documentation"
          value={scheduledMatches.filter((match) => match.documentation_status === 'needed').length}
          tone="warn"
        />
      </StatGrid>

      {nextMatch ? (
        <Card className="mb-6 flex flex-col gap-3" aria-label="Next assigned match">
          <p className="text-xs font-bold tracking-wide text-green uppercase">Next Match</p>
          <h2 className="text-xl font-extrabold text-ink">{nextMatch.match_number}</h2>
          <p className="text-sm font-semibold text-ink-soft">
            {getRelationshipLabel(nextMatch.participant_a_entry_id)} vs{' '}
            {getRelationshipLabel(nextMatch.participant_b_entry_id)}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Start</dt>
              <dd className="font-semibold text-ink">{formatDateTime(nextMatch.scheduled_start_at, timezone)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Place</dt>
              <dd className="font-semibold text-ink">
                {getRelationshipLabel(nextMatch.venue_id)} / {getRelationshipLabel(nextMatch.court_id)}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3 text-sm font-bold text-blue">
            <Link href={`/workspaces/matches/${nextMatch.match_number}`} className="no-underline hover:underline">
              Match details
            </Link>
            <Link
              href={`/workspaces/matches/${nextMatch.match_number}/live-score`}
              className="no-underline hover:underline"
            >
              Live score
            </Link>
          </div>

          {quickTransitions.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">No quick actions for this status</p>
          ) : (
            <div className="flex flex-wrap gap-2" aria-label="Match officer quick actions">
              {quickTransitions.map((transition) => (
                <form key={transition.to} action={transitionMatchStatusAction}>
                  <input type="hidden" name="matchNumber" value={nextMatch.match_number} />
                  <input type="hidden" name="targetStatus" value={transition.to} />
                  <SubmitButton size="sm">
                    {transition.label}
                  </SubmitButton>
                </form>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <section aria-label="Assigned matches">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-ink">Assigned Match List</h2>
          <span className="text-sm font-extrabold text-ink-soft">{scheduledMatches.length}</span>
        </div>
        <div className="flex flex-col gap-3">
          {scheduledMatches.length === 0 ? (
            <EmptyState>No scheduled match-day items are ready yet.</EmptyState>
          ) : (
            scheduledMatches.map((match) => (
              <div key={match.id} className="flex flex-col gap-2">
                <MatchCard match={match} compact timezone={timezone} />
                <Link
                  href={`/workspaces/matches/${match.match_number}/live-score`}
                  className="text-sm font-bold text-blue no-underline hover:underline"
                >
                  Open live score →
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
