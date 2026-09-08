import type { CollectionConfig } from 'payload'

// No-login "Quick Bracket Tournament" (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md) -
// deliberately NOT related to Events/Sports/CompetitionCategories/Stages/CompetitionEntries/
// Matches. Those all require a real event (and most a real sport too) with access scoped to real
// event membership - opening an anonymous-write hole across five access-controlled collections
// just to render a name-list bracket would be a far bigger surface than one small, isolated
// collection with no foreign keys into the authenticated system at all.
//
// `create` is technically open here, but the real gatekeeping (honeypot, Turnstile, IP rate limit,
// participant/size validation, curated field construction) happens in
// createQuickBracketAction - nothing in this collection should ever be written to directly from a
// public REST/GraphQL request. `update` has no legitimate caller yet (Phase 2's claim flow will use
// the local API, not a public update endpoint), so it is locked down entirely.
export const QuickBrackets: CollectionConfig = {
  slug: 'quick-brackets',
  admin: {
    defaultColumns: ['name', 'format', 'bracket_size', 'status', 'createdAt'],
    group: 'Competition Results',
    useAsTitle: 'name',
    description: 'No-login quick bracket generator results. Read-only once created.',
  },
  access: {
    create: () => true,
    read: () => true,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Short random id used in the public /quick-bracket/[slug] URL.',
      },
    },
    {
      name: 'format',
      type: 'select',
      required: true,
      options: [
        { label: 'Single Elimination', value: 'single_elimination' },
        { label: 'Double Elimination', value: 'double_elimination' },
      ],
    },
    {
      name: 'third_place',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Single elimination only - include a Bronze Final.' },
    },
    {
      name: 'split_participants',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Double elimination only - start with half of participants in the losers bracket. Not yet implemented (Phase 2); stored for forward compatibility only.',
      },
    },
    {
      name: 'bracket_size_mode',
      type: 'select',
      required: true,
      options: [
        { label: 'From participant list', value: 'from_participants' },
        { label: 'Manual size (blank bracket)', value: 'manual_size' },
      ],
    },
    {
      name: 'bracket_size',
      type: 'number',
      required: true,
      admin: { description: 'Resolved power-of-two bracket size actually generated.' },
    },
    {
      name: 'participants',
      type: 'array',
      admin: { description: 'Entered names in seed order. Empty/"TBD" placeholders for a blank bracket.' },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'seed', type: 'number', required: true },
      ],
    },
    {
      name: 'bracket_data',
      type: 'json',
      required: true,
      admin: {
        description: 'Generated once at creation. Same shape as Brackets.bracket_data. Never recalculated.',
      },
    },
    {
      name: 'owner_token',
      type: 'text',
      index: true,
      admin: { hidden: true, description: 'Matched against a cookie for the "your guest brackets" list only - not a write credential.' },
    },
    {
      name: 'creator_ip',
      type: 'text',
      admin: { hidden: true, description: 'Abuse-investigation / rate-limit audit trail only.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Claimed', value: 'claimed' },
        { label: 'Expired', value: 'expired' },
      ],
    },
    {
      name: 'claimed_event_id',
      type: 'relationship',
      relationTo: 'events',
      admin: { description: 'Set by the Phase 2 claim-to-real-event flow.' },
    },
    {
      name: 'expires_at',
      type: 'date',
      required: true,
      index: true,
      admin: { description: 'createdAt + 30 days at creation time. Checked on read even before cleanup runs.' },
    },
  ],
  timestamps: true,
}
