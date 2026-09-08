import type { CollectionConfig } from 'payload'

import { isSuperAdmin, type UserRole } from '@/access/roles'

// One row per InTourney user, tracking that account's Berlanggan (berlanggan.web.id) subscription
// license - see src/lib/berlanggan/ for the API client and src/app/(frontend)/workspaces/
// workspaceAuth.tsx for where this gates /workspaces access. Kept as its own collection rather
// than fields on Users (whose access.update is isSuperAdmin-only, see Users.ts) because license
// state must be writable by system-level Server Action code acting on behalf of a non-super_admin
// user activating their own subscription - same "different write-actor" reason EventMemberships
// is its own collection instead of fields on Events/Users.
//
// Every real write to this collection goes through the Local API with overrideAccess: true (from
// activateLicenseAction.ts and subscriptionGate.ts's lazy revalidation) - the access block below
// only governs what a signed-in user can see/do to this collection directly (Payload Admin, REST,
// GraphQL), not the system-level gating/activation code path.
export const Licenses: CollectionConfig = {
  slug: 'licenses',
  admin: {
    group: 'Billing',
    defaultColumns: ['user_id', 'effective_status', 'license_expires_at', 'last_validated_at'],
    useAsTitle: 'license_key',
  },
  access: {
    // Real creates happen server-side (overrideAccess: true) from activateLicenseAction.ts - no
    // self-service "create my own license row" surface, so this stays super_admin-only rather
    // than open.
    create: isSuperAdmin,
    // A user may read their own license row (a future self-service "my subscription" screen would
    // rely on this); a super_admin may read any row for support/debugging.
    read: ({ req }) => {
      if (!req.user) return false
      const roles = (req.user as { roles?: UserRole[] | null }).roles
      if (roles?.includes('super_admin')) return true
      return { user_id: { equals: req.user.id } }
    },
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  indexes: [{ fields: ['user_id'], unique: true }],
  fields: [
    {
      name: 'user_id',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'license_key',
      type: 'text',
      required: true,
      admin: {
        description:
          'The Berlanggan license key this account activated (or "GRANDFATHERED" for a manually-seeded internal record - see src/scripts/grandfatherLicenses.ts).',
      },
    },
    {
      name: 'fingerprint',
      type: 'text',
      required: true,
      admin: {
        description: 'sha256(userId + BERLANGGAN_FINGERPRINT_PEPPER) - stored for audit/debugging only.',
      },
    },
    { name: 'token', type: 'text', admin: { description: 'Last activation/validate heartbeat token.' } },
    { name: 'token_expires_at', type: 'date' },
    { name: 'license_expires_at', type: 'date' },
    {
      name: 'effective_status',
      type: 'select',
      required: true,
      defaultValue: 'not_activated',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Grace period', value: 'grace' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Not activated', value: 'not_activated' },
      ],
    },
    {
      name: 'entitlements',
      type: 'json',
      admin: { description: 'Cached {key: value} entitlements from the last successful activate/validate.' },
    },
    { name: 'last_validated_at', type: 'date' },
    {
      name: 'last_error',
      type: 'text',
      admin: { description: 'Last Berlanggan error message, if any - for support debugging.' },
    },
  ],
  timestamps: true,
}
