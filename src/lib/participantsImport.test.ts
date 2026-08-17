import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { buildParticipantsTemplateWorkbook } from './participantsImportTemplate'
import { parseParticipantsWorkbook } from './participantsImport'

describe('parseParticipantsWorkbook', () => {
  it('round-trips the template, including identification_number and photo (MSG-05)', () => {
    const buffer = buildParticipantsTemplateWorkbook()
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    const parsed = parseParticipantsWorkbook(arrayBuffer)

    // The template walks through one small example scenario (5 contingents, a couple of team
    // rosters, 9 participants covering the optional-field variations) rather than one throwaway
    // row per sheet - assert the scenario's shape, not just that parsing didn't crash.
    expect(parsed.clubs).toHaveLength(5)
    expect(parsed.teams).toHaveLength(4)
    expect(parsed.players).toHaveLength(9)
    expect(parsed.pairs).toHaveLength(1)

    expect(parsed.players[0]).toMatchObject({
      name: 'John Smith',
      clubName: 'Contingent Jakarta',
      identificationNumber: 'ID-0001',
      photo: 'https://example.com/photos/john-smith.jpg',
    })
    // A player with no club_name (e.g. an independent entrant with no contingent) - the field must
    // come back undefined, not an empty string, same as every other blank-optional-cell case.
    const playerWithNoClub = parsed.players.find((player) => player.name === 'Fajar Nugroho')
    expect(playerWithNoClub).toMatchObject({ clubName: undefined, identificationNumber: undefined })
    // A team with no club_name (a cross-contingent squad) - same blank-vs-undefined check on the
    // Teams sheet.
    const teamWithNoClub = parsed.teams.find((team) => team.name === 'Organizing Committee Mixed Volleyball')
    expect(teamWithNoClub).toMatchObject({ clubName: undefined })
    // The register-on-import shortcut: a category_name value comes back as-is, a blank one comes
    // back undefined - same convention as every other optional cell.
    const playerWithCategory = parsed.players.find((player) => player.name === 'Amanda Putri')
    expect(playerWithCategory).toMatchObject({ categoryName: 'Badminton Singles Women' })
    const playerWithoutCategory = parsed.players.find((player) => player.name === 'John Smith')
    expect(playerWithoutCategory).toMatchObject({ categoryName: undefined })
    // Pairs are matched by player name, not id - both names must round-trip exactly.
    expect(parsed.pairs[0]).toMatchObject({
      player1Name: 'John Smith',
      player2Name: 'Citra Lestari',
      teamName: undefined,
      clubName: undefined,
      categoryName: undefined,
    })
  })

  it('leaves identificationNumber and photo undefined when the columns are blank', () => {
    const workbook = XLSX.utils.book_new()
    const playersSheet = XLSX.utils.json_to_sheet([{ name: 'Jane Doe' }])
    XLSX.utils.book_append_sheet(workbook, playersSheet, 'Players')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const parsed = parseParticipantsWorkbook(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )

    expect(parsed.players).toEqual([{ name: 'Jane Doe' }])
    expect(parsed.pairs).toEqual([])
  })
})
