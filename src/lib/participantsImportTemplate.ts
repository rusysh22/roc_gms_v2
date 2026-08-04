import * as XLSX from 'xlsx'

// Column names here must match the keys `participantsImport.ts` reads back out - keep them in
// sync if either side changes.
export const buildParticipantsTemplateWorkbook = (): Buffer => {
  const workbook = XLSX.utils.book_new()

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['How to use this template'],
    [''],
    ['1. Fill in one row per club, team, or player on its matching sheet tab below.'],
    ['2. "name" is required on every sheet.'],
    [
      '3. On the Teams and Players sheets, "club_name" is optional. If set, it must match a name ' +
        'from the Clubs sheet (or an existing club in this event) - case-insensitive.',
    ],
    [
      '4. "gender" on the Players sheet must be one of: male, female, other, prefer_not_to_say - ' +
        'or left blank.',
    ],
    [
      '5. "employee_id" on the Players sheet is optional but must be unique within this event if ' +
        'set - a duplicate will fail just that row, not the whole import.',
    ],
    ['6. "photo" on the Players sheet is optional and must be a URL to an image, not a file upload.'],
    ['7. Do not rename the Clubs / Teams / Players sheet tabs - the importer reads them by name.'],
    ['8. Delete the example row before adding your own data (or just overwrite it).'],
    ['9. Upload this file on the Clubs / Teams / Players step of the New Event Wizard.'],
  ])
  instructionsSheet['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

  const clubsSheet = XLSX.utils.json_to_sheet([
    { name: 'FC Example', contact_person: 'Jane Doe', contact_email: 'jane@example.com' },
  ])
  clubsSheet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(workbook, clubsSheet, 'Clubs')

  const teamsSheet = XLSX.utils.json_to_sheet([
    { name: 'FC Example U-18', club_name: 'FC Example', contact_email: 'team@example.com' },
  ])
  teamsSheet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams')

  const playersSheet = XLSX.utils.json_to_sheet([
    {
      name: 'John Smith',
      club_name: 'FC Example',
      email: 'john@example.com',
      phone: '0812-0000-0000',
      gender: 'male',
      employee_id: 'EMP-0001',
      photo: 'https://example.com/photos/john-smith.jpg',
    },
  ])
  playersSheet['!cols'] = [
    { wch: 26 },
    { wch: 22 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 36 },
  ]
  XLSX.utils.book_append_sheet(workbook, playersSheet, 'Players')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
