import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

export const CompetitionCategories: CollectionConfig = {
  slug: 'competition-categories',
  admin: {
    defaultColumns: ['name', 'sport_id', 'participant_mode', 'format_type', 'status'],
    group: 'Event Setup',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: publicReadScopedToEvent(),
    update: canManageEventStructure,
  },
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 9: slug uniqueness must be scoped per
  // event, not global, so two different events can each have their own
  // "mens-singles" category without colliding at the DB level.
  indexes: [{ fields: ['event_id', 'slug'], unique: true }],
  fields: [
    {
      name: 'event_id',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
    },
    {
      name: 'sport_id',
      type: 'relationship',
      relationTo: 'sports',
      required: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
    },
    {
      name: 'participant_mode',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Individual', value: 'individual' },
        { label: 'Pair', value: 'pair' },
        { label: 'Team', value: 'team' },
        { label: 'Club', value: 'club' },
        { label: 'Open', value: 'open' },
        { label: 'TBD', value: 'tbd' },
      ],
    },
    {
      name: 'roster_required',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'min_roster_size',
          type: 'number',
          min: 0,
          defaultValue: 0,
        },
        {
          name: 'max_roster_size',
          type: 'number',
          min: 0,
        },
      ],
    },
    {
      name: 'ruleset_id',
      type: 'relationship',
      relationTo: 'rulesets',
    },
    {
      name: 'format_type',
      type: 'select',
      required: true,
      defaultValue: 'single_elimination',
      options: [
        { label: 'Single Elimination', value: 'single_elimination' },
        { label: 'Double Elimination', value: 'double_elimination' },
        { label: 'Round Robin', value: 'round_robin' },
        { label: 'Group Stage to Knockout', value: 'group_stage_to_knockout' },
        { label: 'League', value: 'league' },
        { label: 'Friendly', value: 'friendly' },
        { label: 'Time Trial', value: 'time_trial' },
        { label: 'Score Ranking', value: 'score_ranking' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Open', value: 'open' },
        { label: 'Locked', value: 'locked' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'group_qualify_count',
      type: 'number',
      min: 1,
      admin: {
        description:
          'How many top-ranked entries per group currently qualify to advance (standings mark them "qualified"). Leave empty to skip auto-qualification (AUDIT_E2E STD-06).',
      },
    },
  ],
  timestamps: true,
}
