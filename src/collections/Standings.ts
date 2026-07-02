import type { CollectionConfig } from 'payload'

import { canManageSchedule } from '@/access/roles'

export const Standings: CollectionConfig = {
  slug: 'standings',
  admin: {
    defaultColumns: ['rank', 'entry_id', 'played', 'points', 'score_difference', 'qualified_status'],
    group: 'Competition Results',
    useAsTitle: 'standing_key',
  },
  access: {
    create: canManageSchedule,
    delete: canManageSchedule,
    read: () => true,
    update: canManageSchedule,
  },
  fields: [
    {
      name: 'standing_key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Deterministic scope + entry key used by recalculation jobs.',
      },
    },
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
      name: 'stage_id',
      type: 'relationship',
      relationTo: 'stages',
      required: true,
      index: true,
    },
    {
      name: 'group_id',
      type: 'relationship',
      relationTo: 'groups',
      index: true,
    },
    {
      name: 'entry_id',
      type: 'relationship',
      relationTo: 'competition-entries',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'rank', type: 'number', required: true, min: 1, defaultValue: 1 },
        { name: 'played', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'won', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'drawn', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'lost', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'points', type: 'number', required: true, min: 0, defaultValue: 0 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'score_for', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'score_against', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'score_difference', type: 'number', required: true, defaultValue: 0 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'set_for', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'set_against', type: 'number', required: true, min: 0, defaultValue: 0 },
        { name: 'set_difference', type: 'number', required: true, defaultValue: 0 },
      ],
    },
    {
      name: 'qualified_status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Eliminated', value: 'eliminated' },
        { label: 'Champion', value: 'champion' },
        { label: 'Runner Up', value: 'runner_up' },
      ],
    },
  ],
  timestamps: true,
}
