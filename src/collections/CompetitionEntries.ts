import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

export const CompetitionEntries: CollectionConfig = {
  slug: 'competition-entries',
  admin: {
    defaultColumns: ['display_name', 'category_id', 'entry_type', 'seed_number', 'status'],
    group: 'Participants',
    useAsTitle: 'display_name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: publicReadScopedToEvent(),
    update: canManageEventStructure,
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
      name: 'entry_type',
      type: 'select',
      required: true,
      defaultValue: 'tbd',
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
      name: 'club_id',
      type: 'relationship',
      relationTo: 'clubs',
      index: true,
    },
    {
      name: 'team_id',
      type: 'relationship',
      relationTo: 'teams',
      index: true,
    },
    {
      name: 'player_id',
      type: 'relationship',
      relationTo: 'players',
      index: true,
    },
    {
      name: 'display_name',
      type: 'text',
      required: true,
    },
    {
      name: 'seed_number',
      type: 'number',
      min: 1,
    },
    {
      name: 'group_id',
      type: 'relationship',
      relationTo: 'groups',
      index: true,
      admin: {
        description:
          'Group-stage assignment for group_stage_to_knockout categories. Set by the wizard\'s Groups panel before any match exists - group membership otherwise has no home until a match references it.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Waitlisted', value: 'waitlisted' },
        { label: 'Withdrawn', value: 'withdrawn' },
        { label: 'Disqualified', value: 'disqualified' },
      ],
    },
  ],
  timestamps: true,
}
