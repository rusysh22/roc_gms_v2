import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

export const Rulesets: CollectionConfig = {
  slug: 'rulesets',
  admin: {
    defaultColumns: ['name', 'sport_id', 'score_type', 'set_based', 'best_of'],
    group: 'Competition Setup',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: publicReadScopedToEvent(),
    update: canManageEventStructure,
  },
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 9: slug uniqueness must be scoped per
  // event, not global, so two different events can each define their own ruleset
  // slugs without colliding at the DB level.
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
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'score_type',
      type: 'select',
      required: true,
      defaultValue: 'points',
      options: [
        { label: 'Points', value: 'points' },
        { label: 'Goals', value: 'goals' },
        { label: 'Sets', value: 'sets' },
        { label: 'Time', value: 'time' },
        { label: 'Result', value: 'result' },
        { label: 'Custom', value: 'custom' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'allow_draw',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'set_based',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'timer_enabled',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'points_win',
          type: 'number',
          min: 0,
          defaultValue: 3,
        },
        {
          name: 'points_draw',
          type: 'number',
          min: 0,
          defaultValue: 1,
        },
        {
          name: 'points_loss',
          type: 'number',
          min: 0,
          defaultValue: 0,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'best_of',
          type: 'number',
          min: 1,
        },
        {
          name: 'target_score',
          type: 'number',
          min: 0,
        },
        {
          name: 'max_score',
          type: 'number',
          min: 0,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'deuce_enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'overtime_enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'penalty_enabled',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'period_count',
          type: 'number',
          min: 0,
        },
        {
          name: 'period_duration',
          type: 'number',
          min: 0,
          admin: {
            description: 'Duration in minutes.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'default_duration_minutes',
          type: 'number',
          min: 1,
          admin: {
            description:
              'Cross-sport schedule optimizer: how long to reserve a court for a match in this ruleset. Leave empty to use the optimizer\'s default.',
          },
        },
        {
          name: 'min_rest_minutes',
          type: 'number',
          min: 0,
          admin: {
            description:
              'Cross-sport schedule optimizer: minimum minutes required between two matches for the same participant, even across different sports/categories. When two categories disagree, the larger value wins. Leave empty to use the optimizer\'s default.',
          },
        },
      ],
    },
    {
      name: 'tie_breakers',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Points', value: 'points' },
        { label: 'Head-to-head', value: 'head_to_head' },
        { label: 'Score Difference', value: 'score_difference' },
        { label: 'Score For', value: 'score_for' },
        { label: 'Set Difference', value: 'set_difference' },
        { label: 'Set For', value: 'set_for' },
        { label: 'Fewest Penalties', value: 'fewest_penalties' },
        { label: 'Manual Decision', value: 'manual_decision' },
      ],
    },
  ],
  timestamps: true,
}
