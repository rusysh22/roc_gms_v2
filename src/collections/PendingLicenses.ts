import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '@/access/roles'

// A Berlanggan `license.issued` webhook arrives keyed by the buyer's *checkout* email, which is the
// only link back to an InTourney account. When no user has that email yet - the buyer paid before
// signing up, or used a different address - the license can't be activated onto an account, so it
// waits here. src/lib/berlanggan/claimPendingLicense.ts drains this: on any gated request,
// checkSubscription looks for a row matching the signed-in user's email and activates it, then
// deletes the row. Renewal/suspend/revoke webhooks that land before the claim also update the
// matching row here so a stale expiry date is never activated later.
//
// Every write goes through the Local API with overrideAccess: true (webhook route + claim helper).
// The access block only governs direct Payload Admin/REST/GraphQL visibility - super_admin only,
// for support ("did the webhook for this customer ever arrive?").
export const PendingLicenses: CollectionConfig = {
  slug: 'pending-licenses',
  admin: {
    group: 'Billing',
    defaultColumns: ['email', 'license_key', 'license_expires_at', 'last_event', 'updatedAt'],
    useAsTitle: 'email',
  },
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  indexes: [{ fields: ['email'], unique: true }],
  fields: [
    {
      name: 'email',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Lowercased buyer email from the Berlanggan checkout - matched against Users.email.',
      },
    },
    { name: 'license_key', type: 'text', required: true },
    {
      name: 'license_expires_at',
      type: 'date',
      admin: { description: 'Commercial "valid until" from Berlanggan - null for a perpetual/one-time license.' },
    },
    { name: 'entitlements', type: 'json' },
    { name: 'seat_limit', type: 'number' },
    { name: 'plan', type: 'text' },
    { name: 'order_public_id', type: 'text' },
    {
      name: 'last_event',
      type: 'text',
      admin: { description: 'The most recent Berlanggan webhook event applied to this pending row.' },
    },
  ],
  timestamps: true,
}
