import type { Where } from 'payload'
import { getPayload } from 'payload'

import config from '@payload-config'
import {
  MatchCard,
  StatBlock,
  WorkspaceMatch,
  WorkspaceNav,
  WorkspaceOption,
  toOptions,
} from '../workspaceComponents'

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
  const [matches, sports, categories, venues, courts] = await Promise.all([
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

  return (
    <main className="workspace-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="scheduler-title">
        <p className="eyebrow">Scheduler Workspace</p>
        <h1 id="scheduler-title">Schedule Command Queue</h1>
        <p className="summary">
          A practical queue for generated unscheduled matches and scheduled demo matches. Calendar
          drag-and-drop and advanced conflict checks are intentionally left for a later phase.
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
        <StatBlock label="Filters" value={filterClauses.length} />
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
