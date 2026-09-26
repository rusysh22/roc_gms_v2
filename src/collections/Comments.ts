import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { resolveEventIdForEntity } from '@/access/entityEventScope'
import { getAccessibleEventIds } from '@/access/eventMembership'
import { scopedToUserEvents } from '@/access/eventScope'
import { canManageMatches, canReadEventBackoffice } from '@/access/roles'
import type { Access } from 'payload'

// AUDIT_TOURNAMENT_STANDARDS SEC-04: a comment targets its entity via (entity_type, entity_id),
// not a real relationship, so it had no event_id to scope on - any scheduler/match_officer could
// read or write internal notes / official notes on another organizer's match through REST/GraphQL/
// Admin. This denormalises the owning event from the target on every write so the access rules
// below can filter by it.
//
// create-time scoping: the event_id isn't on the incoming data yet (denormaliseEventId sets it in
// beforeChange, after access), so resolve it from the target here and check membership directly.
const canCommentOnEntity: Access = async (args) => {
  if (!(await canManageMatches(args))) return false
  const { req, data } = args
  if (!req.user) return false
  const ids = await getAccessibleEventIds(req.payload, req.user)
  if (ids === 'all') return true
  const eventId = await resolveEventIdForEntity(
    req.payload,
    String((data as Record<string, unknown>)?.entity_type ?? ''),
    (data as Record<string, unknown>)?.entity_id as string | number,
  )
  return eventId != null && ids.some((id) => String(id) === String(eventId))
}

const denormaliseEventId: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation === 'update' && data.event_id) return data
  const entityType = String(data.entity_type ?? '')
  const entityId = data.entity_id as string | number | undefined
  if (entityType && entityId != null) {
    data.event_id = await resolveEventIdForEntity(req.payload, entityType, entityId)
  }
  return data
}

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    defaultColumns: [
      'entity_type',
      'entity_id',
      'comment_type',
      'status',
      'author_name',
      'is_pinned',
      'createdAt',
    ],
    group: 'Content',
    useAsTitle: 'body',
  },
  access: {
    // Mutations still gate on capability by role; scopedToUserEvents narrows every read/update/
    // delete to comments whose denormalised event_id the caller is a member of (super_admin sees
    // all). A row that resolved to a null event_id (unknown target / backfill gap) is visible only
    // to super_admin - run `npm run audit:backfill-event` after deploying this.
    create: canCommentOnEntity,
    delete: scopedToUserEvents(canManageMatches),
    read: scopedToUserEvents(canReadEventBackoffice),
    update: scopedToUserEvents(canManageMatches),
  },
  hooks: {
    beforeChange: [denormaliseEventId],
  },
  fields: [
    {
      name: 'event_id',
      type: 'relationship',
      relationTo: 'events',
      index: true,
      admin: {
        readOnly: true,
        description: 'Denormalised from the comment target (entity_type/entity_id) on write - for per-event access scoping.',
      },
    },
    {
      name: 'entity_type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Match', value: 'matches' },
        { label: 'Article', value: 'articles' },
        { label: 'Announcement', value: 'announcements' },
        { label: 'Documentation Asset', value: 'documentation-assets' },
        { label: 'Event', value: 'events' },
      ],
    },
    {
      name: 'entity_id',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Stores the target document id as text so comments can target multiple entity types.',
      },
    },
    {
      name: 'comment_type',
      type: 'select',
      required: true,
      defaultValue: 'internal',
      index: true,
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Internal', value: 'internal' },
        { label: 'Official Note', value: 'official_note' },
      ],
    },
    {
      name: 'author_name',
      type: 'text',
      required: true,
      defaultValue: 'System / Unknown',
    },
    {
      name: 'author_user_id',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Left empty when the author has no authenticated backoffice session.',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Hidden', value: 'hidden' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Deleted', value: 'deleted' },
      ],
    },
    {
      name: 'is_pinned',
      type: 'checkbox',
      defaultValue: false,
      index: true,
    },
    {
      name: 'resolved_at',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'parent_comment_id',
      type: 'relationship',
      relationTo: 'comments',
      index: true,
    },
  ],
  timestamps: true,
}
