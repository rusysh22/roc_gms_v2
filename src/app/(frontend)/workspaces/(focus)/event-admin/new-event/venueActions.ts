'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, text, wizardPage } from './wizardShared'

// Wizard-scoped venue/court CRUD - mirrors sportActions.ts. The Facilities workspace
// (facilityActions.ts) does the same against the cookie-selected event; these take `eventId` from
// the form and land back on the wizard's Venues & Courts step, so a first-time organizer never has
// to leave the flow to give matches somewhere to be played.

const venuesStep = (eventId: string, query = '') =>
  `${wizardPage}?eventId=${eventId}&step=venues${query}`

export async function addVenueAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const name = text(formData, 'name')
  const isVirtual = text(formData, 'isVirtual') === 'on'

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name) {
    redirect(venuesStep(eventId, '&wizardError=invalid_venue'))
  }

  const data = {
    event_id: Number(eventId),
    name,
    address: text(formData, 'address') || undefined,
    map_url: text(formData, 'mapUrl') || undefined,
    is_virtual: isVirtual,
    virtual_url: isVirtual ? text(formData, 'virtualUrl') || undefined : undefined,
  }
  const created = await payload.create({ collection: 'venues', data })
  await recordAuditLog({
    payload,
    action: 'venue.create',
    entityType: 'venues',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(venuesStep(eventId, '&wizardUpdated=1'))
}

export async function deleteVenueAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const venueId = text(formData, 'venueId')

  const venue = await payload.findByID({ collection: 'venues', id: venueId, depth: 0 }).catch(() => null)
  if (!venue || String(venue.event_id) !== String(eventId)) {
    redirect(venuesStep(eventId, '&wizardError=invalid_relationship'))
  }

  // A venue with courts that already carry matches must be retired via those matches, not out from
  // under them - mirrors deleteSportAction's guard.
  const courts = await payload.find({
    collection: 'courts',
    depth: 0,
    limit: 200,
    where: { venue_id: { equals: venueId } },
  })
  const courtIds = courts.docs.map((court) => court.id)
  const matchCount = courtIds.length
    ? await payload.count({ collection: 'matches', where: { court_id: { in: courtIds } } })
    : { totalDocs: 0 }
  if (matchCount.totalDocs > 0) {
    redirect(venuesStep(eventId, '&wizardError=venue_in_use'))
  }

  for (const court of courts.docs) {
    await payload.delete({ collection: 'courts', id: court.id })
  }
  await payload.delete({ collection: 'venues', id: venueId })
  await recordAuditLog({
    payload,
    action: 'venue.delete',
    entityType: 'venues',
    entityId: venueId,
    before: venue,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(venuesStep(eventId, '&wizardUpdated=1'))
}

export async function addCourtAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const name = text(formData, 'name')
  const venueId = text(formData, 'venueId')
  const sportId = text(formData, 'sportId')
  const capacityRaw = text(formData, 'capacity')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name || !venueId) {
    redirect(venuesStep(eventId, '&wizardError=invalid_court'))
  }

  try {
    const venue = await payload.findByID({ collection: 'venues', id: venueId, depth: 0 })
    if (String(venue.event_id) !== String(eventId)) throw new Error('venue')
    if (sportId) {
      const sport = await payload.findByID({ collection: 'sports', id: sportId, depth: 0 })
      if (String(sport.event_id) !== String(eventId)) throw new Error('sport')
    }
  } catch {
    redirect(venuesStep(eventId, '&wizardError=invalid_relationship'))
  }

  const capacity = capacityRaw ? Number(capacityRaw) : undefined
  if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 0)) {
    redirect(venuesStep(eventId, '&wizardError=invalid_court'))
  }

  const data = {
    event_id: Number(eventId),
    venue_id: Number(venueId),
    name,
    sport_id: sportId ? Number(sportId) : undefined,
    capacity,
    is_active: true,
  }
  const created = await payload.create({ collection: 'courts', data })
  await recordAuditLog({
    payload,
    action: 'court.create',
    entityType: 'courts',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(venuesStep(eventId, '&wizardUpdated=1'))
}

export async function deleteCourtAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const courtId = text(formData, 'courtId')

  const court = await payload.findByID({ collection: 'courts', id: courtId, depth: 0 }).catch(() => null)
  if (!court || String(court.event_id) !== String(eventId)) {
    redirect(venuesStep(eventId, '&wizardError=invalid_relationship'))
  }

  const matchCount = await payload.count({ collection: 'matches', where: { court_id: { equals: courtId } } })
  if (matchCount.totalDocs > 0) {
    redirect(venuesStep(eventId, '&wizardError=court_in_use'))
  }

  await payload.delete({ collection: 'courts', id: courtId })
  await recordAuditLog({
    payload,
    action: 'court.delete',
    entityType: 'courts',
    entityId: courtId,
    before: court,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(venuesStep(eventId, '&wizardUpdated=1'))
}
