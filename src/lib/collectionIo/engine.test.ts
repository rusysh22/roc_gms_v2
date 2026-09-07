import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { parseMenuWorkbook } from './engine'
import { MENU_IO_SPECS } from './specs'

const toBuffer = (rows: Record<string, unknown>[], sheetName: string): Buffer => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('parseMenuWorkbook', () => {
  it('maps headers to spec fields case- and separator-insensitively', () => {
    const buffer = toBuffer(
      [{ Name: 'Menteng AC', SLUG: 'menteng-ac', 'Contact Person': 'Budi', ignored: 'x' }],
      'Clubs',
    )
    const [sheet] = parseMenuWorkbook(buffer, MENU_IO_SPECS.clubs)
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.rows[0].cells).toMatchObject({
      name: 'Menteng AC',
      slug: 'menteng-ac',
      contact_person: 'Budi',
    })
    expect(sheet.rows[0].cells).not.toHaveProperty('ignored')
    expect(sheet.rows[0].rowNumber).toBe(2)
  })

  it('drops fully blank rows but keeps partially filled ones', () => {
    const buffer = toBuffer(
      [
        { name: 'A', slug: '' },
        { name: '', slug: '' },
        { name: 'C', slug: '' },
      ],
      'Clubs',
    )
    const [sheet] = parseMenuWorkbook(buffer, MENU_IO_SPECS.clubs)
    expect(sheet.rows.map((r) => r.cells.name)).toEqual(['A', 'C'])
  })

  it('returns an empty sheet when the tab is missing', () => {
    const buffer = toBuffer([{ name: 'A' }], 'WrongTab')
    const [sheet] = parseMenuWorkbook(buffer, MENU_IO_SPECS.clubs)
    expect(sheet.rows).toEqual([])
  })

  it('handles a multi-sheet menu (facilities = venues + courts)', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ name: 'Main Hall' }]), 'Venues')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ name: 'Court 1', venue: 'Main Hall', capacity: 200 }]),
      'Courts',
    )
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const parsed = parseMenuWorkbook(buffer, MENU_IO_SPECS.facilities)
    expect(parsed.map((p) => p.sheet.sheetName)).toEqual(['Venues', 'Courts'])
    expect(parsed[0].rows[0].cells.name).toBe('Main Hall')
    expect(parsed[1].rows[0].cells).toMatchObject({ name: 'Court 1', venue_id: 'Main Hall', capacity: 200 })
  })
})
