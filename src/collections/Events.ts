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
      // MSG-12: added so the Setup Assistant's first question can be "how big is your event"
      // (always answerable) instead of a single tournament format/participant mode that a
      // multi-sport event can't honestly answer at the event level - see SetupStep. Purely a
      // pre-fill signal, like the other setup_* fields; never read by anything outside the wizard.
      name: 'setup_event_scale',
      type: 'select',
      admin: {
        description:
          'Set by the wizard\'s Setup Assistant (Step 0) - whether the organizer described this as a single-sport or multi-sport event. Changes the wording of the format question that follows. Optional; leave empty if skipped.',
      },
      options: [
        { label: 'Single sport', value: 'single_sport' },
        { label: 'Multi-sport', value: 'multi_sport' },
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
          // MSG-12: the question that fills this is no longer asked in the Setup Assistant (MSG-07
          // moved "who's competing" to the per-category catalog picker, where it belongs - a
          // multi-sport event's participant mode genuinely varies by category, so one event-level
          // answer was never honest for it). The field itself stays, and CategoriesStep still reads
          // it for pre-fill, so an event that answered this before MSG-12 shipped keeps behaving
          // exactly as it did - removing the field would be a migration with no upside.
          name: 'setup_participant_mode',
          type: 'select',
          admin: {
            description:
              'No longer asked in the Setup Assistant as of MSG-12 (multi-sport events can\'t answer it honestly at the event level - see setup_event_scale). Still read for pre-fill by any event that answered it before then.',
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
      name: 'setup_participant_source',
      type: 'select',
      admin: {
        description:
          'Set by the wizard\'s Setup Assistant (Step 0) - where the admin said their participant data currently lives. Used to highlight the relevant path in the Participants step (e.g. Bulk Import for "Excel/CSV"). Optional; leave empty if skipped.',
      },
      options: [
        { label: 'Not entered yet - manual entry', value: 'manual' },
        { label: 'Excel/CSV file', value: 'excel' },
        { label: 'Participants will self-register', value: 'registration_form' },
        { label: 'Copied from a previous event', value: 'copy_previous' },
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
    {
      name: 'medal_tally_enabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'MSG-02: turns on the medal tally / overall contingent standings feature for this event - the public /medals page, the workspace medals page, and automatic medal derivation when a category finishes. Off by default so existing events are unaffected.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'medal_ranking_method',
          type: 'select',
          defaultValue: 'gold_first',
          admin: {
            description: 'How contingents are ranked against each other on the medal tally.',
          },
          options: [
            { label: 'Most gold first (Olympic-style)', value: 'gold_first' },
            { label: 'Weighted points', value: 'weighted_points' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'medal_points_gold',
          type: 'number',
          min: 0,
          defaultValue: 3,
          admin: { description: 'Only used when medal_ranking_method is weighted_points.' },
        },
        {
          name: 'medal_points_silver',
          type: 'number',
          min: 0,
          defaultValue: 2,
          admin: { description: 'Only used when medal_ranking_method is weighted_points.' },
        },
        {
          name: 'medal_points_bronze',
          type: 'number',
          min: 0,
          defaultValue: 1,
          admin: { description: 'Only used when medal_ranking_method is weighted_points.' },
        },
      ],
    },
  ],
  timestamps: true,
}
