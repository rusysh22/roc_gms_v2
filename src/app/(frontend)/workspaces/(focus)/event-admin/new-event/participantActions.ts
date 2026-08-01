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
  // Per-row detail so a failed import is actionable ("Jane Doe: duplicate name") instead of just
  // an opaque "N skipped" count the user has no way to act on. `skip` is a row that produced no
  // document at all; `warn` is a row that was still created but with a caveat worth surfacing
  // (e.g. its club name didn't match anything, or an invalid gender was dropped).
  const issues: { sheet: string; name: string; reason: string }[] = []
  const skip = (sheet: string, name: string, reason: string) => {
    skipped += 1
    issues.push({ sheet, name: name || '(blank)', reason })
  }
  const warn = (sheet: string, name: string, reason: string) => {
    issues.push({ sheet, name: name || '(blank)', reason })
  }

  for (const row of parsed.clubs) {
    const slug = slugify(row.name)
    const key = row.name.trim().toLowerCase()
    if (!slug) {
      skip('Clubs', row.name, 'Missing or invalid name')
      continue
    }
    if (clubIdByName.has(key)) {
      skip('Clubs', row.name, 'Duplicate club name in this event')
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
        skip('Clubs', row.name, 'A club with this name already exists')
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
      skip('Clubs', row.name, 'Could not save (unexpected error)')
    }
  }

  for (const row of parsed.teams) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Teams', row.name, 'Missing or invalid name')
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
        skip('Teams', row.name, 'A team with this name already exists')
        continue
      }
      const clubId = row.clubName ? clubIdByName.get(row.clubName.trim().toLowerCase()) : undefined
      if (row.clubName && !clubId) {
        warn('Teams', row.name, `Club "${row.clubName}" not found - saved without a club`)
      }
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
      skip('Teams', row.name, 'Could not save (unexpected error)')
    }
  }

  for (const row of parsed.players) {
    try {
      const clubId = row.clubName ? clubIdByName.get(row.clubName.trim().toLowerCase()) : undefined
      if (row.clubName && !clubId) {
        warn('Players', row.name, `Club "${row.clubName}" not found - saved without a club`)
      }
      const gender = row.gender && validGenders.has(row.gender) ? row.gender : undefined
      if (row.gender && !gender) {
        warn('Players', row.name, `Gender "${row.gender}" is not valid - saved without a gender`)
      }
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
      skip('Players', row.name, 'Could not save (unexpected error)')
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
      issues,
      clubs: parsed.clubs.length,
      teams: parsed.teams.length,
      players: parsed.players.length,
    },
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  const MAX_ISSUES_IN_URL = 25
  const issuesParam =
    issues.length > 0
      ? encodeURIComponent(JSON.stringify(issues.slice(0, MAX_ISSUES_IN_URL)))
      : ''
  const moreIssues = issues.length > MAX_ISSUES_IN_URL ? issues.length - MAX_ISSUES_IN_URL : 0
  redirect(
    `${wizardPage}?eventId=${eventId}&step=participants&wizardImported=${created}` +
      (skipped ? `&wizardImportSkipped=${skipped}` : '') +
      (issuesParam ? `&wizardImportIssues=${issuesParam}` : '') +
      (moreIssues ? `&wizardImportMoreIssues=${moreIssues}` : ''),
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
