// MSG-07: a curated catalog of common sports and their standard events/rules, so adding a
// standard multi-sport event's structure is "pick sport, tick events" instead of ~26 manual forms
// per sport (Sport + Ruleset + one Category per event). Deliberately a static, hand-curated
// constant, not a collection - this is product knowledge, not user data, so it doesn't need
// seeding/migration/versioning. Users can still create sports/categories entirely outside the
// catalog; anything they add lands in the same `sports`/`competition-categories` collections as
// catalog-sourced ones.
//
// The catalog's domain accuracy (which events are "standard", what durations are realistic) is
// the actual risk here, not the code - review this list with someone who runs these events before
// relying on it for a real one.

export type CatalogParticipantMode = 'individual' | 'pair' | 'team' | 'club'

// Mirrors Rulesets.tie_breakers' select options exactly (src/collections/Rulesets.ts) - kept as
// its own type so a typo here fails typecheck instead of silently reaching payload.create.
export type CatalogTieBreaker =
  | 'points'
  | 'head_to_head'
  | 'score_difference'
  | 'score_for'
  | 'set_difference'
  | 'set_for'
  | 'fewest_penalties'
  | 'manual_decision'

export type CatalogEvent = {
  name: string
  participantMode: CatalogParticipantMode
  rosterRequired?: boolean
  minRosterSize?: number
  maxRosterSize?: number
}

export type CatalogRuleset = {
  name: string
  // Hand-written, not generated from the fields below - a sentence that reads naturally isn't
  // always something you can reliably compose from raw field values, and this is exactly the text
  // shown to users at "layer 2" (see formatRulesetSummary in rulesetSummary.ts, which prefers this
  // over generating one when a catalog sport is the source).
  summary: string
  scoreType: 'points' | 'goals' | 'sets' | 'time' | 'result' | 'custom'
  setBased: boolean
  bestOf?: number
  targetScore?: number
  maxScore?: number
  deuceEnabled?: boolean
  allowDraw?: boolean
  periodCount?: number
  periodDuration?: number
  defaultDurationMinutes: number
  minRestMinutes: number
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  tieBreakers: CatalogTieBreaker[]
}

export type CatalogSport = {
  key: string
  name: string
  sportType: 'court' | 'field' | 'table' | 'board' | 'esport' | 'track' | 'other'
  // A single emoji, rendered directly - lucide-react has no sport-specific icon set, and an emoji
  // matches the catalog picker mockup (MULTI_SPORT_GAMES_ENHANCEMENTS_DESIGN.md MSG-07) without
  // needing an icon library dependency.
  icon: string
  events: CatalogEvent[]
  ruleset: CatalogRuleset
}

export const SPORT_CATALOG: CatalogSport[] = [
  {
    key: 'badminton',
    name: 'Badminton',
    sportType: 'court',
    icon: '🏸',
    events: [
      { name: "Men's Singles", participantMode: 'individual' },
      { name: "Women's Singles", participantMode: 'individual' },
      { name: "Men's Doubles", participantMode: 'pair' },
      { name: "Women's Doubles", participantMode: 'pair' },
      { name: 'Mixed Doubles', participantMode: 'pair' },
    ],
    ruleset: {
      name: 'Badminton Standard',
      summary: '3 sets · 21 points · deuce · ~40 min per match',
      scoreType: 'sets',
      setBased: true,
      bestOf: 3,
      targetScore: 21,
      maxScore: 30,
      deuceEnabled: true,
      defaultDurationMinutes: 40,
      minRestMinutes: 30,
      pointsWin: 3,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['head_to_head', 'score_difference', 'points'],
    },
  },
  {
    key: 'table_tennis',
    name: 'Table Tennis',
    sportType: 'table',
    icon: '🏓',
    events: [
      { name: "Men's Singles", participantMode: 'individual' },
      { name: "Women's Singles", participantMode: 'individual' },
      { name: "Men's Doubles", participantMode: 'pair' },
      { name: "Women's Doubles", participantMode: 'pair' },
    ],
    ruleset: {
      name: 'Table Tennis Standard',
      summary: '3 sets · 11 points · deuce · ~30 min per match',
      scoreType: 'sets',
      setBased: true,
      bestOf: 3,
      targetScore: 11,
      deuceEnabled: true,
      defaultDurationMinutes: 30,
      minRestMinutes: 20,
      pointsWin: 3,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['head_to_head', 'score_difference', 'points'],
    },
  },
  {
    key: 'tennis',
    name: 'Tennis',
    sportType: 'court',
    icon: '🎾',
    events: [
      { name: "Men's Singles", participantMode: 'individual' },
      { name: "Women's Singles", participantMode: 'individual' },
      { name: "Men's Doubles", participantMode: 'pair' },
      { name: "Women's Doubles", participantMode: 'pair' },
      { name: 'Mixed Doubles', participantMode: 'pair' },
    ],
    ruleset: {
      name: 'Tennis Standard',
      summary: '3 sets · ~60 min per match',
      scoreType: 'sets',
      setBased: true,
      bestOf: 3,
      defaultDurationMinutes: 60,
      minRestMinutes: 30,
      pointsWin: 3,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['head_to_head', 'score_difference'],
    },
  },
  {
    key: 'volleyball',
    name: 'Volleyball',
    sportType: 'court',
    icon: '🏐',
    events: [
      { name: "Men's Team", participantMode: 'team', rosterRequired: true, minRosterSize: 6, maxRosterSize: 14 },
      { name: "Women's Team", participantMode: 'team', rosterRequired: true, minRosterSize: 6, maxRosterSize: 14 },
    ],
    ruleset: {
      name: 'Volleyball Standard',
      summary: '3 sets · 25 points · deuce · ~75 min per match',
      scoreType: 'sets',
      setBased: true,
      bestOf: 3,
      targetScore: 25,
      deuceEnabled: true,
      defaultDurationMinutes: 75,
      minRestMinutes: 45,
      pointsWin: 3,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['head_to_head', 'set_difference', 'score_difference'],
    },
  },
  {
    key: 'futsal',
    name: 'Futsal',
    sportType: 'field',
    icon: '⚽',
    events: [
      { name: "Men's Team", participantMode: 'team', rosterRequired: true, minRosterSize: 5, maxRosterSize: 14 },
      { name: "Women's Team", participantMode: 'team', rosterRequired: true, minRosterSize: 5, maxRosterSize: 14 },
    ],
    ruleset: {
      name: 'Futsal Standard',
      summary: 'Goals · draw allowed · 2×20 min · roster 5-14',
      scoreType: 'goals',
      setBased: false,
      allowDraw: true,
      periodCount: 2,
      periodDuration: 20,
      defaultDurationMinutes: 50,
      minRestMinutes: 45,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tieBreakers: ['points', 'head_to_head', 'score_difference', 'score_for'],
    },
  },
  {
    key: 'football',
    name: 'Football (Soccer)',
    sportType: 'field',
    icon: '⚽',
    events: [
      { name: "Men's Team", participantMode: 'team', rosterRequired: true, minRosterSize: 11, maxRosterSize: 23 },
      { name: "Women's Team", participantMode: 'team', rosterRequired: true, minRosterSize: 11, maxRosterSize: 23 },
    ],
    ruleset: {
      name: 'Football Standard',
      summary: 'Goals · draw allowed · 2×45 min · roster 11-23',
      scoreType: 'goals',
      setBased: false,
      allowDraw: true,
      periodCount: 2,
      periodDuration: 45,
      defaultDurationMinutes: 105,
      minRestMinutes: 60,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tieBreakers: ['points', 'head_to_head', 'score_difference', 'score_for'],
    },
  },
  {
    key: 'basketball',
    name: 'Basketball',
    sportType: 'field',
    icon: '🏀',
    events: [
      { name: "Men's 5x5", participantMode: 'team', rosterRequired: true, minRosterSize: 5, maxRosterSize: 12 },
      { name: "Women's 5x5", participantMode: 'team', rosterRequired: true, minRosterSize: 5, maxRosterSize: 12 },
      { name: "Men's 3x3", participantMode: 'team', rosterRequired: true, minRosterSize: 3, maxRosterSize: 5 },
      { name: "Women's 3x3", participantMode: 'team', rosterRequired: true, minRosterSize: 3, maxRosterSize: 5 },
    ],
    ruleset: {
      name: 'Basketball Standard',
      summary: 'Points · 4×10 min · roster 5-12',
      scoreType: 'points',
      setBased: false,
      allowDraw: false,
      periodCount: 4,
      periodDuration: 10,
      defaultDurationMinutes: 60,
      minRestMinutes: 45,
      pointsWin: 2,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['points', 'head_to_head', 'score_difference'],
    },
  },
  {
    key: 'petanque',
    name: 'Petanque',
    sportType: 'other',
    icon: '🎯',
    events: [
      { name: 'Single', participantMode: 'individual' },
      { name: 'Double', participantMode: 'pair' },
      { name: 'Triple', participantMode: 'team', rosterRequired: true, minRosterSize: 3, maxRosterSize: 4 },
    ],
    ruleset: {
      name: 'Petanque Standard',
      summary: '13 points · ~60 min per match',
      scoreType: 'points',
      setBased: false,
      targetScore: 13,
      defaultDurationMinutes: 60,
      minRestMinutes: 30,
      pointsWin: 3,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['points', 'head_to_head'],
    },
  },
  {
    key: 'chess',
    name: 'Chess',
    sportType: 'board',
    icon: '♟️',
    events: [
      { name: "Men's Individual", participantMode: 'individual' },
      { name: "Women's Individual", participantMode: 'individual' },
      { name: 'Team', participantMode: 'team', rosterRequired: true, minRosterSize: 4, maxRosterSize: 6 },
    ],
    ruleset: {
      name: 'Chess Standard',
      summary: 'Win/draw/loss result · ~60 min per match',
      scoreType: 'result',
      setBased: false,
      allowDraw: true,
      defaultDurationMinutes: 60,
      minRestMinutes: 30,
      pointsWin: 1,
      pointsDraw: 0.5,
      pointsLoss: 0,
      tieBreakers: ['points', 'head_to_head'],
    },
  },
  {
    key: 'athletics',
    name: 'Athletics',
    sportType: 'track',
    icon: '🏃',
    events: [
      { name: "Men's 100m", participantMode: 'individual' },
      { name: "Women's 100m", participantMode: 'individual' },
      { name: "Men's 400m", participantMode: 'individual' },
      { name: "Women's 400m", participantMode: 'individual' },
      { name: '4x100m Relay', participantMode: 'team', rosterRequired: true, minRosterSize: 4, maxRosterSize: 6 },
    ],
    ruleset: {
      name: 'Athletics Time Trial',
      summary: 'Fastest time wins · time trial format',
      scoreType: 'time',
      setBased: false,
      defaultDurationMinutes: 15,
      minRestMinutes: 30,
      pointsWin: 0,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: [],
    },
  },
  {
    key: 'swimming',
    name: 'Swimming',
    sportType: 'track',
    icon: '🏊',
    events: [
      { name: "Men's Freestyle", participantMode: 'individual' },
      { name: "Women's Freestyle", participantMode: 'individual' },
      { name: "Men's Breaststroke", participantMode: 'individual' },
      { name: "Women's Breaststroke", participantMode: 'individual' },
      { name: "Men's Backstroke", participantMode: 'individual' },
      { name: "Women's Backstroke", participantMode: 'individual' },
    ],
    ruleset: {
      name: 'Swimming Time Trial',
      summary: 'Fastest time wins · time trial format',
      scoreType: 'time',
      setBased: false,
      defaultDurationMinutes: 15,
      minRestMinutes: 30,
      pointsWin: 0,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: [],
    },
  },
  {
    key: 'esports',
    name: 'eSports',
    sportType: 'esport',
    icon: '🎮',
    events: [
      { name: 'Mobile Legends', participantMode: 'team', rosterRequired: true, minRosterSize: 5, maxRosterSize: 7 },
      { name: 'PUBG Mobile', participantMode: 'team', rosterRequired: true, minRosterSize: 4, maxRosterSize: 6 },
      { name: 'Free Fire', participantMode: 'team', rosterRequired: true, minRosterSize: 4, maxRosterSize: 6 },
    ],
    ruleset: {
      name: 'eSports Standard',
      summary: 'Best of 3 · ~45 min per match · roster 4-7',
      scoreType: 'points',
      setBased: true,
      bestOf: 3,
      defaultDurationMinutes: 45,
      minRestMinutes: 15,
      pointsWin: 3,
      pointsDraw: 0,
      pointsLoss: 0,
      tieBreakers: ['points', 'head_to_head'],
    },
  },
]

export const getCatalogSport = (key: string): CatalogSport | undefined =>
  SPORT_CATALOG.find((sport) => sport.key === key)

export const searchCatalog = (query: string): CatalogSport[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return SPORT_CATALOG
  return SPORT_CATALOG.filter((sport) => sport.name.toLowerCase().includes(normalized))
}
