import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getActiveEvent } from '../../activeEvent'
import {
  NoActiveEventNotice,
  PageHero,
  StatBlock,
  StatGrid,
  getRelationshipId,
  getRelationshipLabel,
  type RelationshipDoc,
  type WorkspaceMatch,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'

export const dynamic = 'force-dynamic'

type AnalyticsMatch = WorkspaceMatch & {
  actual_start_at?: string | null
  officer_ids?: (RelationshipDoc | string | number)[] | null
}

const LATE_THRESHOLD_MINUTES = 5
const DOCUMENTATION_LABELS: Record<string, string> = {
  not_started: 'Not started',
  needed: 'Needed',
  submitted: 'Submitted',
  approved: 'Approved',
  not_required: 'Not required',
}

const rankBy = (entries: [string, number][], limit = 8) =>
  entries.sort((a, b) => b[1] - a[1]).slice(0, limit)

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15 P2 "operational analytics": retrospective/aggregate
// metrics, distinct in purpose from Command Center's "what needs attention right now" - schedule
// adherence, officer workload, venue utilization, documentation completion. All derived from
// fields matches already carry; no new collection or tracking needed.
export default async function AnalyticsPage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.analytics,
    returnTo: '/workspaces/analytics',
    workspaceName: 'Operational Analytics',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Reports"
          title="Operational Analytics"
          summary="Schedule adherence, workload, and completion metrics for this event."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const allMatchesResult = await access.payload.find({
    collection: 'matches',
    depth: 2,
    limit: 2000,
    where: { event_id: { equals: activeEvent.id } },
  })
  const matches = allMatchesResult.docs as AnalyticsMatch[]

  // ---- Schedule adherence -----------------------------------------------------------------------
  const timedMatches = matches.filter((match) => match.scheduled_start_at && match.actual_start_at)
  const delaysMinutes = timedMatches.map(
    (match) =>
      (new Date(match.actual_start_at as string).getTime() - new Date(match.scheduled_start_at as string).getTime()) /
      60000,
  )
  const averageDelay = delaysMinutes.length
    ? Math.round(delaysMinutes.reduce((sum, value) => sum + value, 0) / delaysMinutes.length)
    : 0
  const lateCount = delaysMinutes.filter((value) => value > LATE_THRESHOLD_MINUTES).length
  const onTimeRate = timedMatches.length
    ? Math.round(((timedMatches.length - lateCount) / timedMatches.length) * 100)
    : null

  // ---- Officer workload --------------------------------------------------------------------------
  const officerCounts = new Map<string, { label: string; count: number }>()
  for (const match of matches) {
    for (const officer of match.officer_ids || []) {
      const id = String(getRelationshipId(officer))
      const existing = officerCounts.get(id)
      officerCounts.set(id, {
        label: getRelationshipLabel(officer, `Officer #${id}`),
        count: (existing?.count || 0) + 1,
      })
    }
  }
  const officerRanking = rankBy(
    Array.from(officerCounts.entries()).map(([id, value]) => [value.label, value.count] as [string, number]),
  )

  // ---- Venue utilization --------------------------------------------------------------------------
  const venueCounts = new Map<string, number>()
  for (const match of matches) {
    const label = getRelationshipLabel(match.venue_id, 'Unassigned venue')
    venueCounts.set(label, (venueCounts.get(label) || 0) + 1)
  }
  const venueRanking = rankBy(Array.from(venueCounts.entries()))

  // ---- Documentation completion -------------------------------------------------------------------
  const documentationCounts = new Map<string, number>()
  for (const match of matches) {
    const status = match.documentation_status || 'not_started'
    documentationCounts.set(status, (documentationCounts.get(status) || 0) + 1)
  }

  // ---- Result/dispute snapshot ---------------------------------------------------------------------
  const disputedCount = matches.filter((match) => match.status === 'disputed').length
  const postponedCount = matches.filter((match) => match.status === 'postponed').length
  const publishedCount = matches.filter((match) => match.status === 'result_published').length

  return (
    <>
      <PageHero
        eyebrow="Reports"
        title="Operational Analytics"
        summary="Schedule adherence, workload, and completion metrics for this event. Computed from current match data, not a historical trend."
        actions={
          <Button asChild variant="secondary">
            <Link href="/workspaces/analytics/readiness">Readiness Analytics</Link>
          </Button>
        }
      />

      {matches.length === 0 ? (
        <EmptyState>No matches yet - analytics will populate once matches are generated.</EmptyState>
      ) : (
        <>
          <StatGrid>
            <StatBlock
              label="Avg. start delay"
              value={timedMatches.length ? `${averageDelay >= 0 ? '+' : ''}${averageDelay} min` : 'No data'}
              tone={averageDelay > LATE_THRESHOLD_MINUTES ? 'alert' : averageDelay > 0 ? 'warn' : 'good'}
            />
            <StatBlock
              label="Started on time"
              value={onTimeRate === null ? 'No data' : `${onTimeRate}%`}
              tone={onTimeRate === null ? 'default' : onTimeRate >= 80 ? 'good' : onTimeRate >= 50 ? 'warn' : 'alert'}
            />
            <StatBlock label="Results published" value={publishedCount} tone="good" />
            <StatBlock
              label="Disputed / postponed"
              value={disputedCount + postponedCount}
              tone={disputedCount + postponedCount > 0 ? 'alert' : 'good'}
            />
          </StatGrid>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="flex flex-col gap-3">
              <CardTitle>Officer workload</CardTitle>
              {officerRanking.length === 0 ? (
                <p className="text-sm text-ink-soft">No officers assigned to any match yet.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {officerRanking.map(([label, count]) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span className="truncate font-semibold text-ink">{label}</span>
                      <span className="font-bold tabular-nums text-ink-soft">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <CardTitle>Venue utilization</CardTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {venueRanking.map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold text-ink">{label}</span>
                    <span className="font-bold tabular-nums text-ink-soft">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="flex flex-col gap-3">
              <CardTitle>Documentation completion</CardTitle>
              <ul className="flex flex-col gap-2 text-sm">
                {Object.entries(DOCUMENTATION_LABELS).map(([status, label]) => (
                  <li key={status} className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{label}</span>
                    <span className="font-bold tabular-nums text-ink-soft">
                      {documentationCounts.get(status) || 0}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
