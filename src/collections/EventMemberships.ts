import type { CollectionConfig } from 'payload'

import { canReadEventBackoffice, isSystemAdmin } from '@/access/roles'

// AUDIT_E2E AUTH-01: roles on Users are global, so any event_admin/scheduler/match_officer/
// content_admin could operate on *every* event in the system, not just the ones they were
// actually assigned to. This collection is the scope boundary - see src/access/eventMembership.ts
// for how it's enforced in the active-event switcher, and Events.ts for the hook that
// auto-enrolls an event's creator as its first member.
export const EventMemberships: CollectionConfig = {
  slug: 'event-memberships',
  admin: {
    defaultColumns: ['event_id', 'user_id', 'roles', 'updatedAt'],
    group: 'System',
    useAsTitle: 'user_id',
  },
  access: {
    create: isSystemAdmin,
    delete: isSystemAdmin,
    read: canReadEventBackoffice,
    update: isSystemAdmin,
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
      name: 'user_id',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      admin: {
        description:
          'Optional note of which roles this member acts as on this event. The member\'s account-level roles (Users.roles) still determine what they can actually do - this field does not grant extra capability by itself.',
      },
      options: [
        { label: 'Super Admin', value: 'super_admin' },
        { label: 'Event Admin', value: 'event_admin' },
        { label: 'Scheduler', value: 'scheduler' },
        { label: 'Match Officer', value: 'match_officer' },
        { label: 'Content Admin', value: 'content_admin' },
        { label: 'Registration', value: 'registration' },
        { label: 'Draw', value: 'draw' },
      ],
    },
    // MSG-06: the one field on this collection that actually narrows capability rather than just
    // annotating it - see the comment at the top of this file. Empty (the default) means "every
    // sport", so every existing membership row keeps behaving exactly as before. Enforced in
    // enforceMatchSportScope (src/access/roles.ts), which runs on every Matches mutation path
    // (Local API, REST, GraphQL, Payload Admin), not just the custom workspace UI.
    {
      name: 'sport_ids',
      type: 'relationship',
      relationTo: 'sports',
      hasMany: true,
      filterOptions: ({ data }) => ({ event_id: { equals: data?.event_id } }),
      admin: {
        description:
          'Restrict this member to specific sports. Leave empty for all sports. This field can only narrow what the member may do - it never grants capability their account roles lack.',
      },
    },
  ],
  timestamps: true,
}
