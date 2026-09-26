import type { CollectionConfig } from 'payload'

import { scopedToUserEvents } from '@/access/eventScope'
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
    // AUDIT_TOURNAMENT_STANDARDS SEC-05: before/after snapshots can contain another organizer's
    // match/schedule/participant data, and read was a bare global-role check. Now scoped to the
    // caller's events via the event_id recordAuditLog denormalises from the entity (src/lib/
    // audit.ts). Entries that resolved to a null event_id stay super_admin-only.
    read: scopedToUserEvents(canReadEventBackoffice),
    update: () => false,
  },
  fields: [
    {
      name: 'event_id',
      type: 'relationship',
      relationTo: 'events',
      index: true,
      admin: {
        readOnly: true,
        description: 'Denormalised from the audited entity on write - for per-event access scoping.',
      },
    },
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
