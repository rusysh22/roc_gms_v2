import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, StatBlock, StatGrid, formatStatus } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { computeEventCategoryReadiness, type CategoryReadiness } from '../categoryReadiness'

export const dynamic = 'force-dynamic'

const SECTION_LABELS: Record<keyof CategoryReadiness['completionBySection'], string> = {
  participants: 'Participants',
  draw: 'Draw/groups',
  schedule: 'Schedule',
  publish: 'Published',
}

const SectionDot = ({ label, done }: { label: string; done: boolean }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${done ? 'text-green' : 'text-ink-soft'}`}>
    {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
    {label}
  </span>
)

export default async function ReadinessAnalyticsPage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.analytics,
    returnTo: '/workspaces/analytics/readiness',
    workspaceName: 'Readiness Analytics',
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
          title="Readiness Analytics"
          summary="Which categories are actually ready to publish, and what's blocking the rest."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const summary = await computeEventCategoryReadiness(access.payload, activeEvent.id)

  return (
    <>
      <PageHero
        eyebrow="Reports"
        title="Readiness Analytics"
        summary="Per-category readiness, not aggregate counts - each category is checked against participants, draw/groups, schedule, and publish status independently, so 100% never hides a category that isn't actually ready."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/workspaces/analytics">Operational Analytics</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/event-admin/new-event">Open Event Wizard</Link>
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatBlock label="Categories" value={summary.categories.length} />
        <StatBlock label="Publishable" value={summary.publishableCount} tone="good" />
        <StatBlock label="Blocked" value={summary.blockedCount} tone={summary.blockedCount > 0 ? 'alert' : 'default'} />
      </StatGrid>

      {summary.categories.length === 0 ? (
        <EmptyState>No categories exist yet for this event.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.categories.map((row) => (
            <Card key={row.categoryId} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    {row.sportLabel} &middot; {formatStatus(row.formatType)}
                  </p>
                  <CardTitle>{row.categoryName}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={formatStatus(row.status) === 'Draft' ? 'neutral' : row.status === 'published' ? 'green' : 'blue'}>
                    {formatStatus(row.status)}
                  </StatusBadge>
                  <StatusBadge tone={row.publishable ? 'green' : 'gold'}>
                    {row.publishable ? 'Publishable' : row.blockers.length > 0 ? `${row.blockers.length} blocker${row.blockers.length === 1 ? '' : 's'}` : 'Needs attention'}
                  </StatusBadge>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {(Object.keys(SECTION_LABELS) as Array<keyof CategoryReadiness['completionBySection']>).map((key) => (
                  <SectionDot key={key} label={SECTION_LABELS[key]} done={row.completionBySection[key]} />
                ))}
              </div>

              {row.blockers.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {row.blockers.map((issue) => (
                    <li key={issue.code} className="flex items-start gap-2 text-sm font-semibold text-danger">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {row.warnings.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {row.warnings.map((issue) => (
                    <li key={issue.code} className="text-sm text-ink-soft">
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {row.nextAction ? (
                <p className="text-sm">
                  <span className="font-bold text-ink">Next: </span>
                  <span className="text-ink-soft">{row.nextAction}</span>
                </p>
              ) : (
                <p className="text-sm font-semibold text-green">Ready - nothing blocking this category.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
