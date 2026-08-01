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
    create: isSuperAdmin,
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
      defaultValue: ['content_admin'],
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
      ],
    },
  ],
  timestamps: true,
}
