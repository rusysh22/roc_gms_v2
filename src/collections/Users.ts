import type { CollectionConfig } from 'payload'

import { canReadAdminField, isAuthenticated, isSuperAdmin } from '@/access/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    defaultColumns: ['name', 'email', 'roles', 'updatedAt'],
    group: 'System',
    useAsTitle: 'email',
  },
  // AUDIT_E2E SEC-02: no login rate limiting/abuse protection existed at all - Payload's own
  // built-in lockout (not a bolt-on) blocks credential-stuffing/brute-force against /api/users/
  // login after repeated failures, per-account, without needing a new dependency or middleware.
  auth: {
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  access: {
    // Open self-registration (product decision, not previously supported): anyone can create an
    // account via POST /api/users (the /register page), same endpoint the admin panel already used
    // for super-admin-created accounts. Safe to open because `roles` below has its own field-level
    // access requiring super_admin to *set* it - a public registration always falls through to that
    // field's defaultValue (['event_admin']), so this can never be used to self-grant super_admin
    // or any other role. event_admin - not a lower role - is the deliberate default: a new signup
    // should be able to build their own event immediately (src/collections/Events.ts's
    // enrollCreatorAsMember auto-enrolls them as its first member), and every event-scoped
    // collection's access control (src/access/eventScope.ts) narrows that role down to only the
    // events they created/were added to - so this never grants reach into anyone else's event.
    create: () => true,
    delete: isSuperAdmin,
    read: isAuthenticated,
    update: isSuperAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      // Self-registration's effective default (see the `create` access comment above) - grants
      // full event_admin capability, but scoped per-event by src/access/eventScope.ts, so a new
      // signup can run their own event without being able to touch anyone else's.
      defaultValue: ['event_admin'],
      access: {
        create: canReadAdminField,
        read: canReadAdminField,
        update: canReadAdminField,
      },
      options: [
        {
          label: 'Super Admin',
          value: 'super_admin',
        },
        {
          label: 'Event Admin',
          value: 'event_admin',
        },
        {
          label: 'Scheduler',
          value: 'scheduler',
        },
        {
          label: 'Match Officer',
          value: 'match_officer',
        },
        {
          label: 'Content Admin',
          value: 'content_admin',
        },
        {
          label: 'Registration',
          value: 'registration',
        },
        {
          label: 'Draw',
          value: 'draw',
        },
      ],
    },
  ],
  timestamps: true,
}
