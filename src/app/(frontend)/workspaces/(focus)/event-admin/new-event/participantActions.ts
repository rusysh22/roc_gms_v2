'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { WORKSPACE_ROLES, assertWorkspaceActionAccess } from '../../../workspaceAuth'
import { getWizardEvent, slugify, text, wizardPage } from './wizardShared'

const emailValid = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export async function addClubAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const name = text(formData, 'name')
  const slug = slugify(text(formData, 'slug') || name)
  const email = text(formData, 'contactEmail')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name || !slug || !emailValid(email)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_club`)
  }

  const duplicate = await payload.find({
    collection: 'clubs',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=duplicate_slug`)
  }

  const data = {
    event_id: Number(eventId),
    name,
    slug,
    contact_person: text(formData, 'contactPerson') || undefined,
    contact_email: email || undefined,
  }
  const created = await payload.create({ collection: 'clubs', data })
  await recordAuditLog({
    payload,
    action: 'club.create',
    entityType: 'clubs',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardUpdated=1`)
}

export async function addTeamAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const name = text(formData, 'name')
  const slug = slugify(text(formData, 'slug') || name)
  const clubId = text(formData, 'clubId')
  const email = text(formData, 'contactEmail')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name || !slug || !emailValid(email)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_team`)
  }

  if (clubId) {
    try {
      const club = await payload.findByID({ collection: 'clubs', id: clubId, depth: 0 })
      if (String(club.event_id) !== String(eventId)) {
        throw new Error('invalid_relationship')
      }
    } catch {
      redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_relationship`)
    }
  }

  const duplicate = await payload.find({
    collection: 'teams',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  if (duplicate.docs.length > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=duplicate_slug`)
  }

  const data = {
    event_id: Number(eventId),
    club_id: clubId ? Number(clubId) : undefined,
    name,
    slug,
    contact_email: email || undefined,
  }
  const created = await payload.create({ collection: 'teams', data })
  await recordAuditLog({
    payload,
    action: 'team.create',
    entityType: 'teams',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardUpdated=1`)
}

export async function addPlayerAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const name = text(formData, 'name')
  const clubId = text(formData, 'clubId')
  const email = text(formData, 'email')
  const gender = text(formData, 'gender')
  const genders = new Set(['male', 'female', 'other', 'prefer_not_to_say'])

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!name || !emailValid(email) || (gender && !genders.has(gender))) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_player`)
  }

  if (clubId) {
    try {
      const club = await payload.findByID({ collection: 'clubs', id: clubId, depth: 0 })
      if (String(club.event_id) !== String(eventId)) {
        throw new Error('invalid_relationship')
      }
    } catch {
      redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_relationship`)
    }
  }

  const data = {
    event_id: Number(eventId),
    club_id: clubId ? Number(clubId) : undefined,
    name,
    email: email || undefined,
    gender: gender || undefined,
  }
  const created = await payload.create({ collection: 'players', data })
  await recordAuditLog({
    payload,
    action: 'player.create',
    entityType: 'players',
    entityId: created.id,
    before: null,
    after: data,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardUpdated=1`)
}
