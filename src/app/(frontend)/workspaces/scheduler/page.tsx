import type { Where } from 'payload'
import { getPayload } from 'payload'

import config from '@payload-config'
import {
  MatchCard,
  StatBlock,
  WorkspaceMatch,
  WorkspaceNav,
  WorkspaceOption,
  formatDateLabel,
  formatTimeOnly,
  getDateKey,
  getRelationshipLabel,
  toOptions,
} from '../workspaceComponents'
import { ConflictWarning, detectScheduleConflicts } from './conflicts'

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
  <label>
    <span>{label}</span>
    <select name={name} defaultValue={value}>
      <option value="">All</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
)

export default async function SchedulerWorkspacePage({
  searchParams,
}: {
  searchParams?: SchedulerSearchParams
}) {
  const params = searchParams ? await searchParams : {}
  const sport = getParam(params, 'sport')
  const category = getParam(params, 'category')
  const venue = getParam(params, 'venue')
  const court = getParam(params, 'court')
  const status = getParam(params, 'status')
  const payload = await getPayload({ config })
  const filterClauses: Where[] = []

  if (sport) filterClauses.push({ sport_id: { equals: sport } })
  if (category) filterClauses.push({ category_id: { equals: category } })
  if (venue) filterClauses.push({ venue_id: { equals: venue } })
  if (court) filterClauses.push({ court_id: { equals: court } })
  if (status) filterClauses.push({ status: { equals: status } })

  const where = filterClauses.length > 0 ? { and: filterClauses } : undefined
  const [matches, sports, categories, venues, courts, allMatches] = await Promise.all([
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 100,
      sort: 'scheduled_start_at',
      where,
    }),
    payload.find({ collection: 'sports', limit: 100, sort: 'name' }),
    payload.find({ collection: 'competition-categories', limit: 100, sort: 'name' }),
    payload.find({ collection: 'venues', limit: 100, sort: 'name' }),
    payload.find({ collection: 'courts', limit: 100, sort: 'name' }),
    payload.find({
      collection: 'matches',
      depth: 2,
      limit: 300,
      sort: 'scheduled_start_at',
    }),
  ])

  const queueMatches = matches.docs as WorkspaceMatch[]
  const unscheduledMatches = queueMatches.filter((match) => !match.scheduled_start_at)
  const scheduledMatches = queueMatches.filter((match) => Boolean(match.scheduled_start_at))
  const statusOptions = Array.from(new Set(queueMatches.map((match) => match.status))).map(
    (matchStatus) => ({
      id: matchStatus,
      label: matchStatus.replaceAll('_', ' '),
    }),
  )

  const conflicts = detectScheduleConflicts(allMatches.docs as WorkspaceMatch[])
  const alertConflicts = conflicts.filter((conflict) => conflict.severity === 'alert')

  const dayKeys = Array.from(
    new Set(
      scheduledMatches
        .map((match) => getDateKey(match.scheduled_start_at))
        .filter((key): key is string => Boolean(key)),
    ),
  ).sort()

  const dayLanes = dayKeys.map((dayKey) => {
    const dayMatches = scheduledMatches.filter(
      (match) => getDateKey(match.scheduled_start_at) === dayKey,
    )
    const laneLabels = Array.from(
      new Set(dayMatches.map((match) => getRelationshipLabel(match.venue_id, 'Unassigned venue'))),
    )

    return {
      dayKey,
      dateLabel: formatDateLabel(dayMatches[0]?.scheduled_start_at),
      lanes: laneLabels.map((label) => ({
        label,
        matches: dayMatches.filter(
          (match) => getRelationshipLabel(match.venue_id, 'Unassigned venue') === label,
        ),
      })),
    }
  })

  return (
    <main className="workspace-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="scheduler-title">
        <p className="eyebrow">Scheduler Workspace</p>
        <h1 id="scheduler-title">Schedule Command Queue</h1>
        <p className="summary">
          A practical queue and calendar lane view for generated unscheduled matches and scheduled
          demo matches. Conflict warnings are informational only for this phase; drag-and-drop
          calendar editing and advanced conflict checks are left for a later phase.
        </p>
        <div className="actions">
          <a href="/admin/collections/matches">Backoffice Matches</a>
          <a href="/schedule">Public Schedule</a>
        </div>
      </section>

      <section className="workspace-stats" aria-label="Scheduler summary">
        <StatBlock label="Visible Matches" value={queueMatches.length} />
        <StatBlock label="Unscheduled" value={unscheduledMatches.length} tone="warn" />
        <StatBlock label="Scheduled" value={scheduledMatches.length} tone="good" />
        <StatBlock
          label="Conflicts"
          value={conflicts.length}
          tone={alertConflicts.length > 0 ? 'alert' : conflicts.length > 0 ? 'warn' : 'good'}
        />
      </section>

      <section className="conflict-panel" aria-label="Conflict warnings">
        <div className="queue-heading">
          <h2>Conflict Warnings</h2>
          <span>{conflicts.length}</span>
        </div>
        <p className="conflict-panel__note">
          Warnings only. Nothing is blocked from being scheduled yet. Checked across all matches,
          not just the current filter.
        </p>
        {conflicts.length === 0 ? (
          <p className="empty-state">No conflicts detected across current matches.</p>
        ) : (
          <ul className="conflict-list">
            {conflicts.map((conflict: ConflictWarning) => (
              <li key={conflict.id} className={`conflict-item conflict-item--${conflict.severity}`}>
                {conflict.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="workspace-panel calendar-lane-panel" aria-label="Calendar lane view">
        <h2>Calendar Lanes</h2>
        {dayLanes.length === 0 ? (
          <p className="empty-state">No scheduled matches yet to display on the calendar.</p>
        ) : (
          dayLanes.map((day) => (
            <div className="calendar-day" key={day.dayKey}>
              <h3>{day.dateLabel}</h3>
              <div className="calendar-lanes">
                {day.lanes.map((lane) => (
                  <div className="calendar-lane" key={lane.label}>
                    <p className="calendar-lane__label">{lane.label}</p>
                    <div className="calendar-lane__items">
                      {lane.matches.map((match) => (
                        <a
                          className="calendar-lane__item"
                          key={match.id}
                          href={`/workspaces/matches/${match.match_number}`}
                        >
                          <span className="calendar-lane__time">
                            {formatTimeOnly(match.scheduled_start_at)}
                          </span>
                          <strong>{match.match_number}</strong>
                          <span>
                            {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                            {getRelationshipLabel(match.participant_b_entry_id)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <form className="filter-bar" action="/workspaces/scheduler">
        <FilterSelect label="Sport" name="sport" value={sport} options={toOptions(sports.docs)} />
        <FilterSelect
          label="Category"
          name="category"
          value={category}
          options={toOptions(categories.docs)}
        />
        <FilterSelect label="Venue" name="venue" value={venue} options={toOptions(venues.docs)} />
        <FilterSelect label="Court" name="court" value={court} options={toOptions(courts.docs)} />
        <FilterSelect label="Status" name="status" value={status} options={statusOptions} />
        <button type="submit">Apply</button>
        <a href="/workspaces/scheduler">Reset</a>
      </form>

      <section className="queue-columns" aria-label="Match scheduling queue">
        <div>
          <div className="queue-heading">
            <h2>Unscheduled</h2>
            <span>{unscheduledMatches.length}</span>
          </div>
          <div className="schedule-list">
            {unscheduledMatches.length === 0 ? (
              <p className="empty-state">No unscheduled matches match these filters.</p>
            ) : (
              unscheduledMatches.map((match) => <MatchCard key={match.id} match={match} />)
            )}
          </div>
        </div>

        <div>
          <div className="queue-heading">
            <h2>Scheduled</h2>
            <span>{scheduledMatches.length}</span>
          </div>
          <div className="schedule-list">
            {scheduledMatches.length === 0 ? (
              <p className="empty-state">No scheduled matches match these filters.</p>
            ) : (
              scheduledMatches.map((match) => <MatchCard key={match.id} match={match} />)
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
