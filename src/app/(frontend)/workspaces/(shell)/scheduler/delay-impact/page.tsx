import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock } from 'lucide-react'

import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { AutoRefresh } from '@/components/auto-refresh'
import { computeDelayImpacts } from '@/lib/delayPropagation'
import { getActiveEvent } from '../../../activeEvent'
import {
  NoActiveEventNotice,
  PageHero,
  formatDateTime,
  getRelationshipId,
  getRelationshipLabel,
  type WorkspaceMatch,
} from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { ConfirmSubmitButton } from '../../../matches/ConfirmSubmitButton'
import { rescheduleMatchAction } from '../schedulerActions'

export const dynamic = 'force-dynamic'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15 P2 "automated delay propagation": when a match on a
// court is running late, everything scheduled after it on that same court is optimistic until
// someone accounts for the slip. This page surfaces the suggested shift per downstream match -
// applying it is always an explicit, individually-confirmed action through the exact same
// rescheduleMatchAction every other reschedule goes through (conflict-checked, audit-logged,
// posts the schedule-change announcement), never a silent bulk rewrite.
export default async function DelayImpactPage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo: '/workspaces/scheduler/delay-impact',
    workspaceName: 'Delay Impact',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Operations" title="Delay Impact" summary="Suggested reschedules from matches running late." />
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
  const matches = allMatchesResult.docs as WorkspaceMatch[]
  const impacts = computeDelayImpacts(matches)

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Delay Impact"
        summary="When a match on a court runs late, everything scheduled after it on that court may need to shift. Nothing here changes automatically - review each suggestion and apply it explicitly."
        actions={
          <AutoRefresh
            intervalMs={30000}
            showIndicator
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-soft"
          />
        }
      />

      {impacts.length === 0 ? (
        <EmptyState icon={Clock}>No matches are running late enough to affect their court&apos;s later matches.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {impacts.map((impact) => (
            <Card key={impact.courtKey} className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />
                <CardTitle>
                  {getRelationshipLabel(impact.sourceMatch.venue_id)} / {getRelationshipLabel(impact.sourceMatch.court_id)}
                </CardTitle>
              </div>
              <p className="text-sm text-ink-soft">
                <Link
                  href={`/workspaces/matches/${impact.sourceMatch.match_number}`}
                  className="font-bold text-blue hover:underline"
                >
                  {impact.sourceMatch.match_number}
                </Link>{' '}
                is running about <strong className="text-ink">{impact.delayMinutes} min</strong> late.{' '}
                {impact.downstream.length} match{impact.downstream.length === 1 ? '' : 'es'} scheduled after it on
                this court may need to shift.
              </p>

              <div className="flex flex-col gap-3">
                {impact.downstream.map((suggestion) => {
                  const formId = `delay-apply-${suggestion.match.id}`
                  return (
                    <div
                      key={suggestion.match.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-mist px-4 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/workspaces/matches/${suggestion.match.match_number}`}
                          className="font-bold text-ink no-underline hover:underline"
                        >
                          {suggestion.match.match_number}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                          {formatDateTime(suggestion.match.scheduled_start_at)}
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          <span className="font-bold text-ink">{formatDateTime(suggestion.suggestedStartAt)}</span>
                        </p>
                      </div>
                      <form id={formId} action={rescheduleMatchAction}>
                        <input type="hidden" name="matchNumber" value={suggestion.match.match_number} />
                        <input type="hidden" name="scheduledStart" value={suggestion.suggestedStartAt} />
                        <input type="hidden" name="scheduledEnd" value={suggestion.suggestedEndAt} />
                        <input
                          type="hidden"
                          name="venueId"
                          value={String(getRelationshipId(suggestion.match.venue_id) ?? '')}
                        />
                        <input
                          type="hidden"
                          name="courtId"
                          value={String(getRelationshipId(suggestion.match.court_id) ?? '')}
                        />
                        <input
                          type="hidden"
                          name="reason"
                          value={`Delay propagated from ${impact.sourceMatch.match_number} (+${impact.delayMinutes} min)`}
                        />
                        <ConfirmSubmitButton
                          formId={formId}
                          tone="default"
                          size="sm"
                          confirmMessage={`Shift ${suggestion.match.match_number} to ${formatDateTime(suggestion.suggestedStartAt)}?`}
                        >
                          Apply suggested time
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
