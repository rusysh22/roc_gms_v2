import * as XLSX from 'xlsx'

export type ParsedClubRow = { name: string; contactPerson?: string; contactEmail?: string; categoryName?: string }
export type ParsedTeamRow = { name: string; clubName?: string; contactEmail?: string; categoryName?: string }
export type ParsedPlayerRow = {
  name: string
  clubName?: string
  email?: string
  phone?: string
  gender?: string
  identificationNumber?: string
  photo?: string
  categoryName?: string
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
  categoryName?: string
}

export type ParsedParticipantsWorkbook = {
  clubs: ParsedClubRow[]
  teams: ParsedTeamRow[]
  players: ParsedPlayerRow[]
  pairs: ParsedPairRow[]
}

const str = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim())

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

  const clubs = sheetRows(workbook, 'Clubs')
    .map((row) => ({
      name: str(row.name),
      contactPerson: str(row.contact_person) || undefined,
      contactEmail: str(row.contact_email) || undefined,
      categoryName: str(row.category_name) || undefined,
    }))
    .filter((row) => row.name)

  const teams = sheetRows(workbook, 'Teams')
    .map((row) => ({
      name: str(row.name),
      clubName: str(row.club_name) || undefined,
      contactEmail: str(row.contact_email) || undefined,
      categoryName: str(row.category_name) || undefined,
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
      categoryName: str(row.category_name) || undefined,
    }))
    .filter((row) => row.name)

  const pairs = sheetRows(workbook, 'Pairs')
    .map((row) => ({
      player1Name: str(row.player1_name),
      player2Name: str(row.player2_name),
      teamName: str(row.team_name) || undefined,
      clubName: str(row.club_name) || undefined,
      categoryName: str(row.category_name) || undefined,
    }))
    .filter((row) => row.player1Name && row.player2Name)

  return { clubs, teams, players, pairs }
}
