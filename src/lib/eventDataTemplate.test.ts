import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { buildEventDataTemplateWorkbook } from './eventDataTemplate'
import { parseParticipantsWorkbook } from './participantsImport'

// A stand-in for the Payload local API - only `find`, keyed by collection, is used.
const fakePayload = {
  find: async ({ collection }: { collection: string }) => {
    const docs: Record<string, unknown[]> = {
      sports: [
        { id: 1, name: 'Badminton', sport_type: 'court' },
        { id: 2, name: 'Futsal', sport_type: 'field' },
      ],
      rulesets: [{ id: 10, name: 'BWF 21', sport_id: { id: 1, name: 'Badminton' }, score_type: 'sets', set_based: true }],
      'competition-categories': [
        {
          id: 100,
          name: 'Badminton Singles Men',
          sport_id: { id: 1, name: 'Badminton' },
          ruleset_id: { id: 10, name: 'BWF 21' },
          participant_mode: 'individual',
          format_type: 'single_elimination',
          status: 'draft',
          third_place_policy: 'match',
        },
      ],
      clubs: [{ id: 200, name: 'Contingent Jakarta' }],
    }
    return { docs: docs[collection] ?? [] }
  },
}

describe('buildEventDataTemplateWorkbook', () => {
  it('pre-fills Sports/Rulesets/Categories with the event data and round-trips through the parser', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await buildEventDataTemplateWorkbook(fakePayload as any, '1')
    const parsed = parseParticipantsWorkbook(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )

    expect(parsed.sports.map((s) => s.name)).toEqual(['Badminton', 'Futsal'])
    expect(parsed.rulesets[0]).toMatchObject({ name: 'BWF 21', sportName: 'Badminton', scoreType: 'sets' })
    expect(parsed.categories[0]).toMatchObject({
      name: 'Badminton Singles Men',
      sportName: 'Badminton',
      rulesetName: 'BWF 21',
      participantMode: 'individual',
    })
    // Individual categories get worked example Players registered straight into them; every
    // generated name is prefixed "EXAMPLE - " so the organizer can spot and bulk-delete them.
    const examples = parsed.players.filter((p) => p.name.startsWith('EXAMPLE - '))
    expect(examples.length).toBeGreaterThanOrEqual(4)
    expect(examples.every((p) => p.categoryNames?.[0] === 'Badminton Singles Men')).toBe(true)
  })

  it('builds pair/team example rows from the event categories with matching participant_mode', async () => {
    const payloadWithModes = {
      find: async ({ collection }: { collection: string }) => {
        const docs: Record<string, unknown[]> = {
          sports: [
            { id: 1, name: 'Badminton', sport_type: 'court' },
            { id: 2, name: 'Petanque', sport_type: 'field' },
          ],
          rulesets: [],
          'competition-categories': [
            { id: 100, name: 'Badminton Doubles Men', sport_id: { id: 1, name: 'Badminton' }, participant_mode: 'pair' },
            { id: 101, name: 'Petanque Triples', sport_id: { id: 2, name: 'Petanque' }, participant_mode: 'team' },
          ],
          clubs: [],
        }
        return { docs: docs[collection] ?? [] }
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await buildEventDataTemplateWorkbook(payloadWithModes as any, '1')
    const parsed = parseParticipantsWorkbook(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    )

    // pair category -> example Pairs, each built from two example Players on the Players sheet
    const pairExamples = parsed.pairs.filter((p) => p.player1Name.startsWith('EXAMPLE - '))
    expect(pairExamples.length).toBeGreaterThanOrEqual(3)
    expect(pairExamples.every((p) => p.categoryNames?.[0] === 'Badminton Doubles Men')).toBe(true)
    const playerNames = new Set(parsed.players.map((p) => p.name))
    for (const pair of pairExamples) {
      expect(playerNames.has(pair.player1Name)).toBe(true)
      expect(playerNames.has(pair.player2Name)).toBe(true)
    }

    // team category -> example Teams tied to a contingent
    const teamExamples = parsed.teams.filter((t) => t.name.startsWith('EXAMPLE - '))
    expect(teamExamples.length).toBeGreaterThanOrEqual(3)
    expect(teamExamples.every((t) => t.categoryNames?.[0] === 'Petanque Triples')).toBe(true)
  })

  it('adds list data validations and a hidden _Reference sheet', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await buildEventDataTemplateWorkbook(fakePayload as any, '1')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)

    expect(wb.getWorksheet('_Reference')?.state).toBe('veryHidden')

    const categories = wb.getWorksheet('Categories')!
    // sport_name (col B) -> reference range dropdown
    expect(categories.getCell('B2').dataValidation).toMatchObject({ type: 'list' })
    // participant_mode (col C) -> inline enum dropdown, strict
    expect(categories.getCell('C2').dataValidation).toMatchObject({
      type: 'list',
      formulae: [`"individual,pair,team,club,open,tbd"`],
    })
    // category_name dropdown must be non-blocking (comma lists allowed)
    expect(wb.getWorksheet('Players')!.getCell('H2').dataValidation?.errorStyle).toBe('warning')
  })
})
