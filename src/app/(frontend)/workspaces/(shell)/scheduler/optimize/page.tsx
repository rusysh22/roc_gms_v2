import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { generateSchedulePlan, type SchedulePlanParams } from '@/lib/scheduleOptimizer'
import { resolveEventTimezone } from '@/lib/timezone'
import { getActiveEvent } from '../../../activeEvent'
import {
  NoActiveEventNotice,
  PageHero,
  StatBlock,
  StatGrid,
  formatDateTime,
  getRelationshipLabel,
} from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { applyOptimizerPlanAction } from './optimizerActions'

export const dynamic = 'force-dynamic'

const DEFAULT_DURATION_MINUTES = 30
const DEFAULT_MIN_REST_MINUTES = 15
const SLOT_STEP_MINUTES = 15

const optimizerErrorMessages: Record<string, string> = {
  invalid_request: 'Nothing was selected to apply.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

const toDateOnly = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '')

const parseMinuteOfDay = (value: string, fallback: number) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return hours * 60 + minutes
}

// MSG-04: values match JS Date#getDay() (0 = Sunday), which is what scheduleOptimizer.ts's
// allowedWeekdays already expects - listed Monday-first here purely for display order.
const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]
const ALL_WEEKDAYS = WEEKDAY_OPTIONS.map((option) => option.value)

export default async function ScheduleOptimizerPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo: '/workspaces/scheduler/optimize',
    workspaceName: 'Cross-Sport Schedule Optimizer',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const payload = access.payload
  const activeEvent = await getActiveEvent(payload)
  const timezone = resolveEventTimezone(activeEvent?.timezone)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Operations"
          title="Cross-Sport Schedule Optimizer"
          summary="Propose venue/court/time assignments for every unscheduled match at once."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const query = searchParams ? await searchParams : {}
  const optimizerError = get(query, 'optimizerError')
  const appliedCount = get(query, 'optimizerApplied')
  const skippedCount = get(query, 'optimizerSkipped')

  const rangeStartDate = get(query, 'rangeStart') || toDateOnly(activeEvent.event_start_at) || toDateOnly(new Date().toISOString())
  const rangeEndDate = get(query, 'rangeEnd') || toDateOnly(activeEvent.event_end_at) || rangeStartDate
  const dailyStart = get(query, 'dailyStart') || '08:00'
  const dailyEnd = get(query, 'dailyEnd') || '18:00'

  // MSG-04: a plain GET form can't distinguish "every weekday checkbox was unchecked and
  // submitted" from "the page just loaded and the weekday param was never in the URL at all" -
  // both look like an absent `weekday` param. The always-present `weekdaySubmitted` marker
  // resolves that: only trust an empty selection once we know the form was actually submitted.
  const weekdaySubmitted = get(query, 'weekdaySubmitted') === '1'
  const rawWeekdayValues = query.weekday
  const submittedWeekdays = (Array.isArray(rawWeekdayValues) ? rawWeekdayValues : rawWeekdayValues ? [rawWeekdayValues] : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  const selectedWeekdays = weekdaySubmitted ? submittedWeekdays : ALL_WEEKDAYS

  const params: SchedulePlanParams = {
    rangeStartDate,
    rangeEndDate,
    dailyStartMinute: parseMinuteOfDay(dailyStart, 8 * 60),
    dailyEndMinute: parseMinuteOfDay(dailyEnd, 18 * 60),
    slotStepMinutes: SLOT_STEP_MINUTES,
    defaultDurationMinutes: DEFAULT_DURATION_MINUTES,
    defaultMinRestMinutes: DEFAULT_MIN_REST_MINUTES,
    allowedWeekdays: selectedWeekdays,
  }

  const validRange =
    Boolean(rangeStartDate) &&
    Boolean(rangeEndDate) &&
    rangeStartDate <= rangeEndDate &&
    params.dailyStartMinute < params.dailyEndMinute &&
    selectedWeekdays.length > 0

  const [plan, venuesResult, courtsResult] = await Promise.all([
    validRange
      ? generateSchedulePlan(payload, { eventId: activeEvent.id, params })
      : Promise.resolve({ assignments: [], unplaced: [] }),
    payload.find({ collection: 'venues', depth: 0, limit: 200, where: { event_id: { equals: activeEvent.id } } }),
    payload.find({ collection: 'courts', depth: 0, limit: 200, where: { event_id: { equals: activeEvent.id } } }),
  ])
  const venueLabelById = new Map(venuesResult.docs.map((venue) => [String(venue.id), String(venue.name)]))
  const courtLabelById = new Map(courtsResult.docs.map((court) => [String(court.id), String(court.name)]))

  const featuredPlacedCount = plan.assignments.filter((assignment) => assignment.isFeatured).length

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Cross-Sport Schedule Optimizer"
        summary="Proposes venue/court/time assignments for every currently-unscheduled match at once - rest time between matches for the same person (even across sports), venue/court availability, and broadcast priority all considered. Nothing is written until you apply it below."
      />

      {optimizerError && optimizerErrorMessages[optimizerError] ? (
        <AlertBanner tone="error" className="mb-4">
          {optimizerErrorMessages[optimizerError]}
        </AlertBanner>
      ) : null}
      {appliedCount ? (
        <AlertBanner tone="success" className="mb-4">
          Applied {appliedCount} match{appliedCount === '1' ? '' : 'es'}.
          {skippedCount && Number(skippedCount) > 0
            ? ` ${skippedCount} were skipped because something changed since this proposal was generated (re-run the optimizer to see why).`
            : ''}
        </AlertBanner>
      ) : null}

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>Proposal window</CardTitle>
        <form method="get" className="grid gap-4 sm:grid-cols-4">
          <input type="hidden" name="weekdaySubmitted" value="1" />
          <Field label="From date">
            <Input type="date" name="rangeStart" defaultValue={rangeStartDate} required />
          </Field>
          <Field label="To date">
            <Input type="date" name="rangeEnd" defaultValue={rangeEndDate} required />
          </Field>
          <Field label="Daily start time">
            <Input type="time" name="dailyStart" defaultValue={dailyStart} required />
          </Field>
          <Field label="Daily end time">
            <Input type="time" name="dailyEnd" defaultValue={dailyEnd} required />
          </Field>
          <fieldset className="sm:col-span-4">
            <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">Active days</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAY_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    name="weekday"
                    value={option.value}
                    defaultChecked={selectedWeekdays.includes(option.value)}
                    className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-4">
            <SubmitButton>Generate proposal</SubmitButton>
          </div>
        </form>
        {!validRange && selectedWeekdays.length === 0 ? (
          <p className="text-sm font-semibold text-gold">Select at least one active day.</p>
        ) : !validRange ? (
          <p className="text-sm font-semibold text-gold">
            Check the dates and hours above - the end must be after the start.
          </p>
        ) : null}
      </Card>

      <StatGrid>
        <StatBlock label="Proposed placements" value={plan.assignments.length} tone="good" />
        <StatBlock label="Featured matches on featured courts" value={featuredPlacedCount} />
        <StatBlock label="Could not be placed" value={plan.unplaced.length} tone={plan.unplaced.length > 0 ? 'warn' : 'default'} />
      </StatGrid>

      {plan.unplaced.length > 0 ? (
        <Card className="mb-6 flex flex-col gap-2">
          <CardTitle>Could not be placed</CardTitle>
          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
            {plan.unplaced.map((item) => (
              <li key={item.matchId}>
                <strong className="text-ink">{item.matchNumber}</strong> - {item.reason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <CardTitle>Proposed placements ({plan.assignments.length})</CardTitle>
        {plan.assignments.length === 0 ? (
          <EmptyState>
            No unscheduled matches could be placed in this window - generate a proposal above, or add more
            courts/venues.
          </EmptyState>
        ) : (
          <form action={applyOptimizerPlanAction} className="flex flex-col gap-4">
            <input type="hidden" name="count" value={plan.assignments.length} />
            <div className="overflow-x-auto">
              <Table caption="Proposed schedule placements">
                <TableHeader>
                  <TableRow>
                    <TableHead>Apply</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Court</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.assignments.map((assignment, index) => (
                    <TableRow key={`${assignment.matchId}-${index}`}>
                      <TableCell>
                        <input type="checkbox" name={`apply_${index}`} defaultChecked className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
                        <input type="hidden" name={`matchId_${index}`} value={assignment.matchId} />
                        <input type="hidden" name={`venueId_${index}`} value={assignment.venueId} />
                        <input type="hidden" name={`courtId_${index}`} value={assignment.courtId} />
                        <input type="hidden" name={`start_${index}`} value={assignment.startAt} />
                        <input type="hidden" name={`end_${index}`} value={assignment.endAt} />
                      </TableCell>
                      <TableCell className="font-bold">
                        {assignment.matchNumber}
                        {assignment.isFeatured ? <span className="ml-2 text-xs font-bold text-gold">Featured</span> : null}
                      </TableCell>
                      <TableCell>{formatDateTime(assignment.startAt, timezone)}</TableCell>
                      <TableCell>{formatDateTime(assignment.endAt, timezone)}</TableCell>
                      <TableCell>{venueLabelById.get(String(assignment.venueId)) || getRelationshipLabel(undefined)}</TableCell>
                      <TableCell>{courtLabelById.get(String(assignment.courtId)) || getRelationshipLabel(undefined)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <SubmitButton className="self-start">Apply selected placements</SubmitButton>
          </form>
        )}
      </Card>
    </>
  )
}
