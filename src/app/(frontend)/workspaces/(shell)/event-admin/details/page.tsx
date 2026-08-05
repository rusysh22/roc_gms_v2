import { AlertBanner } from '@/components/ui/alert-banner'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_EVENT_TIMEZONE, EVENT_TIMEZONE_OPTIONS } from '@/lib/timezone'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { updateEventDetailsAction } from './detailsActions'
import { ReadinessChecklist } from './ReadinessChecklist'

export const dynamic = 'force-dynamic'

const detailsErrorMessages: Record<string, string> = {
  invalid_event: 'Fill in the event name, slug, dates, status, and visibility.',
  invalid_date_range: 'Event end time must be after the start time.',
  duplicate_slug: 'That slug is already used by another event.',
  missing_event: 'No active event to edit yet.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

// Every field this form reads is a plain scalar (never a relationship/upload), so the document
// `getActiveEvent` already fetched (it always pulls the full row - `depth` only changes whether
// relationship fields are populated, not which scalar columns come back) already has everything
// this page needs. Just widens the type instead of re-fetching the same row a second time.
type EventDetailsDoc = {
  name?: string | null
  slug?: string | null
  description?: string | null
  location?: string | null
  organizer_name?: string | null
  event_start_at?: string | null
  event_end_at?: string | null
  timezone?: string | null
  public_open_at?: string | null
  registration_open_at?: string | null
  registration_close_at?: string | null
  schedule_publish_at?: string | null
  archive_at?: string | null
  status?: string | null
  visibility?: string | null
  rules_summary?: string | null
}

// Payload stores dates as UTC ISO strings; datetime-local inputs need "YYYY-MM-DDTHH:mm" in
// whatever timezone renders/submits the form. Matches the same round-trip the New Event Wizard's
// create form already relies on (new Date(inputValue).toISOString()), so edit and create stay
// consistent with each other.
const toDateTimeLocalValue = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default async function EventDetailsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin/details',
    workspaceName: 'Event Details',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Event Setup"
          title="Event Details"
          summary="Edit this event's name, schedule window, status, and visibility."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const detailsError = get(params, 'detailsError')
  const detailsUpdated = get(params, 'detailsUpdated')
  const event = activeEvent as unknown as EventDetailsDoc

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Event Details"
        summary="Edit this event's name, schedule window, status, and visibility - no Payload Admin required."
      />

      {detailsError && detailsErrorMessages[detailsError] ? (
        <AlertBanner tone="error" className="mb-4">
          {detailsErrorMessages[detailsError]}
        </AlertBanner>
      ) : null}
      {detailsUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <div className="mb-6">
        <ReadinessChecklist payload={access.payload} eventId={String(activeEvent.id)} />
      </div>

      <form action={updateEventDetailsAction} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <CardTitle>Basic info</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event name" className="sm:col-span-2">
              <Input name="name" required defaultValue={event.name || ''} />
            </Field>
            <Field label="Slug (advanced)" className="sm:col-span-2">
              <Input name="slug" defaultValue={event.slug || ''} />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea name="description" defaultValue={event.description || ''} />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={event.location || ''} placeholder="e.g. Main Sports Hall" />
            </Field>
            <Field label="Organizer">
              <Input name="organizerName" defaultValue={event.organizer_name || ''} placeholder="e.g. HR Committee" />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Event timeline</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">
              Start and end are required. The rest control when the public page opens and when
              registration/schedule details become visible - leave any of them blank to skip that
              rule.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start">
              <Input
                name="eventStart"
                type="datetime-local"
                required
                defaultValue={toDateTimeLocalValue(event.event_start_at)}
              />
            </Field>
            <Field label="End">
              <Input
                name="eventEnd"
                type="datetime-local"
                required
                defaultValue={toDateTimeLocalValue(event.event_end_at)}
              />
            </Field>
            <Field
              label="Time zone"
              className="sm:col-span-2"
              description="Every schedule, match, and bracket time for this event is shown in this zone - on the public site and in the workspace."
            >
              <Select name="timezone" defaultValue={event.timezone || DEFAULT_EVENT_TIMEZONE}>
                {EVENT_TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Public page opens">
              <Input
                name="publicOpenAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(event.public_open_at)}
              />
            </Field>
            <Field label="Registration opens">
              <Input
                name="registrationOpenAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(event.registration_open_at)}
              />
            </Field>
            <Field label="Registration closes">
              <Input
                name="registrationCloseAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(event.registration_close_at)}
              />
            </Field>
            <Field label="Schedule publishes">
              <Input
                name="schedulePublishAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(event.schedule_publish_at)}
              />
            </Field>
            <Field label="Archives">
              <Input name="archiveAt" type="datetime-local" defaultValue={toDateTimeLocalValue(event.archive_at)} />
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Status &amp; visibility</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">
              Visibility controls whether this event's public page can be found at all - it must be
              something other than "Hidden" before anyone can view it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select name="status" defaultValue={event.status || 'draft'}>
                <option value="draft">Draft</option>
                <option value="setup">Setup</option>
                <option value="coming_soon">Coming soon</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select name="visibility" defaultValue={event.visibility || 'hidden'}>
                <option value="hidden">Hidden</option>
                <option value="coming_soon">Coming soon</option>
                <option value="preview_only">Preview only</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Rules summary (optional)</CardTitle>
          <Textarea
            name="rulesSummary"
            defaultValue={event.rules_summary || ''}
            placeholder="Short public-facing summary of house rules or conduct expectations."
          />
        </Card>

        <div>
          <SubmitButton>Save event details</SubmitButton>
        </div>
      </form>
    </>
  )
}
