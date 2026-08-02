import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { FileUpload } from '@/components/ui/file-upload'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteSponsorAction, saveSponsorAction } from './sponsorActions'

export const dynamic = 'force-dynamic'

const basePage = '/workspaces/event-admin/sponsors'
const sponsorErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a sponsor name and choose a valid tier.',
  invalid_image: 'That file is not an image. Upload a JPG, PNG, SVG, or WebP.',
}

const TIER_TONE: Record<string, 'gold' | 'blue' | 'neutral'> = {
  title: 'gold',
  gold: 'gold',
  silver: 'neutral',
  bronze: 'neutral',
  partner: 'blue',
}

type SponsorDoc = {
  id: string | number
  name: string
  tier: string
  website_url?: string | null
  display_order?: number | null
  logo?: { url?: string; alt?: string } | string | number | null
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function SponsorsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: basePage,
    workspaceName: 'Sponsors',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Event Setup"
          title="Sponsors"
          summary="Add sponsor logos and tiers to show on this event's public page."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const editingId = get(params, 'edit')
  const sponsorError = get(params, 'sponsorError')
  const sponsorUpdated = get(params, 'sponsorUpdated')
  const sponsors = await access.payload.find({
    collection: 'sponsors',
    depth: 1,
    limit: 200,
    sort: ['tier', 'display_order', 'name'],
    where: { event_id: { equals: activeEvent.id } },
  })
  const docs = sponsors.docs as SponsorDoc[]
  const editing = docs.find((sponsor) => String(sponsor.id) === editingId)
  const editingLogo =
    editing?.logo && typeof editing.logo === 'object' ? (editing.logo as { url?: string }) : undefined

  const form = (
    <form action={saveSponsorAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={editing?.id || ''} />
      <Field label="Sponsor name" className="sm:col-span-2">
        <Input name="name" required defaultValue={editing?.name || ''} />
      </Field>
      <Field label="Tier">
        <Select name="tier" defaultValue={editing?.tier || 'partner'}>
          <option value="title">Title Sponsor</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
          <option value="partner">Partner</option>
        </Select>
      </Field>
      <Field label="Display order" description="Lower numbers show first within the same tier.">
        <Input name="displayOrder" type="number" defaultValue={editing?.display_order ?? 0} />
      </Field>
      <Field label="Website URL" optional className="sm:col-span-2">
        <Input name="websiteUrl" type="url" placeholder="https://" defaultValue={editing?.website_url || ''} />
      </Field>
      <Field label="Logo" optional className="sm:col-span-2">
        <FileUpload
          id="sponsor-logo-upload"
          name="logoImage"
          accept="image/*"
          maxSizeBytes={4 * 1024 * 1024}
          existingPreviewUrl={editingLogo?.url}
          existingLabel="Current logo"
          showRemoveOption
          removeFieldName="removeLogo"
        />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">{editing ? 'Save sponsor' : 'Add sponsor'}</SubmitButton>
      </div>
    </form>
  )

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Sponsors"
        summary="Add sponsor logos and tiers to show on this event's public page."
      />

      {sponsorError && sponsorErrorMessages[sponsorError] ? (
        <AlertBanner tone="error" className="mb-4">
          {sponsorErrorMessages[sponsorError]}
        </AlertBanner>
      ) : null}
      {sponsorUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <div className="mb-4 flex items-center justify-end">
        <CrudFormModal
          key={editingId || 'add'}
          title={editing ? `Edit ${editing.name}` : 'Add sponsor'}
          openDefault={Boolean(editing)}
          closeHref={basePage}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add sponsor
            </Button>
          }
        >
          {form}
        </CrudFormModal>
      </div>

      {docs.length === 0 ? (
        <EmptyState>No sponsors added yet.</EmptyState>
      ) : (
        <Table caption="Sponsors">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Website</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((sponsor) => {
              const formId = `delete-sponsor-${sponsor.id}`
              return (
                <TableRow key={sponsor.id}>
                  <TableCell className="font-bold">{sponsor.name}</TableCell>
                  <TableCell>
                    <StatusBadge tone={TIER_TONE[sponsor.tier] || 'neutral'}>{sponsor.tier}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-ink-soft">{sponsor.website_url || '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`${basePage}?edit=${sponsor.id}`}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Link>
                      </Button>
                      <form id={formId} action={deleteSponsorAction}>
                        <input type="hidden" name="id" value={String(sponsor.id)} />
                        <ConfirmDialog
                          trigger={
                            <Button type="button" variant="destructive" size="sm">
                              Delete
                            </Button>
                          }
                          description={`Delete "${sponsor.name}"? This removes it from the public sponsor strip immediately.`}
                          confirmLabel="Delete"
                          confirmButtonProps={{ type: 'submit', form: formId }}
                        />
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </>
  )
}
