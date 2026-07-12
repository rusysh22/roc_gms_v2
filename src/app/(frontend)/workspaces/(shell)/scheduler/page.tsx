import type { Where } from 'payload'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  MatchCard,
  StatBlock,
  StatGrid,
  PageHero,
  WorkspaceMatch,
  WorkspaceOption,
  formatDateLabel,
  formatTimeOnly,
  getDateKey,
  getRelationshipLabel,
  toOptions,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { ConflictWarning, detectScheduleConflicts } from './conflicts'
import { createScheduledMatchAction, rescheduleMatchAction } from './schedulerActions'

export const dynamic = 'force-dynamic'

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

  const params = searchParams ? await searchParams : {}
  const sport = getParam(params, 'sport')
  const category = getParam(params, 'category')
  const venue = getParam(params, 'venue')
  const court = getParam(params, 'court')
  const status = getParam(params, 'status')
  const payload = access.payload
  const filterClauses: Where[] = []

  if (sport) filterClauses.push({ sport_id: { equals: sport } })
  if (category) filterClauses.push({ category_id: { equals: category } })
  if (venue) filterClauses.push({ venue_id: { equals: venue } })
  if (court) filterClauses.push({ court_id: { equals: court } })
  if (status) filterClauses.push({ status: { equals: status } })

  const where = filterClauses.length > 0 ? { and: filterClauses } : undefined
  const [matches, sports, categories, venues, courts, entries, allMatches] = await Promise.all([
    payload.find({ collection: 'matches', depth: 2, limit: 100, sort: 'scheduled_start_at', where }),
    payload.find({ collection: 'sports', limit: 100, sort: 'name' }),
    payload.find({ collection: 'competition-categories', limit: 100, sort: 'name' }),
    payload.find({ collection: 'venues', limit: 100, sort: 'name' }),
    payload.find({ collection: 'courts', limit: 100, sort: 'name' }),
    payload.find({ collection: 'competition-entries', limit: 200, sort: 'display_name' }),
    payload.find({ collection: 'matches', depth: 2, limit: 300, sort: 'scheduled_start_at' }),
  ])

  const queueMatches = matches.docs as WorkspaceMatch[]
  const unscheduledMatches = queueMatches.filter((match) => !match.scheduled_start_at)
  const scheduledMatches = queueMatches.filter((match) => Boolean(match.scheduled_start_at))
  const statusOptions = Array.from(new Set(queueMatches.map((match) => match.status))).map((matchStatus) => ({
    id: matchStatus,
    label: matchStatus.replaceAll('_', ' '),
  }))

  const conflicts = detectScheduleConflicts(allMatches.docs as WorkspaceMatch[])
  const alertConflicts = conflicts.filter((conflict) => conflict.severity === 'alert')

  const dayKeys = Array.from(
    new Set(
      scheduledMatches.map((match) => getDateKey(match.scheduled_start_at)).filter((key): key is string => Boolean(key)),
    ),
  ).sort()

  const dayLanes = dayKeys.map((dayKey) => {
    const dayMatches = scheduledMatches.filter((match) => getDateKey(match.scheduled_start_at) === dayKey)
    const laneLabels = Array.from(
      new Set(dayMatches.map((match) => getRelationshipLabel(match.venue_id, 'Unassigned venue'))),
    )

    return {
      dayKey,
      dateLabel: formatDateLabel(dayMatches[0]?.scheduled_start_at),
      lanes: laneLabels.map((label) => ({
        label,
        matches: dayMatches.filter((match) => getRelationshipLabel(match.venue_id, 'Unassigned venue') === label),
      })),
    }
  })

  return (
    <>
      <PageHero
        eyebrow="Scheduler Workspace"
        title="Schedule Command Queue"
        summary="Create and reschedule matches using the guided forms below. Every submission validates relationships, time order, conflicts, lifecycle state, and records an audit entry."
        actions={
          <Button asChild>
            <Link href="/schedule">Public Schedule</Link>
          </Button>
        }
      />

      <Card className="mb-6 flex flex-col gap-4">
        <div>
          <CardTitle>Add Match</CardTitle>
          <p className="text-xs font-semibold text-ink-soft">
            The active event is derived automatically. Use business names, never IDs.
          </p>
        </div>
        <form action={createScheduledMatchAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Match number">
            <Input name="matchNumber" required placeholder="FB-001" />
          </Field>
          <FilterSelect label="Sport" name="sportId" value="" options={toOptions(sports.docs)} />
          <FilterSelect label="Category" name="categoryId" value="" options={toOptions(categories.docs)} />
          <FilterSelect label="Participant A" name="participantA" value="" options={toOptions(entries.docs)} />
          <FilterSelect label="Participant B" name="participantB" value="" options={toOptions(entries.docs)} />
          <Field label="Start">
            <Input name="scheduledStart" type="datetime-local" required />
          </Field>
          <Field label="End">
            <Input name="scheduledEnd" type="datetime-local" required />
          </Field>
          <FilterSelect label="Venue" name="venueId" value="" options={toOptions(venues.docs)} />
          <FilterSelect label="Court" name="courtId" value="" options={toOptions(courts.docs)} />
          <Field label="Status">
            <Select name="status" defaultValue="scheduled">
              <option value="draft">Draft</option>
              <option value="ready_for_scheduling">Ready for scheduling</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold text-ink">
            <input type="checkbox" name="isPublic" className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
            Public schedule
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit">Create match</Button>
          </div>
        </form>
      </Card>

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

      <Card className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Conflict Warnings</CardTitle>
          <span className="text-sm font-extrabold text-ink-soft">{conflicts.length}</span>
        </div>
        <p className="text-xs font-semibold text-ink-soft">
          Warnings only. Nothing is blocked from being scheduled yet. Checked across all matches, not just the current
          filter.
        </p>
        {conflicts.length === 0 ? (
          <EmptyState>No conflicts detected across current matches.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {conflicts.map((conflict: ConflictWarning) => (
              <li
                key={conflict.id}
                className={
                  conflict.severity === 'alert'
                    ? 'flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700'
                    : 'flex items-start gap-2 rounded-card border border-gold/40 bg-mist px-3 py-2 text-sm font-semibold text-ink'
                }
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {conflict.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>Calendar Lanes</CardTitle>
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
                      {lane.matches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between gap-2 rounded-card border border-line bg-paper px-3 py-2 text-xs"
                        >
                          <span className="font-bold text-ink-soft">{formatTimeOnly(match.scheduled_start_at)}</span>
                          <strong className="font-extrabold text-ink">{match.match_number}</strong>
                          <span className="min-w-0 truncate text-right font-semibold text-ink-soft">
                            {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                            {getRelationshipLabel(match.participant_b_entry_id)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>Filter Queue</CardTitle>
        <form className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5" action="/workspaces/scheduler">
          <FilterSelect label="Sport" name="sport" value={sport} options={toOptions(sports.docs)} />
          <FilterSelect label="Category" name="category" value={category} options={toOptions(categories.docs)} />
          <FilterSelect label="Venue" name="venue" value={venue} options={toOptions(venues.docs)} />
          <FilterSelect label="Court" name="court" value={court} options={toOptions(courts.docs)} />
          <FilterSelect label="Status" name="status" value={status} options={statusOptions} />
          <div className="flex gap-2 sm:col-span-3 lg:col-span-5">
            <Button type="submit">Apply</Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/scheduler">Reset</Link>
            </Button>
          </div>
        </form>
      </Card>

      <section className="mb-6 grid gap-4 lg:grid-cols-2" aria-label="Match scheduling queue">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">Unscheduled</h2>
            <span className="text-sm font-extrabold text-ink-soft">{unscheduledMatches.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {unscheduledMatches.length === 0 ? (
              <EmptyState>No unscheduled matches match these filters.</EmptyState>
            ) : (
              unscheduledMatches.map((match) => <MatchCard key={match.id} match={match} detailsHref={null} />)
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-ink">Scheduled</h2>
            <span className="text-sm font-extrabold text-ink-soft">{scheduledMatches.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {scheduledMatches.length === 0 ? (
              <EmptyState>No scheduled matches match these filters.</EmptyState>
            ) : (
              scheduledMatches.map((match) => <MatchCard key={match.id} match={match} detailsHref={null} />)
            )}
          </div>
        </div>
      </section>

      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Reschedule Match</CardTitle>
          <p className="text-xs font-semibold text-ink-soft">
            Only draft, ready-for-scheduling, and scheduled matches may be changed here.
          </p>
        </div>
        <form action={rescheduleMatchAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            label="Match"
            name="matchNumber"
            value=""
            options={queueMatches.map((match) => ({ id: match.match_number, label: match.match_number }))}
          />
          <Field label="New start">
            <Input name="scheduledStart" type="datetime-local" required />
          </Field>
          <Field label="New end">
            <Input name="scheduledEnd" type="datetime-local" required />
          </Field>
          <FilterSelect label="Venue" name="venueId" value="" options={toOptions(venues.docs)} />
          <FilterSelect label="Court" name="courtId" value="" options={toOptions(courts.docs)} />
          <Field label="Reason">
            <Input name="reason" required />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit">Confirm reschedule</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
