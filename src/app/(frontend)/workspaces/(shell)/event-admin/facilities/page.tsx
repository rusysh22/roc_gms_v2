import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, toOptions } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveCourtAction, saveVenueAction } from './facilityActions'

export const dynamic = 'force-dynamic'
const basePage = '/workspaces/event-admin/facilities'
const facilityErrorMessages: Record<string, string> = {
  invalid_venue: 'Fill in a valid venue name.',
  invalid_court: 'Fill in a valid court name, venue, and capacity.',
  invalid_relationship: 'The selected venue/sport does not belong to the active event.',
}
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const param = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

const CheckboxField = ({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) => (
  <label className="flex items-center gap-2 text-sm font-semibold text-ink">
    <input
      type="checkbox"
      name={name}
      defaultChecked={defaultChecked}
      className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
    />
    {label}
  </label>
)

export default async function FacilitiesPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: basePage,
    workspaceName: 'Facilities Management',
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
          title="Venues and Courts"
          summary="Maintain the active event's locations and playable courts. Schedule-safe relationship validation runs on every save."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const editVenue = param(params, 'venue')
  const editCourt = param(params, 'court')
  const facilityError = param(params, 'facilityError')
  const venueUpdated = param(params, 'venueUpdated')
  const courtUpdated = param(params, 'courtUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const [venues, courts, sports] = await Promise.all([
    access.payload.find({ collection: 'venues', depth: 0, limit: 200, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'courts', depth: 1, limit: 300, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'sports', depth: 0, limit: 100, sort: 'name', where: eventWhere }),
  ])
  const venue = venues.docs.find((item) => String(item.id) === editVenue)
  const court = courts.docs.find((item) => String(item.id) === editCourt)

  const venueForm = (
    <form action={saveVenueAction} className="grid gap-4">
      <input type="hidden" name="id" value={venue?.id || ''} />
      <Field label="Name">
        <Input name="name" required defaultValue={venue?.name || ''} />
      </Field>
      <Field label="Address">
        <Textarea name="address" defaultValue={venue?.address || ''} />
      </Field>
      <Field label="Map URL">
        <Input name="mapUrl" type="url" defaultValue={venue?.map_url || ''} />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={venue?.description || ''} />
      </Field>
      <CheckboxField name="isVirtual" label="Virtual venue" defaultChecked={Boolean(venue?.is_virtual)} />
      <Field label="Virtual URL">
        <Input name="virtualUrl" type="url" defaultValue={venue?.virtual_url || ''} />
      </Field>
      <Button type="submit">Save venue</Button>
    </form>
  )

  const courtForm = (
    <form action={saveCourtAction} className="grid gap-4">
      <input type="hidden" name="id" value={court?.id || ''} />
      <Field label="Name">
        <Input name="name" required defaultValue={court?.name || ''} />
      </Field>
      <Field label="Venue">
        <Select
          name="venueId"
          required
          defaultValue={
            typeof court?.venue_id === 'object' ? String(court.venue_id?.id || '') : String(court?.venue_id || '')
          }
        >
          <option value="">Select venue</option>
          {toOptions(venues.docs).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Sport">
        <Select
          name="sportId"
          defaultValue={
            typeof court?.sport_id === 'object' ? String(court.sport_id?.id || '') : String(court?.sport_id || '')
          }
        >
          <option value="">Any sport</option>
          {toOptions(sports.docs).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Capacity">
        <Input name="capacity" type="number" min="0" defaultValue={court?.capacity ?? ''} />
      </Field>
      <CheckboxField name="isActive" label="Active" defaultChecked={court ? Boolean(court.is_active) : true} />
      <Button type="submit">Save court</Button>
    </form>
  )

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Venues and Courts"
        summary="Maintain the active event's locations and playable courts. Schedule-safe relationship validation runs on every save."
      />

      {facilityError && facilityErrorMessages[facilityError] ? (
        <AlertBanner tone="error" className="mb-4">
          {facilityErrorMessages[facilityError]}
        </AlertBanner>
      ) : null}
      {venueUpdated || courtUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-ink">Venues ({venues.totalDocs})</h2>
          <CrudFormModal
            key={editVenue || 'add-venue'}
            title={venue ? `Edit ${venue.name}` : 'Add venue'}
            openDefault={Boolean(venue)}
            closeHref={basePage}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add venue
              </Button>
            }
          >
            {venueForm}
          </CrudFormModal>
        </div>
        {venues.docs.length === 0 ? (
          <EmptyState>No venues yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.docs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">{item.name}</TableCell>
                  <TableCell className="text-ink-soft">{item.address || '—'}</TableCell>
                  <TableCell className="text-ink-soft">{item.is_virtual ? 'Virtual' : 'Physical'}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}?venue=${item.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-ink">Courts ({courts.totalDocs})</h2>
          <CrudFormModal
            key={editCourt || 'add-court'}
            title={court ? `Edit ${court.name}` : 'Add court'}
            openDefault={Boolean(court)}
            closeHref={basePage}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add court
              </Button>
            }
          >
            {courtForm}
          </CrudFormModal>
        </div>
        {courts.docs.length === 0 ? (
          <EmptyState>No courts yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courts.docs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">{item.name}</TableCell>
                  <TableCell className="text-ink-soft">
                    {typeof item.venue_id === 'object' ? item.venue_id?.name : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={item.is_active ? 'green' : 'neutral'}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}?court=${item.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  )
}
