import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHero, toOptions } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveCourtAction, saveVenueAction } from './facilityActions'

export const dynamic = 'force-dynamic'
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
    returnTo: '/workspaces/event-admin/facilities',
    workspaceName: 'Facilities Management',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const params = searchParams ? await searchParams : {}
  const editVenue = param(params, 'venue')
  const editCourt = param(params, 'court')
  const [venues, courts, sports] = await Promise.all([
    access.payload.find({ collection: 'venues', depth: 0, limit: 200, sort: 'name' }),
    access.payload.find({ collection: 'courts', depth: 1, limit: 300, sort: 'name' }),
    access.payload.find({ collection: 'sports', depth: 0, limit: 100, sort: 'name' }),
  ])
  const venue = venues.docs.find((item) => String(item.id) === editVenue)
  const court = courts.docs.find((item) => String(item.id) === editCourt)

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Venues and Courts"
        summary="Maintain the active event's locations and playable courts. Schedule-safe relationship validation runs on every save."
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>{venue ? `Edit ${venue.name}` : 'Add venue'}</CardTitle>
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
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>{court ? `Edit ${court.name}` : 'Add court'}</CardTitle>
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
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <CardTitle>Venues</CardTitle>
          {venues.docs.length === 0 ? (
            <EmptyState>No venues yet.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {venues.docs.map((item) => (
                <Link
                  key={item.id}
                  href={`/workspaces/event-admin/facilities?venue=${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-ink">{item.name}</strong>
                    <span className="text-xs font-semibold text-ink-soft">
                      {item.address ? item.address : 'No address specified'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>Courts</CardTitle>
          {courts.docs.length === 0 ? (
            <EmptyState>No courts yet.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {courts.docs.map((item) => (
                <Link
                  key={item.id}
                  href={`/workspaces/event-admin/facilities?court=${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
                >
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-ink">{item.name}</strong>
                    <span className="text-xs font-semibold text-ink-soft">
                      Status: {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>
    </>
  )
}
