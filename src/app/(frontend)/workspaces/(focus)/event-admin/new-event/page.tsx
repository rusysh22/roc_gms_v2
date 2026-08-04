import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Where } from 'payload'
import {
  Building2,
  CalendarRange,
  Check,
  ClipboardList,
  Copy,
  FileSpreadsheet,
  GitBranch,
  PenLine,
  Repeat,
  Trophy,
  User,
  UserRound,
  Users,
} from 'lucide-react'

import { buildSingleEliminationBracketLayout } from '@/lib/brackets'
import { buildDoubleEliminationBracketLayout, isExactPowerOfTwo } from '@/lib/doubleElimination'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button, buttonVariants } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmSubmitButton } from '../../../matches/ConfirmSubmitButton'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { GlossaryHint } from '@/components/ui/glossary-hint'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SelectAllCheckbox } from '@/components/ui/select-all-checkbox'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { BracketTree } from '../../../../brackets/bracketTree'
import {
  AuditLogPanel,
  formatStatus,
  getRelationshipId,
  getRelationshipLabel,
  toOptions,
  type AuditLogSummary,
  type RelationshipDoc,
} from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { FocusHeader } from '../../FocusHeader'
import { EventNameSlugFields } from './EventNameSlugFields'
import { SummaryDetailModal, type SummaryDetailItem } from './SummaryDetailModal'
import { createEventAction, publishEventAction } from './eventActions'
import { AUTO_GENERATE_FORMATS } from './wizardShared'
import { addRulesetAction, addSportAction } from './sportActions'
import { addCategoryAction, updateCategoryStatusAction } from './categoryActions'
import {
  addClubAction,
  addPairAction,
  addPlayerAction,
  addTeamAction,
  cancelParticipantsImportAction,
  confirmParticipantsImportAction,
  previewParticipantsImportAction,
} from './participantActions'
import { addEntriesAction, shuffleSeedsAction, withdrawEntryAction } from './entriesSeedActions'
import { generateMatchesAction } from './generateActions'
import { getNextPowerOfTwo } from '@/lib/matchGeneration'
import { GroupKnockoutPanel } from './GroupKnockoutPanel'
import { UnsavedChangesGuard } from './UnsavedChangesGuard'
import { SeedOrderTable } from './SeedOrderTable'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 5: "Entries & Seeding" used to be one step covering two
// different decisions - who's registered, and what order they're seeded in - "sering dikerjakan
// oleh orang/waktu berbeda" per the doc. Split into Registration and Draw & Seeding so each has its
// own screen, its own "done" criterion, and its own place in the step nav.
const STEPS = [
  { key: 'setup', label: 'Setup Assistant' },
  { key: 'event', label: 'Event' },
  { key: 'sports', label: 'Sports & Rulesets' },
  { key: 'categories', label: 'Categories' },
  { key: 'participants', label: 'Clubs / Teams / Players' },
  { key: 'registration', label: 'Registration' },
  { key: 'draw', label: 'Draw & Seeding' },
  { key: 'generate', label: 'Generate Matches' },
  { key: 'bracket', label: 'Bracket' },
  { key: 'history', label: 'History' },
] as const

// AUDIT_UI_UX_CSS reconciliation: every step's in-page heading used to hardcode its own number as
// a plain literal ("5. Registration", "9. Publish"...). When item 5 split the old single
// "Entries & Seeding" step into Registration + Draw & Seeding, every literal after that point in
// the array went stale (Bracket's own heading was never updated past "9.", Participants' number
// was dropped entirely) while the progress bar above it kept counting correctly - the same page
// showed two different numbers for the same step. Deriving the number from STEPS here means a
// future reorder can't silently desync a hardcoded literal from the array again.
const stepNumber = (key: (typeof STEPS)[number]['key']) => STEPS.findIndex((step) => step.key === key) + 1

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
  duplicate_seed: 'Two entries had the same seed number. Give each entry a unique seed and save again.',
  invalid_group_count: 'Choose between 2 and 12 groups.',
  missing_groups: 'Create groups first.',
  invalid_qualify_count: 'Enter how many entries qualify per group (1 or more).',
  missing_qualify_count: 'Set how many entries qualify per group before finalizing.',
  groups_not_finished: 'Every group match needs a published result before finalizing the group stage.',
  group_stage_not_finalized: 'Finalize the group stage before promoting to knockout.',
  already_promoted: 'This group stage has already been promoted to knockout. Undo Phase first if you need to redo it.',
  not_promoted: 'This group stage has not been promoted to knockout yet.',
  knockout_already_started: 'Knockout matches have already started - this phase can no longer be undone.',
  no_qualifiers: 'No qualified entries were found for this group stage.',
  unsupported_format:
    'This category format is not supported by auto-generation yet. Use the Scheduler workspace to create matches manually.',
  double_elimination_requires_power_of_two:
    'Double elimination auto-generation needs an exact power-of-two number of confirmed entries (4, 8, 16, 32...). Add or remove entries to reach one, or build the bracket manually in the Scheduler workspace.',
  invalid_publish_option: 'Choose one of the three publish options.',
}

// Wizard progress, redesigned as: a plain-language status line ("Step 3 of 10") that works on its
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
          // Setup Assistant (index 0) and Event (index 1) are both reachable before an event
          // exists - everything from Sports onward needs a real eventId.
          const reachable = index <= 1 || Boolean(eventId)
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
            // `items-start` (not `items-center`) is load-bearing: the connector div's `mt-3.5` is
            // calibrated to land at the pill's vertical center measured *from the li's top edge*.
            // With `items-center`, flexbox instead centers the connector against its sibling's full
            // height - which varies per step because labels wrap to a different number of lines
            // ("Event" is one line, "Setup Assistant" is two), so neighboring connector segments sat
            // at different heights and the whole row read as crooked.
            <li key={step.key} className={cn('flex items-start', index < STEPS.length - 1 && 'flex-1')}>
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
                // AUDIT_UI_UX_CSS axe: 50%-opacity ink-soft measured 2.38:1 on this step's label
                // text (still real, readable content - not decorative) - well under the 4.5:1
                // normal-text minimum. Full-opacity ink-soft already passes on its own (see the
                // reachable/inactive branch above, which never used the opacity modifier) and
                // still reads as visually muted next to the active step's full-ink label.
                <span className="flex flex-col items-center gap-1 text-ink-soft">
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
  const step = get(params, 'step') || (eventId ? 'sports' : 'setup')
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
    // History has no "done" criterion of its own - it's a passive viewer over data other steps
    // already produced, not a task to complete. Counting it done once the event exists keeps 100%
    // reachable once every real task step clears its own bar. Setup Assistant is the same shape:
    // answered or skipped, it's definitionally behind you once an event exists.
    completedSteps.add('history')
    completedSteps.add('setup')
    const [sportsCount, categoriesResult, clubsCount, teamsCount, playersCount, confirmedEntries, eventMatches] =
      await Promise.all([
        payload.count({ collection: 'sports', where: { event_id: { equals: eventId } } }),
        payload.find({
          collection: 'competition-categories',
          depth: 0,
          limit: 500,
          where: { event_id: { equals: eventId } },
        }),
        payload.count({ collection: 'clubs', where: { event_id: { equals: eventId } } }),
        payload.count({ collection: 'teams', where: { event_id: { equals: eventId } } }),
        payload.count({ collection: 'players', where: { event_id: { equals: eventId } } }),
        payload.find({
          collection: 'competition-entries',
          depth: 0,
          limit: 5000,
          where: { and: [{ event_id: { equals: eventId } }, { status: { equals: 'confirmed' } }] },
        }),
        payload.find({ collection: 'matches', depth: 0, limit: 5000, where: { event_id: { equals: eventId } } }),
      ])
    if (sportsCount.totalDocs > 0) completedSteps.add('sports')
    if (categoriesResult.totalDocs > 0) completedSteps.add('categories')
    if (clubsCount.totalDocs + teamsCount.totalDocs + playersCount.totalDocs > 0) {
      completedSteps.add('participants')
    }

    // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 11: "entries"/"generate"/"bracket" used to flip to done
    // the moment ANY category anywhere had an entry or match, so the top bar could read "100%
    // complete" while most categories hadn't been touched. Each step is now only marked done once
    // every non-draft category actually clears its own bar (draft categories aren't publishable
    // yet, so they don't block progress; categories on a manual-scheduling-only format don't block
    // the auto-generate step since the wizard can never generate their matches anyway).
    const nonDraftCategories = categoriesResult.docs.filter((category) => category.status !== 'draft')
    const confirmedCountByCategory = new Map<string, number>()
    for (const entry of confirmedEntries.docs) {
      const key = String(entry.category_id)
      confirmedCountByCategory.set(key, (confirmedCountByCategory.get(key) || 0) + 1)
    }
    const categoriesWithMatches = new Set(eventMatches.docs.map((match) => String(match.category_id)))

    if (
      nonDraftCategories.length > 0 &&
      nonDraftCategories.every((category) => (confirmedCountByCategory.get(String(category.id)) || 0) >= 2)
    ) {
      // Registration and Draw share this criterion: every entry gets a seed_number the moment
      // it's added (see addEntriesAction), so there's no separate "has this category actually been
      // seeded" signal to check independently of "does it have entries" yet.
      completedSteps.add('registration')
      completedSteps.add('draw')
    }

    const autoGenerateCategories = nonDraftCategories.filter((category) =>
      AUTO_GENERATE_FORMATS.has(String(category.format_type)),
    )
    // group_stage_to_knockout is deliberately excluded from AUTO_GENERATE_FORMATS (it's a
    // multi-action pipeline, not a single "Generate Matches" click) - but it still needs its own
    // "done" signal, or these categories would never contribute to 100% and would also never show
    // as complete once actually promoted. "Done" here means matches exist on the knockout stage
    // specifically (order 2, single_elimination) - not just any group-stage match, which would
    // fire the moment group matches generate, long before promotion.
    const groupKnockoutCategories = nonDraftCategories.filter(
      (category) => category.format_type === 'group_stage_to_knockout',
    )
    const knockoutStagesResult = groupKnockoutCategories.length
      ? await payload.find({
          collection: 'stages',
          depth: 0,
          limit: 200,
          where: {
            and: [
              { event_id: { equals: eventId } },
              { order: { equals: 2 } },
              { stage_type: { equals: 'single_elimination' } },
            ],
          },
        })
      : null
    const knockoutStageIds = new Set((knockoutStagesResult?.docs ?? []).map((stage) => String(stage.id)))
    const categoriesWithKnockoutMatches = new Set(
      eventMatches.docs
        .filter((match) => knockoutStageIds.has(String(match.stage_id)))
        .map((match) => String(match.category_id)),
    )
    const generateReadyCategories = [...autoGenerateCategories, ...groupKnockoutCategories]
    const isGenerateDone = (category: (typeof generateReadyCategories)[number]) =>
      category.format_type === 'group_stage_to_knockout'
        ? categoriesWithKnockoutMatches.has(String(category.id))
        : categoriesWithMatches.has(String(category.id))
    if (generateReadyCategories.length > 0 && generateReadyCategories.every(isGenerateDone)) {
      completedSteps.add('generate')
      completedSteps.add('bracket')
    }
  }

  return (
    // Fixed viewport-height shell from `lg:` up (`h-svh overflow-hidden`) so header/stepper/summary
    // stay put and only the step content scrolls within its own pane below - a lightly-filled step
    // like Sports & Rulesets then shows with zero scrolling at all, while a data-heavy one (a long
    // Registration entries table, History's audit log) still scrolls, just inside its own pane
    // instead of the whole page. Left at the pre-existing `min-h-svh` (page grows and scrolls
    // normally) below `lg:` - two independently-scrolling panes stacked in one mobile column would
    // be fiddlier to use than a single normal scroll, not an improvement.
    <main className="flex min-h-svh flex-col lg:h-svh lg:overflow-hidden">
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

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {wizardError && errorMessages[wizardError] ? (
            <AlertBanner tone="error">{errorMessages[wizardError]}</AlertBanner>
          ) : null}
          {wizardUpdated ? <AlertBanner tone="success">Saved.</AlertBanner> : null}
          {get(params, 'wizardUndone') ? (
            <AlertBanner tone="success">
              Phase undone. The knockout matches were removed and the group stage is unlocked for
              revision.
            </AlertBanner>
          ) : null}
          {get(params, 'wizardPromoteWarning') ? (
            <AlertBanner tone="warning">
              {get(params, 'wizardPromoteWarning')} qualifier(s) were withdrawn/disqualified after
              the group stage was finalized and were dropped from the knockout bracket.
            </AlertBanner>
          ) : null}

          {step === 'setup' ? <SetupStep /> : null}
          {step === 'event' ? (
            <EventStep
              defaultName={get(params, 'name')}
              defaultSlug={get(params, 'slug')}
              suggestedSlug={get(params, 'suggestedSlug')}
              defaultStart={get(params, 'eventStart')}
              defaultEnd={get(params, 'eventEnd')}
              defaultLocation={get(params, 'location')}
              defaultOrganizerName={get(params, 'organizerName')}
              defaultSetupTournamentType={get(params, 'setupTournamentType')}
              defaultSetupParticipantMode={get(params, 'setupParticipantMode')}
              defaultSetupParticipantSource={get(params, 'setupParticipantSource')}
            />
          ) : null}
          {step === 'sports' && event ? <SportsStep payload={payload} eventId={eventId} /> : null}
          {step === 'categories' && event ? (
            <CategoriesStep
              payload={payload}
              eventId={eventId}
              setupTournamentType={String(event.setup_tournament_type || '')}
              setupParticipantMode={String(event.setup_participant_mode || '')}
            />
          ) : null}
          {step === 'participants' && event ? (
            <ParticipantsStep
              payload={payload}
              eventId={eventId}
              tab={get(params, 'tab')}
              setupParticipantSource={String(event.setup_participant_source || '')}
              imported={get(params, 'wizardImported')}
              importSkipped={get(params, 'wizardImportSkipped')}
              importIssues={get(params, 'wizardImportIssues')}
              importMoreIssues={get(params, 'wizardImportMoreIssues')}
              importPreviewMediaId={get(params, 'importPreviewMediaId')}
              importPreviewClubs={get(params, 'importPreviewClubs')}
              importPreviewTeams={get(params, 'importPreviewTeams')}
              importPreviewPlayers={get(params, 'importPreviewPlayers')}
              importPreviewSkipped={get(params, 'importPreviewSkipped')}
              importPreviewIssues={get(params, 'importPreviewIssues')}
              importPreviewMoreIssues={get(params, 'importPreviewMoreIssues')}
            />
          ) : null}
          {step === 'registration' && event ? (
            <RegistrationStep
              payload={payload}
              eventId={eventId}
              categoryId={get(params, 'categoryId')}
              sourceSearch={get(params, 'sourceSearch')}
              sourceClub={get(params, 'sourceClub')}
            />
          ) : null}
          {step === 'draw' && event ? (
            <DrawStep payload={payload} eventId={eventId} categoryId={get(params, 'categoryId')} />
          ) : null}
          {step === 'generate' && event ? (
            <GenerateStep payload={payload} eventId={eventId} categoryId={get(params, 'categoryId')} />
          ) : null}
          {step === 'bracket' && event ? (
            <BracketStep
              payload={payload}
              eventId={eventId}
              eventSlug={String(event.slug || '')}
              eventStatus={String(event.status || 'draft')}
              eventVisibility={String(event.visibility || 'hidden')}
              categoryId={get(params, 'categoryId')}
              generated={get(params, 'wizardGenerated')}
              failed={get(params, 'wizardGenerateFailed')}
              published={get(params, 'wizardPublished')}
            />
          ) : null}
          {step === 'history' && event ? <HistoryStep payload={payload} eventId={eventId} /> : null}
        </div>

        {/* No longer `lg:sticky lg:top-24` - that pattern relied on the page itself scrolling
            past a pinned sidebar. Now that the shell is a fixed-height grid row (see `main` above),
            the aside is just the row's second column: it stretches to the row's full height by
            default and scrolls independently if SummaryPanel's own content ever runs long. */}
        <aside className="lg:min-h-0 lg:overflow-y-auto lg:pl-1">
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

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 11: readiness needs to be visible per category, not just
  // as event-wide entity counts - "8 sports, 10 categories, 100 entries" doesn't tell an admin
  // which of the 10 categories still need work. Each category gets its own status here instead.
  // confirmedEntries/matches above are fetched at depth: 1 (their `category_id` is a populated
  // object, not a raw id) for entryItems/matchItems' relationship labels - getRelationshipId
  // unwraps that back to a plain id string for map/set keys below.
  const confirmedCountByCategoryId = new Map<string, number>()
  for (const entry of confirmedEntries.docs) {
    const key = String(getRelationshipId(entry.category_id as RelationshipDoc))
    confirmedCountByCategoryId.set(key, (confirmedCountByCategoryId.get(key) || 0) + 1)
  }
  const categoryIdsWithMatches = new Set(
    matches.docs.map((match) => String(getRelationshipId(match.category_id as RelationshipDoc))),
  )
  // group_stage_to_knockout categories are only "ready" once qualifiers have actually been
  // promoted into a knockout bracket - not the moment group-stage matches exist, which would fire
  // long before promotion and contradict the Groups panel's own state.
  const categoryIdsWithKnockoutMatches = new Set(
    matches.docs
      .filter((match) => {
        const stage = match.stage_id as { stage_type?: string } | string | number | null | undefined
        return Boolean(stage && typeof stage === 'object' && stage.stage_type === 'single_elimination')
      })
      .map((match) => String(getRelationshipId(match.category_id as RelationshipDoc))),
  )
  const categoryReadiness = categories.docs.map((category) => {
    const confirmedCount = confirmedCountByCategoryId.get(String(category.id)) || 0
    const isGroupStageToKnockout = category.format_type === 'group_stage_to_knockout'
    const hasMatches = isGroupStageToKnockout
      ? categoryIdsWithKnockoutMatches.has(String(category.id))
      : categoryIdsWithMatches.has(String(category.id))
    const autoGenerates = AUTO_GENERATE_FORMATS.has(String(category.format_type)) || isGroupStageToKnockout
    let tone: 'green' | 'blue' | 'gold' | 'neutral'
    let label: string
    if (category.status === 'draft') {
      tone = 'neutral'
      label = 'Draft'
    } else if (confirmedCount < 2) {
      tone = 'gold'
      label = 'Needs entries'
    } else if (autoGenerates && !hasMatches) {
      tone = 'gold'
      label = 'Needs matches'
    } else if (!autoGenerates) {
      tone = 'blue'
      label = 'Manual scheduling'
    } else {
      tone = 'green'
      label = 'Ready'
    }
    return { id: category.id, name: String(category.name), tone, label }
  })
  const readyCount = categoryReadiness.filter((row) => row.tone === 'green').length

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
      {categoryReadiness.length > 0 ? (
        <div className="flex flex-col gap-2 border-b border-line pb-3">
          <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">
            Category readiness · {readyCount}/{categoryReadiness.length} ready
          </p>
          <div className="flex flex-col gap-1.5">
            {categoryReadiness.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-ink">{row.name}</span>
                <StatusBadge tone={row.tone}>{row.label}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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

// `sticky` is opt-in, not the default: BracketStep renders a StepActions block of secondary
// nav links (Generate another category / Go to Scheduler / Go to Brackets Workspace) *before*
// its actual final content (the Publish card), so pinning every StepActions to the bottom would
// wrongly float that mid-step block over content that comes after it. The 5 "Continue to X"
// usages are each step's genuine last element - those pass `sticky` explicitly.
const StepActions = ({ children, sticky = false }: { children: ReactNode; sticky?: boolean }) => (
  <div
    className={cn(
      'flex flex-wrap justify-end gap-2',
      sticky && 'sticky bottom-0 z-10 border-t border-line bg-mist pb-1 pt-3',
    )}
  >
    {children}
  </div>
)

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 1 (option A, full): a curated 4-option subset of
// CompetitionCategories.format_type - not all 8 values from the Categories step's own dropdown,
// since the whole point of an assistant is fewer, friendlier choices up front. Mirrors
// PARTICIPANT_MODE_CHOICES' shape/style exactly (defined further below, referenced here only
// inside SetupStep's render - by the time that runs the whole module has already loaded).
const TOURNAMENT_TYPE_CHOICES = [
  {
    value: 'single_elimination',
    label: 'Single Elimination',
    helper: 'Knockout bracket - lose once and you\'re out.',
    Icon: Trophy,
  },
  {
    value: 'round_robin',
    label: 'Round Robin',
    helper: 'Everyone plays everyone once, ranked by results.',
    Icon: Repeat,
  },
  {
    value: 'group_stage_to_knockout',
    label: 'Group Stage → Knockout',
    helper: 'Groups play round robin first, top finishers advance to a bracket.',
    Icon: GitBranch,
  },
  {
    value: 'league',
    label: 'League',
    helper: 'Multiple rounds across a season, ranked by points.',
    Icon: CalendarRange,
  },
] as const

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 1 gap-fill: the doc's Step 0 spec has a second question
// ("Data peserta Anda sekarang ada di mana?") this session's first pass skipped. Only the "excel"
// answer has anywhere real to go right now - ParticipantsStep highlights Bulk Import when it sees
// this answer (see there). The other three are stored for real but don't change any UI yet
// (self-registration and copy-from-previous-event aren't built) - still worth capturing honestly
// rather than pretending the question has no purpose until those exist.
const PARTICIPANT_SOURCE_CHOICES = [
  {
    value: 'manual',
    label: 'Not entered yet',
    helper: 'I\'ll add clubs, teams, and players by hand.',
    Icon: PenLine,
  },
  {
    value: 'excel',
    label: 'Excel/CSV file',
    helper: 'I have a spreadsheet ready to import.',
    Icon: FileSpreadsheet,
  },
  {
    value: 'registration_form',
    label: 'Self-registration',
    helper: 'Participants will register themselves.',
    Icon: ClipboardList,
  },
  {
    value: 'copy_previous',
    label: 'A previous event',
    helper: 'I want to reuse participants from another event.',
    Icon: Copy,
  },
] as const

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 1, option A: unlike the ruleset preset (P1 item 3, purely
// a client-side JSX default keyed off a sibling field chosen the same step), this answer has to
// survive past a page the admin hasn't reached yet - there's no `events` row to persist it on
// until createEventAction runs. Both fields are plain, optional GET params here, carried through
// as hidden inputs in EventStep's form, and only actually persisted (onto Events.setup_*) once
// the event is created - see eventActions.ts. Fully skippable; skipping preserves every existing
// default exactly as it was before this step existed.
const SetupStep = () => (
  <Card className="flex flex-col gap-6">
    <div>
      <CardTitle>{stepNumber('setup')}. Setup Assistant</CardTitle>
      <p className="mt-1 text-sm text-ink-soft">
        Answer a couple of quick questions and we&apos;ll pre-fill the format and participant type
        choices in later steps. Everything here stays fully editable - skip it if you&apos;d
        rather decide as you go.
      </p>
    </div>
    <form method="get" action="/workspaces/event-admin/new-event" className="flex flex-col gap-6">
      <input type="hidden" name="step" value="event" />
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
          What kind of tournament is this?
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOURNAMENT_TYPE_CHOICES.map(({ value, label, helper, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-2 rounded-card border border-line bg-paper p-3 transition-colors has-[:checked]:border-green has-[:checked]:bg-mist has-[:checked]:ring-2 has-[:checked]:ring-green/20"
            >
              <input type="radio" name="setupTournamentType" value={value} className="sr-only" />
              <Icon className="h-5 w-5 text-green" aria-hidden="true" />
              <span className="text-sm font-bold text-ink">{label}</span>
              <span className="text-xs text-ink-soft">{helper}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
          Who&apos;s competing?
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PARTICIPANT_MODE_CHOICES.map(({ value, label, helper, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-2 rounded-card border border-line bg-paper p-3 transition-colors has-[:checked]:border-green has-[:checked]:bg-mist has-[:checked]:ring-2 has-[:checked]:ring-green/20"
            >
              <input type="radio" name="setupParticipantMode" value={value} className="sr-only" />
              <Icon className="h-5 w-5 text-green" aria-hidden="true" />
              <span className="text-sm font-bold text-ink">{label}</span>
              <span className="text-xs text-ink-soft">{helper}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
          Where does your participant data live right now?
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PARTICIPANT_SOURCE_CHOICES.map(({ value, label, helper, Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-2 rounded-card border border-line bg-paper p-3 transition-colors has-[:checked]:border-green has-[:checked]:bg-mist has-[:checked]:ring-2 has-[:checked]:ring-green/20"
            >
              <input type="radio" name="setupParticipantSource" value={value} className="sr-only" />
              <Icon className="h-5 w-5 text-green" aria-hidden="true" />
              <span className="text-sm font-bold text-ink">{label}</span>
              <span className="text-xs text-ink-soft">{helper}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Continue</SubmitButton>
        <Link
          href="/workspaces/event-admin/new-event?step=event"
          className="text-sm font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          Skip for now
        </Link>
      </div>
    </form>
  </Card>
)

const EventStep = ({
  defaultName,
  defaultSlug,
  suggestedSlug,
  defaultStart,
  defaultEnd,
  defaultLocation,
  defaultOrganizerName,
  defaultSetupTournamentType,
  defaultSetupParticipantMode,
  defaultSetupParticipantSource,
}: {
  defaultName: string
  defaultSlug: string
  suggestedSlug: string
  defaultStart: string
  defaultEnd: string
  defaultLocation: string
  defaultOrganizerName: string
  defaultSetupTournamentType: string
  defaultSetupParticipantMode: string
  defaultSetupParticipantSource: string
}) => (
  <Card className="flex flex-col gap-4">
    <div>
      <CardTitle>{stepNumber('event')}. Event details</CardTitle>
      <p className="mt-1 text-sm text-ink-soft">
        The basics for your event. You can add sports, categories, and participants next.
      </p>
    </div>
    {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 8 gap-fill: warns on tab close/refresh once anything
        below has been touched, so a typed-out name/dates/logo isn't silently lost - see
        UnsavedChangesGuard for exactly what this does and doesn't cover. */}
    <UnsavedChangesGuard>
      <form action={createEventAction} className="grid gap-4 sm:grid-cols-2">
        {/* Carried through from the Setup Assistant (Step 0), if answered - createEventAction
            persists these onto the new event so every later step can read a real default off it. */}
        <input type="hidden" name="setupTournamentType" value={defaultSetupTournamentType} />
        <input type="hidden" name="setupParticipantMode" value={defaultSetupParticipantMode} />
        <input type="hidden" name="setupParticipantSource" value={defaultSetupParticipantSource} />
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
    </UnsavedChangesGuard>
  </Card>
)

type Payload = Awaited<ReturnType<typeof requireWorkspaceAccess>> extends { payload: infer P }
  ? P
  : never

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P1 item 3: "Ruleset preset per sport dan contextual field" -
// the ruleset form used to default every sport to the same score_type="points"/no-set/no-best-of
// combination regardless of what kind of sport it was for, so a badminton or table tennis ruleset
// (best-of-N sets) needed the same manual field-by-field setup as a football one (single-goal
// count). Suggests sane starting values from the sport's own `sport_type` instead - still fully
// editable, none of this is enforced.
const RULESET_PRESET_BY_SPORT_TYPE: Record<
  string,
  { scoreType: string; setBased: boolean; bestOf: number | ''; allowDraw: boolean }
> = {
  court: { scoreType: 'sets', setBased: true, bestOf: 3, allowDraw: false },
  table: { scoreType: 'sets', setBased: true, bestOf: 3, allowDraw: false },
  field: { scoreType: 'goals', setBased: false, bestOf: '', allowDraw: true },
  board: { scoreType: 'result', setBased: false, bestOf: '', allowDraw: true },
  esport: { scoreType: 'points', setBased: false, bestOf: '', allowDraw: false },
  track: { scoreType: 'time', setBased: false, bestOf: '', allowDraw: false },
  other: { scoreType: 'points', setBased: false, bestOf: '', allowDraw: false },
}
const getRulesetPreset = (sportType: string) =>
  RULESET_PRESET_BY_SPORT_TYPE[sportType] ?? RULESET_PRESET_BY_SPORT_TYPE.other

const SportsStep = async ({ payload, eventId }: { payload: Payload; eventId: string }) => {
  const [sports, rulesets] = await Promise.all([
    payload.find({ collection: 'sports', depth: 0, limit: 100, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({ collection: 'rulesets', depth: 0, limit: 200, where: { event_id: { equals: eventId } }, sort: 'name' }),
  ])

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardTitle>{stepNumber('sports')}. Add a sport</CardTitle>
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
                  <GlossaryHint
                    term="Rulesets"
                    definition="How score, winning, standings, and tie-breaks are calculated for this sport. Optional - categories work fine without one."
                  />
                  : {rulesets.docs.filter((r) => String(r.sport_id) === String(sport.id)).length}
                </p>
              </div>
              <form action={addRulesetAction} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="sportId" value={sport.id} />
                <Field label="Ruleset name" className="sm:col-span-2">
                  <Input name="name" required placeholder={`${sport.name} Standard`} />
                </Field>
                {(() => {
                  const preset = getRulesetPreset(String(sport.sport_type))
                  return (
                    <>
                      <Field label="Score type">
                        <Select name="scoreType" defaultValue={preset.scoreType}>
                          <option value="points">Points</option>
                          <option value="goals">Goals</option>
                          <option value="sets">Sets</option>
                          <option value="time">Time</option>
                          <option value="result">Result</option>
                          <option value="custom">Custom</option>
                        </Select>
                      </Field>
                      <Field label="Best of">
                        <Input name="bestOf" type="number" min="1" defaultValue={preset.bestOf} />
                      </Field>
                      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <input
                          name="setBased"
                          type="checkbox"
                          defaultChecked={preset.setBased}
                          className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                        />
                        Set based
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <input
                          name="allowDraw"
                          type="checkbox"
                          defaultChecked={preset.allowDraw}
                          className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                        />
                        Allow draw
                      </label>
                      <p className="text-xs text-ink-soft sm:col-span-2">
                        Pre-filled for a &ldquo;{String(sport.sport_type)}&rdquo; sport - change
                        anything before saving.
                      </p>
                    </>
                  )
                })()}
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

      <StepActions sticky>
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

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 1: this used to be a plain <select> defaulting to "Team"
// with no explanation - an admin who didn't recognize the field just kept the default, which is
// wrong for anything other than a team-based category. Four visual cards replace it, none
// pre-selected, each answering "who's bertanding on this category" in plain language instead of
// jargon (doc section 8.2's exact terms: Peserta kategori/Pemain perorangan/Pasangan/Tim/Klub).
// Open/TBD stay reachable but demoted behind a "Not sure yet" disclosure (doc section 8.2: "Jangan
// tampilkan Open dan TBD sebagai participant type utama").
const PARTICIPANT_MODE_CHOICES = [
  {
    value: 'individual',
    label: 'Individual player',
    helper: 'One person is one entry - e.g. badminton singles, chess.',
    Icon: User,
  },
  {
    value: 'pair',
    label: 'Pair',
    helper: 'Two players compete together as one entry - e.g. mixed doubles.',
    Icon: UserRound,
  },
  {
    value: 'team',
    label: 'Team',
    helper: 'A group of players compete as one unit - e.g. futsal, basketball.',
    Icon: Users,
  },
  {
    value: 'club',
    label: 'Club / delegation',
    helper: 'The organization itself is the entry, not a team or player inside it.',
    Icon: Building2,
  },
] as const

const CategoriesStep = async ({
  payload,
  eventId,
  setupTournamentType,
  setupParticipantMode,
}: {
  payload: Payload
  eventId: string
  setupTournamentType: string
  setupParticipantMode: string
}) => {
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
        <CardTitle>{stepNumber('categories')}. Add a competition category</CardTitle>
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
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
                Who&apos;s competing in this category?
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PARTICIPANT_MODE_CHOICES.map(({ value, label, helper, Icon }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer flex-col gap-2 rounded-card border border-line bg-paper p-3 transition-colors has-[:checked]:border-green has-[:checked]:bg-mist has-[:checked]:ring-2 has-[:checked]:ring-green/20"
                  >
                    <input
                      type="radio"
                      name="participantMode"
                      value={value}
                      required
                      defaultChecked={value === setupParticipantMode}
                      className="sr-only"
                    />
                    <Icon className="h-5 w-5 text-green" aria-hidden="true" />
                    <span className="text-sm font-bold text-ink">{label}</span>
                    <span className="text-xs text-ink-soft">{helper}</span>
                  </label>
                ))}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-bold text-ink-soft select-none">
                  Not sure yet
                </summary>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="radio"
                      name="participantMode"
                      value="open"
                      className="h-4 w-4 border-line text-green focus:ring-green/40"
                    />
                    Open (any participant type)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <input
                      type="radio"
                      name="participantMode"
                      value="tbd"
                      className="h-4 w-4 border-line text-green focus:ring-green/40"
                    />
                    To be decided later
                  </label>
                </div>
              </details>
            </fieldset>
            <Field label="Format">
              {/* Pre-filled from the Setup Assistant's tournament-type answer (item 1, option A),
                  same "suggestion, not lock" spirit as the ruleset preset above - still a plain
                  editable <select>. */}
              <Select name="formatType" defaultValue={setupTournamentType || 'single_elimination'}>
                <optgroup label={`Auto-generates matches in step ${stepNumber('generate')}`}>
                  <option value="single_elimination">Single Elimination</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="double_elimination">Double Elimination (needs a power-of-two entry count)</option>
                  <option value="time_trial">Time Trial (one attempt per entry, ranked by result)</option>
                  <option value="score_ranking">Score Ranking (one attempt per entry, ranked by result)</option>
                </optgroup>
                <optgroup label={`Has its own guided setup (step ${stepNumber('generate')})`}>
                  <option value="group_stage_to_knockout">Group Stage to Knockout</option>
                </optgroup>
                <optgroup label="Manual scheduling only (Scheduler workspace)">
                  <option value="league">League</option>
                  <option value="friendly">Friendly</option>
                </optgroup>
              </Select>
            </Field>
            <Field
              label={
                <GlossaryHint
                  term="Ruleset (optional)"
                  definition="How score, winning, standings, and tie-breaks are calculated. Leave as None if you'll decide later or the sport doesn't need one."
                />
              }
              className="sm:col-span-2"
            >
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

      <StepActions sticky>
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

const PARTICIPANT_TABS = [
  { key: 'clubs', label: 'Clubs' },
  { key: 'teams', label: 'Teams' },
  { key: 'pairs', label: 'Pairs' },
  { key: 'players', label: 'Players' },
] as const

const ParticipantsStep = async ({
  payload,
  eventId,
  tab,
  setupParticipantSource,
  imported,
  importSkipped,
  importIssues,
  importMoreIssues,
  importPreviewMediaId,
  importPreviewClubs,
  importPreviewTeams,
  importPreviewPlayers,
  importPreviewSkipped,
  importPreviewIssues,
  importPreviewMoreIssues,
}: {
  payload: Payload
  eventId: string
  tab?: string
  setupParticipantSource?: string
  imported?: string
  importSkipped?: string
  importIssues?: string
  importMoreIssues?: string
  importPreviewMediaId?: string
  importPreviewClubs?: string
  importPreviewTeams?: string
  importPreviewPlayers?: string
  importPreviewSkipped?: string
  importPreviewIssues?: string
  importPreviewMoreIssues?: string
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
  let previewIssues: ImportIssue[] = []
  if (importPreviewIssues) {
    try {
      const parsed = JSON.parse(importPreviewIssues)
      if (Array.isArray(parsed)) previewIssues = parsed
    } catch {
      previewIssues = []
    }
  }
  const [clubs, teams, players, categories] = await Promise.all([
    payload.find({ collection: 'clubs', depth: 0, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({ collection: 'teams', depth: 1, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({ collection: 'players', depth: 1, limit: 300, where: { event_id: { equals: eventId } }, sort: 'name' }),
    payload.find({
      collection: 'competition-categories',
      depth: 0,
      limit: 500,
      where: { event_id: { equals: eventId } },
    }),
  ])

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 2: this step used to show every directory form
  // (Club/Team/Player) regardless of whether any category actually needed that participant type -
  // full "adaptive Step 4" (a form set driven by which category you're working on) is a bigger
  // rearchitecture than this pass covers, but the narrowest, highest-value slice is not showing the
  // Club/Pair forms at all when nothing in the event uses them yet. Before any category exists,
  // show everything - there's no signal yet to narrow by.
  const participantModes = new Set(categories.docs.map((category) => String(category.participant_mode)))
  const needsClubForm = categories.docs.length === 0 || participantModes.has('club')
  const needsPairForm = categories.docs.length === 0 || participantModes.has('pair')

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 2, option B: this step used to stack all four
  // form+list sections (Club/Team/Pair/Player) on one long page, which got heavy fast on a real
  // roster (e.g. 80+ players in the Nusantara Grand Games demo data). Splitting into tabs via a
  // plain `?tab=` GET param - not client-side state - keeps this a pure server component,
  // matching the same GET-form/query-param pattern every other step's category switcher already
  // uses (DrawStep, RegistrationStep, BracketStep).
  const availableTabs = PARTICIPANT_TABS.filter((participantTab) =>
    participantTab.key === 'clubs' ? needsClubForm
    : participantTab.key === 'pairs' ? needsPairForm
    : true,
  )
  const activeTab = availableTabs.find((participantTab) => participantTab.key === tab)?.key ?? availableTabs[0].key

  return (
    <>
      <h2 className="text-sm font-extrabold text-ink">{stepNumber('participants')}. Clubs / Teams / Players</h2>
      <AlertBanner tone="info">
        Clubs, teams, and players added here are shared across the whole event. You&apos;ll pick
        exactly which of them compete in each sport &amp; category in the next step (Registration).
        Only add a club if a category needs an organization as the entry itself (e.g. an
        inter-school or inter-company competition) - individual, pair, and team categories don&apos;t
        need one.
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

      {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 1 gap-fill: the Setup Assistant's "where's your
          participant data" answer only has one place to actually go right now - pointing straight
          at the card that already exists below, instead of leaving the admin to rediscover it. */}
      {setupParticipantSource === 'excel' && !imported ? (
        <AlertBanner tone="info">
          You mentioned your participant data is in Excel/CSV - use Bulk Import below to add
          everyone at once instead of one at a time.
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
          <form action={previewParticipantsImportAction} className="flex flex-col items-start gap-3 sm:max-w-sm">
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
              Preview import
            </SubmitButton>
          </form>
        </div>
      </Card>

      {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 2 gap-fill: "belum ada preview mapping yang
          menjawab apakah satu row menjadi club, team, player, roster, atau entry" - shows exactly
          that before anything is written, instead of committing the instant a file is chosen. */}
      {importPreviewMediaId ? (
        <Card className="flex flex-col gap-4 border-gold">
          <div>
            <CardTitle>Review import before confirming</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">
              Nothing has been saved yet. Check the mapping below, then confirm or cancel.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Clubs</dt>
              <dd className="text-lg font-extrabold text-ink">{importPreviewClubs || 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Teams</dt>
              <dd className="text-lg font-extrabold text-ink">{importPreviewTeams || 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Players</dt>
              <dd className="text-lg font-extrabold text-ink">{importPreviewPlayers || 0}</dd>
            </div>
          </dl>
          {previewIssues.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-xs font-bold text-ink-soft select-none">
                {importPreviewSkipped ? `${importPreviewSkipped} row(s) will be skipped. ` : ''}
                View row-by-row details ({previewIssues.length}
                {importPreviewMoreIssues ? `, showing first ${previewIssues.length}` : ''})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {previewIssues.map((issue, index) => (
                  <li key={index}>
                    <span className="font-bold">
                      {issue.sheet} &middot; {issue.name}
                    </span>
                    {' — '}
                    {issue.reason}
                  </li>
                ))}
              </ul>
              {importPreviewMoreIssues ? (
                <p className="mt-1 text-xs font-semibold">
                  + {importPreviewMoreIssues} more row(s) with issues not shown here.
                </p>
              ) : null}
            </details>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <form action={confirmParticipantsImportAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="mediaId" value={importPreviewMediaId} />
              <SubmitButton>Confirm &amp; import</SubmitButton>
            </form>
            <form action={cancelParticipantsImportAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="mediaId" value={importPreviewMediaId} />
              <SubmitButton variant="secondary">Cancel</SubmitButton>
            </form>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-ink">4. Participants</h2>
        <nav className="flex flex-wrap gap-2" aria-label="Participant type">
          {availableTabs.map((participantTab) => {
            const isActive = participantTab.key === activeTab
            return (
              <Link
                key={participantTab.key}
                href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=participants&tab=${participantTab.key}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold no-underline transition-colors',
                  isActive ? 'border-green bg-green text-paper' : 'border-line bg-paper text-ink-soft hover:text-ink',
                )}
              >
                {participantTab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 2: a narrow, safe slice of "adaptive Step 4" - the
          full redesign would drive this entire step's form set from which category you're
          working on, which is a much larger rearchitecture than this pass covers. This form adds
          real value only once some category's participants actually are clubs (item 3), so it's
          hidden until then instead of always occupying screen space. Shown by default before any
          category exists yet, since there's nothing to narrow by. */}
      {activeTab === 'clubs' ? (
        <Card className="flex flex-col gap-4">
          {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 3: this used to be the only one of the three
              headings ("Add a club" / "Add a team (optional)" / "Add a player (optional)") without
              an explicit "(optional)" - the missing label read as "Club is mandatory," which isn't
              true for any category except a Club-type one. */}
          <CardTitle>Add a club (optional unless a category&apos;s participants are clubs)</CardTitle>
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
      ) : null}

      {activeTab === 'teams' ? (
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
      ) : null}

      {activeTab === 'pairs' ? (
        <Card className="flex flex-col gap-4">
          {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 4: a doubles pair is stored as a 2-player Team
              internally (rosters always need a team_id), but this form never says "team" - it picks
              two existing players and addPairAction creates the team + both roster rows in one
              submit. Requires players to already exist, so it's placed after the player form/list.
              Item 2: hidden entirely once categories exist and none of them is pair-mode - same
              "only show what's needed" narrowing as the Club form above. */}
          <CardTitle>Add a pair (optional unless a category pairs up players)</CardTitle>
          <p className="text-xs text-ink-soft">
            For categories like mixed doubles, where two players compete together as one entry.
          </p>
          {players.docs.length < 2 ? (
            <EmptyState>Add at least two players above before pairing them up.</EmptyState>
          ) : (
            <form action={addPairAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="eventId" value={eventId} />
              <Field label="Player 1">
                <SearchableSelect
                  name="player1Id"
                  placeholder="Select player"
                  options={toOptions(players.docs).map((player) => ({ value: player.id, label: player.label }))}
                />
              </Field>
              <Field label="Player 2">
                <SearchableSelect
                  name="player2Id"
                  placeholder="Select player"
                  options={toOptions(players.docs).map((player) => ({ value: player.id, label: player.label }))}
                />
              </Field>
              <Field label="Pair name (optional)" className="sm:col-span-2">
                <Input name="name" placeholder="Defaults to Player 1 / Player 2" />
              </Field>
              <Field label="Club (optional)" className="sm:col-span-2">
                <SearchableSelect
                  name="clubId"
                  placeholder="None"
                  options={toOptions(clubs.docs).map((club) => ({ value: club.id, label: club.label }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton>Add pair</SubmitButton>
              </div>
            </form>
          )}
          <p className="text-xs text-ink-soft">
            Pairs you create here show up in the team list above, too - a pair is two players
            sharing one entry, which the rest of the system already tracks as a team.
          </p>
        </Card>
      ) : null}

      {activeTab === 'players' ? (
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
      ) : null}

      <StepActions sticky>
        <Button asChild>
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=registration`}>
            Continue to Registration
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

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 5: registration (who's competing) and draw/seeding (what
// order they're placed in) used to be one combined step and one combined mental model, even though
// the doc frames them as two decisions "sering dikerjakan oleh orang/waktu berbeda." Split into
// RegistrationStep (this one) and DrawStep below - both share the same category-switcher pattern
// and `ParticipantModeToCollection`/club-label helpers, but neither touches the other's concern:
// this one never renders a seed number, DrawStep never renders an add/remove control.
const RegistrationStep = async ({
  payload,
  eventId,
  categoryId,
  sourceSearch,
  sourceClub,
}: {
  payload: Payload
  eventId: string
  categoryId: string
  sourceSearch?: string
  sourceClub?: string
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
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 6: a 80-player event made this an unfiltered scroll of
  // "Add as entry" rows one click at a time. Search matches the source's own name; club filter only
  // applies to teams/players (a club-mode category's "sources" are clubs themselves).
  const sourceWhere: Where[] = [{ event_id: { equals: eventId } }]
  if (sourceSearch) {
    sourceWhere.push({ name: { contains: sourceSearch } })
  }
  if (sourceClub && collection !== 'clubs') {
    sourceWhere.push({ club_id: { equals: sourceClub } })
  }
  // depth: 1 on sourceDocs populates each team/player's own club_id. depth: 2 on entries reaches
  // one level further (entry -> team/player -> club) so both lists can show a club caption.
  const [sourceDocs, entries, clubOptionsResult] = await Promise.all([
    payload.find({ collection, depth: 1, limit: 300, where: { and: sourceWhere }, sort: 'name' }),
    payload.find({
      collection: 'competition-entries',
      depth: 2,
      limit: 300,
      // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 7: a withdrawn entry (see withdrawEntryAction) must
      // drop out of this list - otherwise it'd keep showing as "entered" here while also blocking
      // its participant from being re-added below via `enteredSourceIds`.
      where: {
        and: [{ category_id: { equals: selectedCategoryId } }, { status: { equals: 'confirmed' } }],
      },
      sort: 'seed_number',
    }),
    collection === 'clubs'
      ? Promise.resolve(null)
      : payload.find({
          collection: 'clubs',
          depth: 0,
          limit: 300,
          where: { event_id: { equals: eventId } },
          sort: 'name',
        }),
  ])
  const clubFilterOptions = clubOptionsResult?.docs ?? []

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
  const getSourceClubLabel = (doc: object) =>
    collection === 'clubs'
      ? undefined
      : getRelationshipLabel((doc as { club_id?: unknown }).club_id as RelationshipDoc, '') || undefined

  const getEntryClubLabel = (entry: { team_id?: unknown; player_id?: unknown }) => {
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
          <CardTitle>{stepNumber('registration')}. Registration</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Pick who&apos;s officially competing in this category - each one becomes an{' '}
            <GlossaryHint
              term="entry"
              definition={`A player, pair, team, or club officially registered into this category. Adding someone to the directory in step ${stepNumber('participants')} doesn't register them anywhere by itself.`}
              className="inline-block align-baseline"
            />
            . You&apos;ll set the draw order next, once registration is settled - that&apos;s its
            own step now.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-3" method="get" action="/workspaces/event-admin/new-event">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="step" value="registration" />
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

      <Card className="flex flex-col gap-3">
        <div>
          <CardTitle>
            Add {collectionLabel} as entries into {getRelationshipLabel(selectedCategory as RelationshipDoc)}
          </CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            This category&apos;s participant mode ({String(selectedCategory.participant_mode)}) only
            accepts {collectionLabel} as entries.
          </p>
        </div>

        {sourceDocs.totalDocs === 0 && !sourceSearch && !sourceClub ? (
          <EmptyState>
            No {collectionLabel} exist for this event yet.{' '}
            <Link
              href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=participants`}
              className="font-bold text-blue underline"
            >
              Go back to step {stepNumber('participants')}
            </Link>{' '}
            to add some, then come back here.
          </EmptyState>
        ) : (
          <>
            {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 6: search/club filter, both server-side (GET
                query params) so the filtered list is what actually gets bulk-added below - no
                client-side re-filtering to keep in sync with the checkbox form. */}
            <form
              className="flex flex-wrap items-end gap-3 border-b border-line pb-3"
              method="get"
              action="/workspaces/event-admin/new-event"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="step" value="registration" />
              <input type="hidden" name="categoryId" value={selectedCategoryId} />
              <Field label="Search by name" className="min-w-[180px] flex-1">
                <Input name="sourceSearch" defaultValue={sourceSearch || ''} placeholder={`Search ${collectionLabel}...`} />
              </Field>
              {clubFilterOptions.length > 0 ? (
                <Field label="Club" className="min-w-[160px]">
                  <Select name="sourceClub" defaultValue={sourceClub || ''}>
                    <option value="">All clubs</option>
                    {clubFilterOptions.map((club) => (
                      <option key={club.id} value={String(club.id)}>
                        {String(club.name)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>
              {sourceSearch || sourceClub ? (
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=registration&categoryId=${selectedCategoryId}`}
                  >
                    Clear
                  </Link>
                </Button>
              ) : null}
            </form>

            {availableSources.length === 0 ? (
              <EmptyState>
                {sourceSearch || sourceClub
                  ? 'No match for this filter.'
                  : `All ${collectionLabel} in this event are already entered here.`}
              </EmptyState>
            ) : (
              <form action={addEntriesAction} className="flex flex-col gap-3">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="categoryId" value={selectedCategoryId} />
                <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
                  <SelectAllCheckbox
                    targetName="sourceIds"
                    className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                  />
                  Select all {availableSources.length} shown
                </label>
                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                  {availableSources.map((source) => {
                    const clubLabel = getSourceClubLabel(source)
                    return (
                      <label
                        key={source.id}
                        className="flex cursor-pointer items-center gap-3 rounded-card border border-line bg-paper px-4 py-2.5"
                      >
                        <input
                          type="checkbox"
                          name="sourceIds"
                          value={String(source.id)}
                          className="h-4 w-4 shrink-0 rounded border-line text-green focus:ring-green/40"
                        />
                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-bold text-ink">{source.name}</strong>
                          {clubLabel ? (
                            <span className="block truncate text-xs text-ink-soft">{clubLabel}</span>
                          ) : null}
                        </div>
                      </label>
                    )
                  })}
                </div>
                <div>
                  <SubmitButton size="sm">Add selected as entries</SubmitButton>
                </div>
              </form>
            )}
          </>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Registered ({entries.totalDocs})</CardTitle>
        {entries.docs.length === 0 ? (
          <EmptyState>No one is registered in this category yet.</EmptyState>
        ) : (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {entries.docs.map((entry) => {
              const clubLabel = getEntryClubLabel(entry)
              const formId = `withdraw-entry-${entry.id}`
              return (
                <form
                  key={entry.id}
                  id={formId}
                  action={withdrawEntryAction.bind(null, String(entry.id))}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-2.5"
                >
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="categoryId" value={selectedCategoryId} />
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-ink">{entry.display_name}</strong>
                    {clubLabel ? (
                      <span className="block truncate text-xs text-ink-soft">{clubLabel}</span>
                    ) : null}
                  </div>
                  <ConfirmSubmitButton
                    formId={formId}
                    confirmMessage={`Remove ${entry.display_name} from this category? They can be re-added later.`}
                    variant="secondary"
                    size="sm"
                  >
                    Remove
                  </ConfirmSubmitButton>
                </form>
              )
            })}
          </div>
        )}
      </Card>

      <StepActions sticky>
        <Button asChild>
          <Link
            href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=draw&categoryId=${selectedCategoryId}`}
          >
            Continue to Draw &amp; Seeding
          </Link>
        </Button>
      </StepActions>
    </>
  )
}

const DrawStep = async ({
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

  // Prefer a category that actually has entries to seed over one with none yet - seeding an empty
  // category has nothing to show, so it's a worse default than one that's ready for a draw.
  const categoryIds = categories.docs.map((cat) => String(cat.id))
  const entryCountsResult = categoryId
    ? null
    : categoryIds.length
      ? await payload.find({
          collection: 'competition-entries',
          depth: 0,
          limit: 2000,
          where: {
            and: [{ category_id: { in: categoryIds } }, { status: { equals: 'confirmed' } }],
          },
        })
      : null
  const entryCountByCategory = new Map<string, number>()
  for (const entry of entryCountsResult?.docs ?? []) {
    const catId = String(getRelationshipId(entry.category_id as RelationshipDoc))
    entryCountByCategory.set(catId, (entryCountByCategory.get(catId) || 0) + 1)
  }
  const nextCategoryWithEntries = categories.docs.find(
    (cat) => cat.status !== 'draft' && (entryCountByCategory.get(String(cat.id)) || 0) >= 2,
  )

  const selectedCategoryId =
    categoryId || String(nextCategoryWithEntries?.id ?? categories.docs[0]?.id ?? '')
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
  const entries = await payload.find({
    collection: 'competition-entries',
    depth: 2,
    limit: 300,
    where: {
      and: [{ category_id: { equals: selectedCategoryId } }, { status: { equals: 'confirmed' } }],
    },
    sort: 'seed_number',
  })

  const getEntryClubLabel = (entry: { team_id?: unknown; player_id?: unknown }) => {
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
          <CardTitle>{stepNumber('draw')}. Draw &amp; seeding</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Set each entry&apos;s{' '}
            <GlossaryHint
              term="seed"
              definition="The order participants are placed in the draw. Lower numbers are kept apart in early rounds so the strongest entries don't meet too soon."
              className="align-baseline"
            />
            {' '}for the bracket or schedule. Adding or removing who&apos;s registered happens in
            the previous step.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-3" method="get" action="/workspaces/event-admin/new-event">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="step" value="draw" />
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

      <Card className="flex flex-col gap-4">
        <CardTitle>
          {getRelationshipLabel(selectedCategory as RelationshipDoc)} entries ({entries.totalDocs})
        </CardTitle>
        {entries.docs.length === 0 ? (
          <EmptyState>
            No one is registered in this category yet.{' '}
            <Link
              href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=registration&categoryId=${selectedCategoryId}`}
              className="font-bold text-blue underline"
            >
              Go back to Registration
            </Link>{' '}
            to add participants first.
          </EmptyState>
        ) : (
          <>
            <form id="shuffle-seeds-form" action={shuffleSeedsAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={selectedCategoryId} />
              {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 4: this used to fire an immediate random
                  mutation with zero warning - a misclick threw away a seed order someone may have
                  spent real time arranging, with no preview or way back. A real ConfirmDialog
                  closes the actual data-loss risk and matches the same pattern already used for
                  withdrawing an entry (ConfirmSubmitButton, see RegistrationStep). */}
              <ConfirmSubmitButton
                formId="shuffle-seeds-form"
                confirmMessage={`Shuffle seed order for all ${entries.totalDocs} entries in ${getRelationshipLabel(selectedCategory as RelationshipDoc)}? This replaces the current order and can't be undone automatically.`}
                variant="secondary"
                size="sm"
              >
                Shuffle Seeds
              </ConfirmSubmitButton>
            </form>
            <SeedOrderTable
              eventId={eventId}
              categoryId={selectedCategoryId}
              entries={entries.docs.map((entry) => ({
                id: String(entry.id),
                displayName: String(entry.display_name),
                clubLabel: getEntryClubLabel(entry) || undefined,
                seedNumber: entry.seed_number != null ? Number(entry.seed_number) : null,
              }))}
            />
          </>
        )}
      </Card>

      <StepActions sticky>
        <Button asChild>
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=generate`}>
            Continue to Generate Matches
          </Link>
        </Button>
      </StepActions>
    </>
  )
}

const GenerateStep = async ({
  payload,
  eventId,
  categoryId,
}: {
  payload: Payload
  eventId: string
  categoryId?: string
}) => {
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

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md P1 item 6: "Venue availability sebelum generation" - matches
  // used to generate with zero signal about whether there's anywhere to actually play them, so the
  // gap only surfaced later in the Scheduler workspace. A court with no sport_id set is usable by
  // any sport (shared/multi-purpose court); one with a sport_id only covers that sport.
  const courts =
    categoryIds.length > 0
      ? await payload.find({
          collection: 'courts',
          depth: 0,
          limit: 500,
          where: { and: [{ event_id: { equals: eventId } }, { is_active: { equals: true } }] },
        })
      : { docs: [] as { sport_id?: unknown }[] }
  const anyCourtIsSportAgnostic = courts.docs.some((court) => !court.sport_id)
  const sportIdsWithCourts = new Set(courts.docs.map((court) => String(court.sport_id)).filter(Boolean))
  const courtCountBySport = new Map<string, number>()
  for (const court of courts.docs) {
    if (court.sport_id) {
      const key = String(court.sport_id)
      courtCountBySport.set(key, (courtCountBySport.get(key) || 0) + 1)
    }
  }

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md P1 item 7: "Schedule preview dengan capacity estimate" -
  // before this, generating matches gave no sense of how much work is about to be created. This
  // stops short of the doc's full court-hours estimate (Venues/Courts don't model operating
  // hours or match duration yet - that's separate scheduling-infrastructure work), but match
  // count/round count/byes are all real numbers computable today from confirmed entries alone,
  // and are worth surfacing before a click that can create 100+ match rows.
  const getGenerationEstimate = (formatType: string, confirmedCount: number): string | null => {
    if (confirmedCount < 2) {
      return null
    }
    if (formatType === 'single_elimination') {
      const bracketSize = getNextPowerOfTwo(confirmedCount)
      const totalRounds = Math.log2(bracketSize)
      const byeCount = bracketSize - confirmedCount
      const realMatches = bracketSize - 1 - byeCount
      return `${realMatches} match${realMatches === 1 ? '' : 'es'} · ${totalRounds} round${totalRounds === 1 ? '' : 's'}${byeCount > 0 ? ` · ${byeCount} bye${byeCount === 1 ? '' : 's'}` : ''}`
    }
    if (formatType === 'round_robin') {
      const matchCount = (confirmedCount * (confirmedCount - 1)) / 2
      return `${matchCount} match${matchCount === 1 ? '' : 'es'} (round robin, everyone plays once)`
    }
    if (formatType === 'double_elimination') {
      if (!isExactPowerOfTwo(confirmedCount)) {
        return `Needs an exact power-of-two entry count (4, 8, 16...) - currently ${confirmedCount}`
      }
      // Every entrant but the eventual champion loses exactly twice (the champion loses at most
      // once) - the standard double-elimination match-count identity: 2N-2 without a grand final
      // reset, 2N-1 if the losers-bracket finalist forces one.
      const withoutReset = 2 * confirmedCount - 2
      return `${withoutReset}-${withoutReset + 1} matches (double elimination, winners + losers bracket + grand final)`
    }
    if (formatType === 'time_trial' || formatType === 'score_ranking') {
      return `${confirmedCount} attempt${confirmedCount === 1 ? '' : 's'} (one per entry, ranked by result once recorded)`
    }
    return null
  }

  const categoriesWithCounts = categories.docs.map((category) => ({
    category,
    confirmedCount: confirmedCountByCategory.get(String(category.id)) || 0,
    hasCourt: anyCourtIsSportAgnostic || sportIdsWithCourts.has(String(category.sport_id)),
    courtCount:
      (anyCourtIsSportAgnostic ? courts.docs.filter((court) => !court.sport_id).length : 0) +
      (courtCountBySport.get(String(category.sport_id)) || 0),
  }))

  const selectedCategory = categoryId
    ? categories.docs.find((category) => String(category.id) === categoryId)
    : undefined
  const showGroupKnockoutPanel = selectedCategory?.format_type === 'group_stage_to_knockout'

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>{stepNumber('generate')}. Generate matches</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Choose a category with at least two confirmed entries. Single Elimination and Round
            Robin categories generate a seeded first round automatically; Group Stage to Knockout
            categories use the Groups panel below; other formats must be scheduled manually in the
            Scheduler workspace.
          </p>
        </div>
        {courts.docs.length === 0 ? (
          <AlertBanner tone="warning">
            No venues or courts are set up for this event yet. Matches can still generate, but
            nothing will have anywhere to be scheduled until you{' '}
            <Link href="/workspaces/event-admin/facilities" className="font-bold underline">
              add at least one court
            </Link>
            .
          </AlertBanner>
        ) : null}
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {categoriesWithCounts.map(({ category, confirmedCount, hasCourt, courtCount }) => {
            const isGroupStageToKnockout = category.format_type === 'group_stage_to_knockout'
            const estimate = getGenerationEstimate(String(category.format_type), confirmedCount)
            return (
              <div
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-ink">{category.name}</strong>
                  <span className="text-xs font-semibold text-ink-soft">
                    {String(category.format_type).replaceAll('_', ' ')} &middot; {confirmedCount} confirmed entries
                  </span>
                  {estimate ? (
                    <span className="block text-xs text-ink-soft">
                      Will generate: {estimate} &middot; {courtCount} court{courtCount === 1 ? '' : 's'} available
                      for this sport
                    </span>
                  ) : null}
                  {!hasCourt && courts.docs.length > 0 ? (
                    <span className="block text-xs font-semibold text-gold">
                      No court covers this sport yet
                    </span>
                  ) : null}
                </div>
                {isGroupStageToKnockout ? (
                  <Button asChild size="sm" variant={String(category.id) === categoryId ? 'primary' : 'secondary'}>
                    <Link
                      href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=generate&categoryId=${category.id}`}
                    >
                      Manage Groups
                    </Link>
                  </Button>
                ) : (
                  <form action={generateMatchesAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <SubmitButton
                      size="sm"
                      disabled={confirmedCount < 2 || !AUTO_GENERATE_FORMATS.has(String(category.format_type))}
                    >
                      Generate Matches
                    </SubmitButton>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {showGroupKnockoutPanel ? (
        <GroupKnockoutPanel
          payload={payload}
          eventId={eventId}
          categoryId={categoryId!}
          category={{
            name: String(selectedCategory!.name),
            slug: String(selectedCategory!.slug),
            group_qualify_count: selectedCategory!.group_qualify_count ?? null,
          }}
        />
      ) : null}
    </>
  )
}

const BracketStep = async ({
  payload,
  eventId,
  eventSlug,
  eventStatus,
  eventVisibility,
  categoryId,
  generated,
  failed,
  published,
}: {
  payload: Payload
  eventId: string
  eventSlug: string
  eventStatus: string
  eventVisibility: string
  categoryId: string
  generated: string
  failed: string
  published: string
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
  const isGroupStageToKnockout = category?.format_type === 'group_stage_to_knockout'
  // group_stage_to_knockout categories have two stages (group stage order 1, knockout order 2) -
  // prefer the knockout stage once it exists (post-promotion) so this step shows the actual
  // bracket instead of getting stuck on the group stage's round-robin fixture list forever.
  const stageResult = category
    ? await payload.find({
        collection: 'stages',
        depth: 0,
        limit: 1,
        where: {
          and: [
            { category_id: { equals: selectedCategoryId } },
            { order: { equals: isGroupStageToKnockout ? 2 : 1 } },
          ],
        },
      })
    : null
  let stage = stageResult?.docs[0]
  if (!stage && isGroupStageToKnockout) {
    const groupStageResult = await payload.find({
      collection: 'stages',
      depth: 0,
      limit: 1,
      where: { and: [{ category_id: { equals: selectedCategoryId } }, { order: { equals: 1 } }] },
    })
    stage = groupStageResult.docs[0]
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-extrabold text-ink">{stepNumber('bracket')}. Bracket / fixtures</h2>
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
      ) : stage.stage_type === 'double_elimination' ? (
        <DoubleEliminationBracketView payload={payload} stageId={String(stage.id)} />
      ) : stage.stage_type === 'time_trial' || stage.stage_type === 'score_ranking' ? (
        <RankingAttemptsList payload={payload} stageId={String(stage.id)} />
      ) : (
        <RoundRobinFixtureList payload={payload} stageId={String(stage.id)} />
      )}

      <StepActions>
        <Button asChild variant="secondary">
          <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=registration`}>
            Generate another category
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/workspaces/scheduler">Go to Scheduler</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/workspaces/brackets">Go to Brackets Workspace</Link>
        </Button>
      </StepActions>

      {/* NOVICE_ADMIN_FLOW_UX_REDESIGN.md P1 item 9: "Publish harus memberi tiga opsi yang mudah
          dipahami: Simpan sebagai draft; Publish informasi event saja; Publish event dan schedule."
          Previously the wizard's last action was a single "Finish Setup & View Event Page" link
          that never actually changed status/visibility at all - every event silently stayed
          status=draft/visibility=hidden (its create-time default) unless the admin separately found
          the Event Details workspace page. Three explicit choices instead of one implicit no-op. */}
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Publish</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Choose what visitors can see right now. You can change this anytime from Event Details.
          </p>
        </div>
        {published === 'draft' ? (
          <AlertBanner tone="info">Saved as draft. Nothing is visible to visitors yet.</AlertBanner>
        ) : null}
        <p className="text-xs font-semibold text-ink-soft">
          Current status: <span className="text-ink">{eventStatus.replaceAll('_', ' ')}</span>
          {' · '}Visibility: <span className="text-ink">{eventVisibility.replaceAll('_', ' ')}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <form
            action={publishEventAction}
            className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4"
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="publishOption" value="draft" />
            <strong className="text-sm font-bold text-ink">Keep as draft</strong>
            <p className="flex-1 text-xs text-ink-soft">
              Nothing is visible publicly. Come back and publish whenever you&apos;re ready.
            </p>
            <SubmitButton variant="secondary" size="sm">
              Save as draft
            </SubmitButton>
          </form>
          <form
            action={publishEventAction}
            className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4"
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="publishOption" value="info" />
            <strong className="text-sm font-bold text-ink">Publish event info only</strong>
            <p className="flex-1 text-xs text-ink-soft">
              The public page goes live as &ldquo;Coming Soon&rdquo; - visitors see the event
              details, not results.
            </p>
            <SubmitButton variant="secondary" size="sm">
              Publish info
            </SubmitButton>
          </form>
          <form
            action={publishEventAction}
            className="flex flex-col gap-2 rounded-card border border-line bg-paper p-4"
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="publishOption" value="full" />
            <strong className="text-sm font-bold text-ink">Publish event &amp; schedule</strong>
            <p className="flex-1 text-xs text-ink-soft">
              Everything goes live - schedule, standings, and brackets become visible to visitors.
            </p>
            <SubmitButton size="sm">Publish everything</SubmitButton>
          </form>
        </div>
        {/* No separate desktop/mobile preview frame - the public page is responsive by design
            (same breakpoints used throughout this app), and staff already see a live "Admin
            Preview" bar on it regardless of publish state (see events/[eventSlug]/page.tsx). */}
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href={`/events/${eventSlug}`}>Preview event page (desktop &amp; mobile) →</Link>
        </Button>
      </Card>
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

// Renders as three stacked brackets (winners / losers / grand final) rather than integrating the
// @g-loot/react-tournament-brackets package's dedicated DoubleEliminationBracket component - that
// component expects a cross-linked matches.upper/matches.lower shape (including
// nextLooserMatchId) that would need its own transform layer, whereas reusing BracketTree three
// times gets a working, readable view from code that's already shipped and tested.
const DoubleEliminationBracketView = async ({ payload, stageId }: { payload: Payload; stageId: string }) => {
  const layout = await buildDoubleEliminationBracketLayout(payload, stageId)
  const { grand_final: grandFinal, grand_final_reset: grandFinalReset } = layout.bracketData
  const grandFinalRounds =
    grandFinal ?
      [
        {
          name: 'Grand Final',
          order: 0,
          matches: [
            grandFinal,
            ...(grandFinalReset && grandFinalReset.status !== 'cancelled' ? [grandFinalReset] : []),
          ],
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-3 text-sm font-extrabold text-ink">Winners bracket</h3>
        <BracketTree rounds={layout.bracketData.winners_rounds} champion={null} />
      </Card>
      {layout.bracketData.losers_rounds.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-sm font-extrabold text-ink">Losers bracket</h3>
          <BracketTree rounds={layout.bracketData.losers_rounds} champion={null} />
        </Card>
      ) : null}
      {grandFinalRounds.length > 0 ? (
        <Card>
          <h3 className="mb-3 text-sm font-extrabold text-ink">Grand final</h3>
          <BracketTree rounds={grandFinalRounds} champion={layout.bracketData.champion} />
        </Card>
      ) : null}
    </div>
  )
}

const RankingAttemptsList = async ({ payload, stageId }: { payload: Payload; stageId: string }) => {
  const matches = await payload.find({
    collection: 'matches',
    depth: 1,
    limit: 200,
    sort: ['match_number'],
    where: { stage_id: { equals: stageId } },
  })

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>Attempts ({matches.totalDocs})</CardTitle>
      <p className="text-sm text-ink-soft">
        Each confirmed entry gets one attempt record. Record results from the Matches workspace -
        this step is just a readiness overview, not where you enter values.
      </p>
      {matches.docs.length === 0 ? (
        <EmptyState>No attempt records generated yet.</EmptyState>
      ) : (
        <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
          {matches.docs.map((match) => (
            <div
              key={match.id}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3"
            >
              <div className="min-w-0">
                <strong className="block truncate text-sm font-bold text-ink">
                  {getRelationshipLabel(match.participant_a_entry_id as RelationshipDoc)}
                </strong>
                <span className="text-xs font-semibold text-ink-soft">{match.match_number}</span>
              </div>
              <span className="shrink-0 text-xs font-bold text-ink-soft">
                {match.result_qualifier
                  ? String(match.result_qualifier).toUpperCase()
                  : typeof match.result_value === 'number'
                    ? match.result_value
                    : formatStatus(match.status)}
              </span>
            </div>
          ))}
        </div>
      )}
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

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 8: `recordAuditLog` is already called from nearly every
// action in this wizard (and in event-admin proper), so the data exists - this step just needed a
// viewer. `audit-logs` is a polymorphic table (entity_type + entity_id, no event_id column), so
// "everything that happened to this event" means collecting every entity id this event owns across
// the collections that carry an `event_id` field, then matching audit rows against that set.
const HISTORY_ENTITY_COLLECTIONS = [
  'sports',
  'rulesets',
  'competition-categories',
  'clubs',
  'teams',
  'players',
  'competition-entries',
  'venues',
  'courts',
  'matches',
  'match-sets',
] as const

const HistoryStep = async ({ payload, eventId }: { payload: Payload; eventId: string }) => {
  const idsByCollection = await Promise.all(
    HISTORY_ENTITY_COLLECTIONS.map((collection) =>
      payload.find({
        collection,
        depth: 0,
        limit: 5000,
        where: { event_id: { equals: eventId } },
      }),
    ),
  )

  const orConditions: Where[] = [
    { and: [{ entity_type: { equals: 'events' } }, { entity_id: { equals: String(eventId) } }] },
  ]
  HISTORY_ENTITY_COLLECTIONS.forEach((collection, index) => {
    const ids = idsByCollection[index].docs.map((doc) => String(doc.id))
    if (ids.length > 0) {
      orConditions.push({ and: [{ entity_type: { equals: collection } }, { entity_id: { in: ids } }] })
    }
  })

  const logs = await payload.find({
    collection: 'audit-logs',
    depth: 1,
    limit: 300,
    sort: '-createdAt',
    where: { or: orConditions },
  })

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>{stepNumber('history')}. Change history</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Every recorded change for this event across sports, categories, participants, entries,
          venues, and matches — most recent first.
        </p>
      </div>
      <AuditLogPanel entries={logs.docs as unknown as AuditLogSummary[]} />
    </Card>
  )
}
