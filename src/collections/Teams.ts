import type { CollectionConfig } from 'payload'

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
    read: () => true,
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
      unique: true,
      index: true,
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
