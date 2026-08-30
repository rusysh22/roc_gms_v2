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

// `redirect()` / `notFound()` work by throwing a control-flow error Next.js re-catches upstream -
// a `try/catch` around import processing must let those through untouched and only swallow real
// failures. See https://nextjs.org/docs/app/api-reference/functions/redirect#behavior.
const isNextControlFlowError = (error: unknown): boolean =>
  typeof (error as { digest?: unknown })?.digest === 'string' &&
  ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
    (error as { digest: string }).digest === 'NEXT_NOT_FOUND')

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

// prd/redesign/import-data-and-draft-persistence.md track IMP: the workbook's Sports and Categories
// sheets are processed before any participant sheet. An unrecognised enum value never fails the
// row - it falls back to the field default with a warning (mirrors addSportAction/addCategoryAction
// which already coerce their form inputs the same way).
const validSportTypes = new Set(['court', 'field', 'table', 'board', 'esport', 'track', 'other'])
const validParticipantModes = new Set(['individual', 'pair', 'team', 'club', 'open', 'tbd'])
const validFormatTypes = new Set([
  'single_elimination',
  'double_elimination',
  'round_robin',
  'group_stage_to_knockout',
  'league',
  'friendly',
  'time_trial',
  'score_ranking',
])
const validCategoryStatuses = new Set(['draft', 'open', 'locked', 'published', 'archived'])
const validThirdPlacePolicies = new Set(['none', 'match', 'shared'])
const validScoreTypes = new Set(['points', 'goals', 'sets', 'time', 'result', 'custom'])

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
  const [existingSports, existingRulesets, existingClubs, existingTeams, existingPlayers, existingCategories] =
    await Promise.all([
      payload.find({ collection: 'sports', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
      payload.find({ collection: 'rulesets', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
      payload.find({ collection: 'clubs', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
      payload.find({ collection: 'teams', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
      payload.find({ collection: 'players', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
      payload.find({ collection: 'competition-categories', depth: 0, limit: 500, where: { event_id: { equals: eventId } } }),
    ])
  const knownRulesetSlugs = new Set(existingRulesets.docs.map((ruleset) => String(ruleset.slug)))
  const knownRulesetNames = new Set(existingRulesets.docs.map((ruleset) => String(ruleset.name).trim().toLowerCase()))
  // A category's `sport_name` resolves against either an existing sport (by name or slug) or a
  // Sports row in the same workbook - the sheet slug is derived deterministically from the name.
  const knownSportSlugs = new Set(existingSports.docs.map((sport) => String(sport.slug)))
  const knownSportNames = new Set(existingSports.docs.map((sport) => String(sport.name).trim().toLowerCase()))
  const knownSportCategorySlugs = new Set(existingCategories.docs.map((category) => String(category.slug)))
  const knownClubNames = new Set(existingClubs.docs.map((club) => String(club.name).trim().toLowerCase()))
  const knownTeamSlugs = new Set(existingTeams.docs.map((team) => String(team.slug)))
  const knownIdentificationNumbers = new Set(
    existingPlayers.docs
      .map((player) => (player.identification_number ? String(player.identification_number).trim().toLowerCase() : ''))
      .filter(Boolean),
  )
  const knownPlayerNames = new Set(existingPlayers.docs.map((player) => String(player.name).trim().toLowerCase()))
  const categoriesByName = buildCategoryNameIndex(existingCategories.docs as ImportCategoryDoc[])
  // A `category_name` cell on a participant sheet can point at a Category defined in the same
  // workbook, not just one already in the event - add those to the resolver index, skipping any
  // whose slug already exists so an existing+sheet pairing doesn't read as a false "ambiguous".
  for (const row of parsed.categories) {
    const slug = slugify(row.name)
    if (!slug || !row.sportName || knownSportCategorySlugs.has(slug)) continue
    const key = row.name.trim().toLowerCase()
    const list = categoriesByName.get(key) || []
    list.push({ id: `sheet:${slug}`, name: row.name, participant_mode: row.participantMode || 'open' })
    categoriesByName.set(key, list)
  }

  let sportsToCreate = 0
  let sportsToUpdate = 0
  let rulesetsToCreate = 0
  let rulesetsToUpdate = 0
  let categoriesToCreate = 0
  let categoriesToUpdate = 0
  let clubsToCreate = 0
  let clubsToUpdate = 0
  let teamsToCreate = 0
  let teamsToUpdate = 0
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

  for (const row of parsed.sports) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Sports', row.name, 'Missing or invalid name')
      continue
    }
    if (row.sportType && !validSportTypes.has(row.sportType)) {
      warn('Sports', row.name, `Sport type "${row.sportType}" is not valid - will be saved as "court"`)
    }
    if (knownSportSlugs.has(slug)) {
      sportsToUpdate += 1
    } else {
      sportsToCreate += 1
      knownSportSlugs.add(slug)
      knownSportNames.add(row.name.trim().toLowerCase())
    }
  }

  for (const row of parsed.rulesets) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Rulesets', row.name, 'Missing or invalid name')
      continue
    }
    if (!row.sportName) {
      skip('Rulesets', row.name, 'Missing sport_name')
      continue
    }
    if (!knownSportNames.has(row.sportName.trim().toLowerCase()) && !knownSportSlugs.has(slugify(row.sportName))) {
      skip('Rulesets', row.name, `Sport "${row.sportName}" not found on the Sports sheet or in this event`)
      continue
    }
    if (row.scoreType && !validScoreTypes.has(row.scoreType)) {
      warn('Rulesets', row.name, `score_type "${row.scoreType}" is not valid - will use "points"`)
    }
    if (knownRulesetSlugs.has(slug)) {
      rulesetsToUpdate += 1
    } else {
      rulesetsToCreate += 1
      knownRulesetSlugs.add(slug)
      knownRulesetNames.add(row.name.trim().toLowerCase())
    }
  }

  for (const row of parsed.categories) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Categories', row.name, 'Missing or invalid name')
      continue
    }
    if (!row.sportName) {
      skip('Categories', row.name, 'Missing sport_name')
      continue
    }
    if (!knownSportNames.has(row.sportName.trim().toLowerCase()) && !knownSportSlugs.has(slugify(row.sportName))) {
      skip('Categories', row.name, `Sport "${row.sportName}" not found on the Sports sheet or in this event`)
      continue
    }
    if (row.rulesetName && !knownRulesetNames.has(row.rulesetName.trim().toLowerCase())) {
      warn('Categories', row.name, `Ruleset "${row.rulesetName}" not found - will be saved without a ruleset`)
    }
    if (row.participantMode && !validParticipantModes.has(row.participantMode)) {
      warn('Categories', row.name, `participant_mode "${row.participantMode}" is not valid - will use "open"`)
    }
    if (row.formatType && !validFormatTypes.has(row.formatType)) {
      warn('Categories', row.name, `format_type "${row.formatType}" is not valid - will use "single_elimination"`)
    }
    if (row.status && !validCategoryStatuses.has(row.status)) {
      warn('Categories', row.name, `status "${row.status}" is not valid - will use "draft"`)
    }
    if (row.thirdPlacePolicy && !validThirdPlacePolicies.has(row.thirdPlacePolicy)) {
      warn('Categories', row.name, `third_place_policy "${row.thirdPlacePolicy}" is not valid - will use "none"`)
    }
    if (knownSportCategorySlugs.has(slug)) {
      categoriesToUpdate += 1
    } else {
      categoriesToCreate += 1
      knownSportCategorySlugs.add(slug)
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
      clubsToUpdate += 1
    } else {
      knownClubNames.add(key)
      clubsToCreate += 1
    }
    checkCategory('Clubs', row.name, row.categoryNames, 'club')
  }

  for (const row of parsed.teams) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Teams', row.name, 'Missing or invalid name')
      continue
    }
    if (row.clubName && !knownClubNames.has(row.clubName.trim().toLowerCase())) {
      warn('Teams', row.name, `Club "${row.clubName}" not found - will be saved without a club`)
    }
    if (knownTeamSlugs.has(slug)) {
      teamsToUpdate += 1
    } else {
      knownTeamSlugs.add(slug)
      teamsToCreate += 1
    }
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

  return {
    sportsToCreate,
    sportsToUpdate,
    rulesetsToCreate,
    rulesetsToUpdate,
    categoriesToCreate,
    categoriesToUpdate,
    clubsToCreate,
    clubsToUpdate,
    teamsToCreate,
    teamsToUpdate,
    playersToCreate,
    pairsToCreate,
    entriesToRegister,
    skippedCount,
    issues,
  }
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
    parsed.sports.length === 0 &&
    parsed.rulesets.length === 0 &&
    parsed.categories.length === 0 &&
    parsed.clubs.length === 0 &&
    parsed.teams.length === 0 &&
    parsed.players.length === 0 &&
    parsed.pairs.length === 0
  ) {
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=empty_import`)
  }

  let plan: Awaited<ReturnType<typeof planParticipantsImport>>
  const scratchFilename = `${randomUUID()}.xlsx`
  try {
    plan = await planParticipantsImport(payload, eventId, parsed)
    // Scratch storage only - not a real event asset, deleted by confirm/cancel. Re-uploading (not
    // trying to preserve the original File object) is the only option since a File can't survive a
    // redirect/second form submission; a plain filesystem write makes re-reading it back cheap.
    await fs.mkdir(SCRATCH_DIR, { recursive: true })
    await fs.writeFile(path.join(SCRATCH_DIR, scratchFilename), buffer)
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    // A malformed workbook that still parsed but breaks the dry run (bad cell types, an
    // unexpected shape) used to fall straight through to the framework's white error page. Log
    // the real cause for the team and send the organizer back to a readable error instead.
    payload.logger.error(
      `previewParticipantsImportAction failed for event ${eventId}: ${
        error instanceof Error ? error.stack : String(error)
      }`,
    )
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=import_failed`)
  }

  const { issuesParam, moreIssues } = encodeIssues(plan.issues)
  redirect(
    `${wizardPage}?eventId=${eventId}&step=participants&importPreviewFile=${scratchFilename}` +
      `&importPreviewSports=${plan.sportsToCreate}&importPreviewSportsUpdate=${plan.sportsToUpdate}` +
      `&importPreviewRulesets=${plan.rulesetsToCreate}&importPreviewRulesetsUpdate=${plan.rulesetsToUpdate}` +
      `&importPreviewCategories=${plan.categoriesToCreate}&importPreviewCategoriesUpdate=${plan.categoriesToUpdate}` +
      `&importPreviewClubs=${plan.clubsToCreate}&importPreviewClubsUpdate=${plan.clubsToUpdate}` +
      `&importPreviewTeams=${plan.teamsToCreate}&importPreviewTeamsUpdate=${plan.teamsToUpdate}` +
      `&importPreviewPlayers=${plan.playersToCreate}` +
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

  try {
  const [existingSports, existingRulesets, existingClubs, existingPlayers, existingCategories] = await Promise.all([
    payload.find({ collection: 'sports', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'rulesets', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'clubs', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({ collection: 'players', depth: 0, limit: 1000, where: { event_id: { equals: eventId } } }),
    payload.find({
      collection: 'competition-categories',
      depth: 0,
      limit: 500,
      where: { event_id: { equals: eventId } },
    }),
  ])
  // Sports/Categories are upserted by slug before any participant sheet, so a Category can name a
  // Sport from the same workbook and a participant row's `category_name` can hit a Category just
  // created here. `sportIdByName`/`sportIdBySlug` and `rulesetIdByName` back that resolution.
  const sportIdBySlug = new Map<string, number>()
  const sportIdByName = new Map<string, number>()
  for (const sport of existingSports.docs) {
    sportIdBySlug.set(String(sport.slug), Number(sport.id))
    sportIdByName.set(String(sport.name).trim().toLowerCase(), Number(sport.id))
  }
  const rulesetIdByName = new Map<string, number>()
  const rulesetIdBySlug = new Map<string, number>()
  for (const ruleset of existingRulesets.docs) {
    rulesetIdByName.set(String(ruleset.name).trim().toLowerCase(), Number(ruleset.id))
    rulesetIdBySlug.set(String(ruleset.slug), Number(ruleset.id))
  }
  const categoryIdBySlug = new Map<string, number>()
  for (const category of existingCategories.docs) {
    categoryIdBySlug.set(String(category.slug), Number(category.id))
  }
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
  let updated = 0
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

  // --- Sports (upsert by slug) ---
  for (const row of parsed.sports) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Sports', row.name, 'Missing or invalid name')
      continue
    }
    const sportType = row.sportType && validSportTypes.has(row.sportType) ? row.sportType : 'court'
    if (row.sportType && sportType !== row.sportType) {
      warn('Sports', row.name, `Sport type "${row.sportType}" is not valid - saved as "court"`)
    }
    try {
      const existingId = sportIdBySlug.get(slug)
      if (existingId) {
        const before = await payload.findByID({ collection: 'sports', id: existingId, depth: 0 }).catch(() => null)
        const data = {
          name: row.name,
          sport_type: sportType as 'court' | 'field' | 'table' | 'board' | 'esport' | 'track' | 'other',
          description: row.description,
          icon: row.icon,
        }
        await payload.update({ collection: 'sports', id: existingId, data })
        await recordAuditLog({
          payload,
          action: 'sport.update',
          entityType: 'sports',
          entityId: existingId,
          before,
          after: data,
          actorUserId: user.id,
        })
        updated += 1
      } else {
        const data = {
          event_id: Number(eventId),
          name: row.name,
          slug,
          sport_type: sportType as 'court' | 'field' | 'table' | 'board' | 'esport' | 'track' | 'other',
          description: row.description,
          icon: row.icon,
          is_active: true,
        }
        const doc = await payload.create({ collection: 'sports', data })
        sportIdBySlug.set(slug, Number(doc.id))
        sportIdByName.set(row.name.trim().toLowerCase(), Number(doc.id))
        await recordAuditLog({
          payload,
          action: 'sport.create',
          entityType: 'sports',
          entityId: doc.id,
          before: null,
          after: data,
          actorUserId: user.id,
        })
        created += 1
      }
    } catch {
      skip('Sports', row.name, 'Could not save (unexpected error)')
    }
  }

  // --- Rulesets (upsert by slug) ---
  for (const row of parsed.rulesets) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Rulesets', row.name, 'Missing or invalid name')
      continue
    }
    const sportId = row.sportName
      ? sportIdByName.get(row.sportName.trim().toLowerCase()) ?? sportIdBySlug.get(slugify(row.sportName))
      : undefined
    if (!sportId) {
      skip('Rulesets', row.name, `Sport "${row.sportName}" not found on the Sports sheet or in this event`)
      continue
    }
    const scoreType = row.scoreType && validScoreTypes.has(row.scoreType) ? row.scoreType : 'points'
    if (row.scoreType && scoreType !== row.scoreType) {
      warn('Rulesets', row.name, `score_type "${row.scoreType}" is not valid - saved as "points"`)
    }
    const rulesetData = {
      sport_id: sportId,
      name: row.name,
      score_type: scoreType as 'points' | 'goals' | 'sets' | 'time' | 'result' | 'custom',
      set_based: row.setBased,
      allow_draw: row.allowDraw,
      best_of: row.bestOf,
      target_score: row.targetScore,
      max_score: row.maxScore,
      description: row.description,
    }
    try {
      const existingId = rulesetIdBySlug.get(slug)
      if (existingId) {
        const before = await payload.findByID({ collection: 'rulesets', id: existingId, depth: 0 }).catch(() => null)
        await payload.update({ collection: 'rulesets', id: existingId, data: rulesetData })
        await recordAuditLog({
          payload,
          action: 'ruleset.update',
          entityType: 'rulesets',
          entityId: existingId,
          before,
          after: rulesetData,
          actorUserId: user.id,
        })
        updated += 1
      } else {
        const doc = await payload.create({
          collection: 'rulesets',
          data: { event_id: Number(eventId), slug, ...rulesetData },
        })
        rulesetIdBySlug.set(slug, Number(doc.id))
        rulesetIdByName.set(row.name.trim().toLowerCase(), Number(doc.id))
        await recordAuditLog({
          payload,
          action: 'ruleset.create',
          entityType: 'rulesets',
          entityId: doc.id,
          before: null,
          after: { event_id: Number(eventId), slug, ...rulesetData },
          actorUserId: user.id,
        })
        created += 1
      }
    } catch {
      skip('Rulesets', row.name, 'Could not save (unexpected error)')
    }
  }

  // --- Categories (upsert by slug) ---
  for (const row of parsed.categories) {
    const slug = slugify(row.name)
    if (!slug) {
      skip('Categories', row.name, 'Missing or invalid name')
      continue
    }
    const sportId = row.sportName
      ? sportIdByName.get(row.sportName.trim().toLowerCase()) ?? sportIdBySlug.get(slugify(row.sportName))
      : undefined
    if (!sportId) {
      skip('Categories', row.name, `Sport "${row.sportName}" not found on the Sports sheet or in this event`)
      continue
    }
    const participantMode =
      row.participantMode && validParticipantModes.has(row.participantMode) ? row.participantMode : 'open'
    if (row.participantMode && participantMode !== row.participantMode) {
      warn('Categories', row.name, `participant_mode "${row.participantMode}" is not valid - saved as "open"`)
    }
    const formatType =
      row.formatType && validFormatTypes.has(row.formatType) ? row.formatType : 'single_elimination'
    if (row.formatType && formatType !== row.formatType) {
      warn('Categories', row.name, `format_type "${row.formatType}" is not valid - saved as "single_elimination"`)
    }
    const status = row.status && validCategoryStatuses.has(row.status) ? row.status : 'draft'
    if (row.status && status !== row.status) {
      warn('Categories', row.name, `status "${row.status}" is not valid - saved as "draft"`)
    }
    const thirdPlacePolicy =
      row.thirdPlacePolicy && validThirdPlacePolicies.has(row.thirdPlacePolicy) ? row.thirdPlacePolicy : 'none'
    let rulesetId: number | undefined
    if (row.rulesetName) {
      rulesetId = rulesetIdByName.get(row.rulesetName.trim().toLowerCase())
      if (!rulesetId) {
        warn('Categories', row.name, `Ruleset "${row.rulesetName}" not found - saved without a ruleset`)
      }
    }
    const data = {
      sport_id: sportId,
      name: row.name,
      participant_mode: participantMode as 'individual' | 'pair' | 'team' | 'club' | 'open' | 'tbd',
      format_type: formatType as
        | 'single_elimination'
        | 'double_elimination'
        | 'round_robin'
        | 'group_stage_to_knockout'
        | 'league'
        | 'friendly'
        | 'time_trial'
        | 'score_ranking',
      status: status as 'draft' | 'open' | 'locked' | 'published' | 'archived',
      third_place_policy: thirdPlacePolicy as 'none' | 'match' | 'shared',
      roster_required: row.rosterRequired,
      min_roster_size: row.minRosterSize,
      max_roster_size: row.maxRosterSize,
      group_qualify_count: row.groupQualifyCount,
      result_unit: row.resultUnit,
      ruleset_id: rulesetId,
      medal_eligible: row.medalEligible,
      medal_weight: row.medalWeight,
    }
    try {
      const existingId = categoryIdBySlug.get(slug)
      if (existingId) {
        const before = await payload
          .findByID({ collection: 'competition-categories', id: existingId, depth: 0 })
          .catch(() => null)
        await payload.update({ collection: 'competition-categories', id: existingId, data })
        await recordAuditLog({
          payload,
          action: 'competition_category.update',
          entityType: 'competition-categories',
          entityId: existingId,
          before,
          after: data,
          actorUserId: user.id,
        })
        updated += 1
      } else {
        const doc = await payload.create({
          collection: 'competition-categories',
          data: { event_id: Number(eventId), slug, ...data },
        })
        categoryIdBySlug.set(slug, Number(doc.id))
        // Make the just-created category resolvable by `category_name` on the participant sheets
        // below (queueRegistration reads categoriesByName).
        const key = row.name.trim().toLowerCase()
        const list = categoriesByName.get(key) || []
        list.push({ id: doc.id, name: row.name, participant_mode: participantMode })
        categoriesByName.set(key, list)
        await recordAuditLog({
          payload,
          action: 'competition_category.create',
          entityType: 'competition-categories',
          entityId: doc.id,
          before: null,
          after: { event_id: Number(eventId), slug, ...data },
          actorUserId: user.id,
        })
        created += 1
      }
    } catch {
      skip('Categories', row.name, 'Could not save (unexpected error)')
    }
  }

  for (const row of parsed.clubs) {
    const slug = slugify(row.name)
    const key = row.name.trim().toLowerCase()
    if (!slug) {
      skip('Clubs', row.name, 'Missing or invalid name')
      continue
    }
    try {
      const existingId = clubIdByName.get(key)
      if (existingId) {
        // Upsert: a re-import of an edited row updates the club in place rather than skipping it.
        const before = await payload.findByID({ collection: 'clubs', id: existingId, depth: 0 }).catch(() => null)
        const data = { contact_person: row.contactPerson, contact_email: row.contactEmail }
        await payload.update({ collection: 'clubs', id: existingId, data })
        await recordAuditLog({
          payload,
          action: 'club.update',
          entityType: 'clubs',
          entityId: existingId,
          before,
          after: data,
          actorUserId: user.id,
        })
        updated += 1
        queueRegistration('Clubs', 'clubs', existingId, row.name, row.categoryNames, 'club')
        continue
      }
      const duplicate = await payload.find({
        collection: 'clubs',
        depth: 0,
        limit: 1,
        where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
      })
      if (duplicate.docs.length > 0) {
        skip('Clubs', row.name, 'A different club already uses this name/slug')
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
      const clubId = row.clubName ? clubIdByName.get(row.clubName.trim().toLowerCase()) : undefined
      if (row.clubName && !clubId) {
        warn('Teams', row.name, `Club "${row.clubName}" not found - saved without a club`)
      }
      const existing = await payload.find({
        collection: 'teams',
        depth: 0,
        limit: 1,
        where: { and: [{ slug: { equals: slug } }, { event_id: { equals: eventId } }] },
      })
      if (existing.docs.length > 0) {
        // Upsert by slug: a re-import of an edited row updates the team in place.
        const before = existing.docs[0]
        const data = { club_id: clubId, contact_email: row.contactEmail }
        await payload.update({ collection: 'teams', id: before.id, data })
        await recordAuditLog({
          payload,
          action: 'team.update',
          entityType: 'teams',
          entityId: before.id,
          before,
          after: data,
          actorUserId: user.id,
        })
        updated += 1
        queueRegistration('Teams', 'teams', Number(before.id), row.name, row.categoryNames, 'team')
        continue
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
      let createdEntry
      try {
        createdEntry = await payload.create({ collection: 'competition-entries', data: entryData })
      } catch {
        // One bad registration (an unexpected validation failure) must not abort the whole batch
        // and roll the organizer onto an error page - skip it with a row-level note, same as the
        // per-source create loops above.
        skip(registration.collection === 'teams' ? 'Pairs' : registration.collection === 'clubs' ? 'Clubs' : 'Players', registration.sourceName, 'Could not register into its category (unexpected error)')
        continue
      }
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
      updated,
      skipped,
      registered,
      issues,
      sports: parsed.sports.length,
      rulesets: parsed.rulesets.length,
      categories: parsed.categories.length,
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
      (updated ? `&wizardImportUpdated=${updated}` : '') +
      (registered ? `&wizardRegistered=${registered}` : '') +
      (skipped ? `&wizardImportSkipped=${skipped}` : '') +
      (issuesParam ? `&wizardImportIssues=${issuesParam}` : '') +
      (moreIssues ? `&wizardImportMoreIssues=${moreIssues}` : ''),
  )
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    // Anything the per-row `skip`/`warn` guards above did not already contain (an unexpected
    // Payload validation failure in the batch registration pass, a DB hiccup) landed the organizer
    // on the framework's white error page with a half-applied import and no way to tell what broke.
    // Log the real cause for the team and return a readable error; the scratch file is kept so a
    // retry is still possible.
    payload.logger.error(
      `confirmParticipantsImportAction failed for event ${eventId}: ${
        error instanceof Error ? error.stack : String(error)
      }`,
    )
    redirect(`${wizardPage}?eventId=${eventId}&step=participants&wizardError=import_failed`)
  }
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
