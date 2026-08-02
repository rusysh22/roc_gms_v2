import Link from 'next/link'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { buildSingleEliminationBracketLayout } from '@/lib/brackets'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { BracketTree } from '../../../../brackets/bracketTree'
import {
  getRelationshipId,
  getRelationshipLabel,
  toOptions,
  type RelationshipDoc,
} from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { FocusHeader } from '../../FocusHeader'
import { EventNameSlugFields } from './EventNameSlugFields'
import { SummaryDetailModal, type SummaryDetailItem } from './SummaryDetailModal'
import { createEventAction } from './eventActions'
import { AUTO_GENERATE_FORMATS } from './wizardShared'
import { addRulesetAction, addSportAction } from './sportActions'
import { addCategoryAction, updateCategoryStatusAction } from './categoryActions'
import {
  addClubAction,
  addPlayerAction,
  addTeamAction,
  importParticipantsAction,
} from './participantActions'
import { addEntryAction, saveSeedOrderAction, shuffleSeedsAction } from './entriesSeedActions'
import { generateMatchesAction } from './generateActions'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

const STEPS = [
  { key: 'event', label: 'Event' },
  { key: 'sports', label: 'Sports & Rulesets' },
  { key: 'categories', label: 'Categories' },
  { key: 'participants', label: 'Clubs / Teams / Players' },
  { key: 'entries', label: 'Entries & Seeding' },
  { key: 'generate', label: 'Generate Matches' },
  { key: 'bracket', label: 'Bracket' },
] as const

const errorMessages: Record<string, string> = {
  invalid_event: 'Fill in the event name, start, and end fields.',
  invalid_date_range: 'Event end time must be after the start time (they cannot be the same).',
  invalid_logo: 'That logo file is not an image. Upload a JPG, PNG, or WebP.',
  duplicate_slug: 'That slug is already used. Try a different name or slug.',
  missing_event: 'Start by creating the event first.',
  invalid_sport: 'Fill in a valid sport name and type.',
  invalid_ruleset: 'Fill in a valid ruleset name and score type.',
  invalid_relationship: 'The selected item does not belong to this event.',
  invalid_category: 'Fill in the required category fields.',
  invalid_category_status: 'Choose a valid category status.',
  invalid_club: 'Fill in a valid club name.',
  invalid_team: 'Fill in a valid team name.',
  invalid_player: 'Fill in a valid player name.',
  invalid_entry: 'Choose a category and a participant to add.',
  duplicate_entry: 'That participant is already entered in this category.',
  invalid_import_file: 'Upload a valid .xlsx file exported from the template.',
  empty_import: 'That file has no rows in its Clubs, Teams, or Players sheets.',
  not_enough_entries: 'Add at least two confirmed entries before generating matches.',
  unsupported_format:
    'This category format is not supported by auto-generation yet. Use the Scheduler workspace to create matches manually.',
}

// Wizard progress, redesigned as: a plain-language status line ("Step 3 of 7") that works on its
// own on narrow screens, a slim animated bar under it for an at-a-glance sense of how much is
// left, and - lg and up, where there's room - the full connected-circle stepper with every step
// name spelled out. All three describe the same state.
//
// `completedSteps` reflects real data (a sport/category/participant/entry/match actually exists),
// not just "you've passed this step's URL" - the previous `index < currentIndex` check marked
// every earlier step "done" even if the user jumped ahead via the URL before filling it in, which
// misrepresented progress. The current step always keeps its distinct active/outline treatment
// regardless of whether its data already exists.
const StepProgress = ({
  eventId,
  current,
  completedSteps,
}: {
  eventId: string
  current: string
  completedSteps: Set<string>
}) => {
  const currentIndex = STEPS.findIndex((step) => step.key === current)
  const completedCount = STEPS.filter((step) => completedSteps.has(step.key)).length
  const percent = Math.round((completedCount / STEPS.length) * 100)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-ink-soft">
        <span>
          Step {currentIndex + 1} of {STEPS.length}
          <span className="text-ink-soft/60"> · </span>
          {STEPS[currentIndex]?.label}
        </span>
        <span className="tabular-nums">{percent}% complete</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Wizard progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-mist"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="hidden items-start lg:flex" aria-label="Wizard steps">
        {STEPS.map((step, index) => {
          const reachable = index === 0 || Boolean(eventId)
          const active = index === currentIndex
          const done = completedSteps.has(step.key) && !active
          const href = `/workspaces/event-admin/new-event?${eventId ? `eventId=${eventId}&` : ''}step=${step.key}`
          const pill = (
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-colors',
                done && 'bg-green text-paper',
                active && 'border-2 border-green bg-paper text-green',
                !done && !active && 'bg-mist text-ink-soft',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
            </span>
          )
          return (
            <li key={step.key} className={cn('flex items-center', index < STEPS.length - 1 && 'flex-1')}>
              {reachable ? (
                <Link
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-1 no-underline',
                    active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {pill}
                  <span className="max-w-20 text-center text-[11px] font-bold leading-tight">
                    {step.label}
                  </span>
                </Link>
              ) : (
                <span className="flex flex-col items-center gap-1 text-ink-soft/50">
                  {pill}
                  <span className="max-w-20 text-center text-[11px] font-bold leading-tight">
                    {step.label}
                  </span>
                </span>
              )}
              {index < STEPS.length - 1 ? (
                <div className={cn('mx-2 mt-3.5 h-0.5 flex-1 rounded-full', done ? 'bg-green' : 'bg-line')} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default async function NewEventWizardPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin/new-event',
    workspaceName: 'New Event Wizard',
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
  const params = searchParams ? await searchParams : {}
  const eventId = get(params, 'eventId')
  const step = get(params, 'step') || (eventId ? 'sports' : 'event')
  const wizardError = get(params, 'wizardError')
  const wizardUpdated = get(params, 'wizardUpdated')

  const event = eventId
    ? await payload.findByID({ collection: 'events', id: eventId, depth: 1 }).catch(() => null)
    : null
  if (eventId && !event) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertBanner tone="error">Event not found. Start over.</AlertBanner>
        <Button asChild>
          <Link href="/workspaces/event-admin/new-event">Start a new event</Link>
        </Button>
      </main>
    )
  }

  const eventLogo =
    event?.logo && typeof event.logo === 'object' ? (event.logo as { url?: string; alt?: string }) : undefined

  const completedSteps = new Set<string>()
  if (event) {
    completedSteps.add('event')
    const [sportsCount, categoriesCount, clubsCount, teamsCount, playersCount, confirmedCount, matchesCount] =
      await Promise.all([
        payload.count({ collection: 'sports', where: { event_id: { equals: eventId } } }),
        payload.count({ collection: 'competition-categories', where: { event_id: { equals: eventId } } }),
        payload.count({ collection: 'clubs', where: { event_id: { equals: eventId } } }),
        payload.count({ collection: 'teams', where: { event_id: { equals: eventId } } }),
        payload.count({ collection: 'players', where: { event_id: { equals: eventId } } }),
        payload.count({
          collection: 'competition-entries',
          where: { and: [{ event_id: { equals: eventId } }, { status: { equals: 'confirmed' } }] },
        }),
        payload.count({ collection: 'matches', where: { event_id: { equals: eventId } } }),
      ])
    if (sportsCount.totalDocs > 0) completedSteps.add('sports')
    if (categoriesCount.totalDocs > 0) completedSteps.add('categories')
    if (clubsCount.totalDocs + teamsCount.totalDocs + playersCount.totalDocs > 0) {
      completedSteps.add('participants')
    }
    if (confirmedCount.totalDocs > 0) completedSteps.add('entries')
    if (matchesCount.totalDocs > 0) {
      completedSteps.add('generate')
      completedSteps.add('bracket')
    }
  }

  return (
    <main className="flex min-h-svh flex-col">
      <FocusHeader
        backHref="/workspaces/event-admin"
        backLabel="Event Admin"
        maxWidthClassName="max-w-7xl"
        title={
          eventLogo?.url ? (
            <span className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions */}
              <img
                src={eventLogo.url}
                alt={eventLogo.alt || ''}
                className="h-8 w-8 shrink-0 rounded-full border border-line object-cover"
              />
              {event?.name || 'New Event Wizard'}
            </span>
          ) : (
            event?.name || 'New Event Wizard'
          )
        }
      >
        <StepProgress eventId={eventId} current={step} completedSteps={completedSteps} />
      </FocusHeader>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-4">
          {wizardError && errorMessages[wizardError] ? (
            <AlertBanner tone="error">{errorMessages[wizardError]}</AlertBanner>
          ) : null}
          {wizardUpdated ? <AlertBanner tone="success">Saved.</AlertBanner> : null}

          {step === 'event' ? (
            <EventStep
              defaultName={get(params, 'name')}
              defaultSlug={get(params, 'slug')}
              suggestedSlug={get(params, 'suggestedSlug')}
              defaultStart={get(params, 'eventStart')}
              defaultEnd={get(params, 'eventEnd')}
              defaultLocation={get(params, 'location')}
              defaultOrganizerName={get(params, 'organizerName')}
            />
          ) : null}
          {step === 'sports' && event ? <SportsStep payload={payload} eventId={eventId} /> : null}
          {step === 'categories' && event ? <CategoriesStep payload={payload} eventId={eventId} /> : null}
          {step === 'participants' && event ? (
            <ParticipantsStep
              payload={payload}
              eventId={eventId}
              imported={get(params, 'wizardImported')}
              importSkipped={get(params, 'wizardImportSkipped')}
              importIssues={get(params, 'wizardImportIssues')}
              importMoreIssues={get(params, 'wizardImportMoreIssues')}
            />
          ) : null}
          {step === 'entries' && event ? (
            <EntriesStep payload={payload} eventId={eventId} categoryId={get(params, 'categoryId')} />
          ) : null}
          {step === 'generate' && event ? <GenerateStep payload={payload} eventId={eventId} /> : null}
          {step === 'bracket' && event ? (
            <BracketStep
              payload={payload}
              eventId={eventId}
              eventSlug={String(event.slug || '')}
              categoryId={get(params, 'categoryId')}
              generated={get(params, 'wizardGenerated')}
              failed={get(params, 'wizardGenerateFailed')}
            />
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SummaryPanel payload={payload} eventId={eventId} event={event as SummaryEventDoc | null} />
        </aside>
      </div>
    </main>
  )
}

type SummaryEventDoc = {
  name?: string
  event_start_at?: string
  event_end_at?: string
  location?: string
}

const SUMMARY_PREVIEW_COUNT = 4

const SummarySection = ({
  label,
  modalTitle,
  columnLabel,
  items,
}: {
  label: string
  modalTitle: string
  columnLabel: string
  items: SummaryDetailItem[]
}) => {
  const preview = items.slice(0, SUMMARY_PREVIEW_COUNT)
  return (
    <div className="border-b border-line py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-soft">{label}</span>
        <strong className="text-sm font-extrabold text-ink tabular-nums">{items.length}</strong>
      </div>
      {preview.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {preview.map((item) => (
            <li key={item.id} className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-ink">{item.primary}</span>
              {item.secondary ? (
                <span className="shrink-0 truncate text-xs text-ink-soft">{item.secondary}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-ink-soft">Nothing yet.</p>
      )}
      {items.length > SUMMARY_PREVIEW_COUNT ? (
        <div className="mt-1.5">
          <SummaryDetailModal
            title={modalTitle}
            columnLabel={columnLabel}
            items={items}
            triggerLabel={`View all ${items.length} →`}
          />
        </div>
      ) : null}
    </div>
  )
}

const SummaryPanel = async ({
  payload,
  eventId,
  event,
}: {
  payload: Payload
  eventId: string
  event: SummaryEventDoc | null
}) => {
  if (!eventId || !event) {
    return (
      <Card className="flex flex-col gap-2">
        <CardTitle>Progress</CardTitle>
        <p className="text-sm text-ink-soft">Create the event first to see live progress here.</p>
      </Card>
    )
  }

  const [sports, categories, clubs, teams, players, confirmedEntries, matches] = await Promise.all([
    payload.find({
      collection: 'sports',
      depth: 0,
      limit: 500,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'competition-categories',
      depth: 1,
      limit: 500,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'clubs',
      depth: 0,
      limit: 500,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'teams',
      depth: 1,
      limit: 500,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'players',
      depth: 1,
      limit: 500,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'competition-entries',
      depth: 1,
      limit: 500,
      where: { and: [{ event_id: { equals: eventId } }, { status: { equals: 'confirmed' } }] },
      sort: 'display_name',
    }),
    payload.find({
      collection: 'matches',
      depth: 1,
      limit: 500,
      where: { event_id: { equals: eventId } },
      sort: ['round_name', 'match_number'],
    }),
  ])

  const sportItems: SummaryDetailItem[] = sports.docs.map((sport) => ({
    id: sport.id,
    primary: String(sport.name),
    secondary: String(sport.sport_type || '').replaceAll('_', ' '),
  }))

  const categoryItems: SummaryDetailItem[] = categories.docs.map((category) => ({
    id: category.id,
    primary: String(category.name),
    secondary: `${getRelationshipLabel(category.sport_id as RelationshipDoc)} · ${String(
      category.format_type || '',
    ).replaceAll('_', ' ')}`,
  }))

  const clubItems: SummaryDetailItem[] = clubs.docs.map((club) => ({
    id: club.id,
    primary: String(club.name),
    secondary: (club.contact_person as string) || (club.contact_email as string) || undefined,
  }))

  const teamItems: SummaryDetailItem[] = teams.docs.map((team) => ({
    id: team.id,
    primary: String(team.name),
    secondary: getRelationshipLabel(team.club_id as RelationshipDoc),
  }))

  const playerItems: SummaryDetailItem[] = players.docs.map((player) => ({
    id: player.id,
    primary: String(player.name),
    secondary: getRelationshipLabel(player.club_id as RelationshipDoc),
  }))

  const entryItems: SummaryDetailItem[] = confirmedEntries.docs.map((entry) => ({
    id: entry.id,
    primary: String(entry.display_name),
    secondary: getRelationshipLabel(entry.category_id as RelationshipDoc),
  }))

  const matchItems: SummaryDetailItem[] = matches.docs.map((match) => ({
    id: match.id,
    primary: `${match.match_number}${match.round_name ? ` · ${match.round_name}` : ''}`,
    secondary: `${getRelationshipLabel(match.category_id as RelationshipDoc)} · ${String(
      match.status || '',
    ).replaceAll('_', ' ')}`,
  }))

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Progress</CardTitle>
      <div>
        <p className="truncate text-sm font-extrabold text-ink">{event.name}</p>
        <p className="text-xs font-semibold text-ink-soft">
          {event.event_start_at ? new Date(event.event_start_at).toLocaleDateString() : 'No start date'}
          {event.location ? ` · ${event.location}` : ''}
        </p>
      </div>
      <div className="flex flex-col">
        <SummarySection
          label="Sports"
          modalTitle="Sports in this event"
          columnLabel="Sport"
          items={sportItems}
        />
        <SummarySection
          label="Categories"
          modalTitle="Competition categories"
          columnLabel="Category"
          items={categoryItems}
        />
        <SummarySection label="Clubs" modalTitle="Clubs" columnLabel="Club" items={clubItems} />
        <SummarySection label="Teams" modalTitle="Teams" columnLabel="Team" items={teamItems} />
        <SummarySection label="Players" modalTitle="Players" columnLabel="Player" items={playerItems} />
        <SummarySection
          label="Confirmed entries"
          modalTitle="Confirmed entries"
          columnLabel="Entry"
          items={entryItems}
        />
        <SummarySection
          label="Matches generated"
          modalTitle="Generated matches"
          columnLabel="Match"
          items={matchItems}
        />
      </div>
    </Card>
  )
}

const StepActions = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap justify-end gap-2">{children}</div>
)

const EventStep = ({
  defaultName,
  defaultSlug,
  suggestedSlug,
  defaultStart,
  defaultEnd,
  defaultLocation,
  defaultOrganizerName,
}: {
  defaultName: string
  defaultSlug: string
  suggestedSlug: string
  defaultStart: string
  defaultEnd: string
  defaultLocation: string
  defaultOrganizerName: string
}) => (
  <Card className="flex flex-col gap-4">
    <div>
      <CardTitle>1. Event details</CardTitle>
      <p className="mt-1 text-sm text-ink-soft">
        The basics for your event. You can add sports, categories, and participants next.
      </p>
    </div>
    <form action={createEventAction} className="grid gap-4 sm:grid-cols-2">
      <EventNameSlugFields
        defaultName={defaultName}
        defaultSlug={defaultSlug}
        suggestedSlug={suggestedSlug || undefined}
      />
      <Field label="Start">
        <Input name="eventStart" type="datetime-local" required defaultValue={defaultStart} />
      </Field>
      <Field label="End">
        <Input name="eventEnd" type="datetime-local" required defaultValue={defaultEnd} />
      </Field>
      <Field label="Location">
        <Input name="location" placeholder="e.g. Main Sports Hall" defaultValue={defaultLocation} />
      </Field>
      <Field label="Organizer">
        <Input name="organizerName" placeholder="e.g. HR Committee" defaultValue={defaultOrganizerName} />
      </Field>
      <Field label="Event logo (optional)" className="sm:col-span-2">
        <FileUpload
          id="event-logo-upload"
          name="logo"
          accept="image/*"
          maxSizeBytes={5 * 1024 * 1024}
          helpText="Shown next to your event name. You can also add or change this later. Up to 5MB."
        />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">
          Create event &amp; continue
        </SubmitButton>
      </div>
    </form>
  </Card>
)

type Payload = Awaited<ReturnType<typeof requireWorkspaceAccess>> extends { payload: infer P }
  ? P
  : never

const SportsStep = async ({ payload, eventId }: { payload: Payload; eventId: string }) => {
  const [sports, rulesets] = await Promise.all([
    payload.find({ collection: 'sports', depth: 0, limit: 100, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({ collection: 'rulesets', depth: 0, limit: 200, where: { event_id: { equals: eventId } }, sort: 'name' }),
  ])

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardTitle>2. Add a sport</CardTitle>
        <form action={addSportAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="eventId" value={eventId} />
          <Field label="Sport name">
            <Input name="name" required placeholder="Badminton" />
          </Field>
          <details>
            <summary className="cursor-pointer text-xs font-bold text-ink-soft select-none">
              Advanced: custom URL slug
            </summary>
            <div className="mt-2">
              <Field label="Slug">
                <Input name="slug" placeholder="generated-from-name" />
              </Field>
            </div>
          </details>
          <Field label="Sport type" className="sm:col-span-2">
            <Select name="sportType" defaultValue="court">
              <option value="court">Court</option>
              <option value="field">Field</option>
              <option value="table">Table</option>
              <option value="board">Board</option>
              <option value="esport">Esport</option>
              <option value="track">Track</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Add sport</SubmitButton>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-ink">Sports in this event ({sports.totalDocs})</h2>
        {sports.docs.length === 0 ? <EmptyState>No sports added yet.</EmptyState> : null}
        <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto pr-1">
          {sports.docs.map((sport) => (
            <Card key={sport.id} className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-extrabold text-ink">{sport.name}</p>
                <p className="text-xs font-semibold text-ink-soft">
                  Rulesets: {rulesets.docs.filter((r) => String(r.sport_id) === String(sport.id)).length}
                </p>
              </div>
              <form action={addRulesetAction} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="sportId" value={sport.id} />
                <Field label="Ruleset name" className="sm:col-span-2">
                  <Input name="name" required placeholder={`${sport.name} Standard`} />
                </Field>
                <Field label="Score type">
                  <Select name="scoreType" defaultValue="points">
                    <option value="points">Points</option>
                    <option value="goals">Goals</option>
                    <option value="sets">Sets</option>
                    <option value="time">Time</option>
                    <option value="result">Result</option>
                    <option value="custom">Custom</option>
                  </Select>
                </Field>
                <Field label="Best of">
                  <Input name="bestOf" type="number" min="1" />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input name="setBased" type="checkbox" className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
                  Set based
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input name="allowDraw" type="checkbox" className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
                  Allow draw
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton variant="secondary">
                    Add ruleset
                  </SubmitButton>
                </div>
              </form>
            </Card>
          ))}
        </div>
      </div>

      <StepActions>
        <Button asChild>
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=categories`}>
            Continue to Categories
          </Link>
        </Button>
      </StepActions>
    </>
  )
}

const categoryStatusTone = (status: string): 'green' | 'blue' | 'gold' | 'neutral' => {
  if (status === 'published') return 'green'
  if (status === 'open' || status === 'locked') return 'blue'
  return 'neutral'
}

const CategoriesStep = async ({ payload, eventId }: { payload: Payload; eventId: string }) => {
  const [sports, categories, rulesets] = await Promise.all([
    payload.find({ collection: 'sports', depth: 0, limit: 100, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({
      collection: 'competition-categories',
      depth: 1,
      limit: 200,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({ collection: 'rulesets', depth: 0, limit: 200, where: { event_id: { equals: eventId } }, sort: 'name' }),
  ])

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardTitle>3. Add a competition category</CardTitle>
        {sports.docs.length === 0 ? (
          <EmptyState>Add at least one sport first.</EmptyState>
        ) : (
          <form action={addCategoryAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="eventId" value={eventId} />
            <Field label="Sport" className="sm:col-span-2">
              <SearchableSelect
                name="sportId"
                placeholder="Select sport"
                options={toOptions(sports.docs).map((sport) => ({ value: sport.id, label: sport.label }))}
              />
            </Field>
            <Field label="Category name">
              <Input name="name" required placeholder="Men's Singles" />
            </Field>
            <details>
              <summary className="cursor-pointer text-xs font-bold text-ink-soft select-none">
                Advanced: custom URL slug
              </summary>
              <div className="mt-2">
                <Field label="Slug">
                  <Input name="slug" placeholder="generated-from-name" />
                </Field>
              </div>
            </details>
            <Field label="Participant mode">
              <Select name="participantMode" defaultValue="team">
                <option value="individual">Individual</option>
                <option value="pair">Pair</option>
                <option value="team">Team</option>
                <option value="club">Club</option>
                <option value="open">Open</option>
                <option value="tbd">TBD</option>
              </Select>
            </Field>
            <Field label="Format">
              <Select name="formatType" defaultValue="single_elimination">
                <optgroup label="Auto-generates matches in step 6">
                  <option value="single_elimination">Single Elimination</option>
                  <option value="round_robin">Round Robin</option>
                </optgroup>
                <optgroup label="Manual scheduling only (Scheduler workspace)">
                  <option value="double_elimination">Double Elimination</option>
                  <option value="group_stage_to_knockout">Group Stage to Knockout</option>
                  <option value="league">League</option>
                  <option value="friendly">Friendly</option>
                  <option value="time_trial">Time Trial</option>
                  <option value="score_ranking">Score Ranking</option>
                </optgroup>
              </Select>
            </Field>
            <Field label="Ruleset (optional)" className="sm:col-span-2">
              <Select name="rulesetId">
                <option value="">None</option>
                {sports.docs.map((sport) => {
                  const sportRulesets = rulesets.docs.filter(
                    (ruleset) => String(ruleset.sport_id) === String(sport.id),
                  )
                  if (sportRulesets.length === 0) return null
                  return (
                    <optgroup label={String(sport.name)} key={sport.id}>
                      {sportRulesets.map((ruleset) => (
                        <option key={ruleset.id} value={ruleset.id}>
                          {ruleset.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink sm:col-span-2">
              <input
                name="rosterRequired"
                type="checkbox"
                className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
              />
              Roster required
            </label>
            <Field label="Min roster size">
              <Input name="minRosterSize" type="number" min="0" />
            </Field>
            <Field label="Max roster size">
              <Input name="maxRosterSize" type="number" min="0" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Add category</SubmitButton>
            </div>
          </form>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Categories in this event ({categories.totalDocs})</CardTitle>
        <p className="text-xs font-semibold text-ink-soft">
          New categories start as Draft and are not visible on the public site. Set a category to
          Open, Locked, or Published once it's ready to show up there.
        </p>
        {categories.docs.length === 0 ? (
          <EmptyState>No categories added yet.</EmptyState>
        ) : (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {categories.docs.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-card border border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-ink">{category.name}</strong>
                    <StatusBadge tone={categoryStatusTone(String(category.status))}>
                      {String(category.status).replaceAll('_', ' ')}
                    </StatusBadge>
                  </div>
                  <span className="text-xs font-semibold text-ink-soft">
                    {getRelationshipLabel(category.sport_id as RelationshipDoc)} &middot;{' '}
                    {String(category.participant_mode).replaceAll('_', ' ')} &middot;{' '}
                    {String(category.format_type).replaceAll('_', ' ')}
                  </span>
                </div>
                <form action={updateCategoryStatusAction} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="categoryId" value={String(category.id)} />
                  <Select name="status" defaultValue={String(category.status)} className="h-9 text-xs">
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="locked">Locked</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </Select>
                  <SubmitButton size="sm" variant="secondary">
                    Save
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>

      <StepActions>
        <Button asChild>
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=participants`}>
            Continue to Clubs / Teams / Players
          </Link>
        </Button>
      </StepActions>
    </>
  )
}

type ImportIssue = { sheet: string; name: string; reason: string }

const ParticipantsStep = async ({
  payload,
  eventId,
  imported,
  importSkipped,
  importIssues,
  importMoreIssues,
}: {
  payload: Payload
  eventId: string
  imported?: string
  importSkipped?: string
  importIssues?: string
  importMoreIssues?: string
}) => {
  let issues: ImportIssue[] = []
  if (importIssues) {
    try {
      const parsed = JSON.parse(importIssues)
      if (Array.isArray(parsed)) issues = parsed
    } catch {
      issues = []
    }
  }
  const [clubs, teams, players] = await Promise.all([
    payload.find({ collection: 'clubs', depth: 0, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({ collection: 'teams', depth: 1, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({ collection: 'players', depth: 1, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
  ])

  return (
    <>
      <AlertBanner tone="info">
        Clubs, teams, and players added here are shared across the whole event. You&apos;ll pick
        exactly which of them compete in each sport &amp; category in the next step (Entries &amp;
        Seeding).
      </AlertBanner>

      {imported ? (
        <AlertBanner tone="success">
          <p>
            Imported {imported} row(s) from the Excel file.
            {importSkipped ? ` ${importSkipped} row(s) were skipped.` : ''}
          </p>
          {issues.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold underline underline-offset-2">
                View row-by-row details ({issues.length}{importMoreIssues ? `, showing first ${issues.length}` : ''})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {issues.map((issue, index) => (
                  <li key={index}>
                    <span className="font-bold">
                      {issue.sheet} · {issue.name}
                    </span>
                    {' — '}
                    {issue.reason}
                  </li>
                ))}
              </ul>
              {importMoreIssues ? (
                <p className="mt-1 text-xs font-semibold">
                  + {importMoreIssues} more row(s) with issues not shown here.
                </p>
              ) : null}
            </details>
          ) : null}
        </AlertBanner>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div>
          <CardTitle>Bulk import from Excel</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Got a lot of clubs, teams, or players? Download the template, fill it in, and upload it
            here - everything gets tied to this event automatically.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild variant="secondary" size="sm" className="self-start">
            <a href="/workspaces/event-admin/new-event/participants-template" download>
              Download Excel template
            </a>
          </Button>
          <form action={importParticipantsAction} className="flex flex-col items-start gap-3 sm:max-w-sm">
            <input type="hidden" name="eventId" value={eventId} />
            <FileUpload
              id="participants-import-upload"
              name="file"
              variant="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              triggerLabel="Choose Excel file"
              helpText=".xlsx or .xls"
              className="w-full"
            />
            <SubmitButton size="sm">
              Import
            </SubmitButton>
          </form>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>4. Add a club</CardTitle>
          <form action={addClubAction} className="flex flex-col gap-4">
            <input type="hidden" name="eventId" value={eventId} />
            <Field label="Club name">
              <Input name="name" required />
            </Field>
            <Field label="Contact person">
              <Input name="contactPerson" />
            </Field>
            <Field label="Contact email">
              <Input name="contactEmail" type="email" />
            </Field>
            <SubmitButton>Add club</SubmitButton>
          </form>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {clubs.docs.map((club) => (
              <div key={club.id} className="rounded-card border border-line bg-paper px-3 py-2">
                <strong className="text-sm font-bold text-ink">{club.name}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Add a team (optional)</CardTitle>
          <form action={addTeamAction} className="flex flex-col gap-4">
            <input type="hidden" name="eventId" value={eventId} />
            <Field label="Team name">
              <Input name="name" required />
            </Field>
            <Field label="Club">
              <SearchableSelect
                name="clubId"
                placeholder="None"
                options={toOptions(clubs.docs).map((club) => ({ value: club.id, label: club.label }))}
              />
            </Field>
            <Field label="Contact email">
              <Input name="contactEmail" type="email" />
            </Field>
            <SubmitButton>Add team</SubmitButton>
          </form>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {teams.docs.map((team) => {
              const clubLabel = getRelationshipLabel(team.club_id as RelationshipDoc, '')
              return (
                <div key={team.id} className="rounded-card border border-line bg-paper px-3 py-2">
                  <strong className="block text-sm font-bold text-ink">{team.name}</strong>
                  {clubLabel ? <span className="block text-xs text-ink-soft">{clubLabel}</span> : null}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <CardTitle>Add a player (optional)</CardTitle>
        <form action={addPlayerAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="eventId" value={eventId} />
          <Field label="Player name">
            <Input name="name" required />
          </Field>
          <Field label="Club">
            <SearchableSelect
              name="clubId"
              placeholder="None"
              options={toOptions(clubs.docs).map((club) => ({ value: club.id, label: club.label }))}
            />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Field label="Gender">
            <Select name="gender" defaultValue="">
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Add player</SubmitButton>
          </div>
        </form>
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
          {players.docs.map((player) => {
            const clubLabel = getRelationshipLabel(player.club_id as RelationshipDoc, '')
            return (
              <div key={player.id} className="rounded-card border border-line bg-paper px-3 py-2">
                <strong className="block text-sm font-bold text-ink">{player.name}</strong>
                {clubLabel ? <span className="block text-xs text-ink-soft">{clubLabel}</span> : null}
              </div>
            )
          })}
        </div>
      </Card>

      <StepActions>
        <Button asChild>
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=entries`}>
            Continue to Entries &amp; Seeding
          </Link>
        </Button>
      </StepActions>
    </>
  )
}

// "pair" entries are backed by Teams (not bare Players) because Rosters always require a
// team_id - a doubles pair is modeled as a 2-player team.
const ParticipantModeToCollection: Record<string, 'teams' | 'clubs' | 'players'> = {
  team: 'teams',
  club: 'clubs',
  pair: 'teams',
  individual: 'players',
  open: 'players',
  tbd: 'players',
}

const EntriesStep = async ({
  payload,
  eventId,
  categoryId,
}: {
  payload: Payload
  eventId: string
  categoryId: string
}) => {
  const categories = await payload.find({
    collection: 'competition-categories',
    depth: 1,
    limit: 200,
    where: { event_id: { equals: eventId } },
    sort: 'name',
  })

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 8: defaulting to "first category alphabetically" meant
  // an admin landing on this step often saw a category that was already fully entered, with no
  // signal that three other categories still had zero entries. Default to the first non-draft
  // category with no entries yet instead - draft categories aren't ready to register anyone into,
  // so they never grab default focus even if they sort first.
  const categoryIds = categories.docs.map((cat) => String(cat.id))
  const entryCountsResult = categoryId
    ? null // an explicit categoryId was requested - no need to compute a default
    : categoryIds.length
      ? await payload.find({
          collection: 'competition-entries',
          depth: 0,
          limit: 2000,
          where: { category_id: { in: categoryIds } },
        })
      : null
  const entryCountByCategory = new Map<string, number>()
  for (const entry of entryCountsResult?.docs ?? []) {
    const catId = String(getRelationshipId(entry.category_id as RelationshipDoc))
    entryCountByCategory.set(catId, (entryCountByCategory.get(catId) || 0) + 1)
  }
  const nextIncompleteCategory = categories.docs.find(
    (cat) => cat.status !== 'draft' && (entryCountByCategory.get(String(cat.id)) || 0) === 0,
  )

  const selectedCategoryId =
    categoryId || String(nextIncompleteCategory?.id ?? categories.docs[0]?.id ?? '')
  const selectedCategory = categories.docs.find((c) => String(c.id) === selectedCategoryId)
  const categoryOptions = categories.docs.map((category) => ({
    id: String(category.id),
    label: `${getRelationshipLabel(category.sport_id as RelationshipDoc)} — ${category.name}`,
  }))

  if (!selectedCategory) {
    return (
      <Card>
        <EmptyState>Add a competition category first.</EmptyState>
      </Card>
    )
  }

  const collection = ParticipantModeToCollection[String(selectedCategory.participant_mode)] || 'players'
  // depth: 1 on sourceDocs populates each team/player's own club_id. depth: 2 on entries reaches
  // one level further (entry -> team/player -> club) so both lists can show a club caption.
  const [sourceDocs, entries] = await Promise.all([
    payload.find({ collection, depth: 1, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({
      collection: 'competition-entries',
      depth: 2,
      limit: 300,
      where: { category_id: { equals: selectedCategoryId } },
      sort: 'seed_number',
    }),
  ])

  const enteredSourceIds = new Set(
    entries.docs.map((entry) =>
      getRelationshipId(
        collection === 'teams' ? (entry.team_id as RelationshipDoc)
        : collection === 'clubs' ? (entry.club_id as RelationshipDoc)
        : (entry.player_id as RelationshipDoc),
      ),
    ),
  )
  const availableSources = sourceDocs.docs.filter((doc) => !enteredSourceIds.has(String(doc.id)))
  const collectionLabel = collection === 'teams' ? 'teams' : collection === 'clubs' ? 'clubs' : 'players'

  // A club-mode entry's own name already IS the club - only surface a secondary club caption for
  // team/pair (via club_id) and individual (via nested team_id/player_id.club_id) participants.
  const getSourceClubLabel = (doc: Record<string, unknown>) =>
    collection === 'clubs'
      ? undefined
      : getRelationshipLabel(doc.club_id as RelationshipDoc, '') || undefined

  const getEntryClubLabel = (entry: Record<string, unknown>) => {
    if (collection === 'clubs') {
      return undefined
    }
    const nested =
      entry.team_id && typeof entry.team_id === 'object' ? (entry.team_id as Record<string, unknown>)
      : entry.player_id && typeof entry.player_id === 'object' ? (entry.player_id as Record<string, unknown>)
      : undefined
    return nested ? getRelationshipLabel(nested.club_id as RelationshipDoc, '') || undefined : undefined
  }

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>5. Entries &amp; seeding</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            This is where participants get assigned into a specific sport &amp; category. Pick one
            below, then add entries and seed them underneath.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-3" method="get" action="/workspaces/event-admin/new-event">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="step" value="entries" />
          <Field label="Sport & category" className="min-w-[240px] flex-1">
            <SearchableSelect
              name="categoryId"
              defaultValue={selectedCategoryId}
              options={categoryOptions.map((category) => ({ value: category.id, label: category.label }))}
            />
          </Field>
          <Button type="submit" variant="secondary">
            Switch category
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>
          Add {collectionLabel} as entries into {getRelationshipLabel(selectedCategory as RelationshipDoc)}
        </CardTitle>
        <p className="text-xs text-ink-soft">
          This category&apos;s participant mode ({String(selectedCategory.participant_mode)}) only
          accepts {collectionLabel} as entries.
        </p>
        {sourceDocs.totalDocs === 0 ? (
          <EmptyState>
            No {collectionLabel} exist for this event yet.{' '}
            <Link
              href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=participants`}
              className="font-bold text-blue underline"
            >
              Go back to step 4
            </Link>{' '}
            to add some, then come back here.
          </EmptyState>
        ) : availableSources.length === 0 ? (
          <EmptyState>All {collectionLabel} in this event are already entered here.</EmptyState>
        ) : (
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {availableSources.map((source) => {
              const clubLabel = getSourceClubLabel(source)
              return (
                <form
                  action={addEntryAction}
                  key={source.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-2.5"
                >
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="categoryId" value={selectedCategoryId} />
                  <input type="hidden" name="sourceId" value={source.id} />
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-ink">{source.name}</strong>
                    {clubLabel ? (
                      <span className="block truncate text-xs text-ink-soft">{clubLabel}</span>
                    ) : null}
                  </div>
                  <SubmitButton size="sm" variant="secondary">
                    Add as entry
                  </SubmitButton>
                </form>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Current entries ({entries.totalDocs})</CardTitle>
        {entries.docs.length === 0 ? (
          <EmptyState>No entries yet for this category.</EmptyState>
        ) : (
          <>
            <form action={shuffleSeedsAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={selectedCategoryId} />
              <SubmitButton variant="secondary" size="sm">
                Shuffle Seeds
              </SubmitButton>
            </form>
            <form action={saveSeedOrderAction} className="flex flex-col gap-3">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={selectedCategoryId} />
              <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Seed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.docs.map((entry) => {
                    const clubLabel = getEntryClubLabel(entry)
                    return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-bold">
                        {entry.display_name}
                        {clubLabel ? (
                          <span className="block text-xs font-normal text-ink-soft">{clubLabel}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Input
                          name={`seed_${entry.id}`}
                          type="number"
                          min="1"
                          className="w-20"
                          defaultValue={entry.seed_number ?? ''}
                        />
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
              <div>
                <SubmitButton>Save Order</SubmitButton>
              </div>
            </form>
          </>
        )}
      </Card>

      <StepActions>
        <Button asChild>
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=generate`}>
            Continue to Generate Matches
          </Link>
        </Button>
      </StepActions>
    </>
  )
}

const GenerateStep = async ({ payload, eventId }: { payload: Payload; eventId: string }) => {
  const categories = await payload.find({
    collection: 'competition-categories',
    depth: 0,
    limit: 200,
    where: { event_id: { equals: eventId } },
    sort: 'name',
  })

  // One batched query for every category's confirmed-entry count instead of one query per
  // category - the counts are grouped client-side afterward.
  const categoryIds = categories.docs.map((category) => category.id)
  const confirmedEntries =
    categoryIds.length > 0
      ? await payload.find({
          collection: 'competition-entries',
          depth: 0,
          limit: 5000,
          where: { and: [{ category_id: { in: categoryIds } }, { status: { equals: 'confirmed' } }] },
        })
      : { docs: [] as { category_id?: unknown }[] }

  const confirmedCountByCategory = new Map<string, number>()
  for (const entry of confirmedEntries.docs) {
    const key = String(entry.category_id)
    confirmedCountByCategory.set(key, (confirmedCountByCategory.get(key) || 0) + 1)
  }
  const categoriesWithCounts = categories.docs.map((category) => ({
    category,
    confirmedCount: confirmedCountByCategory.get(String(category.id)) || 0,
  }))

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>6. Generate matches</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Choose a category with at least two confirmed entries. Single Elimination and Round Robin
          categories generate a seeded first round automatically; other formats must be scheduled
          manually in the Scheduler workspace.
        </p>
      </div>
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
        {categoriesWithCounts.map(({ category, confirmedCount }) => (
          <form
            action={generateMatchesAction}
            key={category.id}
            className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3"
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="categoryId" value={category.id} />
            <div className="min-w-0">
              <strong className="block truncate text-sm font-bold text-ink">{category.name}</strong>
              <span className="text-xs font-semibold text-ink-soft">
                {String(category.format_type).replaceAll('_', ' ')} &middot; {confirmedCount} confirmed entries
              </span>
            </div>
            <SubmitButton
              size="sm"
              disabled={
                confirmedCount < 2 || !AUTO_GENERATE_FORMATS.has(String(category.format_type))
              }
            >
              Generate Matches
            </SubmitButton>
          </form>
        ))}
      </div>
    </Card>
  )
}

const BracketStep = async ({
  payload,
  eventId,
  eventSlug,
  categoryId,
  generated,
  failed,
}: {
  payload: Payload
  eventId: string
  eventSlug: string
  categoryId: string
  generated: string
  failed: string
}) => {
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 14: this step used to dead-end on "Generate matches for
  // a category first" whenever the URL had no `categoryId`, even if the event already had several
  // categories with generated matches - the only way in was clicking a link that happened to carry
  // the param. It now always fetches every category and offers a switcher, matching the pattern
  // EntriesStep already uses, and only falls back to the empty state when the event truly has zero
  // categories yet.
  const categories = await payload.find({
    collection: 'competition-categories',
    depth: 1,
    limit: 200,
    where: { event_id: { equals: eventId } },
    sort: 'name',
  })
  // AUDIT item 8: default to a category that already has a generated stage, so landing here
  // without an explicit categoryId shows a real bracket instead of the "no stage yet" empty state
  // for whichever category happens to sort first.
  const categoryIds = categories.docs.map((cat) => String(cat.id))
  const stagedCategoryIds = categoryId
    ? new Set<string>()
    : categoryIds.length
      ? new Set(
          (
            await payload.find({
              collection: 'stages',
              depth: 0,
              limit: 200,
              where: { and: [{ category_id: { in: categoryIds } }, { order: { equals: 1 } }] },
            })
          ).docs.map((stage) => String(getRelationshipId(stage.category_id as RelationshipDoc))),
        )
      : new Set<string>()
  const categoryWithStage = categories.docs.find((cat) => stagedCategoryIds.has(String(cat.id)))

  const selectedCategoryId =
    categoryId || String(categoryWithStage?.id ?? categories.docs[0]?.id ?? '')
  const categoryOptions = categories.docs.map((cat) => ({
    id: String(cat.id),
    label: `${getRelationshipLabel(cat.sport_id as RelationshipDoc)} — ${cat.name}`,
  }))

  if (!selectedCategoryId) {
    return (
      <Card>
        <EmptyState>
          Add a competition category first, then generate matches for it before viewing a bracket
          here.
        </EmptyState>
      </Card>
    )
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: selectedCategoryId, depth: 0 })
    .catch(() => null)
  const stageResult = category
    ? await payload.find({
        collection: 'stages',
        depth: 0,
        limit: 1,
        where: { and: [{ category_id: { equals: selectedCategoryId } }, { order: { equals: 1 } }] },
      })
    : null
  const stage = stageResult?.docs[0]

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-ink">7. Bracket / fixtures</h2>
        <Card>
          <form className="flex flex-wrap items-end gap-3" method="get" action="/workspaces/event-admin/new-event">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="step" value="bracket" />
            <Field label="Sport & category" className="min-w-[240px] flex-1">
              <SearchableSelect
                name="categoryId"
                defaultValue={selectedCategoryId}
                options={categoryOptions.map((cat) => ({ value: cat.id, label: cat.label }))}
              />
            </Field>
            <Button type="submit" variant="secondary">
              Switch category
            </Button>
          </form>
        </Card>
        {generated ? (
          <AlertBanner tone="success">
            Generated {generated} match(es) for {category?.name}.
          </AlertBanner>
        ) : null}
        {failed ? (
          <AlertBanner tone="error">
            {failed} pairing(s) could not be generated (likely a duplicate submission). Go back to{' '}
            <Link
              href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=generate`}
              className="underline"
            >
              Generate Matches
            </Link>{' '}
            and click once more to fill in the rest.
          </AlertBanner>
        ) : null}
      </div>

      {!stage ? (
        <Card>
          <EmptyState>No stage generated yet for this category.</EmptyState>
        </Card>
      ) : stage.stage_type === 'single_elimination' ? (
        <SingleEliminationBracketView payload={payload} stageId={String(stage.id)} />
      ) : (
        <RoundRobinFixtureList payload={payload} stageId={String(stage.id)} />
      )}

      <StepActions>
        <Button asChild variant="secondary">
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=entries`}>
            Generate another category
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/workspaces/scheduler">Go to Scheduler</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/workspaces/brackets">Go to Brackets Workspace</Link>
        </Button>
        <Button asChild>
          <Link href={`/events/${eventSlug}`}>Finish Setup &amp; View Event Page</Link>
        </Button>
      </StepActions>
    </>
  )
}

const SingleEliminationBracketView = async ({ payload, stageId }: { payload: Payload; stageId: string }) => {
  const layout = await buildSingleEliminationBracketLayout(payload, stageId)
  return (
    <Card>
      <BracketTree rounds={layout.bracketData.rounds} champion={layout.bracketData.champion} />
    </Card>
  )
}

const RoundRobinFixtureList = async ({ payload, stageId }: { payload: Payload; stageId: string }) => {
  const matches = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 200,
    sort: ['round_name', 'match_number'],
    where: { stage_id: { equals: stageId } },
  })

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Fixtures ({matches.totalDocs})</CardTitle>
      {matches.docs.length === 0 ? (
        <EmptyState>No fixtures generated yet.</EmptyState>
      ) : (
        <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
          {matches.docs.map((match) => (
            <div key={match.id} className="rounded-card border border-line bg-paper px-4 py-3">
              <strong className="block text-sm font-bold text-ink">{match.match_number}</strong>
              <span className="text-xs font-semibold text-ink-soft">
                {getRelationshipLabel(match.participant_a_entry_id as RelationshipDoc)} vs{' '}
                {getRelationshipLabel(match.participant_b_entry_id as RelationshipDoc)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
