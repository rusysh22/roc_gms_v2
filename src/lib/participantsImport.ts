import * as XLSX from 'xlsx'

export type ParsedClubRow = { name: string; contactPerson?: string; contactEmail?: string }
export type ParsedTeamRow = { name: string; clubName?: string; contactEmail?: string }
export type ParsedPlayerRow = {
  name: string
  clubName?: string
  email?: string
  phone?: string
  gender?: string
}

export type ParsedParticipantsWorkbook = {
  clubs: ParsedClubRow[]
  teams: ParsedTeamRow[]
  players: ParsedPlayerRow[]
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
    }))
    .filter((row) => row.name)

  const teams = sheetRows(workbook, 'Teams')
    .map((row) => ({
      name: str(row.name),
      clubName: str(row.club_name) || undefined,
      contactEmail: str(row.contact_email) || undefined,
    }))
    .filter((row) => row.name)

  const players = sheetRows(workbook, 'Players')
    .map((row) => ({
      name: str(row.name),
      clubName: str(row.club_name) || undefined,
      email: str(row.email) || undefined,
      phone: str(row.phone) || undefined,
      gender: str(row.gender).toLowerCase() || undefined,
    }))
    .filter((row) => row.name)

  return { clubs, teams, players }
}
