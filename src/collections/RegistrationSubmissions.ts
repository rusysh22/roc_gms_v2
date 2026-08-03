import type { CollectionConfig } from 'payload'

import { canManageEventStructure } from '@/access/roles'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 2: "Registration portal dan approval queue". A
// submission is deliberately NOT a CompetitionEntry/Club/Team/Player directly - it's unvetted
// input from an anonymous public visitor (name typos, duplicate clubs, spam) that staff review
// before it becomes real participant data. Approving a submission (see
// src/app/(frontend)/workspaces/(shell)/event-admin/registrations/registrationActions.ts)
// creates/reuses the actual Club/Team/Player/CompetitionEntry records and links back here via the
// created_*_id fields; rejecting one just records why, with nothing else touched.
//
// Access is staff-only at the collection boundary, same as every other participant collection
// (canManageEventStructure) - the public registration form's server action still succeeds because
// Payload's Local API defaults `overrideAccess` to true for trusted server-side code. This is the
// first collection in the app a public visitor can cause a row to be written to; the actual abuse
// mitigation (rate limit, honeypot, registration-window check) lives in the server action, not
// here - collection access alone can't express "only through my own form."
export const RegistrationSubmissions: CollectionConfig = {
  slug: 'registration-submissions',
  admin: {
    defaultColumns: ['display_name', 'category_id', 'status', 'contact_email', 'createdAt'],
    group: 'Participants',
    useAsTitle: 'display_name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: canManageEventStructure,
    update: canManageEventStructure,
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
      name: 'category_id',
      type: 'relationship',
      relationTo: 'competition-categories',
      required: true,
      index: true,
    },
    {
      name: 'participant_mode',
      type: 'select',
      required: true,
      admin: {
        description: "Snapshot of the category's participant mode at submission time.",
      },
      options: [
        { label: 'Individual', value: 'individual' },
        { label: 'Pair', value: 'pair' },
        { label: 'Team', value: 'team' },
        { label: 'Club', value: 'club' },
      ],
    },
    {
      name: 'display_name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the athlete, pair, team, or club being registered.',
      },
    },
    {
      name: 'club_name',
      type: 'text',
      admin: {
        description: 'Free-text club/organization affiliation - reconciled against real Club records on approval, not validated at submission time.',
      },
    },
    {
      name: 'roster',
      type: 'array',
      admin: {
        description: 'One row per person - exactly 1 for individual, exactly 2 for pair, any number for team. Empty for club entries.',
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          type: 'row',
          fields: [
            { name: 'email', type: 'email' },
            { name: 'phone', type: 'text' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'contact_name', type: 'text', required: true },
        { name: 'contact_email', type: 'email', required: true },
        { name: 'contact_phone', type: 'text' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Anything the submitter added - allergies, special requests, etc.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending Review', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'review_notes',
      type: 'textarea',
      admin: {
        description: 'Staff-only - required when rejecting, optional when approving.',
      },
    },
    {
      name: 'reviewed_by',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
    {
      name: 'reviewed_at',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'created_club_id', type: 'relationship', relationTo: 'clubs', index: true },
        { name: 'created_team_id', type: 'relationship', relationTo: 'teams', index: true },
      ],
    },
    {
      name: 'created_player_ids',
      type: 'relationship',
      relationTo: 'players',
      hasMany: true,
    },
    {
      name: 'created_entry_id',
      type: 'relationship',
      relationTo: 'competition-entries',
      index: true,
    },
    {
      name: 'submitter_ip',
      type: 'text',
      admin: {
        description: 'Best-effort IP captured at submission time, for abuse investigation only.',
      },
    },
  ],
  timestamps: true,
}
