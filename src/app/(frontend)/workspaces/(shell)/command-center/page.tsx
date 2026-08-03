import Link from 'next/link'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Eye, Play } from 'lucide-react'

import { AutoRefresh } from '@/components/auto-refresh'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { computeDelayImpacts } from '@/lib/delayPropagation'
import { getActiveEvent } from '../../activeEvent'
import { NoActiveEventNotice, PageHero, getRelationshipLabel, type WorkspaceMatch } from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { detectScheduleConflicts } from '../scheduler/conflicts'

export const dynamic = 'force-dynamic'

const STARTABLE_STATUSES = new Set(['ready_to_start', 'check_in_open'])
const PRE_START_STATUSES = new Set(['scheduled', 'published', 'ready_to_start', 'check_in_open'])
const ONGOING_STATUSES = new Set(['ongoing', 'paused'])

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.1/15.7 (P0): a single screen answering "what needs
// my attention right now" - matches that should start, are running late, are ongoing, are done but
// not yet official, are under review, are postponed with nowhere to go, or have a venue conflict.
// Every card's primary action is phrased as work ("Start 3 matches"), not a bare stat - and each
// links into the scheduler pre-filtered to exactly that status, or the review queue for results.
// "Next round waiting on a winner" (also listed in 15.1) needs per-category bracket-slot data this
// pass doesn't build - noted as a follow-up rather than faked with a rough approximation.
export default async function CommandCenterPage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo: '/workspaces/command-center',
    workspaceName: 'Command Center',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Operations"
          title="Command Center"
          summary="One screen for everything that needs attention right now."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const allMatchesResult = await access.payload.find({
    collection: 'matches',
    depth: 2,
    limit: 1000,
    sort: 'scheduled_start_at',
    where: { event_id: { equals: activeEvent.id } },
  })
  const allMatches = allMatchesResult.docs as WorkspaceMatch[]
  const now = Date.now()

  const startNow = allMatches.filter(
    (m) => STARTABLE_STATUSES.has(m.status) && m.scheduled_start_at && new Date(m.scheduled_start_at).getTime() <= now,
  )
  const late = allMatches.filter(
    (m) => PRE_START_STATUSES.has(m.status) && m.scheduled_start_at && new Date(m.scheduled_start_at).getTime() < now,
  )
  const ongoing = allMatches.filter((m) => ONGOING_STATUSES.has(m.status))
  const finishedNotOfficial = allMatches.filter((m) => m.status === 'finished')
  const underReview = allMatches.filter((m) => m.status === 'under_review' || m.status === 'disputed')
  const postponedNoTime = allMatches.filter(
    (m) => m.status === 'postponed' && (!m.scheduled_start_at || new Date(m.scheduled_start_at).getTime() < now),
  )
  const conflicts = detectScheduleConflicts(allMatches).filter((warning) => warning.severity === 'alert')
  const delayImpacts = computeDelayImpacts(allMatches)
  const downstreamAffected = delayImpacts.reduce((sum, impact) => sum + impact.downstream.length, 0)

  // "Ongoing / paused" is shown for visibility but isn't a backlog item on its own (a match
  // correctly running isn't something that "needs attention"), so it's deliberately left out of
  // this count - matches what actually determines whether the empty state should show.
  const totalWorkItems =
    startNow.length +
    late.length +
    finishedNotOfficial.length +
    underReview.length +
    postponedNoTime.length +
    conflicts.length +
    downstreamAffected

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Command Center"
        summary="One screen for everything that needs attention right now."
        actions={
          <AutoRefresh
            intervalMs={20000}
            showIndicator
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-soft"
          />
        }
      />

      {totalWorkItems === 0 ? (
        <EmptyState icon={CheckCircle2}>Nothing needs attention right now.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WorkCard
            icon={Play}
            tone="gold"
            title={(count) => `Start ${count} match${count === 1 ? '' : 'es'}`}
            actionLabel={(count) => `Start ${count} match${count === 1 ? '' : 'es'}`}
            matches={startNow}
            href="/workspaces/scheduler?status=ready_to_start"
          />
          <WorkCard
            icon={Clock}
            tone="danger"
            title={(count) => `${count} late match${count === 1 ? '' : 'es'}`}
            actionLabel={() => 'Review in Scheduler'}
            matches={late}
            href="/workspaces/scheduler?status=scheduled"
          />
          <WorkCard
            icon={Play}
            tone="blue"
            title={(count) => `${count} ongoing / paused`}
            actionLabel={() => 'View matches'}
            matches={ongoing}
            href="/workspaces/matches"
          />
          <WorkCard
            icon={Eye}
            tone="gold"
            title={(count) => `Review ${count} result${count === 1 ? '' : 's'}`}
            actionLabel={(count) => `Review ${count} result${count === 1 ? '' : 's'}`}
            matches={finishedNotOfficial}
            href="/workspaces/matches?status=finished"
          />
          <WorkCard
            icon={AlertTriangle}
            tone="danger"
            title={(count) => `${count} under review / disputed`}
            actionLabel={() => 'View matches'}
            matches={underReview}
            href="/workspaces/matches"
          />
          <WorkCard
            icon={CalendarClock}
            tone="danger"
            title={(count) => `${count} postponed - needs a new time`}
            actionLabel={(count) => `Reschedule ${count} match${count === 1 ? '' : 'es'}`}
            matches={postponedNoTime}
            href="/workspaces/scheduler?status=postponed"
          />
          {conflicts.length > 0 ? (
            <Card className="flex flex-col gap-2 border-danger/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
                <CardTitle>Venue/court conflicts</CardTitle>
              </div>
              <p className="text-sm text-ink-soft">{conflicts.length} conflict(s) need resolving.</p>
              <Link href="/workspaces/scheduler" className="text-sm font-bold text-brand-secondary hover:underline">
                Resolve in Scheduler &rarr;
              </Link>
            </Card>
          ) : null}
          {downstreamAffected > 0 ? (
            <Card className="flex flex-col gap-2 border-danger/30">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-danger" aria-hidden="true" />
                <CardTitle>Delay impact</CardTitle>
              </div>
              <p className="text-sm text-ink-soft">
                {downstreamAffected} match{downstreamAffected === 1 ? '' : 'es'} may need to shift because of a late
                match on the same court.
              </p>
              <Link
                href="/workspaces/scheduler/delay-impact"
                className="text-sm font-bold text-brand-secondary hover:underline"
              >
                Review suggested reschedules &rarr;
              </Link>
            </Card>
          ) : null}
        </div>
      )}
    </>
  )
}

function WorkCard({
  icon: Icon,
  tone,
  title,
  actionLabel,
  matches,
  href,
}: {
  icon: typeof Play
  tone: 'gold' | 'blue' | 'danger'
  title: (count: number) => string
  actionLabel: (count: number) => string
  matches: WorkspaceMatch[]
  href: string
}) {
  if (matches.length === 0) return null

  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'gold' ? 'text-gold' : 'text-blue'

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${toneClass}`} aria-hidden="true" />
        <CardTitle>{title(matches.length)}</CardTitle>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-ink-soft">
        {matches.slice(0, 4).map((match) => (
          <li key={match.id} className="truncate">
            {match.match_number} &middot; {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
            {getRelationshipLabel(match.participant_b_entry_id)}
          </li>
        ))}
        {matches.length > 4 ? <li>+{matches.length - 4} more</li> : null}
      </ul>
      <Link href={href} className="mt-1 text-sm font-bold text-brand-secondary hover:underline">
        {actionLabel(matches.length)} &rarr;
      </Link>
    </Card>
  )
}
