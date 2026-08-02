import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveClubAction } from './clubActions'
import { copyParticipantsFromEventAction } from './copyParticipantsActions'

export const dynamic = 'force-dynamic'

const basePage = '/workspaces/event-admin/clubs'
const clubErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a valid club name and email.',
  duplicate_slug: 'That name/slug is already used by another club.',
}
const copyErrorMessages: Record<string, string> = {
  invalid_input: 'Choose a different event to copy from.',
}
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function ClubsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: basePage,
    workspaceName: 'Club Management',
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
          title="Clubs"
          summary="Create and maintain the clubs in the active event without using Advanced Data Administration."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const query = get(params, 'q').toLowerCase()
  const editingId = get(params, 'edit')
  const clubError = get(params, 'clubError')
  const clubUpdated = get(params, 'clubUpdated')
  const copyError = get(params, 'copyError')
  const copySummary = get(params, 'copySummary')
  const [clubs, otherEvents] = await Promise.all([
    access.payload.find({
      collection: 'clubs',
      depth: 0,
      limit: 200,
      sort: 'name',
      where: { event_id: { equals: activeEvent.id } },
    }),
    access.payload.find({
      collection: 'events',
      depth: 0,
      limit: 100,
      sort: '-createdAt',
      where: { id: { not_equals: activeEvent.id } },
    }),
  ])
  const editing = clubs.docs.find((club) => String(club.id) === editingId)
  const visible = clubs.docs.filter(
    (club) => !query || `${club.name} ${club.slug}`.toLowerCase().includes(query),
  )

  const form = (
    <form action={saveClubAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={editing?.id || ''} />
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={editing?.name || ''} />
      </Field>
      <details>
        <summary className="cursor-pointer text-xs font-bold text-ink-soft select-none">
          Advanced: custom URL slug
        </summary>
        <div className="mt-2">
          <Field label="Slug">
            <Input name="slug" defaultValue={editing?.slug || ''} placeholder="generated-from-name" />
          </Field>
        </div>
      </details>
      <Field label="Logo URL">
        <Input name="logo" type="url" defaultValue={editing?.logo || ''} />
      </Field>
      <Field label="Contact person">
        <Input name="contactPerson" defaultValue={editing?.contact_person || ''} />
      </Field>
      <Field label="Contact email">
        <Input name="contactEmail" type="email" defaultValue={editing?.contact_email || ''} />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <Textarea name="description" defaultValue={editing?.description || ''} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">
          {editing ? 'Save club' : 'Add club'}
        </SubmitButton>
      </div>
    </form>
  )

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Clubs"
        summary="Create and maintain the clubs in the active event without using Advanced Data Administration."
      />

      {clubError && clubErrorMessages[clubError] ? (
        <AlertBanner tone="error" className="mb-4">
          {clubErrorMessages[clubError]}
        </AlertBanner>
      ) : null}
      {clubUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}
      {copyError && copyErrorMessages[copyError] ? (
        <AlertBanner tone="error" className="mb-4">
          {copyErrorMessages[copyError]}
        </AlertBanner>
      ) : null}
      {copySummary ? (
        <AlertBanner tone="success" className="mb-4">
          {(() => {
            const [clubsCount, teamsCount, playersCount] = copySummary.split('-')
            return `Copied ${clubsCount} club(s), ${teamsCount} team(s), and ${playersCount} player(s). Duplicates (matched by name) were skipped.`
          })()}
        </AlertBanner>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="flex min-w-0 flex-1 gap-2 sm:max-w-sm" action={basePage}>
          {/* AUDIT_UI_UX_CSS FORM-03/A11Y-01: the one raw Input left without an accessible name
              after the Field-based fixes elsewhere - a compact inline search bar with no visible
              label by design, so an aria-label (not a visible Field label) is the right fit here. */}
          <Input name="q" defaultValue={query} placeholder="Search by name..." aria-label="Search clubs by name" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          {otherEvents.docs.length > 0 ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  Copy from previous event
                </Button>
              </DialogTrigger>
              <DialogContent
                title="Copy participants from a previous event"
                description="Copies clubs, teams, and players by name. Anything already in this event with a matching name is reused, not duplicated."
              >
                <form action={copyParticipantsFromEventAction} className="flex flex-col gap-4">
                  <Field label="Source event">
                    <Select name="sourceEventId" required defaultValue="">
                      <option value="" disabled>
                        Select an event
                      </option>
                      {otherEvents.docs.map((event) => (
                        <option key={event.id} value={String(event.id)}>
                          {event.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <SubmitButton>Copy participants</SubmitButton>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
          <CrudFormModal
            key={editingId || 'add'}
            title={editing ? `Edit ${editing.name}` : 'Add club'}
            openDefault={Boolean(editing)}
            closeHref={basePage}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add club
              </Button>
            }
          >
            {form}
          </CrudFormModal>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState>No clubs found.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact person</TableHead>
              <TableHead>Contact email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((club) => (
              <TableRow key={club.id}>
                <TableCell className="font-bold">{club.name}</TableCell>
                <TableCell className="text-ink-soft">{club.contact_person || '—'}</TableCell>
                <TableCell className="text-ink-soft">{club.contact_email || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`${basePage}?edit=${club.id}`}>
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
    </>
  )
}
