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
    ['This file has 7 data sheets (tabs at the bottom): Sports, Rulesets, Categories, Clubs, Teams, Players, Pairs.'],
    [''],
    ['Fill them top to bottom - the importer processes them in that order, so a Category can name a'],
    ['Sport from the Sports sheet, and a Clubs/Teams/Players/Pairs row can name a Category from the'],
    ['Categories sheet, all in the same upload. Any sheet you leave empty is simply skipped.'],
    [''],
    ['What each sheet is for'],
    [
      '- Sports = the games played at your event (Badminton, Futsal, Chess, ...). Re-importing a sport ' +
        'with the same name updates it instead of creating a duplicate.',
    ],
    [
      '- Rulesets = optional scoring rules you can attach to a category (best-of-3 sets, goals with ' +
        'draws allowed, ...). "sport_name" must match a row on the Sports sheet. Skip this sheet to ' +
        'use each sport\'s default rules.',
    ],
    [
      '- Categories = a specific competition within a sport (Badminton Singles Men, Futsal Open, ...). ' +
        '"sport_name" must match a row on the Sports sheet (or a sport already in this event). This is ' +
        'what the "category_name" column on the sheets below registers participants into.',
    ],
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
    [
      '- Pairs = for categories like mixed doubles, where two players compete together as one entry (e.g. ' +
        'badminton doubles). Each row names two existing players from the Players sheet above (or already in ' +
        'this event) - the importer creates the 2-player team for you. Skip this sheet if no category in your ' +
        'event pairs players up.',
    ],
    [''],
    ['How to read the example data below'],
    [
      'The sample rows describe one small multi-sport event: 5 contingents (Clubs), 2 of which also field a ' +
        'futsal team plus one mixed team that is not tied to any single contingent (Teams), 9 participants ' +
        '(Players) covering the situations you are likely to hit, and one doubles pair (Pairs) built from two ' +
        'of those players - someone on a team sport\'s roster, someone who only plays an individual sport, ' +
        'someone with no contingent yet, and several optional fields left genuinely blank instead of filled ' +
        'with placeholder text.',
    ],
    [''],
    ['Column rules'],
    [
      '0. On the Sports sheet, "name" is required and "sport_type" must be one of: court, field, table, ' +
        'board, esport, track, other (blank defaults to court). On the Categories sheet, "name" and ' +
        '"sport_name" are required; "participant_mode" is one of individual/pair/team/club/open/tbd and ' +
        '"format_type" is one of single_elimination/double_elimination/round_robin/group_stage_to_knockout/' +
        'league/friendly/time_trial/score_ranking. On the Rulesets sheet "score_type" is one of ' +
        'points/goals/sets/time/result/custom. Any unrecognised value falls back to the default with a ' +
        'warning - the row is never lost. A blank optional cell on a re-import means "leave unchanged".',
    ],
    [
      '1. "name" is required on Clubs/Teams/Players; "player1_name" and "player2_name" are required on Pairs. ' +
        'Every other column is optional unless stated otherwise.',
    ],
    [
      '2. On the Teams, Players, and Pairs sheets, "club_name" is optional. If set, it must match a name from ' +
        'the Clubs sheet (or an existing club already in this event) - case-insensitive.',
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
    [
      '6. "player1_name" / "player2_name" on the Pairs sheet must each match a name on the Players sheet above ' +
        '(or an existing player already in this event) - case-insensitive. "team_name" is optional and ' +
        'defaults to "Player 1 / Player 2" if left blank.',
    ],
    [
      '7. "category_name" (on Clubs, Teams, Players, and Pairs) is optional and does two things at once: it ' +
        'creates the row AND registers it as an entry into one or more categories in the same step, instead of ' +
        'registering it later in the wizard\'s Registration step. Each name must exactly match (case-insensitive) ' +
        'the name of a category you already created in this event, and that category\'s participant type must ' +
        'match the sheet (e.g. a Players row can only register into an individual-mode category). Leave it ' +
        'blank to register participants manually later - nothing breaks either way.',
    ],
    [
      '7a. To register the same row into more than one category (e.g. a player entered in both Singles and ' +
        'Doubles, or a team entered in both a group stage and a separate cup category), list every category ' +
        'name in that one cell separated by commas: "Badminton Singles Men, Badminton Doubles Men". Each name ' +
        'is matched and validated independently - if one of the names in the list doesn\'t match anything, only ' +
        'that one registration is skipped (with a warning after import), the row and its other, valid ' +
        'registrations are unaffected.',
    ],
    ['8. Do not rename any sheet tab - the importer reads them by name.'],
    ['9. Delete the example rows before adding your own data (or just overwrite them row by row).'],
    ['10. Upload this file on the Import step of the New Event Wizard.'],
    [
      '11. Tip: once you have added your sports and categories, use "Download template for this event" ' +
        'in the wizard - it comes back with the Sports and Categories sheets already filled in with your ' +
        'real data.',
    ],
  ])
  instructionsSheet['!cols'] = [{ wch: 100 }]
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions')

  // The example sports/categories below are internally consistent with the participant sheets'
  // `category_name` cells further down ("Futsal Men", "Badminton Singles Women", ...), so the
  // whole file is one coherent walk-through rather than disconnected per-sheet samples.
  const sportsSheet = XLSX.utils.json_to_sheet([
    { name: 'Badminton', sport_type: 'court', description: '', icon: '' },
    { name: 'Futsal', sport_type: 'field', description: '', icon: '' },
  ])
  sportsSheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, sportsSheet, 'Sports')

  const rulesetsSheet = XLSX.utils.json_to_sheet([
    {
      name: 'Badminton BWF 21',
      sport_name: 'Badminton',
      score_type: 'sets',
      set_based: 'yes',
      allow_draw: 'no',
      best_of: 3,
      target_score: 21,
      max_score: 30,
      description: '',
    },
    {
      name: 'Futsal 2x20',
      sport_name: 'Futsal',
      score_type: 'goals',
      set_based: 'no',
      allow_draw: 'yes',
      best_of: '',
      target_score: '',
      max_score: '',
      description: '',
    },
  ])
  rulesetsSheet['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(workbook, rulesetsSheet, 'Rulesets')

  const categoriesSheet = XLSX.utils.json_to_sheet([
    {
      name: 'Badminton Singles Men',
      sport_name: 'Badminton',
      participant_mode: 'individual',
      format_type: 'single_elimination',
      ruleset_name: 'Badminton BWF 21',
      status: 'draft',
      roster_required: '',
      min_roster_size: '',
      max_roster_size: '',
      group_qualify_count: '',
      third_place_policy: 'match',
      result_unit: '',
      medal_eligible: 'yes',
      medal_weight: 1,
    },
    {
      name: 'Badminton Singles Women',
      sport_name: 'Badminton',
      participant_mode: 'individual',
      format_type: 'single_elimination',
      ruleset_name: '',
      status: 'draft',
      roster_required: '',
      min_roster_size: '',
      max_roster_size: '',
      group_qualify_count: '',
      third_place_policy: 'match',
      result_unit: '',
      medal_eligible: 'yes',
      medal_weight: 1,
    },
    {
      name: 'Badminton Doubles Men',
      sport_name: 'Badminton',
      participant_mode: 'pair',
      format_type: 'single_elimination',
      ruleset_name: '',
      status: 'draft',
      roster_required: '',
      min_roster_size: '',
      max_roster_size: '',
      group_qualify_count: '',
      third_place_policy: 'none',
      result_unit: '',
      medal_eligible: 'yes',
      medal_weight: 1,
    },
    {
      name: 'Futsal Men',
      sport_name: 'Futsal',
      participant_mode: 'team',
      format_type: 'group_stage_to_knockout',
      ruleset_name: 'Futsal 2x20',
      status: 'draft',
      roster_required: 'yes',
      min_roster_size: 5,
      max_roster_size: 12,
      group_qualify_count: 2,
      third_place_policy: 'match',
      result_unit: '',
      medal_eligible: 'yes',
      medal_weight: 1,
    },
    {
      name: 'Futsal Open',
      sport_name: 'Futsal',
      participant_mode: 'team',
      format_type: 'round_robin',
      ruleset_name: '',
      status: 'draft',
      roster_required: 'yes',
      min_roster_size: 5,
      max_roster_size: 12,
      group_qualify_count: '',
      third_place_policy: 'none',
      result_unit: '',
      medal_eligible: '',
      medal_weight: '',
    },
  ])
  categoriesSheet['!cols'] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categories')

  const clubsSheet = XLSX.utils.json_to_sheet([
    { name: 'Contingent Jakarta', contact_person: 'Jane Doe', contact_email: 'jane.doe@example.com', category_name: '' },
    { name: 'Contingent Bandung', contact_person: 'Amir Hidayat', contact_email: 'amir.h@example.com', category_name: '' },
    { name: 'Contingent Surabaya', contact_person: '', contact_email: '', category_name: '' },
    { name: 'Contingent Yogyakarta', contact_person: 'Siti Rahma', contact_email: 'siti.rahma@example.com', category_name: '' },
    { name: 'Contingent Medan', contact_person: '', contact_email: '', category_name: '' },
  ])
  clubsSheet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 28 }, { wch: 26 }]
  XLSX.utils.book_append_sheet(workbook, clubsSheet, 'Clubs')

  const teamsSheet = XLSX.utils.json_to_sheet([
    {
      name: 'Jakarta Futsal Men',
      club_name: 'Contingent Jakarta',
      contact_email: 'team.jakarta.futsal@example.com',
      // Demonstrates the optional register-on-import shortcut, including the comma-separated
      // multi-category form - only matches whichever of these two category names already exist in
      // this event ("Futsal Men", "Futsal Open"), the other is simply skipped with a warning.
      category_name: 'Futsal Men, Futsal Open',
    },
    { name: 'Bandung Futsal Men', club_name: 'Contingent Bandung', contact_email: '', category_name: '' },
    { name: 'Jakarta Basketball 5x5 Women', club_name: 'Contingent Jakarta', contact_email: '', category_name: '' },
    // No club_name: a mixed/combined team that doesn't belong to any single contingent - shows the
    // field is genuinely optional, not just "usually filled in."
    { name: 'Organizing Committee Mixed Volleyball', club_name: '', contact_email: 'events@example.com', category_name: '' },
  ])
  teamsSheet['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 28 }, { wch: 26 }]
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
      category_name: '',
    },
    // Individual sport (e.g. badminton singles) - never appears on any Teams row, and that's fine.
    // Also demonstrates the optional register-on-import shortcut - only matches if a category named
    // exactly "Badminton Singles Women" already exists in this event, otherwise ignored.
    {
      name: 'Amanda Putri',
      club_name: 'Contingent Jakarta',
      email: 'amanda.putri@example.com',
      phone: '0812-0000-0002',
      gender: 'female',
      identification_number: 'ID-0002',
      photo: '',
      category_name: 'Badminton Singles Women',
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
      category_name: '',
    },
    {
      name: 'Citra Lestari',
      club_name: 'Contingent Bandung',
      email: 'citra.lestari@example.com',
      phone: '',
      gender: 'female',
      identification_number: 'ID-0004',
      photo: '',
      category_name: '',
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
      category_name: '',
    },
    {
      name: 'Endah Wulandari',
      club_name: 'Contingent Yogyakarta',
      email: 'endah.w@example.com',
      phone: '0812-0000-0006',
      gender: 'prefer_not_to_say',
      identification_number: 'ID-0006',
      photo: '',
      category_name: '',
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
      category_name: '',
    },
    {
      name: 'Gita Ayu',
      club_name: 'Contingent Medan',
      email: 'gita.ayu@example.com',
      phone: '0812-0000-0008',
      gender: 'female',
      identification_number: 'ID-0008',
      photo: 'https://example.com/photos/gita-ayu.jpg',
      category_name: '',
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
      category_name: '',
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
    { wch: 26 },
  ]
  XLSX.utils.book_append_sheet(workbook, playersSheet, 'Players')

  const pairsSheet = XLSX.utils.json_to_sheet([
    // A cross-contingent mixed pair built from two players already listed on the Players sheet
    // above - shows player1_name/player2_name are matched by name, not by which club they belong
    // to. team_name and category_name both left blank to show they're genuinely optional too.
    {
      player1_name: 'John Smith',
      player2_name: 'Citra Lestari',
      team_name: '',
      club_name: '',
      category_name: '',
    },
  ])
  pairsSheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 30 }, { wch: 22 }, { wch: 26 }]
  XLSX.utils.book_append_sheet(workbook, pairsSheet, 'Pairs')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
