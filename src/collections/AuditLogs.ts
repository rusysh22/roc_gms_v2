import type { CollectionConfig } from 'payload'

import { canReadEventBackoffice, isSuperAdmin } from '@/access/roles'

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    defaultColumns: ['action', 'entity_type', 'entity_id', 'actor_user_id', 'createdAt'],
    group: 'System',
    useAsTitle: 'action',
  },
  access: {
    create: () => false,
    delete: isSuperAdmin,
    read: canReadEventBackoffice,
    update: () => false,
  },
  fields: [
    {
      name: 'actor_user_id',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Left empty when the action was performed without an authenticated session.',
      },
    },
    {
      name: 'action',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Dot-notation action key, e.g. match.status_transition.',
      },
    },
    {
      name: 'entity_type',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'entity_id',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'before_snapshot',
      type: 'json',
    },
    {
      name: 'after_snapshot',
      type: 'json',
    },
  ],
  timestamps: true,
}
