import { slugify } from '@/lib/slugify'

import type { MenuIoSpec, ResolvedRow, SheetSpec } from './types'

// Kept in sync with WORKSPACE_ROLES in src/app/(frontend)/workspaces/workspaceAuth.tsx - inlined
// here so this spec module (imported by the route handler) doesn't pull in the auth component file.
const ROLES = {
  draw: ['super_admin', 'event_admin', 'draw'],
  eventAdmin: ['super_admin', 'event_admin'],
} as const

// One spec per Event Admin list menu. Keep these declarative - anything genuinely custom goes in
// `toData`. `event_id` is added by the engine.

const s = (row: ResolvedRow, field: string) => String(row.values[field] ?? '').trim()
const n = (row: ResolvedRow, field: string) => {
  const v = row.values[field]
  return typeof v === 'number' ? v : undefined
}
const b = (row: ResolvedRow, field: string) => {
  const v = row.values[field]
  return typeof v === 'boolean' ? v : undefined
}
const rel = (row: ResolvedRow, field: string) => {
  const v = s(row, field)
  return v ? Number(v) : null
}

const idColumn = { header: 'id', field: 'id', kind: 'id' as const, note: 'do not edit - identifies an existing row' }

// --- Clubs -----------------------------------------------------------------
const clubsSheet: SheetSpec = {
  collection: 'clubs',
  sheetName: 'Clubs',
  upsertKeyFields: ['slug'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'slug', field: 'slug', kind: 'text', note: 'blank = generated from name' },
    { header: 'contact_person', field: 'contact_person', kind: 'text' },
    { header: 'contact_email', field: 'contact_email', kind: 'text' },
    { header: 'logo', field: 'logo', kind: 'text', note: 'image URL' },
    { header: 'description', field: 'description', kind: 'text' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    slug: slugify(s(row, 'slug') || s(row, 'name')),
    contact_person: s(row, 'contact_person') || undefined,
    contact_email: s(row, 'contact_email') || undefined,
    logo: s(row, 'logo') || undefined,
    description: s(row, 'description') || undefined,
  }),
}

// --- Sports ---------------------------------------------------------------
const SPORT_TYPES = ['court', 'field', 'table', 'board', 'esport', 'track', 'other'] as const
const sportsSheet: SheetSpec = {
  collection: 'sports',
  sheetName: 'Sports',
  upsertKeyFields: ['slug'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'slug', field: 'slug', kind: 'text', note: 'blank = generated from name' },
    { header: 'sport_type', field: 'sport_type', kind: 'enum', enumValues: SPORT_TYPES },
    { header: 'default_ruleset', field: 'default_ruleset_id', kind: 'relation', relation: { collection: 'rulesets', labelField: 'name' } },
    { header: 'icon', field: 'icon', kind: 'text' },
    { header: 'is_active', field: 'is_active', kind: 'boolean' },
    { header: 'description', field: 'description', kind: 'text' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    slug: slugify(s(row, 'slug') || s(row, 'name')),
    sport_type: s(row, 'sport_type') || 'court',
    default_ruleset_id: rel(row, 'default_ruleset_id'),
    icon: s(row, 'icon') || undefined,
    is_active: b(row, 'is_active') ?? true,
    description: s(row, 'description') || undefined,
  }),
}

// --- Rulesets -----------------------------------------------------------
const SCORE_TYPES = ['points', 'goals', 'sets', 'time', 'result', 'custom'] as const
const rulesetsSheet: SheetSpec = {
  collection: 'rulesets',
  sheetName: 'Rulesets',
  upsertKeyFields: ['slug'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'slug', field: 'slug', kind: 'text', note: 'blank = generated from name' },
    { header: 'sport', field: 'sport_id', kind: 'relation', required: true, relation: { collection: 'sports', labelField: 'name' } },
    { header: 'score_type', field: 'score_type', kind: 'enum', enumValues: SCORE_TYPES },
    { header: 'allow_draw', field: 'allow_draw', kind: 'boolean' },
    { header: 'points_win', field: 'points_win', kind: 'number' },
    { header: 'points_draw', field: 'points_draw', kind: 'number' },
    { header: 'points_loss', field: 'points_loss', kind: 'number' },
    { header: 'default_duration_minutes', field: 'default_duration_minutes', kind: 'number' },
    { header: 'min_rest_minutes', field: 'min_rest_minutes', kind: 'number' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    slug: slugify(s(row, 'slug') || s(row, 'name')),
    sport_id: rel(row, 'sport_id'),
    score_type: s(row, 'score_type') || undefined,
    allow_draw: b(row, 'allow_draw'),
    points_win: n(row, 'points_win'),
    points_draw: n(row, 'points_draw'),
    points_loss: n(row, 'points_loss'),
    default_duration_minutes: n(row, 'default_duration_minutes'),
    min_rest_minutes: n(row, 'min_rest_minutes'),
  }),
}

// --- Sponsors ---------------------------------------------------------
const SPONSOR_TIERS = ['title', 'gold', 'silver', 'bronze', 'partner'] as const
const sponsorsSheet: SheetSpec = {
  collection: 'sponsors',
  sheetName: 'Sponsors',
  upsertKeyFields: [], // no natural key - id column only; blank id = create
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'tier', field: 'tier', kind: 'enum', enumValues: SPONSOR_TIERS },
    { header: 'website_url', field: 'website_url', kind: 'text' },
    { header: 'display_order', field: 'display_order', kind: 'number' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    tier: s(row, 'tier') || 'partner',
    website_url: s(row, 'website_url') || undefined,
    display_order: n(row, 'display_order') ?? 0,
  }),
}

// --- Categories -----------------------------------------------------
const PARTICIPANT_MODES = ['individual', 'pair', 'team', 'club', 'open', 'tbd'] as const
const FORMAT_TYPES = [
  'single_elimination',
  'double_elimination',
  'round_robin',
  'group_stage_to_knockout',
  'league',
  'friendly',
  'time_trial',
  'score_ranking',
] as const
const CATEGORY_STATUS = ['draft', 'open', 'locked', 'published', 'archived'] as const
const THIRD_PLACE = ['none', 'match', 'shared'] as const
const categoriesSheet: SheetSpec = {
  collection: 'competition-categories',
  sheetName: 'Categories',
  upsertKeyFields: ['sport_id', 'slug'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'slug', field: 'slug', kind: 'text', note: 'blank = generated from name; unique per sport' },
    { header: 'sport', field: 'sport_id', kind: 'relation', required: true, relation: { collection: 'sports', labelField: 'name' } },
    { header: 'ruleset', field: 'ruleset_id', kind: 'relation', relation: { collection: 'rulesets', labelField: 'name' } },
    { header: 'participant_mode', field: 'participant_mode', kind: 'enum', enumValues: PARTICIPANT_MODES },
    { header: 'format_type', field: 'format_type', kind: 'enum', enumValues: FORMAT_TYPES },
    { header: 'status', field: 'status', kind: 'enum', enumValues: CATEGORY_STATUS },
    { header: 'roster_required', field: 'roster_required', kind: 'boolean' },
    { header: 'min_roster_size', field: 'min_roster_size', kind: 'number' },
    { header: 'max_roster_size', field: 'max_roster_size', kind: 'number' },
    { header: 'third_place_policy', field: 'third_place_policy', kind: 'enum', enumValues: THIRD_PLACE },
    { header: 'medal_eligible', field: 'medal_eligible', kind: 'boolean' },
    { header: 'medal_weight', field: 'medal_weight', kind: 'number' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    slug: slugify(s(row, 'slug') || s(row, 'name')),
    sport_id: rel(row, 'sport_id'),
    ruleset_id: rel(row, 'ruleset_id'),
    participant_mode: s(row, 'participant_mode') || 'open',
    format_type: s(row, 'format_type') || 'single_elimination',
    status: s(row, 'status') || 'draft',
    roster_required: b(row, 'roster_required') ?? false,
    min_roster_size: n(row, 'min_roster_size') ?? 0,
    max_roster_size: n(row, 'max_roster_size'),
    third_place_policy: s(row, 'third_place_policy') || 'none',
    medal_eligible: b(row, 'medal_eligible') ?? true,
    medal_weight: n(row, 'medal_weight') ?? 1,
  }),
  rowLabel: (row) => s(row, 'name'),
}

// --- Facilities (venues + courts) --------------------------------
const venuesSheet: SheetSpec = {
  collection: 'venues',
  sheetName: 'Venues',
  upsertKeyFields: ['name'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'address', field: 'address', kind: 'text' },
    { header: 'map_url', field: 'map_url', kind: 'text' },
    { header: 'is_virtual', field: 'is_virtual', kind: 'boolean' },
    { header: 'virtual_url', field: 'virtual_url', kind: 'text' },
    { header: 'description', field: 'description', kind: 'text' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    address: s(row, 'address') || undefined,
    map_url: s(row, 'map_url') || undefined,
    is_virtual: b(row, 'is_virtual') ?? false,
    virtual_url: s(row, 'virtual_url') || undefined,
    description: s(row, 'description') || undefined,
  }),
}
const courtsSheet: SheetSpec = {
  collection: 'courts',
  sheetName: 'Courts',
  upsertKeyFields: ['venue_id', 'name'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'venue', field: 'venue_id', kind: 'relation', required: true, relation: { collection: 'venues', labelField: 'name' } },
    { header: 'sport', field: 'sport_id', kind: 'relation', relation: { collection: 'sports', labelField: 'name' } },
    { header: 'capacity', field: 'capacity', kind: 'number' },
    { header: 'is_active', field: 'is_active', kind: 'boolean' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    venue_id: rel(row, 'venue_id'),
    sport_id: rel(row, 'sport_id'),
    capacity: n(row, 'capacity'),
    is_active: b(row, 'is_active') ?? true,
  }),
}

// --- Entries ------------------------------------------------------
const ENTRY_TYPES = ['individual', 'pair', 'team', 'club', 'open', 'tbd'] as const
const ENTRY_STATUS = ['pending', 'confirmed', 'waitlisted', 'withdrawn', 'disqualified'] as const
const entriesSheet: SheetSpec = {
  collection: 'competition-entries',
  sheetName: 'Entries',
  upsertKeyFields: [], // id column only
  columns: [
    idColumn,
    { header: 'display_name', field: 'display_name', kind: 'text', required: true },
    { header: 'category', field: 'category_id', kind: 'relation', required: true, relation: { collection: 'competition-categories', labelField: 'name' } },
    { header: 'entry_type', field: 'entry_type', kind: 'enum', enumValues: ENTRY_TYPES },
    { header: 'player', field: 'player_id', kind: 'relation', relation: { collection: 'players', labelField: 'name' } },
    { header: 'team', field: 'team_id', kind: 'relation', relation: { collection: 'teams', labelField: 'name' } },
    { header: 'club', field: 'club_id', kind: 'relation', relation: { collection: 'clubs', labelField: 'name' } },
    { header: 'seed_number', field: 'seed_number', kind: 'number' },
    { header: 'status', field: 'status', kind: 'enum', enumValues: ENTRY_STATUS },
  ],
  toData: (row) => {
    const type = s(row, 'entry_type') || 'individual'
    return {
      display_name: s(row, 'display_name'),
      category_id: rel(row, 'category_id'),
      entry_type: type,
      player_id: type === 'individual' ? rel(row, 'player_id') : null,
      team_id: type === 'team' ? rel(row, 'team_id') : null,
      club_id: type === 'club' ? rel(row, 'club_id') : null,
      seed_number: n(row, 'seed_number'),
      status: s(row, 'status') || 'pending',
    }
  },
  rowLabel: (row) => s(row, 'display_name'),
}

// --- Participants (players + teams + rosters) --------------------
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const
const playersSheet: SheetSpec = {
  collection: 'players',
  sheetName: 'Players',
  // identification_number is the stable key; a row without one always creates (names aren't unique
  // enough to match on safely).
  upsertKeyFields: ['identification_number'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'identification_number', field: 'identification_number', kind: 'text', note: 'stable key - blank rows always create' },
    { header: 'club', field: 'club_id', kind: 'relation', relation: { collection: 'clubs', labelField: 'name' } },
    { header: 'email', field: 'email', kind: 'text' },
    { header: 'phone', field: 'phone', kind: 'text' },
    { header: 'gender', field: 'gender', kind: 'enum', enumValues: GENDERS },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    identification_number: s(row, 'identification_number') || undefined,
    club_id: rel(row, 'club_id'),
    email: s(row, 'email') || undefined,
    phone: s(row, 'phone') || undefined,
    gender: s(row, 'gender') || undefined,
  }),
  rowLabel: (row) => s(row, 'name'),
}
const teamsSheet: SheetSpec = {
  collection: 'teams',
  sheetName: 'Teams',
  upsertKeyFields: ['slug'],
  columns: [
    idColumn,
    { header: 'name', field: 'name', kind: 'text', required: true },
    { header: 'slug', field: 'slug', kind: 'text', note: 'blank = generated from name' },
    { header: 'club', field: 'club_id', kind: 'relation', relation: { collection: 'clubs', labelField: 'name' } },
    { header: 'captain', field: 'captain_player_id', kind: 'relation', relation: { collection: 'players', labelField: 'name' } },
    { header: 'contact_email', field: 'contact_email', kind: 'text' },
    { header: 'description', field: 'description', kind: 'text' },
  ],
  toData: (row) => ({
    name: s(row, 'name'),
    slug: slugify(s(row, 'slug') || s(row, 'name')),
    club_id: rel(row, 'club_id'),
    captain_player_id: rel(row, 'captain_player_id'),
    contact_email: s(row, 'contact_email') || undefined,
    description: s(row, 'description') || undefined,
  }),
  rowLabel: (row) => s(row, 'name'),
}
const ROSTER_ROLES = ['player', 'captain', 'coach', 'manager', 'substitute'] as const
const ROSTER_STATUS = ['active', 'pending', 'inactive', 'withdrawn'] as const
const rostersSheet: SheetSpec = {
  collection: 'rosters',
  sheetName: 'Rosters',
  // matched on the (team, player, category) triple; a row with no category always creates.
  upsertKeyFields: ['team_id', 'player_id', 'category_id'],
  columns: [
    idColumn,
    { header: 'team', field: 'team_id', kind: 'relation', required: true, relation: { collection: 'teams', labelField: 'name' } },
    { header: 'player', field: 'player_id', kind: 'relation', required: true, relation: { collection: 'players', labelField: 'name' } },
    { header: 'category', field: 'category_id', kind: 'relation', relation: { collection: 'competition-categories', labelField: 'name' } },
    { header: 'role', field: 'role', kind: 'enum', enumValues: ROSTER_ROLES },
    { header: 'status', field: 'status', kind: 'enum', enumValues: ROSTER_STATUS },
  ],
  toData: (row) => ({
    team_id: rel(row, 'team_id'),
    player_id: rel(row, 'player_id'),
    category_id: rel(row, 'category_id'),
    role: s(row, 'role') || 'player',
    status: s(row, 'status') || 'active',
  }),
  rowLabel: (row) => `${row.rawLabels.player_id || '?'} → ${row.rawLabels.team_id || '?'}`,
}

// --- Menu registry ---------------------------------------------------------
export const MENU_IO_SPECS: Record<string, MenuIoSpec> = {
  clubs: { menu: 'clubs', fileStem: 'clubs', allowedRoles: ROLES.draw, sheets: [clubsSheet] },
  sports: { menu: 'sports', fileStem: 'sports', allowedRoles: ROLES.eventAdmin, sheets: [sportsSheet] },
  rulesets: { menu: 'rulesets', fileStem: 'rulesets', allowedRoles: ROLES.eventAdmin, sheets: [rulesetsSheet] },
  sponsors: { menu: 'sponsors', fileStem: 'sponsors', allowedRoles: ROLES.eventAdmin, sheets: [sponsorsSheet] },
  categories: { menu: 'categories', fileStem: 'categories', allowedRoles: ROLES.eventAdmin, sheets: [categoriesSheet] },
  facilities: { menu: 'facilities', fileStem: 'facilities', allowedRoles: ROLES.eventAdmin, sheets: [venuesSheet, courtsSheet] },
  entries: { menu: 'entries', fileStem: 'entries', allowedRoles: ROLES.draw, sheets: [entriesSheet] },
  // Sheet order is the apply order: players must exist before teams reference a captain, teams
  // before rosters.
  participants: {
    menu: 'participants',
    fileStem: 'participants',
    allowedRoles: ROLES.draw,
    sheets: [playersSheet, teamsSheet, rostersSheet],
  },
}
