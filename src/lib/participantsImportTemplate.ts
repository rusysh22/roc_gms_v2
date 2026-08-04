import * as XLSX from 'xlsx'

// Column names here must match the keys `participantsImport.ts` reads back out - keep them in
// sync if either side changes.
//
// The example rows below are deliberately a small, coherent scenario (5 contingents, a mix of
// team and individual sports) rather than one throwaway row per sheet. A first-time organizer
// downloading this file has never seen Clubs/Teams/Players as separate concepts before - a single
// generic row per sheet answers "what column goes where" but not "what does my real event's data
// look like once it's in here." Walking through one small but complete example (some players on a
// club with no team because their sport is individual, one team that isn't tied to any club, blank
// optional fields shown as genuinely blank rather than omitted) answers the second question, which
// is the one that actually causes support requests.
//
// "Contingent" names are used rather than office departments deliberately: this importer is used
// for company sports days just as often as inter-school tournaments, community/public games, or
// regional PORSENI-style events - none of which have "departments". The example organizations
// below stand in for whatever a real organizer's competing groups actually are (departments,
// schools, clubs, or regional delegations).
export const buildParticipantsTemplateWorkbook = (): Buffer => {
  const workbook = XLSX.utils.book_new()

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['How to use this template'],
    [''],
    ['This file has 3 data sheets (tabs at the bottom): Clubs, Teams, Players.'],
    [''],
    ['What each sheet is for'],
    [
      '- Clubs = the contingents competing against each other - whatever that means for your event: ' +
        'departments in a company sports day, schools in an inter-school tournament, chapters in a club ' +
        'league, or regional delegations in a community/public games. If your event scores individuals ' +
        'directly with no group affiliation at all, you can leave this sheet empty.',
    ],
    [
      '- Teams = a squad for a TEAM sport only (futsal, basketball 5x5, tug-of-war, relay, etc.). Skip this ' +
        'sheet entirely if every sport in your event is played one-on-one (badminton singles, chess, running).',
    ],
    [
      '- Players = every person taking part, whether they compete solo (individual sports) or will later be ' +
        'added to one of the rosters above. "club_name" here only marks which contingent they represent - it ' +
        'does not put them on a specific team\'s roster. Roster assignment happens in a later wizard step.',
    ],
    [''],
    ['How to read the example data below'],
    [
      'The sample rows describe one small multi-sport event: 5 contingents (Clubs), 2 of which also field a ' +
        'futsal team plus one mixed team that is not tied to any single contingent (Teams), and 9 participants ' +
        '(Players) covering the situations you are likely to hit - someone on a team sport\'s roster, someone ' +
        'who only plays an individual sport, someone with no contingent yet, and several optional fields left ' +
        'genuinely blank instead of filled with placeholder text.',
    ],
    [''],
    ['Column rules'],
    ['1. "name" is required on every sheet - every other column is optional unless stated otherwise.'],
    [
      '2. On the Teams and Players sheets, "club_name" is optional. If set, it must match a name from the ' +
        'Clubs sheet (or an existing club already in this event) - case-insensitive.',
    ],
    [
      '3. "gender" on the Players sheet must be one of: male, female, other, prefer_not_to_say - or left blank.',
    ],
    [
      '4. "identification_number" on the Players sheet is optional but must be unique within this event if ' +
        'set - a duplicate only fails that one row, not the whole import. Use whatever ID your organization ' +
        'already has (student ID, member number, staff ID, national ID) - or leave it blank entirely.',
    ],
    ['5. "photo" on the Players sheet is optional and must be a URL to an image, not a file upload.'],
    ['6. Do not rename the Clubs / Teams / Players sheet tabs - the importer reads them by name.'],
    ['7. Delete the example rows before adding your own data (or just overwrite them row by row).'],
    ['8. Upload this file on the Clubs / Teams / Players step of the New Event Wizard.'],
  ])
  instructionsSheet['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

  const clubsSheet = XLSX.utils.json_to_sheet([
    { name: 'Contingent Jakarta', contact_person: 'Jane Doe', contact_email: 'jane.doe@example.com' },
    { name: 'Contingent Bandung', contact_person: 'Amir Hidayat', contact_email: 'amir.h@example.com' },
    { name: 'Contingent Surabaya', contact_person: '', contact_email: '' },
    { name: 'Contingent Yogyakarta', contact_person: 'Siti Rahma', contact_email: 'siti.rahma@example.com' },
    { name: 'Contingent Medan', contact_person: '', contact_email: '' },
  ])
  clubsSheet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(workbook, clubsSheet, 'Clubs')

  const teamsSheet = XLSX.utils.json_to_sheet([
    { name: 'Jakarta Futsal Men', club_name: 'Contingent Jakarta', contact_email: 'team.jakarta.futsal@example.com' },
    { name: 'Bandung Futsal Men', club_name: 'Contingent Bandung', contact_email: '' },
    { name: 'Jakarta Basketball 5x5 Women', club_name: 'Contingent Jakarta', contact_email: '' },
    // No club_name: a mixed/combined team that doesn't belong to any single contingent - shows the
    // field is genuinely optional, not just "usually filled in."
    { name: 'Organizing Committee Mixed Volleyball', club_name: '', contact_email: 'events@example.com' },
  ])
  teamsSheet['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams')

  const playersSheet = XLSX.utils.json_to_sheet([
    // On a team sport's roster later, full info filled in.
    {
      name: 'John Smith',
      club_name: 'Contingent Jakarta',
      email: 'john.smith@example.com',
      phone: '0812-0000-0001',
      gender: 'male',
      identification_number: 'ID-0001',
      photo: 'https://example.com/photos/john-smith.jpg',
    },
    // Individual sport (e.g. badminton singles) - never appears on any Teams row, and that's fine.
    {
      name: 'Amanda Putri',
      club_name: 'Contingent Jakarta',
      email: 'amanda.putri@example.com',
      phone: '0812-0000-0002',
      gender: 'female',
      identification_number: 'ID-0002',
      photo: '',
    },
    // Just registered - no identification_number assigned yet. Left blank, not "N/A" or "-".
    {
      name: 'Budi Santoso',
      club_name: 'Contingent Bandung',
      email: 'budi.santoso@example.com',
      phone: '0812-0000-0003',
      gender: 'male',
      identification_number: '',
      photo: '',
    },
    {
      name: 'Citra Lestari',
      club_name: 'Contingent Bandung',
      email: 'citra.lestari@example.com',
      phone: '',
      gender: 'female',
      identification_number: 'ID-0004',
      photo: '',
    },
    // Gender left blank - it's optional, not every organizer collects or needs it.
    {
      name: 'Dedi Kurniawan',
      club_name: 'Contingent Surabaya',
      email: 'dedi.k@example.com',
      phone: '0812-0000-0005',
      gender: '',
      identification_number: 'ID-0005',
      photo: '',
    },
    {
      name: 'Endah Wulandari',
      club_name: 'Contingent Yogyakarta',
      email: 'endah.w@example.com',
      phone: '0812-0000-0006',
      gender: 'prefer_not_to_say',
      identification_number: 'ID-0006',
      photo: '',
    },
    // No club_name - not every participant has to belong to a contingent (e.g. an independent
    // entrant, a guest, or someone competing individually outside any group).
    {
      name: 'Fajar Nugroho',
      club_name: '',
      email: 'fajar.n@example.com',
      phone: '0812-0000-0007',
      gender: 'male',
      identification_number: '',
      photo: '',
    },
    {
      name: 'Gita Ayu',
      club_name: 'Contingent Medan',
      email: 'gita.ayu@example.com',
      phone: '0812-0000-0008',
      gender: 'female',
      identification_number: 'ID-0008',
      photo: 'https://example.com/photos/gita-ayu.jpg',
    },
    // Only name and email filled in - everything else genuinely optional.
    {
      name: 'Hendra Wijaya',
      club_name: 'Contingent Medan',
      email: 'hendra.w@example.com',
      phone: '',
      gender: '',
      identification_number: '',
      photo: '',
    },
  ])
  playersSheet['!cols'] = [
    { wch: 26 },
    { wch: 24 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 36 },
  ]
  XLSX.utils.book_append_sheet(workbook, playersSheet, 'Players')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
