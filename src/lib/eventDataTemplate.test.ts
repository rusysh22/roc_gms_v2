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
    // The example participant rows use a real category name and are flagged for deletion.
    expect(parsed.players[0]).toMatchObject({ name: 'DELETE THIS EXAMPLE ROW', categoryNames: ['Badminton Singles Men'] })
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
