import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { buildParticipantsTemplateWorkbook } from './participantsImportTemplate'
import { parseParticipantsWorkbook } from './participantsImport'

describe('parseParticipantsWorkbook', () => {
  it('round-trips the template, including employee_id and photo (MSG-05)', () => {
    const buffer = buildParticipantsTemplateWorkbook()
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    const parsed = parseParticipantsWorkbook(arrayBuffer)

    // The template walks through one small example scenario (5 departments, a couple of team
    // rosters, 9 employees covering the optional-field variations) rather than one throwaway row
    // per sheet - assert the scenario's shape, not just that parsing didn't crash.
    expect(parsed.clubs).toHaveLength(5)
    expect(parsed.teams).toHaveLength(4)
    expect(parsed.players).toHaveLength(9)

    expect(parsed.players[0]).toMatchObject({
      name: 'John Smith',
      clubName: 'IT & Digital',
      employeeId: 'EMP-0001',
      photo: 'https://example.com/photos/john-smith.jpg',
    })
    // A player with no club_name (e.g. an intern/guest with no department) - the field must come
    // back undefined, not an empty string, same as every other blank-optional-cell case.
    const playerWithNoClub = parsed.players.find((player) => player.name === 'Fajar Nugroho')
    expect(playerWithNoClub).toMatchObject({ clubName: undefined, employeeId: undefined })
    // A team with no club_name (a cross-department squad) - same blank-vs-undefined check on the
    // Teams sheet.
    const teamWithNoClub = parsed.teams.find((team) => team.name === 'Directors Mixed Volleyball')
    expect(teamWithNoClub).toMatchObject({ clubName: undefined })
  })

  it('leaves employeeId and photo undefined when the columns are blank', () => {
    const workbook = XLSX.utils.book_new()
    const playersSheet = XLSX.utils.json_to_sheet([{ name: 'Jane Doe' }])
    XLSX.utils.book_append_sheet(workbook, playersSheet, 'Players')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const parsed = parseParticipantsWorkbook(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )

    expect(parsed.players).toEqual([{ name: 'Jane Doe' }])
  })
})
