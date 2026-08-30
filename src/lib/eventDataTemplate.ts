import ExcelJS from 'exceljs'
import type { Payload } from 'payload'

// prd/redesign/import-data-and-draft-persistence.md track IMP, template variant 2 ("Download
// template for this event"): the same workbook shape as buildParticipantsTemplateWorkbook, but the
// Sports / Rulesets / Categories sheets come back pre-filled with THIS event's real rows, AND every
// relationship / enum column is an Excel dropdown fed by a hidden `_Reference` sheet - so the
// organizer picks a real sport / category / club / mode from a list instead of typing a name that
// has to match exactly. Built with `exceljs` (not the `xlsx` community build the blank template and
// the parser use) because only `exceljs` can write `dataValidation` structures.
//
// Dropdowns on the free-text `category_name` cells use `errorStyle: 'warning'`, not `stop`, on
// purpose: that column accepts a comma-separated list of several categories, which a strict list
// validation would reject.

type RelationshipValue = number | string | { id?: number | string; name?: unknown } | null | undefined

const relationshipName = (value: RelationshipValue, byId: Map<string, string>): string => {
  if (value && typeof value === 'object') {
    if (typeof value.name === 'string') return value.name
    if (value.id !== undefined) return byId.get(String(value.id)) ?? ''
    return ''
  }
  if (value === null || value === undefined) return ''
  return byId.get(String(value)) ?? ''
}

const yesNo = (value: unknown): string => (value === true ? 'yes' : value === false ? 'no' : '')

const ENUMS = {
  sportType: 'court,field,table,board,esport,track,other',
  scoreType: 'points,goals,sets,time,result,custom',
  participantMode: 'individual,pair,team,club,open,tbd',
  formatType:
    'single_elimination,double_elimination,round_robin,group_stage_to_knockout,league,friendly,time_trial,score_ranking',
  categoryStatus: 'draft,open,locked,published,archived',
  thirdPlace: 'none,match,shared',
  gender: 'male,female,other,prefer_not_to_say',
  yesNo: 'yes,no',
} as const

// Rows 2..VALIDATION_ROWS get the dropdown - generous headroom over any realistic sheet.
const VALIDATION_ROWS = 600

type ColSpec = { header: string; width: number }

const setColumns = (ws: ExcelJS.Worksheet, specs: ColSpec[]) => {
  ws.columns = specs.map((spec) => ({ header: spec.header, key: spec.header, width: spec.width }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

const applyList = (
  ws: ExcelJS.Worksheet,
  colLetter: string,
  formula: string,
  { strict = false }: { strict?: boolean } = {},
) => {
  for (let row = 2; row <= VALIDATION_ROWS; row += 1) {
    ws.getCell(`${colLetter}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: strict ? 'error' : 'warning',
      errorTitle: 'Check this value',
      error: strict
        ? 'Pick a value from the dropdown list.'
        : "This isn't one of the listed values - keep it only if you're sure it's right.",
    }
  }
}

export const buildEventDataTemplateWorkbook = async (
  payload: Payload,
  eventId: string,
): Promise<Buffer> => {
  const [sports, rulesets, categories, clubs] = await Promise.all([
    payload.find({
      collection: 'sports',
      depth: 0,
      limit: 1000,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'rulesets',
      depth: 0,
      limit: 1000,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'competition-categories',
      depth: 1,
      limit: 1000,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
    payload.find({
      collection: 'clubs',
      depth: 0,
      limit: 1000,
      where: { event_id: { equals: eventId } },
      sort: 'name',
    }),
  ])

  const sportNameById = new Map<string, string>()
  for (const sport of sports.docs) sportNameById.set(String(sport.id), String(sport.name))
  const rulesetNameById = new Map<string, string>()
  for (const ruleset of rulesets.docs) rulesetNameById.set(String(ruleset.id), String(ruleset.name))

  const sportNames = sports.docs.map((sport) => String(sport.name))
  const rulesetNames = rulesets.docs.map((ruleset) => String(ruleset.name))
  const categoryNames = categories.docs.map((category) => String(category.name))
  const clubNames = clubs.docs.map((club) => String(club.name))

  const workbook = new ExcelJS.Workbook()

  // --- _Reference (hidden): one column per lookup list, feeding the dropdowns below ---
  const ref = workbook.addWorksheet('_Reference')
  ref.state = 'veryHidden'
  ref.columns = [
    { header: 'sports', key: 'sports', width: 24 },
    { header: 'rulesets', key: 'rulesets', width: 24 },
    { header: 'categories', key: 'categories', width: 28 },
    { header: 'clubs', key: 'clubs', width: 28 },
  ]
  const refRowCount = Math.max(sportNames.length, rulesetNames.length, categoryNames.length, clubNames.length)
  for (let i = 0; i < refRowCount; i += 1) {
    ref.addRow({
      sports: sportNames[i] ?? null,
      rulesets: rulesetNames[i] ?? null,
      categories: categoryNames[i] ?? null,
      clubs: clubNames[i] ?? null,
    })
  }
  const sportsRef = sportNames.length > 0 ? `=_Reference!$A$2:$A$${sportNames.length + 1}` : null
  const rulesetsRef = rulesetNames.length > 0 ? `=_Reference!$B$2:$B$${rulesetNames.length + 1}` : null
  const categoriesRef = categoryNames.length > 0 ? `=_Reference!$C$2:$C$${categoryNames.length + 1}` : null
  const clubsRef = clubNames.length > 0 ? `=_Reference!$D$2:$D$${clubNames.length + 1}` : null

  // --- Instructions ---
  const instructions = workbook.addWorksheet('Instructions')
  instructions.getColumn(1).width = 96
  const lines = [
    'Template for this event',
    '',
    "The Sports, Rulesets and Categories sheets are pre-filled with this event's data. Review them",
    '(edit a cell to change a value - a matching name updates the existing row, it does not create a',
    'duplicate), then fill in the Clubs / Teams / Players / Pairs sheets.',
    '',
    'Most cells have a dropdown - click the cell and pick from the list. On "category_name" you can',
    'still type a comma-separated list of several categories; the dropdown there only warns, it does',
    'not block.',
    '',
    'EXAMPLE ROWS: the Clubs / Teams / Players / Pairs sheets come pre-filled with worked example',
    "rows built from THIS event's own categories, so you can see how the data fits together:",
    '  - every "individual" category (singles, solo events) gets example Players registered into it;',
    '  - every "pair" category (doubles, e.g. badminton doubles) gets example Pairs, each built from',
    '    two example Players on the Players sheet;',
    '  - every "team" category (e.g. petanque triples, futsal) gets example Teams, tied to a club.',
    'Every example row\'s first column starts with "EXAMPLE - ". Delete them all before you upload',
    '(sort a sheet by its first column to group the example rows together), or overwrite them with',
    'your real data row by row.',
    '',
    'Do not rename any sheet tab. Upload this file on the Import step of the New Event Wizard.',
  ]
  lines.forEach((line) => instructions.addRow([line]))

  // --- Sports ---
  const sportsSheet = workbook.addWorksheet('Sports')
  setColumns(sportsSheet, [
    { header: 'name', width: 22 },
    { header: 'sport_type', width: 14 },
    { header: 'description', width: 32 },
    { header: 'icon', width: 14 },
  ])
  if (sports.docs.length > 0) {
    for (const sport of sports.docs) {
      sportsSheet.addRow({
        name: String(sport.name),
        sport_type: String(sport.sport_type || 'court'),
        description: String(sport.description || ''),
        icon: String(sport.icon || ''),
      })
    }
  } else {
    sportsSheet.addRow({ name: '', sport_type: 'court', description: '', icon: '' })
  }
  applyList(sportsSheet, 'B', `"${ENUMS.sportType}"`, { strict: true })

  // --- Rulesets ---
  const rulesetsSheet = workbook.addWorksheet('Rulesets')
  setColumns(rulesetsSheet, [
    { header: 'name', width: 22 },
    { header: 'sport_name', width: 16 },
    { header: 'score_type', width: 14 },
    { header: 'set_based', width: 12 },
    { header: 'allow_draw', width: 12 },
    { header: 'best_of', width: 10 },
    { header: 'target_score', width: 14 },
    { header: 'max_score', width: 12 },
    { header: 'description', width: 32 },
  ])
  if (rulesets.docs.length > 0) {
    for (const ruleset of rulesets.docs) {
      rulesetsSheet.addRow({
        name: String(ruleset.name),
        sport_name: relationshipName(ruleset.sport_id as RelationshipValue, sportNameById),
        score_type: String(ruleset.score_type || 'points'),
        set_based: yesNo(ruleset.set_based),
        allow_draw: yesNo(ruleset.allow_draw),
        best_of: ruleset.best_of ?? '',
        target_score: ruleset.target_score ?? '',
        max_score: ruleset.max_score ?? '',
        description: String(ruleset.description || ''),
      })
    }
  } else {
    rulesetsSheet.addRow({ name: '', sport_name: '', score_type: 'points' })
  }
  if (sportsRef) applyList(rulesetsSheet, 'B', sportsRef)
  applyList(rulesetsSheet, 'C', `"${ENUMS.scoreType}"`, { strict: true })
  applyList(rulesetsSheet, 'D', `"${ENUMS.yesNo}"`)
  applyList(rulesetsSheet, 'E', `"${ENUMS.yesNo}"`)

  // --- Categories ---
  const categoriesSheet = workbook.addWorksheet('Categories')
  setColumns(categoriesSheet, [
    { header: 'name', width: 26 },
    { header: 'sport_name', width: 18 },
    { header: 'participant_mode', width: 18 },
    { header: 'format_type', width: 24 },
    { header: 'ruleset_name', width: 20 },
    { header: 'status', width: 12 },
    { header: 'roster_required', width: 16 },
    { header: 'min_roster_size', width: 16 },
    { header: 'max_roster_size', width: 16 },
    { header: 'group_qualify_count', width: 18 },
    { header: 'third_place_policy', width: 18 },
    { header: 'result_unit', width: 14 },
    { header: 'medal_eligible', width: 14 },
    { header: 'medal_weight', width: 14 },
  ])
  if (categories.docs.length > 0) {
    for (const category of categories.docs) {
      categoriesSheet.addRow({
        name: String(category.name),
        sport_name: relationshipName(category.sport_id as RelationshipValue, sportNameById),
        participant_mode: String(category.participant_mode || 'open'),
        format_type: String(category.format_type || 'single_elimination'),
        ruleset_name: relationshipName(category.ruleset_id as RelationshipValue, rulesetNameById),
        status: String(category.status || 'draft'),
        roster_required: yesNo(category.roster_required),
        min_roster_size: category.min_roster_size ?? '',
        max_roster_size: category.max_roster_size ?? '',
        group_qualify_count: category.group_qualify_count ?? '',
        third_place_policy: String(category.third_place_policy || 'none'),
        result_unit: String(category.result_unit || ''),
        medal_eligible: yesNo(category.medal_eligible),
        medal_weight: category.medal_weight ?? '',
      })
    }
  } else {
    categoriesSheet.addRow({
      name: '',
      sport_name: '',
      participant_mode: 'open',
      format_type: 'single_elimination',
      status: 'draft',
      third_place_policy: 'none',
    })
  }
  if (sportsRef) applyList(categoriesSheet, 'B', sportsRef)
  applyList(categoriesSheet, 'C', `"${ENUMS.participantMode}"`, { strict: true })
  applyList(categoriesSheet, 'D', `"${ENUMS.formatType}"`, { strict: true })
  if (rulesetsRef) applyList(categoriesSheet, 'E', rulesetsRef)
  applyList(categoriesSheet, 'F', `"${ENUMS.categoryStatus}"`, { strict: true })
  applyList(categoriesSheet, 'G', `"${ENUMS.yesNo}"`)
  applyList(categoriesSheet, 'K', `"${ENUMS.thirdPlace}"`, { strict: true })
  applyList(categoriesSheet, 'M', `"${ENUMS.yesNo}"`)

  // --- Worked example rows for the participant sheets --------------------------------------------
  // The blank template ships a fixed "one small multi-sport event" walk-through. Here we can do
  // better: we know this event's real categories and their participant_mode, so we generate example
  // rows that mirror THIS event - individual categories get example Players, pair categories get
  // example Pairs, team categories get example Teams. Every generated cell in a name column is
  // prefixed "EXAMPLE - " so the organizer can spot and bulk-delete them (see Instructions).
  const EX = 'EXAMPLE - '
  const catNamesByMode = (mode: string): string[] =>
    categories.docs
      .filter((c) => String(c.participant_mode || '').toLowerCase() === mode)
      .map((c) => String(c.name))
  const individualCatNames = [...catNamesByMode('individual'), ...catNamesByMode('open'), ...catNamesByMode('tbd')]
  const pairCatNames = catNamesByMode('pair')
  const teamCatNames = catNamesByMode('team')
  const clubCatNames = catNamesByMode('club')

  // Reference contingent names for the examples: the event's real clubs if it has any (so the
  // club_name dropdowns match), otherwise invented "EXAMPLE - Contingent X" names that we also add
  // as rows on the Clubs sheet so the whole file stays internally consistent.
  const hasRealClubs = clubNames.length > 0
  const baseContingents = hasRealClubs
    ? clubNames
    : ['Contingent Alpha', 'Contingent Bravo', 'Contingent Charlie', 'Contingent Delta']
  const contingent = (i: number): string => {
    const base = baseContingents[i % baseContingents.length]
    return hasRealClubs ? base : `${EX}${base}`
  }

  const FIRST_NAMES = [
    'Andi', 'Bella', 'Chandra', 'Dewi', 'Eka', 'Fikri', 'Gina', 'Hadi', 'Indah', 'Joko',
    'Kirana', 'Lukman', 'Maya', 'Nanda', 'Oscar', 'Putri', 'Rizky', 'Sinta', 'Toni', 'Umi',
  ]
  type PlayerExample = {
    name: string
    club_name: string
    email: string
    phone: string
    gender: string
    identification_number: string
    photo: string
    category_name: string
  }
  const examplePlayers: PlayerExample[] = []
  let playerSeq = 0
  const addExamplePlayer = (categoryName: string): string => {
    playerSeq += 1
    const first = FIRST_NAMES[(playerSeq - 1) % FIRST_NAMES.length]
    const name = `${EX}${first} P${String(playerSeq).padStart(2, '0')}`
    examplePlayers.push({
      name,
      club_name: contingent(playerSeq - 1),
      email: `${first.toLowerCase()}.p${playerSeq}@example.com`,
      phone: '',
      gender: playerSeq % 2 === 0 ? 'female' : 'male',
      identification_number: `EX-${String(playerSeq).padStart(3, '0')}`,
      photo: '',
      category_name: categoryName,
    })
    return name
  }

  // Individual categories: 4 example entrants each, registered straight into the category.
  for (const catName of individualCatNames.slice(0, 4)) {
    for (let i = 0; i < 4; i += 1) addExamplePlayer(catName)
  }

  // Pair categories: 3 example pairs each. The two players are added to the Players sheet with no
  // category of their own - the Pair row is what carries the registration.
  type PairExample = {
    player1_name: string
    player2_name: string
    team_name: string
    club_name: string
    category_name: string
  }
  const examplePairs: PairExample[] = []
  for (const catName of pairCatNames.slice(0, 3)) {
    for (let i = 0; i < 3; i += 1) {
      const p1 = addExamplePlayer('')
      const p2 = addExamplePlayer('')
      examplePairs.push({
        player1_name: p1,
        player2_name: p2,
        team_name: '',
        club_name: contingent(i),
        category_name: catName,
      })
    }
  }

  // Team categories: 3 example squads each, tied to a contingent.
  type TeamExample = { name: string; club_name: string; contact_email: string; category_name: string }
  const exampleTeams: TeamExample[] = []
  for (const catName of teamCatNames.slice(0, 3)) {
    for (let i = 0; i < 3; i += 1) {
      exampleTeams.push({
        name: `${EX}${baseContingents[i % baseContingents.length]} ${catName}`,
        club_name: contingent(i),
        contact_email: '',
        category_name: catName,
      })
    }
  }

  // Guarantee at least a handful of Players rows even for an event with no individual/pair
  // categories yet, so the sheet's columns are still illustrated.
  if (examplePlayers.length === 0) {
    for (let i = 0; i < 6; i += 1) addExamplePlayer('')
  }
  if (exampleTeams.length === 0) {
    exampleTeams.push({ name: `${EX}delete this row`, club_name: '', contact_email: '', category_name: '' })
  }

  // --- Clubs ---
  const clubsSheet = workbook.addWorksheet('Clubs')
  setColumns(clubsSheet, [
    { header: 'name', width: 30 },
    { header: 'contact_person', width: 22 },
    { header: 'contact_email', width: 28 },
    { header: 'category_name', width: 28 },
  ])
  if (hasRealClubs) {
    clubsSheet.addRow({ name: `${EX}delete this row`, contact_person: '', contact_email: '', category_name: '' })
  } else {
    baseContingents.forEach((base, i) => {
      clubsSheet.addRow({
        name: `${EX}${base}`,
        contact_person: i === 0 ? 'Jane Doe' : '',
        contact_email: i === 0 ? 'jane.doe@example.com' : '',
        category_name: i === 0 ? (clubCatNames[0] ?? '') : '',
      })
    })
  }
  if (categoriesRef) applyList(clubsSheet, 'D', categoriesRef)

  // --- Teams ---
  const teamsSheet = workbook.addWorksheet('Teams')
  setColumns(teamsSheet, [
    { header: 'name', width: 34 },
    { header: 'club_name', width: 22 },
    { header: 'contact_email', width: 28 },
    { header: 'category_name', width: 28 },
  ])
  for (const team of exampleTeams) teamsSheet.addRow(team)
  if (clubsRef) applyList(teamsSheet, 'B', clubsRef)
  if (categoriesRef) applyList(teamsSheet, 'D', categoriesRef)

  // --- Players ---
  const playersSheet = workbook.addWorksheet('Players')
  setColumns(playersSheet, [
    { header: 'name', width: 26 },
    { header: 'club_name', width: 24 },
    { header: 'email', width: 28 },
    { header: 'phone', width: 18 },
    { header: 'gender', width: 18 },
    { header: 'identification_number', width: 22 },
    { header: 'photo', width: 34 },
    { header: 'category_name', width: 28 },
  ])
  for (const player of examplePlayers) playersSheet.addRow(player)
  if (clubsRef) applyList(playersSheet, 'B', clubsRef)
  applyList(playersSheet, 'E', `"${ENUMS.gender}"`, { strict: true })
  if (categoriesRef) applyList(playersSheet, 'H', categoriesRef)

  // --- Pairs ---
  const pairsSheet = workbook.addWorksheet('Pairs')
  setColumns(pairsSheet, [
    { header: 'player1_name', width: 26 },
    { header: 'player2_name', width: 24 },
    { header: 'team_name', width: 30 },
    { header: 'club_name', width: 22 },
    { header: 'category_name', width: 28 },
  ])
  if (examplePairs.length > 0) {
    for (const pair of examplePairs) pairsSheet.addRow(pair)
  } else {
    pairsSheet.addRow({
      player1_name: `${EX}delete this row`,
      player2_name: '',
      team_name: '',
      club_name: '',
      category_name: '',
    })
  }
  if (clubsRef) applyList(pairsSheet, 'D', clubsRef)
  if (categoriesRef) applyList(pairsSheet, 'E', categoriesRef)

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
