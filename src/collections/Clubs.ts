import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

export const Clubs: CollectionConfig = {
  slug: 'clubs',
  admin: {
    defaultColumns: ['name', 'event_id', 'contact_person', 'contact_email'],
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
  // event, not global, so two different events can each have their own club
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
      type: 'row',
      fields: [
        {
          name: 'contact_person',
          type: 'text',
        },
        {
          name: 'contact_email',
          type: 'email',
        },
      ],
    },
  ],
  timestamps: true,
}
