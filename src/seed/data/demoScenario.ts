// Demo seed data for `ROC Olympic 2026`. Kept declarative and duplicate-safe (see src/seed/index.ts)
// so it can run repeatedly against the same database without creating duplicates.
//
// Scope note: this file intentionally covers a wide spread of match lifecycle states, standing
// scenarios, and bracket progress so every redesigned public page (and the underlying workspaces)
// has real data to render against - not just the "happy path". See prd/decision-log.md D024 for the
// rationale and prd/session-handoff.md for a full list of what each scenario demonstrates.

export type DemoMatchSeed = {
  match_number: string
  round_name: string
  sportSlug: string
  categorySlug: string
  stageCategorySlug: string
  groupName?: string
  participantA?: string
  participantB?: string
  scheduled_start_at?: string
  scheduled_end_at?: string
  venueName?: string
  courtName?: string
  status: string
  winner?: string
  score_summary?: string
  is_public: boolean
  documentation_status: string
  // false marks a placeholder match (TBD participants, or a result meant to arrive later) whose
  // real status/winner/score is owned by matchGenerationOverrides or singleEliminationResults
  // processing instead - the create-if-missing step must not re-sync/clobber it on later seed runs.
  finalStateDeclared?: boolean
}

export type DemoMatchSetSeed = {
  matchNumber: string
  set_number: number
  participant_a_score: number
  participant_b_score: number
  notes?: string
}

// Applied to already-created matches (hand-declared or generated) that need no winner-advancement -
// just a status/score/visibility upgrade from their initial placeholder state.
export type DemoMatchOverrideSeed = {
  matchNumber: string
  status: string
  winner?: string
  score_summary?: string
  is_public?: boolean
  documentation_status?: string
  scheduled_start_at?: string
  scheduled_end_at?: string
  venueName?: string
  courtName?: string
  sets?: DemoMatchSetSeed[]
}

// Applied in order, calling the real winner-advancement helper after each result so bracket
// progress (TBD -> filled -> champion) happens the same way it would in production. See
// src/seed/index.ts for the processing loop.
export type DemoSingleEliminationResultSeed = {
  matchNumber: string
  winner: string
  score_summary: string
  sets: DemoMatchSetSeed[]
  scheduled_start_at?: string
  scheduled_end_at?: string
  venueName?: string
  courtName?: string
  is_public: boolean
  documentation_status: string
}

export type DemoEntrySeed = {
  display_name: string
  categorySlug: string
  entry_type: string
  playerEmployeeId?: string
  teamSlug?: string
  clubSlug?: string
  seed_number?: number
  status: string
}

export const demoScenario = {
  event: {
    name: 'ROC Olympic 2026',
    slug: 'roc-olympic-2026',
    description:
      'Internal office olympiad demo event for validating core event structure, participants, venues, and courts.',
    event_start_at: '2026-08-17T08:00:00.000Z',
    event_end_at: '2026-08-21T17:00:00.000Z',
    public_open_at: '2026-08-10T08:00:00.000Z',
    registration_open_at: '2026-07-06T08:00:00.000Z',
    registration_close_at: '2026-07-31T17:00:00.000Z',
    status: 'setup',
    visibility: 'coming_soon',
    location: 'ROC Office Campus',
    organizer_name: 'ROC Sports Committee',
    rules_summary:
      'Demo setup for Badminton, Futsal, Table Tennis, Chess, and Running. Final sport rules will be refined in the ruleset phase.',
    theme_config: {
      primaryColor: '#116466',
      accentColor: '#f2a541',
    },
  },
  sports: [
    {
      name: 'Badminton',
      slug: 'roc-olympic-2026-badminton',
      description: 'Singles and doubles badminton categories.',
      icon: 'racket',
      sport_type: 'court',
      defaultRulesetSlug: 'roc-olympic-2026-badminton-basic',
    },
    {
      name: 'Futsal',
      slug: 'roc-olympic-2026-futsal',
      description: 'Team-based indoor football competition.',
      icon: 'football',
      sport_type: 'field',
      defaultRulesetSlug: 'roc-olympic-2026-futsal-basic',
    },
    {
      name: 'Table Tennis',
      slug: 'roc-olympic-2026-table-tennis',
      description: 'Fast-paced table tennis knockout.',
      icon: 'table-tennis',
      sport_type: 'table',
      defaultRulesetSlug: 'roc-olympic-2026-table-tennis-basic',
    },
    {
      name: 'Chess',
      slug: 'roc-olympic-2026-chess',
      description: 'Round robin chess for the office thinkers.',
      icon: 'chess',
      sport_type: 'board',
      defaultRulesetSlug: 'roc-olympic-2026-chess-basic',
    },
    {
      name: 'Running',
      slug: 'roc-olympic-2026-running',
      description: '100m sprint heats.',
      icon: 'running',
      sport_type: 'track',
      defaultRulesetSlug: 'roc-olympic-2026-running-basic',
    },
  ],
  rulesets: [
    {
      name: 'Badminton Basic',
      slug: 'roc-olympic-2026-badminton-basic',
      sportSlug: 'roc-olympic-2026-badminton',
      description: 'Best of 3 sets to 21 points with deuce enabled.',
      score_type: 'sets',
      allow_draw: false,
      set_based: true,
      timer_enabled: false,
      points_win: 1,
      points_draw: 0,
      points_loss: 0,
      best_of: 3,
      target_score: 21,
      max_score: 30,
      deuce_enabled: true,
      overtime_enabled: false,
      penalty_enabled: false,
      tie_breakers: ['set_difference', 'set_for', 'score_difference', 'score_for'],
    },
    {
      name: 'Futsal Basic',
      slug: 'roc-olympic-2026-futsal-basic',
      sportSlug: 'roc-olympic-2026-futsal',
      description: 'Two-period futsal match with group-stage draws allowed.',
      score_type: 'goals',
      allow_draw: true,
      set_based: false,
      timer_enabled: true,
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      period_count: 2,
      period_duration: 20,
      overtime_enabled: true,
      penalty_enabled: true,
      tie_breakers: ['points', 'score_difference', 'score_for', 'head_to_head'],
    },
    {
      name: 'Table Tennis Basic',
      slug: 'roc-olympic-2026-table-tennis-basic',
      sportSlug: 'roc-olympic-2026-table-tennis',
      description: 'Best of 3 games to 11 points, win by 2.',
      score_type: 'sets',
      allow_draw: false,
      set_based: true,
      timer_enabled: false,
      points_win: 1,
      points_draw: 0,
      points_loss: 0,
      best_of: 3,
      target_score: 11,
      max_score: 21,
      deuce_enabled: true,
      overtime_enabled: false,
      penalty_enabled: false,
      tie_breakers: ['set_difference', 'set_for', 'score_difference', 'score_for'],
    },
    {
      name: 'Chess Basic',
      slug: 'roc-olympic-2026-chess-basic',
      sportSlug: 'roc-olympic-2026-chess',
      description: 'Round robin, win 1 / draw 0.5 / loss 0.',
      score_type: 'result',
      allow_draw: true,
      set_based: false,
      timer_enabled: false,
      points_win: 1,
      points_draw: 0.5,
      points_loss: 0,
      overtime_enabled: false,
      penalty_enabled: false,
      tie_breakers: ['points', 'head_to_head'],
    },
    {
      name: 'Running Basic',
      slug: 'roc-olympic-2026-running-basic',
      sportSlug: 'roc-olympic-2026-running',
      description: '100m sprint heats, fastest time wins.',
      score_type: 'time',
      allow_draw: false,
      set_based: false,
      timer_enabled: true,
      points_win: 1,
      points_draw: 0,
      points_loss: 0,
      overtime_enabled: false,
      penalty_enabled: false,
      tie_breakers: [],
    },
  ],
  categories: [
    {
      name: 'Badminton Men Single',
      slug: 'roc-olympic-2026-badminton-men-single',
      sportSlug: 'roc-olympic-2026-badminton',
      participant_mode: 'individual',
      roster_required: false,
      min_roster_size: 1,
      max_roster_size: 1,
      rulesetSlug: 'roc-olympic-2026-badminton-basic',
      format_type: 'single_elimination',
      status: 'open',
    },
    {
      name: 'Badminton Mixed Double',
      slug: 'roc-olympic-2026-badminton-mixed-double',
      sportSlug: 'roc-olympic-2026-badminton',
      participant_mode: 'pair',
      roster_required: false,
      min_roster_size: 2,
      max_roster_size: 2,
      rulesetSlug: 'roc-olympic-2026-badminton-basic',
      format_type: 'group_stage_to_knockout',
      status: 'open',
    },
    {
      name: 'Futsal Men',
      slug: 'roc-olympic-2026-futsal-men',
      sportSlug: 'roc-olympic-2026-futsal',
      participant_mode: 'team',
      roster_required: false,
      min_roster_size: 5,
      max_roster_size: 12,
      rulesetSlug: 'roc-olympic-2026-futsal-basic',
      format_type: 'group_stage_to_knockout',
      status: 'open',
    },
    {
      name: 'Table Tennis Open Single',
      slug: 'roc-olympic-2026-table-tennis-open',
      sportSlug: 'roc-olympic-2026-table-tennis',
      participant_mode: 'individual',
      roster_required: false,
      min_roster_size: 1,
      max_roster_size: 1,
      rulesetSlug: 'roc-olympic-2026-table-tennis-basic',
      format_type: 'single_elimination',
      status: 'open',
    },
    {
      name: 'Chess Open',
      slug: 'roc-olympic-2026-chess-open',
      sportSlug: 'roc-olympic-2026-chess',
      participant_mode: 'individual',
      roster_required: false,
      min_roster_size: 1,
      max_roster_size: 1,
      rulesetSlug: 'roc-olympic-2026-chess-basic',
      format_type: 'round_robin',
      status: 'open',
    },
    {
      name: 'Running 100m',
      slug: 'roc-olympic-2026-running-100m',
      sportSlug: 'roc-olympic-2026-running',
      participant_mode: 'individual',
      roster_required: false,
      min_roster_size: 1,
      max_roster_size: 1,
      rulesetSlug: 'roc-olympic-2026-running-basic',
      format_type: 'time_trial',
      status: 'open',
    },
  ],
  clubs: [
    {
      name: 'IT Club',
      slug: 'roc-olympic-2026-it-club',
      description: 'Information technology department club.',
      contact_person: 'Dani',
      contact_email: 'it.club@roc-gms.local',
    },
    {
      name: 'Finance',
      slug: 'roc-olympic-2026-finance',
      description: 'Finance department team.',
      contact_person: 'Rina',
      contact_email: 'finance@roc-gms.local',
    },
    {
      name: 'HR',
      slug: 'roc-olympic-2026-hr',
      description: 'Human resources department team.',
      contact_person: 'Maya',
      contact_email: 'hr@roc-gms.local',
    },
    {
      name: 'Marketing',
      slug: 'roc-olympic-2026-marketing',
      description: 'Marketing department team.',
      contact_person: 'Bimo',
      contact_email: 'marketing@roc-gms.local',
    },
    {
      name: 'Operations',
      slug: 'roc-olympic-2026-operations',
      description: 'Operations department team.',
      contact_person: 'Sinta',
      contact_email: 'operations@roc-gms.local',
    },
    {
      name: 'Legal',
      slug: 'roc-olympic-2026-legal',
      description: 'Legal department team.',
      contact_person: 'Wahyu',
      contact_email: 'legal@roc-gms.local',
    },
  ],
  players: [
    { name: 'Andi Pratama', employee_id: 'ROC-2026-001', email: 'andi.pratama@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-it-club' },
    { name: 'Budi Santoso', employee_id: 'ROC-2026-002', email: 'budi.santoso@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-finance' },
    { name: 'Citra Lestari', employee_id: 'ROC-2026-003', email: 'citra.lestari@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-hr' },
    { name: 'Dewi Anggraini', employee_id: 'ROC-2026-004', email: 'dewi.anggraini@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-marketing' },
    { name: 'Eko Wijaya', employee_id: 'ROC-2026-005', email: 'eko.wijaya@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-it-club' },
    { name: 'Fajar Nugroho', employee_id: 'ROC-2026-006', email: 'fajar.nugroho@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-finance' },
    { name: 'Gilang Ramadhan', employee_id: 'ROC-2026-007', email: 'gilang.ramadhan@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-operations' },
    { name: 'Hendra Setiawan', employee_id: 'ROC-2026-008', email: 'hendra.setiawan@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-legal' },
    { name: 'Irfan Hidayat', employee_id: 'ROC-2026-009', email: 'irfan.hidayat@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-hr' },
    { name: 'Joko Prasetyo', employee_id: 'ROC-2026-010', email: 'joko.prasetyo@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-marketing' },
    { name: 'Kirana Dewanti', employee_id: 'ROC-2026-011', email: 'kirana.dewanti@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-operations' },
    { name: 'Made Wirawan', employee_id: 'ROC-2026-012', email: 'made.wirawan@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-hr' },
    { name: 'Nadia Putri', employee_id: 'ROC-2026-013', email: 'nadia.putri@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-hr' },
    { name: 'Kartika Sari', employee_id: 'ROC-2026-014', email: 'kartika.sari@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-operations' },
    { name: 'Lukman Hakim', employee_id: 'ROC-2026-015', email: 'lukman.hakim@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-legal' },
    { name: 'Oscar Pratomo', employee_id: 'ROC-2026-016', email: 'oscar.pratomo@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-finance' },
    { name: 'Putri Ayu', employee_id: 'ROC-2026-017', email: 'putri.ayu@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-it-club' },
    { name: 'Rian Saputra', employee_id: 'ROC-2026-018', email: 'rian.saputra@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-operations' },
    { name: 'Sari Wulandari', employee_id: 'ROC-2026-019', email: 'sari.wulandari@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-legal' },
    { name: 'Tono Setiawan', employee_id: 'ROC-2026-020', email: 'tono.setiawan@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-hr' },
    { name: 'Umi Kalsum', employee_id: 'ROC-2026-021', email: 'umi.kalsum@roc-gms.local', gender: 'female', clubSlug: 'roc-olympic-2026-marketing' },
    { name: 'Vino Anggara', employee_id: 'ROC-2026-022', email: 'vino.anggara@roc-gms.local', gender: 'male', clubSlug: 'roc-olympic-2026-legal' },
  ],
  teams: [
    { name: 'IT Smash Pair', slug: 'roc-olympic-2026-it-smash-pair', clubSlug: 'roc-olympic-2026-it-club', captainEmployeeId: 'ROC-2026-001', contact_email: 'it.club@roc-gms.local' },
    { name: 'Marketing Mix Pair', slug: 'roc-olympic-2026-marketing-mix-pair', clubSlug: 'roc-olympic-2026-marketing', captainEmployeeId: 'ROC-2026-004', contact_email: 'marketing@roc-gms.local' },
    { name: 'HR Rally Pair', slug: 'roc-olympic-2026-hr-rally-pair', clubSlug: 'roc-olympic-2026-hr', captainEmployeeId: 'ROC-2026-012', contact_email: 'hr@roc-gms.local' },
    { name: 'IT Futsal Squad', slug: 'roc-olympic-2026-it-futsal-squad', clubSlug: 'roc-olympic-2026-it-club', captainEmployeeId: 'ROC-2026-005', contact_email: 'it.club@roc-gms.local' },
    { name: 'Finance Futsal Squad', slug: 'roc-olympic-2026-finance-futsal-squad', clubSlug: 'roc-olympic-2026-finance', captainEmployeeId: 'ROC-2026-006', contact_email: 'finance@roc-gms.local' },
    { name: 'Marketing Futsal Squad', slug: 'roc-olympic-2026-marketing-futsal-squad', clubSlug: 'roc-olympic-2026-marketing', captainEmployeeId: 'ROC-2026-010', contact_email: 'marketing@roc-gms.local' },
    { name: 'Legal Futsal Crew', slug: 'roc-olympic-2026-legal-futsal-crew', clubSlug: 'roc-olympic-2026-legal', captainEmployeeId: 'ROC-2026-022', contact_email: 'legal@roc-gms.local' },
  ],
  venues: [
    { name: 'Main Hall', address: 'ROC Office Campus, Main Building', description: 'Indoor hall for badminton matches.', is_virtual: false },
    { name: 'Futsal Field', address: 'ROC Office Campus, Sports Area', description: 'Outdoor futsal field.', is_virtual: false },
    { name: 'Meeting Room A', address: 'ROC Office Campus, Annex Building', description: 'Table tennis and chess venue.', is_virtual: false },
    { name: 'Track Field', address: 'ROC Office Campus, Sports Area', description: 'Outdoor running track.', is_virtual: false },
  ],
  courts: [
    { name: 'Court 1', venueName: 'Main Hall', sportSlug: 'roc-olympic-2026-badminton', capacity: 20 },
    { name: 'Court 2', venueName: 'Main Hall', sportSlug: 'roc-olympic-2026-badminton', capacity: 20 },
    { name: 'Futsal Field', venueName: 'Futsal Field', sportSlug: 'roc-olympic-2026-futsal', capacity: 80 },
    { name: 'Table 1', venueName: 'Meeting Room A', sportSlug: 'roc-olympic-2026-table-tennis', capacity: 10 },
    { name: 'Board 1', venueName: 'Meeting Room A', sportSlug: 'roc-olympic-2026-chess', capacity: 4 },
    { name: 'Track Lane 1', venueName: 'Track Field', sportSlug: 'roc-olympic-2026-running', capacity: 30 },
  ],
  stages: [
    { name: 'Knockout', categorySlug: 'roc-olympic-2026-badminton-men-single', stage_type: 'single_elimination', order: 1, status: 'published' },
    { name: 'Group Stage', categorySlug: 'roc-olympic-2026-badminton-mixed-double', stage_type: 'group_stage', order: 1, status: 'published' },
    { name: 'Group Stage', categorySlug: 'roc-olympic-2026-futsal-men', stage_type: 'group_stage', order: 1, status: 'published' },
    { name: 'Knockout', categorySlug: 'roc-olympic-2026-table-tennis-open', stage_type: 'single_elimination', order: 1, status: 'published' },
    { name: 'Round Robin', categorySlug: 'roc-olympic-2026-chess-open', stage_type: 'round_robin', order: 1, status: 'published' },
    { name: 'Heats', categorySlug: 'roc-olympic-2026-running-100m', stage_type: 'time_trial', order: 1, status: 'published' },
  ],
  groups: [
    { name: 'Group A', stageCategorySlug: 'roc-olympic-2026-badminton-mixed-double', order: 1 },
    { name: 'Group A', stageCategorySlug: 'roc-olympic-2026-futsal-men', order: 1 },
    { name: 'Group B', stageCategorySlug: 'roc-olympic-2026-futsal-men', order: 2 },
  ],
  entries: [
    // Badminton Men Single - full 8-entry bracket (seeds 1-8) plus one withdrawn entry to prove
    // withdrawn/disqualified participants are excluded from bracket generation.
    { display_name: 'Andi Pratama', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-001', clubSlug: 'roc-olympic-2026-it-club', seed_number: 1, status: 'confirmed' },
    { display_name: 'Budi Santoso', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-002', clubSlug: 'roc-olympic-2026-finance', seed_number: 2, status: 'confirmed' },
    { display_name: 'Eko Wijaya', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-005', clubSlug: 'roc-olympic-2026-it-club', seed_number: 3, status: 'confirmed' },
    { display_name: 'Fajar Nugroho', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-006', clubSlug: 'roc-olympic-2026-finance', seed_number: 4, status: 'confirmed' },
    { display_name: 'Gilang Ramadhan', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-007', clubSlug: 'roc-olympic-2026-operations', seed_number: 5, status: 'confirmed' },
    { display_name: 'Hendra Setiawan', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-008', clubSlug: 'roc-olympic-2026-legal', seed_number: 6, status: 'confirmed' },
    { display_name: 'Irfan Hidayat', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-009', clubSlug: 'roc-olympic-2026-hr', seed_number: 7, status: 'confirmed' },
    { display_name: 'Joko Prasetyo', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-010', clubSlug: 'roc-olympic-2026-marketing', seed_number: 8, status: 'confirmed' },
    { display_name: 'Kirana Dewanti (Withdrawn)', categorySlug: 'roc-olympic-2026-badminton-men-single', entry_type: 'individual', playerEmployeeId: 'ROC-2026-011', clubSlug: 'roc-olympic-2026-operations', status: 'withdrawn' },

    // Badminton Mixed Double - 3 pairs, full round robin.
    { display_name: 'IT Smash Pair', categorySlug: 'roc-olympic-2026-badminton-mixed-double', entry_type: 'pair', teamSlug: 'roc-olympic-2026-it-smash-pair', clubSlug: 'roc-olympic-2026-it-club', seed_number: 1, status: 'confirmed' },
    { display_name: 'Marketing Mix Pair', categorySlug: 'roc-olympic-2026-badminton-mixed-double', entry_type: 'pair', teamSlug: 'roc-olympic-2026-marketing-mix-pair', clubSlug: 'roc-olympic-2026-marketing', seed_number: 2, status: 'confirmed' },
    { display_name: 'HR Rally Pair', categorySlug: 'roc-olympic-2026-badminton-mixed-double', entry_type: 'pair', teamSlug: 'roc-olympic-2026-hr-rally-pair', clubSlug: 'roc-olympic-2026-hr', seed_number: 3, status: 'confirmed' },

    // Futsal Men Group A - 4 confirmed teams/clubs, full round robin.
    { display_name: 'IT Futsal Squad', categorySlug: 'roc-olympic-2026-futsal-men', entry_type: 'team', teamSlug: 'roc-olympic-2026-it-futsal-squad', clubSlug: 'roc-olympic-2026-it-club', seed_number: 1, status: 'confirmed' },
    { display_name: 'Finance Futsal Squad', categorySlug: 'roc-olympic-2026-futsal-men', entry_type: 'team', teamSlug: 'roc-olympic-2026-finance-futsal-squad', clubSlug: 'roc-olympic-2026-finance', seed_number: 2, status: 'confirmed' },
    { display_name: 'HR Club', categorySlug: 'roc-olympic-2026-futsal-men', entry_type: 'club', clubSlug: 'roc-olympic-2026-hr', seed_number: 3, status: 'confirmed' },
    { display_name: 'Marketing Futsal Squad', categorySlug: 'roc-olympic-2026-futsal-men', entry_type: 'team', teamSlug: 'roc-olympic-2026-marketing-futsal-squad', clubSlug: 'roc-olympic-2026-marketing', seed_number: 4, status: 'confirmed' },

    // Futsal Men Group B - a mostly-empty group with a real team waiting on a TBD opponent.
    { display_name: 'Legal Futsal Crew', categorySlug: 'roc-olympic-2026-futsal-men', entry_type: 'team', teamSlug: 'roc-olympic-2026-legal-futsal-crew', clubSlug: 'roc-olympic-2026-legal', seed_number: 1, status: 'confirmed' },
    { display_name: 'TBD Futsal Opponent', categorySlug: 'roc-olympic-2026-futsal-men', entry_type: 'tbd', status: 'pending' },

    // Table Tennis Open Single - 4 entries, partially completed bracket (one TBD final slot).
    { display_name: 'Kartika Sari', categorySlug: 'roc-olympic-2026-table-tennis-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-014', clubSlug: 'roc-olympic-2026-operations', seed_number: 1, status: 'confirmed' },
    { display_name: 'Lukman Hakim', categorySlug: 'roc-olympic-2026-table-tennis-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-015', clubSlug: 'roc-olympic-2026-legal', seed_number: 2, status: 'confirmed' },
    { display_name: 'Oscar Pratomo', categorySlug: 'roc-olympic-2026-table-tennis-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-016', clubSlug: 'roc-olympic-2026-finance', seed_number: 3, status: 'confirmed' },
    { display_name: 'Putri Ayu', categorySlug: 'roc-olympic-2026-table-tennis-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-017', clubSlug: 'roc-olympic-2026-it-club', seed_number: 4, status: 'confirmed' },

    // Chess Open - 4 entries, round robin with draws.
    { display_name: 'Rian Saputra', categorySlug: 'roc-olympic-2026-chess-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-018', clubSlug: 'roc-olympic-2026-operations', seed_number: 1, status: 'confirmed' },
    { display_name: 'Sari Wulandari', categorySlug: 'roc-olympic-2026-chess-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-019', clubSlug: 'roc-olympic-2026-legal', seed_number: 2, status: 'confirmed' },
    { display_name: 'Tono Setiawan', categorySlug: 'roc-olympic-2026-chess-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-020', clubSlug: 'roc-olympic-2026-hr', seed_number: 3, status: 'confirmed' },
    { display_name: 'Umi Kalsum', categorySlug: 'roc-olympic-2026-chess-open', entry_type: 'individual', playerEmployeeId: 'ROC-2026-021', clubSlug: 'roc-olympic-2026-marketing', seed_number: 4, status: 'confirmed' },

    // Running 100m - reuses two existing players in a lightweight, non-bracket format.
    { display_name: 'Andi Pratama (Running)', categorySlug: 'roc-olympic-2026-running-100m', entry_type: 'individual', playerEmployeeId: 'ROC-2026-001', clubSlug: 'roc-olympic-2026-it-club', status: 'confirmed' },
    { display_name: 'Budi Santoso (Running)', categorySlug: 'roc-olympic-2026-running-100m', entry_type: 'individual', playerEmployeeId: 'ROC-2026-002', clubSlug: 'roc-olympic-2026-finance', status: 'confirmed' },
  ] satisfies DemoEntrySeed[],
  rosterSeeds: [
    { teamSlug: 'roc-olympic-2026-it-smash-pair', employeeId: 'ROC-2026-001', categorySlug: 'roc-olympic-2026-badminton-mixed-double', role: 'captain' },
    { teamSlug: 'roc-olympic-2026-it-smash-pair', employeeId: 'ROC-2026-003', categorySlug: 'roc-olympic-2026-badminton-mixed-double', role: 'player' },
    { teamSlug: 'roc-olympic-2026-hr-rally-pair', employeeId: 'ROC-2026-012', categorySlug: 'roc-olympic-2026-badminton-mixed-double', role: 'captain' },
    { teamSlug: 'roc-olympic-2026-hr-rally-pair', employeeId: 'ROC-2026-013', categorySlug: 'roc-olympic-2026-badminton-mixed-double', role: 'player' },
    { teamSlug: 'roc-olympic-2026-it-futsal-squad', employeeId: 'ROC-2026-005', categorySlug: 'roc-olympic-2026-futsal-men', role: 'captain' },
    { teamSlug: 'roc-olympic-2026-finance-futsal-squad', employeeId: 'ROC-2026-006', categorySlug: 'roc-olympic-2026-futsal-men', role: 'captain' },
  ],

  // Hand-declared matches. Some are fully resolved at creation time (existing pattern); the
  // single-elimination placeholders (TBD participants) and generated-match upgrades are resolved
  // afterward by demoScenario.singleEliminationResults / demoScenario.matchGenerationOverrides.
  matches: [
    {
      match_number: 'ROC-BMD-GA-001',
      round_name: 'Group A Match 1',
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-mixed-double',
      stageCategorySlug: 'roc-olympic-2026-badminton-mixed-double',
      groupName: 'Group A',
      participantA: 'IT Smash Pair',
      participantB: 'Marketing Mix Pair',
      scheduled_start_at: '2026-08-17T05:00:00.000Z',
      scheduled_end_at: '2026-08-17T06:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 2',
      status: 'scheduled',
      is_public: true,
      documentation_status: 'needed',
      finalStateDeclared: false,
    },
    {
      match_number: 'ROC-BMS-SF-001',
      round_name: 'Semi Final',
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      stageCategorySlug: 'roc-olympic-2026-badminton-men-single',
      participantA: undefined,
      participantB: undefined,
      scheduled_start_at: '2026-08-17T07:00:00.000Z',
      scheduled_end_at: '2026-08-17T08:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 1',
      status: 'scheduled',
      is_public: true,
      documentation_status: 'not_started',
      finalStateDeclared: false,
    },
    {
      match_number: 'ROC-BMS-SF-002',
      round_name: 'Semi Final',
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      stageCategorySlug: 'roc-olympic-2026-badminton-men-single',
      participantA: undefined,
      participantB: undefined,
      scheduled_start_at: '2026-08-17T07:00:00.000Z',
      scheduled_end_at: '2026-08-17T08:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 2',
      status: 'scheduled',
      is_public: true,
      documentation_status: 'not_started',
      finalStateDeclared: false,
    },
    {
      match_number: 'ROC-BMS-001',
      round_name: 'Final',
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      stageCategorySlug: 'roc-olympic-2026-badminton-men-single',
      participantA: undefined,
      participantB: undefined,
      scheduled_start_at: '2026-08-18T03:00:00.000Z',
      scheduled_end_at: '2026-08-18T04:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 1',
      status: 'scheduled',
      is_public: true,
      documentation_status: 'needed',
      finalStateDeclared: false,
    },
    {
      match_number: 'ROC-FUT-GA-001',
      round_name: 'Group A Match 1',
      sportSlug: 'roc-olympic-2026-futsal',
      categorySlug: 'roc-olympic-2026-futsal-men',
      stageCategorySlug: 'roc-olympic-2026-futsal-men',
      groupName: 'Group A',
      participantA: 'IT Futsal Squad',
      participantB: 'Finance Futsal Squad',
      scheduled_start_at: '2026-08-18T08:00:00.000Z',
      scheduled_end_at: '2026-08-18T09:00:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
      status: 'result_published',
      winner: 'IT Futsal Squad',
      score_summary: 'IT Futsal Squad 3-1 Finance Futsal Squad',
      is_public: true,
      documentation_status: 'needed',
    },
    {
      match_number: 'ROC-FUT-GB-001',
      round_name: 'Group B Match 1',
      sportSlug: 'roc-olympic-2026-futsal',
      categorySlug: 'roc-olympic-2026-futsal-men',
      stageCategorySlug: 'roc-olympic-2026-futsal-men',
      groupName: 'Group B',
      participantA: 'Legal Futsal Crew',
      participantB: 'TBD Futsal Opponent',
      scheduled_start_at: '2026-08-21T01:00:00.000Z',
      scheduled_end_at: '2026-08-21T02:00:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
      status: 'scheduled',
      is_public: true,
      documentation_status: 'not_started',
    },
    {
      match_number: 'ROC-TTO-001',
      round_name: 'Final',
      sportSlug: 'roc-olympic-2026-table-tennis',
      categorySlug: 'roc-olympic-2026-table-tennis-open',
      stageCategorySlug: 'roc-olympic-2026-table-tennis-open',
      participantA: undefined,
      participantB: undefined,
      scheduled_start_at: '2026-08-20T06:00:00.000Z',
      scheduled_end_at: '2026-08-20T07:00:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Table 1',
      status: 'published',
      is_public: true,
      documentation_status: 'not_started',
      finalStateDeclared: false,
    },
    {
      match_number: 'ROC-RUN-001',
      round_name: 'Heat 1',
      sportSlug: 'roc-olympic-2026-running',
      categorySlug: 'roc-olympic-2026-running-100m',
      stageCategorySlug: 'roc-olympic-2026-running-100m',
      participantA: 'Andi Pratama (Running)',
      participantB: 'Budi Santoso (Running)',
      scheduled_start_at: '2026-08-21T01:00:00.000Z',
      scheduled_end_at: '2026-08-21T01:15:00.000Z',
      venueName: 'Track Field',
      courtName: 'Track Lane 1',
      status: 'result_published',
      winner: 'Andi Pratama (Running)',
      score_summary: 'Andi Pratama 12.41s - Budi Santoso 12.89s',
      is_public: true,
      documentation_status: 'not_required',
    },
    {
      match_number: 'ROC-RUN-002',
      round_name: 'Heat 2',
      sportSlug: 'roc-olympic-2026-running',
      categorySlug: 'roc-olympic-2026-running-100m',
      stageCategorySlug: 'roc-olympic-2026-running-100m',
      participantA: 'Andi Pratama (Running)',
      participantB: 'Budi Santoso (Running)',
      scheduled_start_at: '2026-08-21T01:20:00.000Z',
      scheduled_end_at: '2026-08-21T01:35:00.000Z',
      venueName: 'Track Field',
      courtName: 'Track Lane 1',
      status: 'disputed',
      score_summary: 'Photo finish under committee review.',
      is_public: true,
      documentation_status: 'needed',
    },
    {
      match_number: 'ROC-RUN-003',
      round_name: 'Heat 3',
      sportSlug: 'roc-olympic-2026-running',
      categorySlug: 'roc-olympic-2026-running-100m',
      stageCategorySlug: 'roc-olympic-2026-running-100m',
      participantA: undefined,
      participantB: undefined,
      status: 'draft',
      is_public: false,
      documentation_status: 'not_started',
    },
    {
      match_number: 'ROC-RUN-004',
      round_name: 'Heat 4',
      sportSlug: 'roc-olympic-2026-running',
      categorySlug: 'roc-olympic-2026-running-100m',
      stageCategorySlug: 'roc-olympic-2026-running-100m',
      participantA: 'Andi Pratama (Running)',
      participantB: 'Budi Santoso (Running)',
      scheduled_start_at: '2026-08-21T01:40:00.000Z',
      scheduled_end_at: '2026-08-21T01:55:00.000Z',
      venueName: 'Track Field',
      courtName: 'Track Lane 1',
      status: 'ready_to_start',
      is_public: true,
      documentation_status: 'not_started',
    },
  ] satisfies DemoMatchSeed[],

  matchGeneration: [
    {
      generation_type: 'single_elimination',
      matchNumberPrefix: 'ROC-BMS-QF',
      startNumber: 1,
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-men-single',
      stageCategorySlug: 'roc-olympic-2026-badminton-men-single',
      roundName: 'Quarter Final',
    },
    {
      generation_type: 'round_robin',
      matchNumberPrefix: 'ROC-BMD-GEN-GA',
      startNumber: 1,
      sportSlug: 'roc-olympic-2026-badminton',
      categorySlug: 'roc-olympic-2026-badminton-mixed-double',
      stageCategorySlug: 'roc-olympic-2026-badminton-mixed-double',
      groupName: 'Group A',
      roundNamePrefix: 'Group A',
    },
    {
      generation_type: 'round_robin',
      matchNumberPrefix: 'ROC-FUT-GEN-GA',
      startNumber: 1,
      sportSlug: 'roc-olympic-2026-futsal',
      categorySlug: 'roc-olympic-2026-futsal-men',
      stageCategorySlug: 'roc-olympic-2026-futsal-men',
      groupName: 'Group A',
      roundNamePrefix: 'Group A',
    },
    {
      generation_type: 'single_elimination',
      matchNumberPrefix: 'ROC-TTO-SF',
      startNumber: 1,
      sportSlug: 'roc-olympic-2026-table-tennis',
      categorySlug: 'roc-olympic-2026-table-tennis-open',
      stageCategorySlug: 'roc-olympic-2026-table-tennis-open',
      roundName: 'Semi Final',
    },
    {
      generation_type: 'round_robin',
      matchNumberPrefix: 'ROC-CHS-GA',
      startNumber: 1,
      sportSlug: 'roc-olympic-2026-chess',
      categorySlug: 'roc-olympic-2026-chess-open',
      stageCategorySlug: 'roc-olympic-2026-chess-open',
      roundNamePrefix: 'Round Robin',
    },
  ],

  // Existing set(s) attached to hand-declared matches at creation time.
  matchSets: [
    { matchNumber: 'ROC-FUT-GA-001', set_number: 1, participant_a_score: 3, participant_b_score: 1, notes: 'Seeded full-time futsal result for standings validation.' },
  ] satisfies DemoMatchSetSeed[],

  // Simple status/score upgrades for matches that do NOT need winner advancement (round robin /
  // standalone matches). Applied via payload.update after creation/generation.
  matchGenerationOverrides: [
    {
      matchNumber: 'ROC-BMD-GA-001',
      status: 'result_published',
      winner: 'IT Smash Pair',
      score_summary: 'IT Smash Pair beat Marketing Mix Pair',
      is_public: true,
      documentation_status: 'approved',
      sets: [
        { matchNumber: 'ROC-BMD-GA-001', set_number: 1, participant_a_score: 21, participant_b_score: 18 },
        { matchNumber: 'ROC-BMD-GA-001', set_number: 2, participant_a_score: 21, participant_b_score: 19 },
      ],
    },
    {
      matchNumber: 'ROC-BMD-GEN-GA-002',
      status: 'ongoing',
      is_public: true,
      documentation_status: 'not_started',
      scheduled_start_at: '2026-08-19T01:00:00.000Z',
      scheduled_end_at: '2026-08-19T02:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 2',
    },
    {
      matchNumber: 'ROC-BMD-GEN-GA-003',
      status: 'scheduled',
      is_public: true,
      documentation_status: 'not_started',
      scheduled_start_at: '2026-08-19T02:30:00.000Z',
      scheduled_end_at: '2026-08-19T03:30:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 2',
    },
    {
      matchNumber: 'ROC-FUT-GEN-GA-002',
      status: 'finished',
      winner: 'IT Futsal Squad',
      score_summary: 'IT Futsal Squad 2-0 HR Club',
      is_public: true,
      documentation_status: 'submitted',
      scheduled_start_at: '2026-08-19T01:00:00.000Z',
      scheduled_end_at: '2026-08-19T02:00:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
      sets: [{ matchNumber: 'ROC-FUT-GEN-GA-002', set_number: 1, participant_a_score: 2, participant_b_score: 0 }],
    },
    {
      matchNumber: 'ROC-FUT-GEN-GA-003',
      status: 'postponed',
      is_public: true,
      documentation_status: 'not_started',
      scheduled_start_at: '2026-08-20T01:00:00.000Z',
      scheduled_end_at: '2026-08-20T02:00:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
    },
    {
      matchNumber: 'ROC-FUT-GEN-GA-004',
      status: 'result_published',
      score_summary: 'Finance Futsal Squad 1-1 HR Club',
      is_public: true,
      documentation_status: 'approved',
      scheduled_start_at: '2026-08-19T02:30:00.000Z',
      scheduled_end_at: '2026-08-19T03:30:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
      sets: [{ matchNumber: 'ROC-FUT-GEN-GA-004', set_number: 1, participant_a_score: 1, participant_b_score: 1 }],
    },
    {
      matchNumber: 'ROC-FUT-GEN-GA-005',
      status: 'cancelled',
      is_public: true,
      documentation_status: 'not_required',
      scheduled_start_at: '2026-08-20T02:30:00.000Z',
      scheduled_end_at: '2026-08-20T03:30:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
    },
    {
      matchNumber: 'ROC-FUT-GEN-GA-006',
      status: 'walkover',
      winner: 'HR Club',
      score_summary: 'HR Club advances by walkover',
      is_public: true,
      documentation_status: 'not_required',
      scheduled_start_at: '2026-08-20T04:00:00.000Z',
      scheduled_end_at: '2026-08-20T05:00:00.000Z',
      venueName: 'Futsal Field',
      courtName: 'Futsal Field',
    },
    {
      matchNumber: 'ROC-TTO-SF-002',
      status: 'check_in_open',
      is_public: true,
      documentation_status: 'not_started',
      scheduled_start_at: '2026-08-19T07:30:00.000Z',
      scheduled_end_at: '2026-08-19T08:30:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Table 1',
    },
    {
      matchNumber: 'ROC-CHS-GA-001',
      status: 'result_published',
      winner: 'Rian Saputra',
      score_summary: 'Rian Saputra beat Sari Wulandari',
      is_public: true,
      documentation_status: 'approved',
      scheduled_start_at: '2026-08-18T07:00:00.000Z',
      scheduled_end_at: '2026-08-18T08:30:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Board 1',
      sets: [{ matchNumber: 'ROC-CHS-GA-001', set_number: 1, participant_a_score: 1, participant_b_score: 0 }],
    },
    {
      matchNumber: 'ROC-CHS-GA-002',
      status: 'result_published',
      score_summary: 'Rian Saputra drew with Tono Setiawan',
      is_public: true,
      documentation_status: 'approved',
      scheduled_start_at: '2026-08-18T09:00:00.000Z',
      scheduled_end_at: '2026-08-18T10:30:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Board 1',
      sets: [{ matchNumber: 'ROC-CHS-GA-002', set_number: 1, participant_a_score: 0.5, participant_b_score: 0.5 }],
    },
    {
      matchNumber: 'ROC-CHS-GA-003',
      status: 'under_review',
      is_public: true,
      documentation_status: 'submitted',
      scheduled_start_at: '2026-08-19T07:00:00.000Z',
      scheduled_end_at: '2026-08-19T08:30:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Board 1',
    },
    {
      matchNumber: 'ROC-CHS-GA-004',
      status: 'result_published',
      winner: 'Tono Setiawan',
      score_summary: 'Tono Setiawan beat Sari Wulandari',
      is_public: true,
      documentation_status: 'approved',
      scheduled_start_at: '2026-08-19T09:00:00.000Z',
      scheduled_end_at: '2026-08-19T10:30:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Board 1',
      sets: [{ matchNumber: 'ROC-CHS-GA-004', set_number: 1, participant_a_score: 0, participant_b_score: 1 }],
    },
    {
      matchNumber: 'ROC-CHS-GA-006',
      status: 'paused',
      is_public: true,
      documentation_status: 'not_started',
      scheduled_start_at: '2026-08-20T07:00:00.000Z',
      scheduled_end_at: '2026-08-20T08:30:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Board 1',
    },
    // ROC-CHS-GA-005 (Sari Wulandari vs Umi Kalsum) is intentionally left untouched at its
    // generated default (`ready_for_scheduling`, is_public false) to demonstrate the Scheduler
    // Workspace's unscheduled-match queue state.
  ] satisfies DemoMatchOverrideSeed[],

  // Processed in order via the real attemptSingleEliminationWinnerAdvancement helper so bracket
  // progress (TBD -> filled -> champion) matches production behavior exactly. See D024.
  singleEliminationResults: [
    {
      matchNumber: 'ROC-BMS-QF-001',
      winner: 'Andi Pratama',
      score_summary: 'Andi Pratama beat Joko Prasetyo',
      sets: [
        { matchNumber: 'ROC-BMS-QF-001', set_number: 1, participant_a_score: 21, participant_b_score: 15 },
        { matchNumber: 'ROC-BMS-QF-001', set_number: 2, participant_a_score: 21, participant_b_score: 12 },
      ],
      scheduled_start_at: '2026-08-17T01:00:00.000Z',
      scheduled_end_at: '2026-08-17T02:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 1',
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-BMS-QF-002',
      winner: 'Budi Santoso',
      score_summary: 'Budi Santoso beat Irfan Hidayat',
      sets: [
        { matchNumber: 'ROC-BMS-QF-002', set_number: 1, participant_a_score: 21, participant_b_score: 19 },
        { matchNumber: 'ROC-BMS-QF-002', set_number: 2, participant_a_score: 21, participant_b_score: 17 },
      ],
      scheduled_start_at: '2026-08-17T01:00:00.000Z',
      scheduled_end_at: '2026-08-17T02:00:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 2',
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-BMS-QF-003',
      winner: 'Eko Wijaya',
      score_summary: 'Eko Wijaya beat Hendra Setiawan in three sets',
      sets: [
        { matchNumber: 'ROC-BMS-QF-003', set_number: 1, participant_a_score: 21, participant_b_score: 14 },
        { matchNumber: 'ROC-BMS-QF-003', set_number: 2, participant_a_score: 18, participant_b_score: 21 },
        { matchNumber: 'ROC-BMS-QF-003', set_number: 3, participant_a_score: 21, participant_b_score: 16 },
      ],
      scheduled_start_at: '2026-08-17T02:30:00.000Z',
      scheduled_end_at: '2026-08-17T03:45:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 1',
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-BMS-QF-004',
      winner: 'Fajar Nugroho',
      score_summary: 'Fajar Nugroho beat Gilang Ramadhan',
      sets: [
        { matchNumber: 'ROC-BMS-QF-004', set_number: 1, participant_a_score: 21, participant_b_score: 16 },
        { matchNumber: 'ROC-BMS-QF-004', set_number: 2, participant_a_score: 21, participant_b_score: 19 },
      ],
      scheduled_start_at: '2026-08-17T02:30:00.000Z',
      scheduled_end_at: '2026-08-17T03:30:00.000Z',
      venueName: 'Main Hall',
      courtName: 'Court 2',
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-BMS-SF-001',
      winner: 'Andi Pratama',
      score_summary: 'Andi Pratama beat Budi Santoso',
      sets: [
        { matchNumber: 'ROC-BMS-SF-001', set_number: 1, participant_a_score: 21, participant_b_score: 17 },
        { matchNumber: 'ROC-BMS-SF-001', set_number: 2, participant_a_score: 21, participant_b_score: 20 },
      ],
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-BMS-SF-002',
      winner: 'Eko Wijaya',
      score_summary: 'Eko Wijaya beat Fajar Nugroho',
      sets: [
        { matchNumber: 'ROC-BMS-SF-002', set_number: 1, participant_a_score: 21, participant_b_score: 13 },
        { matchNumber: 'ROC-BMS-SF-002', set_number: 2, participant_a_score: 21, participant_b_score: 15 },
      ],
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-BMS-001',
      winner: 'Andi Pratama',
      score_summary: 'Andi Pratama is ROC Olympic 2026 Badminton Men Single champion',
      sets: [
        { matchNumber: 'ROC-BMS-001', set_number: 1, participant_a_score: 19, participant_b_score: 21 },
        { matchNumber: 'ROC-BMS-001', set_number: 2, participant_a_score: 21, participant_b_score: 18 },
        { matchNumber: 'ROC-BMS-001', set_number: 3, participant_a_score: 21, participant_b_score: 16 },
      ],
      is_public: true,
      documentation_status: 'approved',
    },
    {
      matchNumber: 'ROC-TTO-SF-001',
      winner: 'Kartika Sari',
      score_summary: 'Kartika Sari beat Putri Ayu',
      sets: [
        { matchNumber: 'ROC-TTO-SF-001', set_number: 1, participant_a_score: 11, participant_b_score: 7 },
        { matchNumber: 'ROC-TTO-SF-001', set_number: 2, participant_a_score: 11, participant_b_score: 9 },
      ],
      scheduled_start_at: '2026-08-19T06:00:00.000Z',
      scheduled_end_at: '2026-08-19T07:00:00.000Z',
      venueName: 'Meeting Room A',
      courtName: 'Table 1',
      is_public: true,
      documentation_status: 'approved',
    },
  ] satisfies DemoSingleEliminationResultSeed[],
}
