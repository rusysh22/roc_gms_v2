import type { CollectionConfig } from 'payload'

import { scopedCreateToUserEvents, scopedToUserEvents } from '@/access/eventScope'
import { canManageParticipants, canReadEventBackoffice } from '@/access/roles'

export const Players: CollectionConfig = {
  slug: 'players',
  admin: {
    defaultColumns: ['name', 'club_id', 'identification_number', 'email', 'gender'],
    group: 'Participants',
    useAsTitle: 'name',
  },
  access: {
    create: scopedCreateToUserEvents(canManageParticipants),
    delete: scopedToUserEvents(canManageParticipants),
    read: scopedToUserEvents(canReadEventBackoffice),
    update: scopedToUserEvents(canManageParticipants),
  },
  // MSG-05: identification_number uniqueness must be scoped per event, not global - it used to be
  // a bare `unique: true` field, which meant the same person's ID collided across two unrelated
  // events. Postgres unique indexes treat NULL as distinct, so players without one (the common
  // case before this field was ever asked for) are unaffected.
  //
  // Deliberately not named "employee_id" - this app runs tournaments for offices, but just as
  // often for schools, clubs, or the general public, none of which have "employees". Whatever ID
  // system the organizer already uses (student ID, member number, staff ID, national ID, or none
  // at all) fits under this one generic name.
  indexes: [{ fields: ['event_id', 'identification_number'], unique: true }],
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
      name: 'identification_number',
      type: 'text',
      admin: {
        description: 'Optional - whatever ID the organizer already uses (student ID, member number, staff ID, etc.).',
      },
      index: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'phone',
          type: 'text',
        },
      ],
    },
    {
      name: 'photo',
      type: 'text',
      admin: {
        description: 'Temporary URL field until the media collection is added.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Prefer Not To Say', value: 'prefer_not_to_say' },
      ],
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  timestamps: true,
}
