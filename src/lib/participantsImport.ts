import * as XLSX from 'xlsx'

export type ParsedClubRow = { name: string; contactPerson?: string; contactEmail?: string; categoryNames?: string[] }
export type ParsedTeamRow = { name: string; clubName?: string; contactEmail?: string; categoryNames?: string[] }
export type ParsedPlayerRow = {
  name: string
  clubName?: string
  email?: string
  phone?: string
  gender?: string
  identificationNumber?: string
  photo?: string
  categoryNames?: string[]
}
// A pair has no name of its own on the sheet - it's identified by its two players, matched by
// name against the Players sheet (same file) or an existing player already in the event.
// `teamName` is the optional display name for the 2-player team a pair is stored as internally
// (see addPairAction) - defaults to "Player 1 / Player 2" when left blank, same as the manual form.
export type ParsedPairRow = {
  player1Name: string
  player2Name: string
  teamName?: string
  clubName?: string
  categoryNames?: string[]
}

// prd/redesign/import-data-and-draft-persistence.md track IMP: the workbook now also carries the
// event structure itself (Sports, Categories), processed before any participant sheet so a
// Category can reference a Sport defined in the same file and a participant row's `category_name`
// can point at a Category defined in the same file.
export type ParsedSportRow = {
  name: string
  sportType?: string
  description?: string
  icon?: string
}
export type ParsedRulesetRow = {
  name: string
  sportName: string
  scoreType?: string
  setBased?: boolean
  allowDraw?: boolean
  bestOf?: number
  targetScore?: number
  maxScore?: number
  description?: string
}
export type ParsedCategoryRow = {
  name: string
  sportName: string
  participantMode?: string
  formatType?: string
  rulesetName?: string
  status?: string
  rosterRequired?: boolean
  minRosterSize?: number
  maxRosterSize?: number
  groupQualifyCount?: number
  thirdPlacePolicy?: string
  resultUnit?: string
  medalEligible?: boolean
  medalWeight?: number
}

export type ParsedParticipantsWorkbook = {
  sports: ParsedSportRow[]
  rulesets: ParsedRulesetRow[]
  categories: ParsedCategoryRow[]
  clubs: ParsedClubRow[]
  teams: ParsedTeamRow[]
  players: ParsedPlayerRow[]
  pairs: ParsedPairRow[]
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim())

// A yes/no cell: blank stays `undefined` (meaning "leave unchanged" on a re-import), anything
// affirmative is `true`, anything else `false`.
const bool = (value: unknown): boolean | undefined => {
  const normalized = str(value).toLowerCase()
  if (!normalized) return undefined
  return normalized === 'yes' || normalized === 'y' || normalized === 'true' || normalized === '1' || normalized === 'on'
}

const num = (value: unknown): number | undefined => {
  const normalized = str(value)
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

// `category_name` may list more than one category, comma-separated, so a single row can register
// into every category it competes in (e.g. a player entered in both Singles and Doubles, or a team
// entered in both a group stage and a separate cup category) instead of only ever the one named.
// Blank entries (from stray/trailing commas) are dropped and exact-duplicate names collapse to one
// - the row shouldn't be queued to register into the same category name twice just because it was
// typed twice.
const parseCategoryNames = (raw: string): string[] | undefined => {
  const seen = new Set<string>()
  const names: string[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(trimmed)
  }
  return names.length > 0 ? names : undefined
}

const sheetRows = (workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] => {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    return []
  }
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
}

// Column names here must match `participantsImportTemplate.ts`'s headers.
export const parseParticipantsWorkbook = (fileBuffer: ArrayBuffer): ParsedParticipantsWorkbook => {
  const workbook = XLSX.read(Buffer.from(fileBuffer), { type: 'buffer' })

  const sports = sheetRows(workbook, 'Sports')
    .map((row) => ({
      name: str(row.name),
      sportType: str(row.sport_type).toLowerCase() || undefined,
      description: str(row.description) || undefined,
      icon: str(row.icon) || undefined,
    }))
    .filter((row) => row.name)

  const rulesets = sheetRows(workbook, 'Rulesets')
    .map((row) => ({
      name: str(row.name),
      sportName: str(row.sport_name),
      scoreType: str(row.score_type).toLowerCase() || undefined,
      setBased: bool(row.set_based),
      allowDraw: bool(row.allow_draw),
      bestOf: num(row.best_of),
      targetScore: num(row.target_score),
      maxScore: num(row.max_score),
      description: str(row.description) || undefined,
    }))
    .filter((row) => row.name)

  const categories = sheetRows(workbook, 'Categories')
    .map((row) => ({
      name: str(row.name),
      sportName: str(row.sport_name),
      participantMode: str(row.participant_mode).toLowerCase() || undefined,
      formatType: str(row.format_type).toLowerCase() || undefined,
      rulesetName: str(row.ruleset_name) || undefined,
      status: str(row.status).toLowerCase() || undefined,
      rosterRequired: bool(row.roster_required),
      minRosterSize: num(row.min_roster_size),
      maxRosterSize: num(row.max_roster_size),
      groupQualifyCount: num(row.group_qualify_count),
      thirdPlacePolicy: str(row.third_place_policy).toLowerCase().replace(/\s+/g, '_') || undefined,
      resultUnit: str(row.result_unit) || undefined,
      medalEligible: bool(row.medal_eligible),
      medalWeight: num(row.medal_weight),
    }))
    .filter((row) => row.name)

  const clubs = sheetRows(workbook, 'Clubs')
    .map((row) => ({
      name: str(row.name),
      contactPerson: str(row.contact_person) || undefined,
      contactEmail: str(row.contact_email) || undefined,
      categoryNames: parseCategoryNames(str(row.category_name)),
    }))
    .filter((row) => row.name)

  const teams = sheetRows(workbook, 'Teams')
    .map((row) => ({
      name: str(row.name),
      clubName: str(row.club_name) || undefined,
      contactEmail: str(row.contact_email) || undefined,
      categoryNames: parseCategoryNames(str(row.category_name)),
    }))
    .filter((row) => row.name)

  const players = sheetRows(workbook, 'Players')
    .map((row) => ({
      name: str(row.name),
      clubName: str(row.club_name) || undefined,
      email: str(row.email) || undefined,
      phone: str(row.phone) || undefined,
      gender: str(row.gender).toLowerCase() || undefined,
      identificationNumber: str(row.identification_number) || undefined,
      photo: str(row.photo) || undefined,
      categoryNames: parseCategoryNames(str(row.category_name)),
    }))
    .filter((row) => row.name)

  const pairs = sheetRows(workbook, 'Pairs')
    .map((row) => ({
      player1Name: str(row.player1_name),
      player2Name: str(row.player2_name),
      teamName: str(row.team_name) || undefined,
      clubName: str(row.club_name) || undefined,
      categoryNames: parseCategoryNames(str(row.category_name)),
    }))
    .filter((row) => row.player1Name && row.player2Name)

  return { sports, rulesets, categories, clubs, teams, players, pairs }
}
