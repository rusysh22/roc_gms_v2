'use server'

import type { Payload } from 'payload'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import { recordAuditLog } from '@/lib/audit'
import { advanceCategoriesStatus } from '@/lib/categoryLifecycle'
import { DEFAULT_EVENT_TIMEZONE, EVENT_TIMEZONE_OPTIONS } from '@/lib/timezone'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { ACTIVE_EVENT_COOKIE } from '../../../activeEvent'
import { slugify, text, wizardPage } from './wizardShared'

const eventTimezones = new Set<string>(EVENT_TIMEZONE_OPTIONS.map((option) => option.value))

// Tries base-2, base-3, ... until one isn't taken, so a duplicate-slug error can offer a ready-to-use
// alternative instead of making the user guess-and-check. Capped at 50 attempts - if a base slug
// somehow already has 50 numbered variants taken, falling through to "no suggestion" is fine.
// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 1 (option A): the Setup Assistant (Step 0) is optional and
// its answers arrive as raw form fields with no prior server-side check - an invalid/tampered
// value here is a non-critical hint, not worth hard-failing event creation over, so it's silently
// dropped rather than redirected as an error. Curated subset only (not the full format_type enum -
// see the Categories step's own dropdown for the rest).
const setupTournamentTypes = new Set(['single_elimination', 'round_robin', 'group_stage_to_knockout', 'league'])
const setupParticipantModes = new Set(['individual', 'pair', 'team', 'club'])
const setupParticipantSources = new Set(['manual', 'excel', 'registration_form', 'copy_previous'])
const setupEventScales = new Set(['single_sport', 'multi_sport'])

const findAvailableSlug = async (payload: Payload, base: string): Promise<string | null> => {
  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 80)
    const existing = await payload.count({ collection: 'events', where: { slug: { equals: candidate } } })
    if (existing.totalDocs === 0) return candidate
  }
  return null
}

export async function createEventAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const name = text(formData, 'name')
  const rawSlug = text(formData, 'slug')
  const slug = slugify(rawSlug || name)
  const start = text(formData, 'eventStart')
  const end = text(formData, 'eventEnd')
  const location = text(formData, 'location')
  const organizerName = text(formData, 'organizerName')
  const timezoneInput = text(formData, 'timezone')
  const timezone = eventTimezones.has(timezoneInput) ? timezoneInput : DEFAULT_EVENT_TIMEZONE
  const setupTournamentTypeInput = text(formData, 'setupTournamentType')
  const setupParticipantModeInput = text(formData, 'setupParticipantMode')
  const setupParticipantSourceInput = text(formData, 'setupParticipantSource')
  const setupEventScaleInput = text(formData, 'setupEventScale')
  const setupTournamentType = setupTournamentTypes.has(setupTournamentTypeInput) ? setupTournamentTypeInput : undefined
  const setupParticipantMode = setupParticipantModes.has(setupParticipantModeInput) ? setupParticipantModeInput : undefined
  const setupParticipantSource = setupParticipantSources.has(setupParticipantSourceInput)
    ? setupParticipantSourceInput
    : undefined
  const setupEventScale = setupEventScales.has(setupEventScaleInput) ? setupEventScaleInput : undefined

  // Failed submissions redirect back with every entered value in the query string so the form can
  // re-populate itself - previously a validation error (or a taken slug) silently wiped the whole
  // form and the user had to retype everything from scratch. Setup Assistant answers ride along
  // the same way, so a bounced submission doesn't quietly lose them.
  const redirectWithInput = (errorCode: string, extra?: Record<string, string>): never => {
    const query = new URLSearchParams({
      step: 'event',
      wizardError: errorCode,
      name,
      slug: rawSlug,
      eventStart: start,
      eventEnd: end,
      location,
      organizerName,
      timezone,
      setupTournamentType: setupTournamentTypeInput,
      setupParticipantMode: setupParticipantModeInput,
      setupParticipantSource: setupParticipantSourceInput,
      setupEventScale: setupEventScaleInput,
      ...extra,
    })
    redirect(`${wizardPage}?${query.toString()}`)
  }

  if (!name || !slug || !start || !end) {
    redirectWithInput('invalid_event')
  }
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    redirectWithInput('invalid_date_range')
  }

  const duplicate = await payload.find({
    collection: 'events',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.length > 0) {
    const suggestedSlug = await findAvailableSlug(payload, slug)
    redirectWithInput('duplicate_slug', suggestedSlug ? { suggestedSlug } : undefined)
  }

  let logoId: number | undefined
  const logoFile = formData.get('logo')
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!logoFile.type.startsWith('image/')) {
      redirectWithInput('invalid_logo')
    }
    const buffer = Buffer.from(await logoFile.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${name} logo` },
      file: { data: buffer, mimetype: logoFile.type, name: logoFile.name, size: logoFile.size },
    })
    logoId = Number(media.id)
  }

  const data = {
    name,
    slug,
    logo: logoId,
    event_start_at: new Date(start).toISOString(),
    event_end_at: new Date(end).toISOString(),
    timezone: timezone as (typeof EVENT_TIMEZONE_OPTIONS)[number]['value'],
    location: location || undefined,
    organizer_name: organizerName || undefined,
    status: 'draft' as const,
    visibility: 'hidden' as const,
    setup_tournament_type: setupTournamentType as
      | 'single_elimination'
      | 'round_robin'
      | 'group_stage_to_knockout'
      | 'league'
      | undefined,
    setup_participant_mode: setupParticipantMode as 'individual' | 'pair' | 'team' | 'club' | undefined,
    setup_participant_source: setupParticipantSource as
      | 'manual'
      | 'excel'
      | 'registration_form'
      | 'copy_previous'
      | undefined,
    setup_event_scale: setupEventScale as 'single_sport' | 'multi_sport' | undefined,
  }
  const created = await payload.create({ collection: 'events', data })
  await recordAuditLog({
    payload,
    action: 'event.create',
    entityType: 'events',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 13: without this, the workspace's "active event" stayed
  // whatever it was before the wizard ran (or fell back to the earliest-starting event), so an
  // admin who just finished creating an event could leave the wizard and land back on an old one.
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_EVENT_COOKIE, String(created.id), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath(wizardPage)
  revalidatePath('/workspaces/event-admin')
  redirect(`${wizardPage}?eventId=${created.id}&step=sports&wizardCreated=1`)
}

// The bulk schedule-revision spreadsheet (export current schedule -> edit dates/venues/courts in
// Excel -> upload) already exists in the Scheduler workspace. Rather than duplicate it into the
// wizard, this points there with the wizard's event set as the active one first, so the Scheduler's
// cookie-based event resolution lands on the right event even mid-wizard.
export async function openScheduleImportAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })
  const eventId = text(formData, 'eventId')
  const event = eventId
    ? await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
    : null
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_EVENT_COOKIE, String(event!.id), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })
  redirect('/workspaces/scheduler/import')
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P1 item 9: the wizard's last step used to be a single "Finish
// Setup & View Event Page" link that never actually changed the event's own status/visibility -
// every event stayed status=draft/visibility=hidden (the create-time default) forever unless the
// admin separately found the Event Details workspace page and changed it there themselves, with no
// hint from the wizard that this step was still needed. Three explicit choices instead of one
// implicit no-op, matching the doc's own "Simpan sebagai draft / Publish informasi event saja /
// Publish event dan schedule" - each is a distinct (status, visibility) pair on the Events
// collection, not a new concept of its own.
const PUBLISH_OPTIONS = {
  draft: { status: 'draft', visibility: 'hidden' },
  info: { status: 'coming_soon', visibility: 'published' },
  full: { status: 'live', visibility: 'published' },
} as const

export async function publishEventAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const option = text(formData, 'publishOption')
  if (!eventId || !(option in PUBLISH_OPTIONS)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=bracket&wizardError=invalid_publish_option`)
  }

  const before = await payload.findByID({ collection: 'events', id: eventId, depth: 0 }).catch(() => null)
  if (!before) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }

  const data = PUBLISH_OPTIONS[option as keyof typeof PUBLISH_OPTIONS]
  await payload.update({ collection: 'events', id: eventId, data })
  await recordAuditLog({
    payload,
    action: 'event.publish',
    entityType: 'events',
    entityId: eventId,
    before,
    after: { ...before, ...data },
    actorUserId: user.id,
  })

  // Taking the event public publishes every category that has completed its draw (locked ->
  // published) so its bracket/standings actually show on the public site. Categories still in
  // draft/open (setup not finished) and any manually archived one are left as-is.
  if (data.visibility === 'published') {
    const lockedCategories = await payload.find({
      collection: 'competition-categories',
      depth: 0,
      limit: 500,
      where: { and: [{ event_id: { equals: eventId } }, { status: { equals: 'locked' } }] },
    })
    await advanceCategoriesStatus(
      payload,
      lockedCategories.docs.map((category) => category.id),
      'published',
      user.id,
    )
  }

  revalidatePath(wizardPage)
  revalidatePath('/workspaces/event-admin')
  revalidatePath(`/events/${before!.slug}`)

  const eventSlug = String(before!.slug)
  if (option === 'draft') {
    redirect(`${wizardPage}?eventId=${eventId}&step=bracket&wizardPublished=draft`)
  }
  redirect(`/events/${eventSlug}`)
}
