'use server'

import fs from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Payload } from 'payload'

import { recordAuditLog } from '@/lib/audit'
import { parseParticipantsWorkbook, type ParsedParticipantsWorkbook } from '@/lib/participantsImport'
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
    where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
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
    where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
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

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 4: a pair is stored as a Team internally (rosters always
// need a team_id, so a doubles pair is modeled as a 2-player team - AUDIT_E2E's own framing) - but
// an admin building a mixed-doubles category shouldn't have to know that, type a "team name," and
// separately go build a roster. This creates the Team AND both roster rows in one submit, from two
// player pickers, and every redirect/copy stays in "pair" language.
export async function addPairAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const player1Id = text(formData, 'player1Id')
  const player2Id = text(formData, 'player2Id')
  const clubId = text(formData, 'clubId')

  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!player1Id || !player2Id || player1Id === player2Id) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_pair`)
  }

  const [player1, player2] = await Promise.all([
    payload.findByID({ collection: 'players', id: player1Id, depth: 0 }).catch(() => null),
    payload.findByID({ collection: 'players', id: player2Id, depth: 0 }).catch(() => null),
  ])
  if (
    !player1 ||
    !player2 ||
    String(player1.event_id) !== String(eventId) ||
    String(player2.event_id) !== String(eventId)
  ) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_relationship`)
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

  const name = text(formData, 'name') || `${player1!.name} / ${player2!.name}`
  const baseSlug = slugify(name)
  let slug = baseSlug
  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const existing = await payload.count({
      collection: 'teams',
      where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
    })
    if (existing.totalDocs === 0) break
    slug = `${baseSlug}-${suffix}`.slice(0, 80)
  }

  const teamData = {
    event_id: Number(eventId),
    club_id: clubId ? Number(clubId) : undefined,
    name,
    slug,
  }
  const team = await payload.create({ collection: 'teams', data: teamData })
  await recordAuditLog({
    payload,
    action: 'team.create',
    entityType: 'teams',
    entityId: team.id,
    before: null,
    after: { ...teamData, pair: true },
    actorUserId: user.id,
  })

  for (const player of [player1!, player2!]) {
    const rosterData = {
      event_id: Number(eventId),
      team_id: Number(team.id),
      player_id: Number(player.id),
      role: 'player' as const,
      status: 'active' as const,
    }
    const roster = await payload.create({ collection: 'rosters', data: rosterData })
    await recordAuditLog({
      payload,
      action: 'roster.create',
      entityType: 'rosters',
      entityId: roster.id,
      before: null,
      after: rosterData,
      actorUserId: user.id,
    })
  }

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardUpdated=1`)
}

const validGenders = new Set(['male', 'female', 'other', 'prefer_not_to_say'])

// Local-disk media storage (see payload.config.ts's Media collection: staticDir under
// media/content) - reading a previously-uploaded file's bytes back is just a filesystem read.
// The preview step uploads here as scratch storage rather than committing anything yet;
// confirm re-reads and deletes it, cancel just deletes it.
const MEDIA_DIR = path.resolve(process.cwd(), 'media/content')

const parseImportFile = async (file: FormDataEntryValue | null): Promise<ParsedParticipantsWorkbook | null> => {
  if (!(file instanceof File) || file.size === 0) {
    return null
  }
  try {
    return parseParticipantsWorkbook(await file.arrayBuffer())
  } catch {
    return null
  }
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 2 gap-fill: "belum ada preview mapping yang menjawab
// apakah satu row menjadi club, team, player, roster, atau entry" - imports used to commit the
// instant a file was chosen, with zero chance to catch a wrong sheet/column before 80+ rows
// landed in the database. This is a read-only dry run over the same dedup rules
// confirmParticipantsImportAction uses for real, so what's previewed is what will happen -
// re-run fresh at confirm time (not trusted as a stale snapshot) in case anything changed
// in between.
const planParticipantsImport = async (payload: Payload, eventId: string, parsed: ParsedParticipantsWorkbook) => {
  const existingClubs = await payload.find({
    collection: 'clubs',
    depth: 0,
    limit: 1000,
    where: { event_id: { equals: eventId } },
  })
  const knownClubNames = new Set(existingClubs.docs.map((club) => String(club.name).trim().toLowerCase()))
  const existingTeams = await payload.find({
    collection: 'teams',
    depth: 0,
    limit: 1000,
    where: { event_id: { equals: eventId } },
  })
  const knownTeamSlugs = new Set(existingTeams.docs.map((team) => String(team.slug)))

  let clubsToCreate = 0
  let teamsToCreate = 0
  let playersToCreate = 0
  let skippedCount = 0
  const issues: { sheet: string; name: string; reason: string }[] = []
  const skip = (sheet: string, name: string, reason: string) => {
    skippedCount += 1
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
    if (knownClubNames.has(key)) {
      skip('Clubs', row.name, 'A club with this name already exists')
      continue
    }
    knownClubNames.add(key)
    clubsToCreate += 1
  }

  for (const row of parsed.teams) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Teams', row.name, 'Missing or invalid name')
      continue
    }
    if (knownTeamSlugs.has(slug)) {
      skip('Teams', row.name, 'A team with this name already exists')
      continue
    }
    if (row.clubName && !knownClubNames.has(row.clubName.trim().toLowerCase())) {
      warn('Teams', row.name, `Club "${row.clubName}" not found - will be saved without a club`)
    }
    knownTeamSlugs.add(slug)
    teamsToCreate += 1
  }

  for (const row of parsed.players) {
    if (row.clubName && !knownClubNames.has(row.clubName.trim().toLowerCase())) {
      warn('Players', row.name, `Club "${row.clubName}" not found - will be saved without a club`)
    }
    if (row.gender && !validGenders.has(row.gender)) {
      warn('Players', row.name, `Gender "${row.gender}" is not valid - will be saved without a gender`)
    }
    playersToCreate += 1
  }

  return { clubsToCreate, teamsToCreate, playersToCreate, skippedCount, issues }
}

const MAX_ISSUES_IN_URL = 25
const encodeIssues = (issues: { sheet: string; name: string; reason: string }[]) => ({
  issuesParam: issues.length > 0 ? encodeURIComponent(JSON.stringify(issues.slice(0, MAX_ISSUES_IN_URL))) : '',
  moreIssues: issues.length > MAX_ISSUES_IN_URL ? issues.length - MAX_ISSUES_IN_URL : 0,
})

export async function previewParticipantsImportAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
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

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = await parseImportFile(file).catch(() => null)
  if (!parsed) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }
  if (parsed.clubs.length === 0 && parsed.teams.length === 0 && parsed.players.length === 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=empty_import`)
  }

  const plan = await planParticipantsImport(payload, eventId, parsed)
  // Scratch storage only - not a real event asset, deleted by confirm/cancel. Re-uploading (not
  // trying to preserve the original File object) is the only option since a File can't survive a
  // redirect/second form submission; local-disk media storage makes re-reading it back cheap.
  const media = await payload.create({
    collection: 'media',
    data: { alt: 'participants-import-preview (temporary)' },
    file: { data: buffer, mimetype: file.type || 'application/octet-stream', name: file.name, size: file.size },
  })

  const { issuesParam, moreIssues } = encodeIssues(plan.issues)
  redirect(
    `${wizardPage}?eventId=${eventId}&step=participants&importPreviewMediaId=${media.id}` +
      `&importPreviewClubs=${plan.clubsToCreate}&importPreviewTeams=${plan.teamsToCreate}&importPreviewPlayers=${plan.playersToCreate}` +
      (plan.skippedCount ? `&importPreviewSkipped=${plan.skippedCount}` : '') +
      (issuesParam ? `&importPreviewIssues=${issuesParam}` : '') +
      (moreIssues ? `&importPreviewMoreIssues=${moreIssues}` : ''),
  )
}

export async function cancelParticipantsImportAction(formData: FormData): Promise<void> {
  const { payload } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const mediaId = text(formData, 'mediaId')
  if (mediaId) {
    await payload.delete({ collection: 'media', id: mediaId }).catch(() => {})
  }

  redirect(`${wizardPage}?eventId=${eventId}&step=participants`)
}

export async function confirmParticipantsImportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const mediaId = text(formData, 'mediaId')
  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  if (!mediaId) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }

  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 }).catch(() => null)
  if (!media?.filename) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }

  let parsed
  try {
    const buffer = await fs.readFile(path.join(MEDIA_DIR, media!.filename!))
    parsed = parseParticipantsWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  } catch {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
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
        where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
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
        where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
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
      const gender = row.gender && validGenders.has(row.gender)
        ? (row.gender as 'male' | 'female' | 'other' | 'prefer_not_to_say')
        : undefined
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

  // Scratch upload only - the real data now lives in clubs/teams/players, this file has served
  // its purpose.
  await payload.delete({ collection: 'media', id: mediaId }).catch(() => {})

  revalidatePath(wizardPage)
  const { issuesParam, moreIssues } = encodeIssues(issues)
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
    gender: (gender || undefined) as 'male' | 'female' | 'other' | 'prefer_not_to_say' | undefined,
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
