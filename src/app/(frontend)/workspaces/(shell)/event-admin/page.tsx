import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { getActiveEvent } from '../../activeEvent'
import { PageHero, StatBlock, StatGrid, formatDateTime } from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'

export const dynamic = 'force-dynamic'

type EventDoc = {
  id: string | number
  name?: string
  status?: string
  visibility?: string
  event_start_at?: string
  event_end_at?: string
  public_open_at?: string
  location?: string
}

const readinessLabels = [
  'Event information',
  'Sports',
  'Competition categories',
  'Rulesets',
  'Clubs',
  'Players',
  'Teams',
  'Entries',
  'Venues',
  'Courts',
  'Matches',
]

export default async function EventAdminWorkspacePage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin',
    workspaceName: 'Event Admin Workspace',
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
  const event = (await getActiveEvent(payload)) as EventDoc | null
  const eventWhere = event ? { event_id: { equals: event.id } } : undefined
  const [sports, categories, rulesets, clubs, players, teams, entries, venues, courts, matches] =
    await Promise.all([
      payload.find({ collection: 'sports', limit: 1, where: eventWhere }),
      payload.find({ collection: 'competition-categories', limit: 1, where: eventWhere }),
      payload.find({ collection: 'rulesets', limit: 1, where: eventWhere }),
      payload.find({ collection: 'clubs', limit: 1, where: eventWhere }),
      payload.find({ collection: 'players', limit: 1, where: eventWhere }),
      payload.find({ collection: 'teams', limit: 1, where: eventWhere }),
      payload.find({ collection: 'competition-entries', limit: 1, where: eventWhere }),
      payload.find({ collection: 'venues', limit: 1, where: eventWhere }),
      payload.find({ collection: 'courts', limit: 1, where: eventWhere }),
      payload.find({ collection: 'matches', limit: 1, where: eventWhere }),
    ])

  const readiness = [
    Boolean(event),
    sports.totalDocs > 0,
    categories.totalDocs > 0,
    rulesets.totalDocs > 0,
    clubs.totalDocs > 0,
    players.totalDocs > 0,
    teams.totalDocs > 0,
    entries.totalDocs > 0,
    venues.totalDocs > 0,
    courts.totalDocs > 0,
    matches.totalDocs > 0,
  ]
  const completedCount = readiness.filter(Boolean).length

  return (
    <>
      <PageHero
        eyebrow="Event Admin Workspace"
        title={event?.name || 'Event Setup'}
        summary="Setup progress for the active event structure. Use Payload Admin as the backoffice editor while this workspace grows into the committee setup cockpit."
        actions={
          <>
            <Button asChild>
              <Link href="/workspaces/event-admin/new-event">Create New Event</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/workspaces/event-admin/details">Manage Event</Link>
            </Button>
            {event ? (
              <>
                <Button asChild variant="secondary">
                  <Link href={`/workspaces/event-admin/new-event?eventId=${event.id}&step=sports`}>
                    Sports
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/workspaces/event-admin/new-event?eventId=${event.id}&step=categories`}>
                    Categories
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <Card className="mb-6 flex flex-col gap-3">
        <CardTitle>Guided setup</CardTitle>
        <p className="text-sm text-ink-soft">
          Routine clubs, facilities, and competition entries can be managed here without Advanced
          Data Administration.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/workspaces/event-admin/clubs">Manage Clubs</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/workspaces/event-admin/facilities">Manage Facilities</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/workspaces/event-admin/participants">Manage Participants</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/workspaces/event-admin/entries">Manage Entries</Link>
          </Button>
        </div>
      </Card>

      <StatGrid>
        <StatBlock label="Readiness" value={`${completedCount}/${readiness.length}`} tone="good" />
        <StatBlock label="Sports" value={sports.totalDocs} />
        <StatBlock label="Categories" value={categories.totalDocs} />
        <StatBlock label="Matches" value={matches.totalDocs} />
      </StatGrid>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>Readiness Checklist</CardTitle>
          <div className="grid gap-1.5">
            {readinessLabels.map((label, index) => (
              <div key={label} className="flex items-center gap-2 text-sm font-semibold text-ink">
                {readiness[index] ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-ink-soft/50" aria-hidden="true" />
                )}
                {label}
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <CardTitle>Event Window</CardTitle>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Status</dt>
              <dd className="font-semibold text-ink">{event?.status?.replaceAll('_', ' ') || 'not set'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Visibility</dt>
              <dd className="font-semibold text-ink">
                {event?.visibility?.replaceAll('_', ' ') || 'not set'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Starts</dt>
              <dd className="font-semibold text-ink">{formatDateTime(event?.event_start_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Public opens</dt>
              <dd className="font-semibold text-ink">{formatDateTime(event?.public_open_at)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Location</dt>
              <dd className="font-semibold text-ink">{event?.location || 'not set'}</dd>
            </div>
          </dl>
        </Card>
      </section>
    </>
  )
}
