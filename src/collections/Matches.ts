import type { CollectionConfig } from 'payload'

import { canManageMatches, canReadPublicMatch } from '@/access/roles'

export const Matches: CollectionConfig = {
  slug: 'matches',
  admin: {
    defaultColumns: [
      'match_number',
      'sport_id',
      'category_id',
      'scheduled_start_at',
      'status',
      'generation_source',
    ],
    group: 'Schedule',
    useAsTitle: 'match_number',
  },
  access: {
    create: canManageMatches,
    delete: canManageMatches,
    read: canReadPublicMatch,
    update: canManageMatches,
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
      name: 'sport_id',
      type: 'relationship',
      relationTo: 'sports',
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
      index: true,
    },
    {
      name: 'group_id',
      type: 'relationship',
      relationTo: 'groups',
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'round_name',
          type: 'text',
        },
        {
          name: 'match_number',
          type: 'text',
          required: true,
          unique: true,
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'participant_a_entry_id',
          type: 'relationship',
          relationTo: 'competition-entries',
          index: true,
        },
        {
          name: 'participant_b_entry_id',
          type: 'relationship',
          relationTo: 'competition-entries',
          index: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'scheduled_start_at',
          type: 'date',
          index: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'scheduled_end_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'actual_start_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'actual_end_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'venue_id',
          type: 'relationship',
          relationTo: 'venues',
          index: true,
        },
        {
          name: 'court_id',
          type: 'relationship',
          relationTo: 'courts',
          index: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Ready for Scheduling', value: 'ready_for_scheduling' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Published', value: 'published' },
        { label: 'Check-in Open', value: 'check_in_open' },
        { label: 'Ready to Start', value: 'ready_to_start' },
        { label: 'Ongoing', value: 'ongoing' },
        { label: 'Paused', value: 'paused' },
        { label: 'Under Review', value: 'under_review' },
        { label: 'Finished', value: 'finished' },
        { label: 'Result Published', value: 'result_published' },
        { label: 'Postponed', value: 'postponed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Walkover', value: 'walkover' },
        { label: 'Disputed', value: 'disputed' },
      ],
    },
    {
      name: 'generation_source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      index: true,
      admin: {
        description: 'Marks whether this match was manually created or generated as a schedule seed.',
      },
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Round Robin', value: 'round_robin' },
        { label: 'Single Elimination', value: 'single_elimination' },
      ],
    },
    {
      name: 'generation_key',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Deterministic key used by seed/generation jobs to avoid duplicate matches.',
      },
    },
    {
      name: 'winner_entry_id',
      type: 'relationship',
      relationTo: 'competition-entries',
      index: true,
    },
    {
      name: 'score_summary',
      type: 'text',
    },
    {
      name: 'is_public',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'documentation_status',
      type: 'select',
      required: true,
      defaultValue: 'not_started',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'Needed', value: 'needed' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Not Required', value: 'not_required' },
      ],
    },
  ],
  timestamps: true,
}
