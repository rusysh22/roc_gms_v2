'use server'

import { randomUUID } from 'node:crypto'
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

type ImportCategoryDoc = { id: unknown; name: unknown; participant_mode: unknown }

const buildCategoryNameIndex = (categories: ImportCategoryDoc[]) => {
  const map = new Map<string, ImportCategoryDoc[]>()
  for (const category of categories) {
    const key = String(category.name).trim().toLowerCase()
    const list = map.get(key) || []
    list.push(category)
    map.set(key, list)
  }
  return map
}

// `category_name` on any import sheet (see participantsImportTemplate.ts) is an optional shortcut
// that both creates the row AND registers it into one or more categories in one step, instead of a
// separate trip through the wizard's Registration step - the cell may list several comma-separated
// names (parseCategoryNames in participantsImport.ts), each resolved and applied independently here.
// Resolved by exact case-insensitive name match against this event's categories - ambiguous (same
// name reused across two categories) or mode-mismatched (e.g. a Players row against a team-mode
// category) resolves to a warning for that one name instead of guessing which one was meant.
const resolveImportCategory = (
  categoriesByName: Map<string, ImportCategoryDoc[]>,
  categoryName: string | undefined,
  expectedMode: string,
): { category: ImportCategoryDoc } | { warning: string } | null => {
  if (!categoryName) {
    return null
  }
  const matches = categoriesByName.get(categoryName.trim().toLowerCase()) || []
  if (matches.length === 0) {
    return { warning: `Category "${categoryName}" not found - not registered to any category` }
  }
  const modeMatches = matches.filter((category) => String(category.participant_mode) === expectedMode)
  if (modeMatches.length === 0) {
    return { warning: `Category "${categoryName}" doesn't accept this participant type - not registered` }
  }
  if (modeMatches.length > 1) {
    return {
      warning: `Category name "${categoryName}" is ambiguous (matches ${modeMatches.length} categories) - register manually in the Registration step`,
    }
  }
  return { category: modeMatches[0] }
}

// Bare filesystem scratch storage - NOT the Media collection. Media enforces "this must be a real,
// decodable image" (validateMediaUpload/validateImageBuffer in src/collections/Media.ts) at the
// collection boundary, which an .xlsx workbook can never satisfy; routing the preview upload
// through Media used to fail every import with "File could not be read as a valid image." before
// a single row was ever parsed. The preview step writes here as scratch storage rather than
// committing anything yet; confirm re-reads and deletes it, cancel just deletes it. The filename
// is a server-generated UUID threaded back through the page as a plain query param - validated
// against SCRATCH_FILENAME_PATTERN before ever touching the filesystem again, since at that point
// it's client-controlled input and a forged value must not be able to path-traverse out of this
// directory.
const SCRATCH_DIR = path.resolve(process.cwd(), 'media/import-scratch')
const SCRATCH_FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.xlsx$/
const scratchFilePath = (filename: string): string | null =>
  SCRATCH_FILENAME_PATTERN.test(filename) ? path.join(SCRATCH_DIR, filename) : null

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
  const [existingClubs, existingTeams, existingPlayers, existingCategories] = await Promise.all([
    payload.find({ collection: 'clubs', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'teams', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'players', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'competition-categories', depth: 0, limit: 500, where: { event_id: { equals: eventId } } }),
  ])
  const knownClubNames = new Set(existingClubs.docs.map((club) => String(club.name).trim().toLowerCase()))
  const knownTeamSlugs = new Set(existingTeams.docs.map((team) => String(team.slug)))
  const knownIdentificationNumbers = new Set(
    existingPlayers.docs
      .map((player) => (player.identification_number ? String(player.identification_number).trim().toLowerCase() : ''))
      .filter(Boolean),
  )
  const knownPlayerNames = new Set(existingPlayers.docs.map((player) => String(player.name).trim().toLowerCase()))
  const categoriesByName = buildCategoryNameIndex(existingCategories.docs as ImportCategoryDoc[])

  let clubsToCreate = 0
  let teamsToCreate = 0
  let playersToCreate = 0
  let pairsToCreate = 0
  let entriesToRegister = 0
  let skippedCount = 0
  const issues: { sheet: string; name: string; reason: string }[] = []
  const skip = (sheet: string, name: string, reason: string) => {
    skippedCount += 1
    issues.push({ sheet, name: name || '(blank)', reason })
  }
  const warn = (sheet: string, name: string, reason: string) => {
    issues.push({ sheet, name: name || '(blank)', reason })
  }
  const checkCategory = (sheet: string, name: string, categoryNames: string[] | undefined, expectedMode: string) => {
    if (!categoryNames) return
    for (const categoryName of categoryNames) {
      const result = resolveImportCategory(categoriesByName, categoryName, expectedMode)
      if (!result) continue
      if ('warning' in result) {
        warn(sheet, name, result.warning)
      } else {
        entriesToRegister += 1
      }
    }
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
    checkCategory('Clubs', row.name, row.categoryNames, 'club')
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
    checkCategory('Teams', row.name, row.categoryNames, 'team')
  }

  for (const row of parsed.players) {
    const identificationNumberKey = row.identificationNumber ? row.identificationNumber.trim().toLowerCase() : ''
    if (identificationNumberKey && knownIdentificationNumbers.has(identificationNumberKey)) {
      skip('Players', row.name, `Identification number "${row.identificationNumber}" is already used in this event`)
      continue
    }
    if (identificationNumberKey) {
      knownIdentificationNumbers.add(identificationNumberKey)
    }
    if (row.clubName && !knownClubNames.has(row.clubName.trim().toLowerCase())) {
      warn('Players', row.name, `Club "${row.clubName}" not found - will be saved without a club`)
    }
    if (row.gender && !validGenders.has(row.gender)) {
      warn('Players', row.name, `Gender "${row.gender}" is not valid - will be saved without a gender`)
    }
    playersToCreate += 1
    knownPlayerNames.add(row.name.trim().toLowerCase())
    checkCategory('Players', row.name, row.categoryNames, 'individual')
  }

  for (const row of parsed.pairs) {
    const label = row.teamName || `${row.player1Name} / ${row.player2Name}`
    const p1Key = row.player1Name.trim().toLowerCase()
    const p2Key = row.player2Name.trim().toLowerCase()
    if (p1Key === p2Key) {
      skip('Pairs', label, 'Player 1 and Player 2 must be different players')
      continue
    }
    if (!knownPlayerNames.has(p1Key) || !knownPlayerNames.has(p2Key)) {
      skip('Pairs', label, 'One or both players were not found on the Players sheet or in this event')
      continue
    }
    if (row.clubName && !knownClubNames.has(row.clubName.trim().toLowerCase())) {
      warn('Pairs', label, `Club "${row.clubName}" not found - will be saved without a club`)
    }
    pairsToCreate += 1
    checkCategory('Pairs', label, row.categoryNames, 'pair')
  }

  return { clubsToCreate, teamsToCreate, playersToCreate, pairsToCreate, entriesToRegister, skippedCount, issues }
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
  if (
    parsed.clubs.length === 0 &&
    parsed.teams.length === 0 &&
    parsed.players.length === 0 &&
    parsed.pairs.length === 0
  ) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=empty_import`)
  }

  const plan = await planParticipantsImport(payload, eventId, parsed)
  // Scratch storage only - not a real event asset, deleted by confirm/cancel. Re-uploading (not
  // trying to preserve the original File object) is the only option since a File can't survive a
  // redirect/second form submission; a plain filesystem write makes re-reading it back cheap.
  const scratchFilename = `${randomUUID()}.xlsx`
  await fs.mkdir(SCRATCH_DIR, { recursive: true })
  await fs.writeFile(path.join(SCRATCH_DIR, scratchFilename), buffer)

  const { issuesParam, moreIssues } = encodeIssues(plan.issues)
  redirect(
    `${wizardPage}?eventId=${eventId}&step=participants&importPreviewFile=${scratchFilename}` +
      `&importPreviewClubs=${plan.clubsToCreate}&importPreviewTeams=${plan.teamsToCreate}&importPreviewPlayers=${plan.playersToCreate}` +
      `&importPreviewPairs=${plan.pairsToCreate}` +
      (plan.entriesToRegister ? `&importPreviewEntries=${plan.entriesToRegister}` : '') +
      (plan.skippedCount ? `&importPreviewSkipped=${plan.skippedCount}` : '') +
      (issuesParam ? `&importPreviewIssues=${issuesParam}` : '') +
      (moreIssues ? `&importPreviewMoreIssues=${moreIssues}` : ''),
  )
}

export async function cancelParticipantsImportAction(formData: FormData): Promise<void> {
  await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const scratchFile = text(formData, 'scratchFile')
  const filePath = scratchFile ? scratchFilePath(scratchFile) : null
  if (filePath) {
    await fs.unlink(filePath).catch(() => {})
  }

  redirect(`${wizardPage}?eventId=${eventId}&step=participants`)
}

export async function confirmParticipantsImportAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const scratchFile = text(formData, 'scratchFile')
  const event = await getWizardEvent(payload, eventId)
  if (!event) {
    redirect(`${wizardPage}?step=event&wizardError=missing_event`)
  }
  const filePath = scratchFile ? scratchFilePath(scratchFile) : null
  if (!filePath) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }

  let parsed
  try {
    const buffer = await fs.readFile(filePath!)
    parsed = parseParticipantsWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
  } catch {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_import_file`)
  }

  const [existingClubs, existingPlayers, existingCategories] = await Promise.all([
    payload.find({ collection: 'clubs', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'players', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({
      collection: 'competition-categories',
      depth: 0,
      limit: 500,
      where: { event_id: { equals: eventId } },
    }),
  ])
  const clubIdByName = new Map<string, number>()
  for (const club of existingClubs.docs) {
    clubIdByName.set(String(club.name).trim().toLowerCase(), Number(club.id))
  }
  const playerIdByName = new Map<string, number>()
  for (const player of existingPlayers.docs) {
    playerIdByName.set(String(player.name).trim().toLowerCase(), Number(player.id))
  }
  const knownIdentificationNumbers = new Set(
    existingPlayers.docs
      .map((player) => (player.identification_number ? String(player.identification_number).trim().toLowerCase() : ''))
      .filter(Boolean),
  )
  const categoriesByName = buildCategoryNameIndex(existingCategories.docs as ImportCategoryDoc[])

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

  // `category_name` rows are resolved against `categoriesByName` as each source is created, then
  // applied in one batch after every club/team/player/pair has been saved - batching needs every
  // referenced category's existing entry count up front for correct seed numbers, same as
  // addBulkCategoryAssignmentsAction.
  const registrations: {
    collection: 'clubs' | 'teams' | 'players'
    sourceId: number
    sourceName: string
    categoryId: number
    entryType: 'club' | 'team' | 'pair' | 'individual'
  }[] = []
  const entryTypeByMode: Record<string, 'club' | 'team' | 'pair' | 'individual'> = {
    club: 'club',
    team: 'team',
    pair: 'pair',
    individual: 'individual',
  }
  const queueRegistration = (
    sheet: string,
    collection: 'clubs' | 'teams' | 'players',
    sourceId: number,
    sourceName: string,
    categoryNames: string[] | undefined,
    expectedMode: string,
  ) => {
    if (!categoryNames) return
    for (const categoryName of categoryNames) {
      const result = resolveImportCategory(categoriesByName, categoryName, expectedMode)
      if (!result) continue
      if ('warning' in result) {
        warn(sheet, sourceName, result.warning)
        continue
      }
      registrations.push({
        collection,
        sourceId,
        sourceName,
        categoryId: Number(result.category.id),
        entryType: entryTypeByMode[expectedMode],
      })
    }
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
      queueRegistration('Clubs', 'clubs', Number(doc.id), row.name, row.categoryNames, 'club')
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
      const doc = await payload.create({ collection: 'teams', data })
      created += 1
      queueRegistration('Teams', 'teams', Number(doc.id), row.name, row.categoryNames, 'team')
    } catch {
      skip('Teams', row.name, 'Could not save (unexpected error)')
    }
  }

  for (const row of parsed.players) {
    const identificationNumberKey = row.identificationNumber ? row.identificationNumber.trim().toLowerCase() : ''
    if (identificationNumberKey && knownIdentificationNumbers.has(identificationNumberKey)) {
      skip('Players', row.name, `Identification number "${row.identificationNumber}" is already used in this event`)
      continue
    }
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
        identification_number: row.identificationNumber,
        photo: row.photo,
      }
      const doc = await payload.create({ collection: 'players', data })
      if (identificationNumberKey) {
        knownIdentificationNumbers.add(identificationNumberKey)
      }
      playerIdByName.set(String(row.name).trim().toLowerCase(), Number(doc.id))
      created += 1
      queueRegistration('Players', 'players', Number(doc.id), row.name, row.categoryNames, 'individual')
    } catch {
      // Falls through here mainly if the unique (event_id, identification_number) DB index is hit
      // despite the in-memory check above - e.g. a concurrent import into the same event.
      skip('Players', row.name, 'Could not save (unexpected error)')
    }
  }

  // Pairs are stored as a 2-player Team the same way addPairAction does it (rosters always need a
  // team_id) - resolved against both players just created above and players that already existed
  // in the event, matched by name since a pair row has no other stable per-workbook key.
  for (const row of parsed.pairs) {
    const label = row.teamName || `${row.player1Name} / ${row.player2Name}`
    const p1Key = row.player1Name.trim().toLowerCase()
    const p2Key = row.player2Name.trim().toLowerCase()
    if (p1Key === p2Key) {
      skip('Pairs', label, 'Player 1 and Player 2 must be different players')
      continue
    }
    const player1Id = playerIdByName.get(p1Key)
    const player2Id = playerIdByName.get(p2Key)
    if (!player1Id || !player2Id) {
      skip('Pairs', label, 'One or both players were not found on the Players sheet or in this event')
      continue
    }
    try {
      const clubId = row.clubName ? clubIdByName.get(row.clubName.trim().toLowerCase()) : undefined
      if (row.clubName && !clubId) {
        warn('Pairs', label, `Club "${row.clubName}" not found - saved without a club`)
      }
      const name = row.teamName || `${row.player1Name} / ${row.player2Name}`
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
      const teamData = { event_id: Number(eventId), club_id: clubId, name, slug }
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
      for (const playerId of [player1Id, player2Id]) {
        const rosterData = {
          event_id: Number(eventId),
          team_id: Number(team.id),
          player_id: playerId,
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
      created += 1
      queueRegistration('Pairs', 'teams', Number(team.id), name, row.categoryNames, 'pair')
    } catch {
      skip('Pairs', label, 'Could not save (unexpected error)')
    }
  }

  // Apply every queued category registration in one batch - same dedupe-by-key/running-seed
  // pattern as addBulkCategoryAssignmentsAction, just sourced from import rows instead of matrix
  // checkboxes.
  let registered = 0
  if (registrations.length > 0) {
    const categoryIds = [...new Set(registrations.map((registration) => String(registration.categoryId)))]
    const existingEntries = await payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 5000,
      where: { category_id: { in: categoryIds } },
    })
    const enteredKeys = new Set(
      existingEntries.docs.map((entry) => {
        const entryCollection = entry.team_id ? 'teams' : entry.club_id ? 'clubs' : 'players'
        const linkedId =
          entryCollection === 'teams' ? entry.team_id : entryCollection === 'clubs' ? entry.club_id : entry.player_id
        return `${entryCollection}:${linkedId}:${entry.category_id}`
      }),
    )
    const nextSeedByCategory = new Map<string, number>()
    for (const entry of existingEntries.docs) {
      const catKey = String(entry.category_id)
      nextSeedByCategory.set(
        catKey,
        Math.max(nextSeedByCategory.get(catKey) || 0, Number(entry.seed_number) || 0) + 1,
      )
    }

    for (const registration of registrations) {
      const key = `${registration.collection}:${registration.sourceId}:${registration.categoryId}`
      if (enteredKeys.has(key)) continue
      const catKey = String(registration.categoryId)
      const seed = nextSeedByCategory.get(catKey) || 1
      const entryData = {
        event_id: Number(eventId),
        category_id: registration.categoryId,
        display_name: registration.sourceName,
        entry_type: registration.entryType,
        status: 'confirmed' as const,
        seed_number: seed,
        player_id: registration.collection === 'players' ? registration.sourceId : undefined,
        team_id: registration.collection === 'teams' ? registration.sourceId : undefined,
        club_id: registration.collection === 'clubs' ? registration.sourceId : undefined,
      }
      const createdEntry = await payload.create({ collection: 'competition-entries', data: entryData })
      await recordAuditLog({
        payload,
        action: 'competition_entry.create',
        entityType: 'competition-entries',
        entityId: createdEntry.id,
        before: null,
        after: entryData,
        actorUserId: user.id,
      })
      enteredKeys.add(key)
      nextSeedByCategory.set(catKey, seed + 1)
      registered += 1
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
      registered,
      issues,
      clubs: parsed.clubs.length,
      teams: parsed.teams.length,
      players: parsed.players.length,
      pairs: parsed.pairs.length,
    },
    actorUserId: user.id,
  })

  // Scratch upload only - the real data now lives in clubs/teams/players, this file has served
  // its purpose.
  await fs.unlink(filePath!).catch(() => {})

  revalidatePath(wizardPage)
  const { issuesParam, moreIssues } = encodeIssues(issues)
  redirect(
    `${wizardPage}?eventId=${eventId}&step=participants&wizardImported=${created}` +
      (registered ? `&wizardRegistered=${registered}` : '') +
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

// Mirrors deleteCategoryAction's guard (categoryActions.ts) - no cascade delete of anything with
// real competition data. A player can be attached to the event two ways: directly as an
// individual-mode competition entry (player_id), or indirectly via a team/pair roster spot
// (rosters.player_id) - either one blocks deletion.
export async function deletePlayerAction(formData: FormData): Promise<void> {
  const { payload, user } = await assertWorkspaceActionAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: wizardPage,
  })

  const eventId = text(formData, 'eventId')
  const playerId = text(formData, 'playerId')

  const player = await payload.findByID({ collection: 'players', id: playerId, depth: 0 }).catch(() => null)
  if (!player || String(player.event_id) !== String(eventId)) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=invalid_relationship`)
  }

  const [entries, rosters] = await Promise.all([
    payload.count({ collection: 'competition-entries', where: { player_id: { equals: playerId } } }),
    payload.count({ collection: 'rosters', where: { player_id: { equals: playerId } } }),
  ])
  if (entries.totalDocs > 0 || rosters.totalDocs > 0) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=player_in_use`)
  }

  await payload.delete({ collection: 'players', id: playerId })
  await recordAuditLog({
    payload,
    action: 'player.delete',
    entityType: 'players',
    entityId: playerId,
    before: player,
    after: null,
    actorUserId: user.id,
  })

  revalidatePath(wizardPage)
  redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardUpdated=1`)
}
