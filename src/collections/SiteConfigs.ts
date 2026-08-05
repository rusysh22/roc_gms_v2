import type { CollectionConfig } from 'payload'

import { isSuperAdmin, isSystemAdmin } from '@/access/roles'

export const SiteConfigs: CollectionConfig = {
  slug: 'site-configs',
  admin: {
    defaultColumns: ['site_name', 'timezone', 'default_language', 'maintenance_mode'],
    group: 'System',
    useAsTitle: 'site_name',
  },
  access: {
    create: isSystemAdmin,
    delete: isSuperAdmin,
    read: () => true,
    update: isSystemAdmin,
  },
  fields: [
    {
      name: 'site_name',
      type: 'text',
      required: true,
      defaultValue: 'InTourney',
    },
    {
      name: 'site_logo',
      type: 'text',
      admin: {
        description: 'Temporary URL field until the media collection is added.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'primary_color',
          type: 'text',
          required: true,
          defaultValue: '#116466',
        },
        {
          name: 'secondary_color',
          type: 'text',
          required: true,
          defaultValue: '#f2a541',
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'timezone',
          type: 'text',
          required: true,
          defaultValue: 'Asia/Jakarta',
          admin: {
            description:
              'Not currently read by any date/time display - each event now has its own timezone field (Events.timezone) that every schedule/match/bracket formatter actually uses. Kept here as a general site setting, not wired to formatting.',
          },
        },
        {
          name: 'default_language',
          type: 'select',
          required: true,
          defaultValue: 'en',
          options: [
            {
              label: 'English',
              value: 'en',
            },
            {
              label: 'Indonesian',
              value: 'id',
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'contact_email',
          type: 'email',
        },
        {
          name: 'contact_phone',
          type: 'text',
        },
      ],
    },
    {
      name: 'public_domain',
      type: 'text',
    },
    {
      name: 'maintenance_mode',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'default_share_image',
      type: 'text',
      admin: {
        description: 'Temporary URL field until the media collection is added.',
      },
    },
  ],
  timestamps: true,
}
