import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageSchedule } from '@/access/roles'

export const Stages: CollectionConfig = {
  slug: 'stages',
  admin: {
    defaultColumns: ['name', 'category_id', 'stage_type', 'order', 'status'],
    group: 'Competition Setup',
    useAsTitle: 'name',
  },
  access: {
    create: scopedCreateToUserEvents(canManageSchedule),
    delete: scopedToUserEvents(canManageSchedule),
    read: publicReadScopedToEvent(),
    update: scopedToUserEvents(canManageSchedule),
  },
  fields: [
    {
      name: 'event_id',
      type: 'relationship',
      relationTo: 'events',
      required: true,
      index: true,
    },
    {
      name: 'category_id',
      type: 'relationship',
      relationTo: 'competition-categories',
      required: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'stage_type',
      type: 'select',
      required: true,
      defaultValue: 'group_stage',
      options: [
        { label: 'Group Stage', value: 'group_stage' },
        { label: 'Round Robin', value: 'round_robin' },
        { label: 'Single Elimination', value: 'single_elimination' },
        { label: 'Double Elimination', value: 'double_elimination' },
        { label: 'Swiss', value: 'swiss' },
        { label: 'League', value: 'league' },
        { label: 'Final Only', value: 'final_only' },
        { label: 'Friendly', value: 'friendly' },
        { label: 'Time Trial', value: 'time_trial' },
        { label: 'Score Ranking', value: 'score_ranking' },
      ],
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 1,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Ready', value: 'ready' },
        { label: 'Published', value: 'published' },
        { label: 'Completed', value: 'completed' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'ruleset_id',
      type: 'relationship',
      relationTo: 'rulesets',
      admin: {
        description:
          'MSG-03: optional per-stage override. Leave empty to inherit the category\'s ruleset - e.g. best-of-3 group matches, best-of-5 semifinal/final. See src/lib/ruleValidation.ts\'s loadRulesetForMatch for resolution order.',
      },
    },
  ],
  timestamps: true,
}
