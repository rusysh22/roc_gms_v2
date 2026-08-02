import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'

import { publicReadEvents } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

// AUDIT_E2E AUTH-01: enrolls the creating user as this event's first EventMemberships row, so a
// brand-new event starts life scoped to its own creator instead of open to every global role
// holder in the system. Best-effort (logged, not fatal) - the event itself must still get created
// even if this enrollment fails.
const enrollCreatorAsMember: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation !== 'create' || !req.user) {
    return doc
  }

  try {
    await req.payload.create({
      collection: 'event-memberships',
      data: { event_id: doc.id, user_id: req.user.id },
    })
  } catch (error) {
    req.payload.logger.error(`Failed to auto-enroll creator as member of event ${doc.id}: ${error}`)
  }

  return doc
}

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    defaultColumns: ['name', 'status', 'visibility', 'event_start_at', 'event_end_at'],
    group: 'Event Setup',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: publicReadEvents,
    update: canManageEventStructure,
  },
  hooks: {
    afterChange: [enrollCreatorAsMember],
  },
  fields: [
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
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'hero_tagline',
      type: 'text',
      admin: {
        description:
          'Short headline shown on this event\'s public hero (e.g. "Smash Your Way to Glory"). Falls back to the event name if empty.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Optional event logo/badge - shown next to the event name.',
      },
    },
    {
      name: 'banner_image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero image shown on this event\'s public page. Compressed automatically on upload.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'event_start_at',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'event_end_at',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'public_open_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'If empty, public access opens seven days before event_start_at.',
          },
        },
        {
          name: 'registration_open_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'registration_close_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
        {
          name: 'schedule_publish_at',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      name: 'archive_at',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Setup', value: 'setup' },
            { label: 'Coming Soon', value: 'coming_soon' },
            { label: 'Live', value: 'live' },
            { label: 'Completed', value: 'completed' },
            { label: 'Archived', value: 'archived' },
          ],
        },
        {
          name: 'visibility',
          type: 'select',
          required: true,
          defaultValue: 'hidden',
          options: [
            { label: 'Hidden', value: 'hidden' },
            { label: 'Coming Soon', value: 'coming_soon' },
            { label: 'Preview Only', value: 'preview_only' },
            { label: 'Published', value: 'published' },
            { label: 'Archived', value: 'archived' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'setup_tournament_type',
          type: 'select',
          admin: {
            description:
              'Set by the wizard\'s Setup Assistant (Step 0) - pre-selects the Categories step\'s format picker. Optional; leave empty if skipped.',
          },
          options: [
            { label: 'Single Elimination', value: 'single_elimination' },
            { label: 'Round Robin', value: 'round_robin' },
            { label: 'Group Stage to Knockout', value: 'group_stage_to_knockout' },
            { label: 'League', value: 'league' },
          ],
        },
        {
          name: 'setup_participant_mode',
          type: 'select',
          admin: {
            description:
              'Set by the wizard\'s Setup Assistant (Step 0) - pre-selects the Categories step\'s "who\'s competing" choice card. Optional; leave empty if skipped.',
          },
          options: [
            { label: 'Individual player', value: 'individual' },
            { label: 'Pair', value: 'pair' },
            { label: 'Team', value: 'team' },
            { label: 'Club / delegation', value: 'club' },
          ],
        },
      ],
    },
    {
      name: 'location',
      type: 'text',
    },
    {
      name: 'organizer_name',
      type: 'text',
    },
    {
      name: 'contact_email',
      type: 'email',
      admin: {
        description: 'Shown on the public page footer for visitor inquiries.',
      },
    },
    {
      name: 'rules_summary',
      type: 'textarea',
    },
    {
      name: 'theme_config',
      type: 'json',
    },
  ],
  timestamps: true,
}
