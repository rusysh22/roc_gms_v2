import Link from 'next/link'
import { ArrowRight, CalendarClock, CheckCircle2, Circle, MapPinned, Trophy } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { computeWizardProgress } from '@/lib/wizardProgress'
import { ResumeSetupLink } from './ResumeSetupLink'
import { getActiveEvent } from '../../activeEvent'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  PageHero,
  StatBlock,
  StatGrid,
  formatDateTime,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../workspaceComponents'
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
  timezone?: string | null
}

type NextMatchDoc = {
  id: string | number
  match_number: string
  scheduled_start_at?: string | null
  participant_a_entry_id?: RelationshipDoc | string | number | null
  participant_b_entry_id?: RelationshipDoc | string | number | null
}

// Mirrors the Match Officer workspace's own "match-day" definition
// (src/app/(frontend)/workspaces/(shell)/match-officer/page.tsx) so the two pages agree on what
// counts as "next up" for the score-update shortcut below.
const MATCH_DAY_STATUSES = ['published', 'scheduled', 'check_in_open', 'ready_to_start', 'ongoing']

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function EventAdminWorkspacePage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const discarded = Array.isArray(params.eventDiscarded) ? params.eventDiscarded[0] : params.eventDiscarded
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
  const timezone = resolveEventTimezone(event?.timezone)
  // DR-2 (prd/redesign/import-data-and-draft-persistence.md): give a returning organizer one
  // unmistakable way back into a half-finished wizard, landing them on the first step still
  // outstanding rather than at the top.
  const wizardProgress = event ? await computeWizardProgress(payload, event.id) : null
  const setupInProgress = Boolean(wizardProgress && !wizardProgress.isComplete)
  // A where clause guaranteed to match nothing when there's no active event yet - otherwise an
  // unscoped `where: undefined` below would silently count every event's data, not zero.
  const eventWhere = event ? { event_id: { equals: event.id } } : { event_id: { equals: -1 } }

  const [sports, categories, rulesets, clubs, players, teams, entries, venues, courts, matches, unscheduled, nextMatch] =
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
      payload.find({
        collection: 'matches',
        limit: 1,
        where: { and: [eventWhere, { scheduled_start_at: { exists: false } }] },
      }),
      payload.find({
        collection: 'matches',
        depth: 1,
        limit: 1,
        sort: 'scheduled_start_at',
        where: {
          and: [eventWhere, { scheduled_start_at: { exists: true } }, { status: { in: MATCH_DAY_STATUSES } }],
        },
      }),
    ])

  const nextMatchDoc = nextMatch.docs[0] as NextMatchDoc | undefined

  // Replaces the old separate "Guided setup" button row + "Readiness Checklist" list (two
  // redundant blocks showing the same information twice) with one list that is both the status
  // indicator and the action - fewer disconnected buttons on screen, same information.
  const setupTasks = [
    { label: 'Event details', done: Boolean(event), href: '/workspaces/event-admin/details' },
    {
      label: 'Sports & rulesets',
      done: sports.totalDocs > 0 || rulesets.totalDocs > 0,
      href: event
        ? `/workspaces/event-admin/new-event?eventId=${event.id}&step=sports`
        : '/workspaces/event-admin/new-event',
    },
    {
      label: 'Competition categories',
      done: categories.totalDocs > 0,
      href: event
        ? `/workspaces/event-admin/new-event?eventId=${event.id}&step=categories`
        : '/workspaces/event-admin/new-event',
    },
    { label: 'Clubs', done: clubs.totalDocs > 0, href: '/workspaces/event-admin/clubs' },
    {
      label: 'Players & teams',
      done: players.totalDocs > 0 || teams.totalDocs > 0,
      href: '/workspaces/event-admin/participants',
    },
    { label: 'Competition entries', done: entries.totalDocs > 0, href: '/workspaces/event-admin/entries' },
    {
      label: 'Venues & courts',
      done: venues.totalDocs > 0 && courts.totalDocs > 0,
      href: '/workspaces/event-admin/facilities',
    },
    {
      label: 'Matches generated',
      done: matches.totalDocs > 0,
      href: event
        ? `/workspaces/event-admin/new-event?eventId=${event.id}&step=generate`
        : '/workspaces/event-admin/new-event',
    },
  ]
  const completedCount = setupTasks.filter((task) => task.done).length

  return (
    <>
      <PageHero
        eyebrow="Event Admin Workspace"
        title={event?.name || 'Set up your first event'}
        summary={
          event
            ? 'Everything below reflects the active event (switch events any time from the sidebar).'
            : 'Create an event to unlock sports, registration, scheduling, and scoring.'
        }
        actions={
          <>
            {setupInProgress && event ? (
              <ResumeSetupLink
                eventId={event.id}
                defaultStep={wizardProgress!.firstIncompleteStep}
                label="Resume Setup"
              />
            ) : (
              <Button asChild>
                <Link href="/workspaces/event-admin/new-event">
                  {event ? 'Create Another Event' : 'Create New Event'}
                </Link>
              </Button>
            )}
            {event ? (
              <Button asChild variant="secondary">
                <Link href="/workspaces/event-admin/details">Edit Event Details</Link>
              </Button>
            ) : null}
          </>
        }
      />

      {discarded === 'deleted' || discarded === 'archived' ? (
        <AlertBanner tone="success" className="mb-4">
          {discarded === 'deleted'
            ? 'Event deleted. It had no setup data, so it was removed permanently.'
            : 'Event archived. It is hidden from the switcher and the public site but can be restored from Payload admin.'}
        </AlertBanner>
      ) : null}

      {setupInProgress && event ? (
        <Card className="mb-6 flex flex-col gap-3 border-blue/30 bg-mist sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Setup in progress</CardTitle>
            <p className="text-sm text-ink-soft">
              {wizardProgress!.completedTaskCount} of {wizardProgress!.totalTaskCount} setup steps done. Pick up where
              you left off &mdash; nothing you have entered is lost.
            </p>
          </div>
          <ResumeSetupLink
            eventId={event.id}
            defaultStep={wizardProgress!.firstIncompleteStep}
            label="Resume Setup"
            className="shrink-0"
          />
        </Card>
      ) : null}

      <StatGrid>
        <StatBlock label="Setup readiness" value={`${completedCount}/${setupTasks.length}`} tone="good" />
        <StatBlock label="Sports" value={sports.totalDocs} />
        <StatBlock label="Categories" value={categories.totalDocs} />
        <StatBlock label="Matches" value={matches.totalDocs} />
      </StatGrid>

      <Card className="mb-6 flex flex-col gap-3">
        <div>
          <CardTitle>Today&apos;s operations</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            The three things that change on every match day - jump straight in.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/workspaces/match-officer"
            className="flex flex-col gap-1 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <Trophy className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
              Update score
            </span>
            <span className="text-xs font-semibold text-ink-soft">
              {nextMatchDoc
                ? `Next: ${getRelationshipLabel(nextMatchDoc.participant_a_entry_id)} vs ${getRelationshipLabel(
                    nextMatchDoc.participant_b_entry_id,
                  )} · ${formatDateTime(nextMatchDoc.scheduled_start_at, timezone)}`
                : 'No match-day matches queued yet.'}
            </span>
          </Link>
          <Link
            href="/workspaces/scheduler"
            className="flex flex-col gap-1 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <CalendarClock className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
              Update schedule
            </span>
            <span className="text-xs font-semibold text-ink-soft">
              {unscheduled.totalDocs > 0
                ? `${unscheduled.totalDocs} match(es) still need a time & court.`
                : 'All generated matches are scheduled.'}
            </span>
          </Link>
          <Link
            href="/workspaces/event-admin/facilities"
            className="flex flex-col gap-1 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <MapPinned className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
              Update venue
            </span>
            <span className="text-xs font-semibold text-ink-soft">
              {venues.totalDocs} venue(s), {courts.totalDocs} court(s) configured.
            </span>
          </Link>
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardTitle>Setup checklist</CardTitle>
          <div className="grid gap-1">
            {setupTasks.map((task) => (
              <Link
                key={task.label}
                href={task.href}
                className="flex items-center justify-between gap-2 rounded-card px-2 py-1.5 no-underline transition-colors hover:bg-mist"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {task.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-ink-soft/50" aria-hidden="true" />
                  )}
                  {task.label}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-soft/60" aria-hidden="true" />
              </Link>
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
              <dd className="font-semibold text-ink">{formatDateTime(event?.event_start_at, timezone)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Public opens</dt>
              <dd className="font-semibold text-ink">{formatDateTime(event?.public_open_at, timezone)}</dd>
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
