import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'

import { buildParticipantsTemplateWorkbook } from './participantsImportTemplate'
import { parseParticipantsWorkbook } from './participantsImport'

describe('parseParticipantsWorkbook', () => {
  it('round-trips the template, including employee_id and photo (MSG-05)', () => {
    const buffer = buildParticipantsTemplateWorkbook()
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

    const parsed = parseParticipantsWorkbook(arrayBuffer)

    expect(parsed.players).toHaveLength(1)
    expect(parsed.players[0]).toMatchObject({
      name: 'John Smith',
      employeeId: 'EMP-0001',
      photo: 'https://example.com/photos/john-smith.jpg',
    })
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
