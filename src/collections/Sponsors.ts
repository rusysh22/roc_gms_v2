import type { CollectionConfig } from 'payload'

import { publicReadScopedToEvent } from '@/access/eventVisibility'
import { canManageEventStructure } from '@/access/roles'

// AUDIT_UI_UX_CSS PUB-10/P2 item 5: "sponsor/partner belum menjadi bagian appearance/public
// design" - no data model existed for this at all. `tier` drives display grouping/sizing on the
// public sponsor strip (title sponsors shown larger than partners); `display_order` is a manual
// override for cases where alphabetical/tier ordering isn't what an organizer's actual sponsorship
// agreement calls for.
export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  admin: {
    defaultColumns: ['name', 'event_id', 'tier', 'display_order'],
    group: 'Participants',
    useAsTitle: 'name',
  },
  access: {
    create: canManageEventStructure,
    delete: canManageEventStructure,
    read: publicReadScopedToEvent(),
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
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'tier',
      type: 'select',
      defaultValue: 'partner',
      options: [
        { label: 'Title Sponsor', value: 'title' },
        { label: 'Gold', value: 'gold' },
        { label: 'Silver', value: 'silver' },
        { label: 'Bronze', value: 'bronze' },
        { label: 'Partner', value: 'partner' },
      ],
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Shown on the public event page. Transparent PNG/SVG recommended.',
      },
    },
    {
      name: 'website_url',
      type: 'text',
      admin: {
        description: 'Optional - the logo links here on the public page if set.',
      },
    },
    {
      name: 'display_order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers show first within the same tier.',
      },
    },
  ],
  timestamps: true,
}
