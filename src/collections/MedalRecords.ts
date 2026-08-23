import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageSchedule } from '@/access/roles'

// MSG-02: one row per medal awarded (gold/silver/bronze), derived from a category's final result
// and cached here the same way standings/brackets are - a cache collection recalculated by
// src/lib/medals.ts, not something an admin fills in directly (except is_manual overrides, see
// below). The [event_id, category_id, entry_id, medal] unique index means recalculation is safe to
// re-run: it can never create a duplicate keeping-the-same-medal row.
export const MedalRecords: CollectionConfig = {
  slug: 'medal-records',
  admin: {
    defaultColumns: ['event_id', 'category_id', 'club_id', 'medal', 'source'],
    group: 'Competition Results',
    useAsTitle: 'medal',
  },
  access: {
    create: scopedCreateToUserEvents(canManageSchedule),
    delete: scopedToUserEvents(canManageSchedule),
    read: publicReadScopedToEvent(),
    update: scopedToUserEvents(canManageSchedule),
  },
  indexes: [{ fields: ['event_id', 'category_id', 'entry_id', 'medal'], unique: true }],
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
      name: 'stage_id',
      type: 'relationship',
      relationTo: 'stages',
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
      name: 'club_id',
      type: 'relationship',
      relationTo: 'clubs',
      index: true,
      admin: {
        description:
          'The contingent this medal counts toward. Left empty when the entry could not be traced to a club (individual/pair entry whose player/team has no club_id set) - shown in the "unmapped medals" panel until fixed.',
      },
    },
    {
      name: 'medal',
      type: 'select',
      required: true,
      options: [
        { label: 'Gold', value: 'gold' },
        { label: 'Silver', value: 'silver' },
        { label: 'Bronze', value: 'bronze' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      admin: {
        description: 'How this medal was derived - for audit/debugging, not shown to the public.',
      },
      options: [
        { label: 'Final match', value: 'final_match' },
        { label: 'Bronze Final match', value: 'bronze_match' },
        { label: 'Shared third place (no match)', value: 'shared_bronze' },
        { label: 'Standings rank', value: 'standings_rank' },
        { label: 'Ranking result', value: 'ranking_result' },
        { label: 'Manual override', value: 'manual' },
      ],
    },
    {
      name: 'source_match_id',
      type: 'relationship',
      relationTo: 'matches',
      admin: {
        description: 'The match this medal was decided in, when source is final_match or bronze_match.',
      },
    },
    {
      name: 'is_manual',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description:
          'Set by an admin override rather than derived recalculation. Recalculation never touches or replaces a manual row for the same (category, medal) combination - the manual decision always wins.',
      },
    },
    {
      name: 'note',
      type: 'text',
    },
  ],
  timestamps: true,
}
