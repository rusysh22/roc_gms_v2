import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

export const Teams: CollectionConfig = {
  slug: 'teams',
  admin: {
    defaultColumns: ['name', 'club_id', 'captain_player_id', 'contact_email'],
    group: 'Participants',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: publicReadScopedToEvent(),
    update: canManageEventStructure,
  },
  // NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 9: slug uniqueness must be scoped per
  // event, not global, so two different events can each have their own team
  // slug without colliding at the DB level.
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
      name: 'club_id',
      type: 'relationship',
      relationTo: 'clubs',
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
      name: 'logo',
      type: 'text',
      admin: {
        description: 'Temporary URL field until the media collection is added.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'captain_player_id',
      type: 'relationship',
      relationTo: 'players',
      index: true,
    },
    {
      name: 'contact_email',
      type: 'email',
    },
  ],
  timestamps: true,
}
