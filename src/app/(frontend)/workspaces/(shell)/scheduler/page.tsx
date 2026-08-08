import type { Where } from 'payload'
import Link from 'next/link'
import { AlertTriangle, ChevronDown } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { getMatchStatusTone, StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { resolveEventTimezone } from '@/lib/timezone'
import { collectEntryClubLabels, getRelationshipId } from '@/lib/brackets'
import { getActiveEvent } from '../../activeEvent'
import {
  NoActiveEventNotice,
  StatBlock,
  StatGrid,
  PageHero,
  WorkspaceMatch,
  WorkspaceOption,
  formatDateLabel,
  formatDateTime,
  formatStatus,
  formatTimeOnly,
  getDateKey,
  getRelationshipLabel,
  toOptions,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { AddMatchDialog } from './AddMatchDialog'
import { RescheduleMatchDialog } from './RescheduleMatchDialog'
import { ConflictWarning, detectScheduleConflicts } from './conflicts'

export const dynamic = 'force-dynamic'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.4: postponed was previously a dead end -
// RescheduleMatchDialog couldn't reach a postponed match at all, so "postpone" had no guided way
// back to a real schedule. Included here alongside the original three statuses. 'published' added
// after live testing found it was the single most common status for an upcoming match, yet the
// Reschedule button never appeared for it - see the matching comment in schedulerActions.ts.
const RESCHEDULABLE_STATUSES = new Set(['draft', 'ready_for_scheduling', 'scheduled', 'published', 'postponed'])

const scheduleErrorMessages: Record<string, string> = {
  invalid_match: 'Fill in every field with valid values before creating the match.',
  invalid_relationship: 'One of the selected sport, category, participants, venue, or court does not belong to this event or category.',
  conflict: 'That time would create a venue or participant conflict.',
  invalid_reschedule: 'Fill in the new time, venue, court, and a reason.',
  reschedule_not_allowed: "This match's current status can no longer be rescheduled here.",
}

type SchedulerSearchParams = Promise<Record<string, string | string[] | undefined>>

const getParam = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key]

  return Array.isArray(value) ? value[0] : value || ''
}

const FilterSelect = ({
  label,
  name,
  value,
  options,
}: {
  label: string
  name: string
  value: string
  options: WorkspaceOption[]
}) => (
  <Field label={label}>
    <Select name={name} defaultValue={value}>
      <option value="">All</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  </Field>
)

export default async function SchedulerWorkspacePage({
  searchParams,
}: {
  searchParams?: SchedulerSearchParams
}) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo: '/workspaces/scheduler',
    workspaceName: 'Scheduler Workspace',
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
      <>
        <PageHero
          eyebrow="Scheduler Workspace"
          title="Schedule Command Queue"
          summary="Create and reschedule matches using the guided forms below."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const sport = getParam(params, 'sport')
  const category = getParam(params, 'category')
  const venue = getParam(params, 'venue')
  const court = getParam(params, 'court')
  const status = getParam(params, 'status')
  const scheduleError = getParam(params, 'scheduleError')
  const scheduleCreated = getParam(params, 'scheduleCreated') === '1'
  const scheduleRescheduled = getParam(params, 'scheduleRescheduled') === '1'
  const filterClauses: Where[] = [{ event_id: { equals: activeEvent.id } }]

  if (sport) filterClauses.push({ sport_id: { equals: sport } })
  if (category) filterClauses.push({ category_id: { equals: category } })
  if (venue) filterClauses.push({ venue_id: { equals: venue } })
  if (court) filterClauses.push({ court_id: { equals: court } })
  if (status) filterClauses.push({ status: { equals: status } })

  const where = { and: filterClauses }
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const [matches, sports, categories, venues, courts, entries, allMatches] = await Promise.all([
    payload.find({ collection: 'matches', depth: 2, limit: 100, sort: 'scheduled_start_at', where }),
    payload.find({ collection: 'sports', limit: 100, sort: 'name', where: eventWhere }),
    payload.find({ collection: 'competition-categories', limit: 100, sort: 'name', where: eventWhere }),
    payload.find({ collection: 'venues', limit: 100, sort: 'name', where: eventWhere }),
    payload.find({ collection: 'courts', limit: 100, sort: 'name', where: eventWhere }),
    payload.find({ collection: 'competition-entries', limit: 200, sort: 'display_name', where: eventWhere }),
    payload.find({ collection: 'matches', depth: 2, limit: 300, sort: 'scheduled_start_at', where: eventWhere }),
  ])

  const queueMatches = matches.docs as WorkspaceMatch[]
  const unscheduledMatches = queueMatches.filter((match) => !match.scheduled_start_at)
  const scheduledMatches = queueMatches.filter((match) => Boolean(match.scheduled_start_at))
  const statusOptions = Array.from(new Set(queueMatches.map((match) => match.status))).map((matchStatus) => ({
    id: matchStatus,
    label: matchStatus.replaceAll('_', ' '),
  }))
  const venueOptions = toOptions(venues.docs)
  const courtOptions = toOptions(courts.docs)

  const allMatchesDocs = allMatches.docs as WorkspaceMatch[]
  const schedulerEntryIds = allMatchesDocs
    .flatMap((match) => [getRelationshipId(match.participant_a_entry_id), getRelationshipId(match.participant_b_entry_id)])
    .filter((id): id is string | number => Boolean(id))
  const clubLabelByEntryId = await collectEntryClubLabels(payload, schedulerEntryIds)

  const conflicts = detectScheduleConflicts(allMatchesDocs)
  const alertConflicts = conflicts.filter((conflict) => conflict.severity === 'alert')

  const dayKeys = Array.from(
    new Set(
      scheduledMatches.map((match) => getDateKey(match.scheduled_start_at, timezone)).filter((key): key is string => Boolean(key)),
    ),
  ).sort()

  const dayLanes = dayKeys.map((dayKey) => {
    const dayMatches = scheduledMatches.filter((match) => getDateKey(match.scheduled_start_at, timezone) === dayKey)
    const laneLabels = Array.from(
      new Set(dayMatches.map((match) => getRelationshipLabel(match.venue_id, 'Unassigned venue'))),
    )

    return {
      dayKey,
      dateLabel: formatDateLabel(dayMatches[0]?.scheduled_start_at, timezone),
      lanes: laneLabels.map((label) => ({
        label,
        matches: dayMatches.filter((match) => getRelationshipLabel(match.venue_id, 'Unassigned venue') === label),
      })),
    }
  })

  const renderQueueTable = (rows: WorkspaceMatch[], emptyMessage: string) =>
    rows.length === 0 ? (
      <EmptyState>{emptyMessage}</EmptyState>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Match</TableHead>
            <TableHead>Participants</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="sr-only">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((match) => {
            const entryAId = getRelationshipId(match.participant_a_entry_id)
            const entryBId = getRelationshipId(match.participant_b_entry_id)
            const clubA = entryAId !== undefined ? clubLabelByEntryId.get(String(entryAId)) : undefined
            const clubB = entryBId !== undefined ? clubLabelByEntryId.get(String(entryBId)) : undefined
            return (
            <TableRow key={match.id}>
              <TableCell>
                <Link
                  href={`/workspaces/matches/${match.match_number}`}
                  className="font-bold text-blue no-underline hover:underline"
                >
                  {match.match_number}
                </Link>
                <p className="text-xs text-ink-soft">
                  {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
                </p>
              </TableCell>
              <TableCell>
                <span>
                  <span className="font-semibold">{getRelationshipLabel(match.participant_a_entry_id)}</span>
                  {clubA ? <span className="block text-xs font-semibold text-ink-soft">{clubA}</span> : null}
                </span>
                <span className="text-ink-soft"> vs </span>
                <span>
                  <span className="font-semibold">{getRelationshipLabel(match.participant_b_entry_id)}</span>
                  {clubB ? <span className="block text-xs font-semibold text-ink-soft">{clubB}</span> : null}
                </span>
              </TableCell>
              <TableCell>
                {match.scheduled_start_at ? (
                  <>
                    <p className="font-semibold whitespace-nowrap">{formatDateTime(match.scheduled_start_at, timezone)}</p>
                    <p className="text-xs text-ink-soft">
                      {getRelationshipLabel(match.venue_id)} / {getRelationshipLabel(match.court_id)}
                    </p>
                  </>
                ) : (
                  <span className="text-ink-soft">Not scheduled</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
              </TableCell>
              <TableCell>
                {RESCHEDULABLE_STATUSES.has(match.status) ? (
                  <RescheduleMatchDialog match={match} venues={venueOptions} courts={courtOptions} />
                ) : null}
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )

  return (
    <>
      <PageHero
        eyebrow="Scheduler Workspace"
        title="Schedule Command Queue"
        summary="Monitor the queue, resolve conflicts, and reschedule matches. Every submission validates relationships, time order, conflicts, and lifecycle state, and records an audit entry."
        actions={
          <>
            <AddMatchDialog
              sports={toOptions(sports.docs)}
              categories={toOptions(categories.docs)}
              entries={toOptions(entries.docs)}
              venues={venueOptions}
              courts={courtOptions}
            />
            <Button asChild variant="secondary">
              <Link href={`/events/${activeEvent.slug}/schedule`}>Public Schedule</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/events/${activeEvent.slug}/display`} target="_blank" rel="noopener">
                Venue Display
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <a href="/workspaces/scheduler/export">Export (.xlsx)</a>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/scheduler/import">Import (.xlsx)</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/scheduler/optimize">Schedule Optimizer</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/scheduler/delay-impact">Delay Impact</Link>
            </Button>
          </>
        }
      />

      {scheduleError && scheduleErrorMessages[scheduleError] ? (
        <AlertBanner tone="error" className="mb-4">
          {scheduleErrorMessages[scheduleError]}
        </AlertBanner>
      ) : null}
      {scheduleCreated ? (
        <AlertBanner tone="success" className="mb-4">
          Match created.
        </AlertBanner>
      ) : null}
      {scheduleRescheduled ? (
        <AlertBanner tone="success" className="mb-4">
          Match rescheduled.
        </AlertBanner>
      ) : null}

      <StatGrid>
        <StatBlock label="Visible Matches" value={queueMatches.length} />
        <StatBlock label="Unscheduled" value={unscheduledMatches.length} tone="warn" />
        <StatBlock label="Scheduled" value={scheduledMatches.length} tone="good" />
        <StatBlock
          label="Conflicts"
          value={conflicts.length}
          tone={alertConflicts.length > 0 ? 'alert' : conflicts.length > 0 ? 'warn' : 'good'}
        />
      </StatGrid>

      {conflicts.length > 0 ? (
        <details className="group mb-6 rounded-panel border border-line bg-paper">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <AlertTriangle
                className={alertConflicts.length > 0 ? 'h-4 w-4 text-danger' : 'h-4 w-4 text-gold'}
                aria-hidden="true"
              />
              {conflicts.length} conflict warning{conflicts.length === 1 ? '' : 's'}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="flex flex-col gap-2 border-t border-line p-4">
            <p className="text-xs font-semibold text-ink-soft">
              Warnings only. Nothing is blocked from being scheduled yet. Checked across all matches, not just the
              current filter.
            </p>
            <ul className="flex flex-col gap-2">
              {conflicts.map((conflict: ConflictWarning) => (
                <li
                  key={conflict.id}
                  className={
                    conflict.severity === 'alert'
                      ? 'flex items-start gap-2 rounded-card border border-danger/30 bg-danger-surface px-3 py-2 text-sm font-semibold text-danger'
                      : 'flex items-start gap-2 rounded-card border border-gold/40 bg-mist px-3 py-2 text-sm font-semibold text-ink'
                  }
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {conflict.message}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>Filter Queue</CardTitle>
        <form className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5" action="/workspaces/scheduler">
          <FilterSelect label="Sport" name="sport" value={sport} options={toOptions(sports.docs)} />
          <FilterSelect label="Category" name="category" value={category} options={toOptions(categories.docs)} />
          <FilterSelect label="Venue" name="venue" value={venue} options={venueOptions} />
          <FilterSelect label="Court" name="court" value={court} options={courtOptions} />
          <FilterSelect label="Status" name="status" value={status} options={statusOptions} />
          <div className="flex gap-2 sm:col-span-3 lg:col-span-5">
            <Button type="submit">Apply</Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/scheduler">Reset</Link>
            </Button>
          </div>
        </form>
      </Card>

      <section className="mb-6 flex flex-col gap-3" aria-label="Unscheduled matches">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-ink">Unscheduled</h2>
          <span className="text-sm font-extrabold text-ink-soft">{unscheduledMatches.length}</span>
        </div>
        {renderQueueTable(unscheduledMatches, 'No unscheduled matches match these filters.')}
      </section>

      <section className="mb-6 flex flex-col gap-3" aria-label="Scheduled matches">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-ink">Scheduled</h2>
          <span className="text-sm font-extrabold text-ink-soft">{scheduledMatches.length}</span>
        </div>
        {renderQueueTable(scheduledMatches, 'No scheduled matches match these filters.')}
      </section>

      <details className="group rounded-panel border border-line bg-paper">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden">
          Calendar view
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-4">
          {dayLanes.length === 0 ? (
            <EmptyState>No scheduled matches yet to display on the calendar.</EmptyState>
          ) : (
            dayLanes.map((day) => (
              <div key={day.dayKey} className="flex flex-col gap-2">
                <h3 className="text-sm font-extrabold text-ink">{day.dateLabel}</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {day.lanes.map((lane) => (
                    <div key={lane.label} className="rounded-card border border-line bg-mist p-3">
                      <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">{lane.label}</p>
                      <div className="flex flex-col gap-2">
                        {lane.matches.map((match) => {
                          const entryAId = getRelationshipId(match.participant_a_entry_id)
                          const entryBId = getRelationshipId(match.participant_b_entry_id)
                          const clubA = entryAId !== undefined ? clubLabelByEntryId.get(String(entryAId)) : undefined
                          const clubB = entryBId !== undefined ? clubLabelByEntryId.get(String(entryBId)) : undefined
                          return (
                          <div
                            key={match.id}
                            className="flex items-center justify-between gap-2 rounded-card border border-line bg-paper px-3 py-2 text-xs"
                          >
                            <span className="font-bold text-ink-soft">{formatTimeOnly(match.scheduled_start_at, timezone)}</span>
                            <strong className="font-extrabold text-ink">{match.match_number}</strong>
                            <span className="min-w-0 truncate text-right font-semibold text-ink-soft">
                              {getRelationshipLabel(match.participant_a_entry_id)}
                              {clubA ? ` (${clubA})` : ''} vs{' '}
                              {getRelationshipLabel(match.participant_b_entry_id)}
                              {clubB ? ` (${clubB})` : ''}
                            </span>
                          </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </details>
    </>
  )
}
