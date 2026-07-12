'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { recordAuditLog } from '@/lib/audit'
import { parseParticipantsWorkbook } from '@/lib/participantsImport'
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

const validGenders = new Set(['male', 'female', 'other', 'prefer_not_to_say'])

export async function importParticipantsAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }

  let parsed
  try {
    parsed = parseParticipantsWorkbook(await file.arrayBuffer())
  } catch {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }

  if (parsed.clubs.length === 0 && parsed.teams.length === 0 && parsed.players.length === 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=empty_import`)
  }

  const existingClubs = await payload.find({
    collection: 'clubs',
    depth: 0,
    limit: 1000,
    where: { event_id: { equals: eventId } },
  })
  const clubIdByName = new Map<string, number>()
  for (const club of existingClubs.docs) {
    clubIdByName.set(String(club.name).trim().toLowerCase(), Number(club.id))
  }

  let created = 0
  let skipped = 0

  for (const row of parsed.clubs) {
    const slug = slugify(row.name)
    const key = row.name.trim().toLowerCase()
    if (!slug || clubIdByName.has(key)) {
      skipped += 1
      continue
    }
    try {
      const duplicate = await payload.find({
        collection: 'clubs',
        depth: 0,
        limit: 1,
        where: { slug: { equals: slug } },
      })
      if (duplicate.docs.length > 0) {
        skipped += 1
        continue
      }
      const data = {
        event_id: Number(eventId),
        name: row.name,
        slug,
        contact_person: row.contactPerson,
        contact_email: row.contactEmail,
      }
      const doc = await payload.create({ collection: 'clubs', data })
      clubIdByName.set(key, Number(doc.id))
      created += 1
    } catch {
      skipped += 1
    }
  }

  for (const row of parsed.teams) {
    const slug = slugify(row.name)
    if (!slug) {
      skipped += 1
      continue
    }
    try {
      const duplicate = await payload.find({
        collection: 'teams',
        depth: 0,
        limit: 1,
        where: { slug: { equals: slug } },
      })
      if (duplicate.docs.length > 0) {
        skipped += 1
        continue
      }
      const clubId = row.clubName ? clubIdByName.get(row.clubName.trim().toLowerCase()) : undefined
      const data = {
        event_id: Number(eventId),
        club_id: clubId,
        name: row.name,
        slug,
        contact_email: row.contactEmail,
      }
      await payload.create({ collection: 'teams', data })
      created += 1
    } catch {
      skipped += 1
    }
  }

  for (const row of parsed.players) {
    try {
      const clubId = row.clubName ? clubIdByName.get(row.clubName.trim().toLowerCase()) : undefined
      const gender = row.gender && validGenders.has(row.gender) ? row.gender : undefined
      const data = {
        event_id: Number(eventId),
        club_id: clubId,
        name: row.name,
        email: row.email,
        gender,
      }
      await payload.create({ collection: 'players', data })
      created += 1
    } catch {
      skipped += 1
    }
  }

  await recordAuditLog({
    payload,
    action: 'participants.bulk_import',
    entityType: 'events',
    entityId: eventId,
    before: null,
    after: {
      created,
      skipped,
      clubs: parsed.clubs.length,
      teams: parsed.teams.length,
      players: parsed.players.length,
    },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(
    `${wizardPage}?eventId=${eventId}&step=participants&wizardImported=${created}${
      skipped ? `&wizardImportSkipped=${skipped}` : ''
    }`,
  )
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
