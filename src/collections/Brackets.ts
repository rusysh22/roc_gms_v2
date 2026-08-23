import type { CollectionConfig } from 'payload'

import { publicReadPublishedBracket } from '@/access/eventVisibility'
import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageSchedule } from '@/access/roles'

export const Brackets: CollectionConfig = {
  slug: 'brackets',
  admin: {
    defaultColumns: ['name', 'format', 'category_id', 'stage_id', 'status'],
    group: 'Competition Results',
    useAsTitle: 'name',
  },
  access: {
    create: scopedCreateToUserEvents(canManageSchedule),
    delete: scopedToUserEvents(canManageSchedule),
    read: publicReadPublishedBracket,
    update: scopedToUserEvents(canManageSchedule),
  },
  fields: [
    {
      name: 'bracket_key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Deterministic event/category/stage key used by bracket cache jobs.',
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
      unique: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'format',
      type: 'select',
      required: true,
      defaultValue: 'single_elimination',
      options: [
        { label: 'Single Elimination', value: 'single_elimination' },
        { label: 'Double Elimination', value: 'double_elimination' },
      ],
    },
    {
      name: 'seed_config',
      type: 'json',
      admin: {
        description: 'Seed and participant metadata used to build this cached bracket view.',
      },
    },
    {
      name: 'bracket_data',
      type: 'json',
      required: true,
      admin: {
        description: 'Cached custom layout data. Match records remain the result source of truth.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Ready', value: 'ready' },
        { label: 'Published', value: 'published' },
        { label: 'Locked', value: 'locked' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
  timestamps: true,
}
