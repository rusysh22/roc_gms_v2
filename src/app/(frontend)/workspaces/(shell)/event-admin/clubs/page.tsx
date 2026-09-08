import { Plus } from 'lucide-react'
import type { Where } from 'payload'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { DataTableToolbar } from '@/components/ui/data-table-toolbar'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ListIO } from '@/components/ui/list-io'
import { Pagination } from '@/components/ui/pagination'
import { RowActions } from '@/components/ui/row-actions'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteClubAction, saveClubAction } from './clubActions'
import { copyParticipantsFromEventAction } from './copyParticipantsActions'

export const dynamic = 'force-dynamic'

const basePage = '/workspaces/event-admin/clubs'
const clubErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a valid club name and email.',
  invalid_relationship: 'That club does not belong to the active event.',
  duplicate_slug: 'That name/slug is already used by another club.',
  club_in_use: 'This club still has players, teams, or entries - remove those first.',
}
const copyErrorMessages: Record<string, string> = {
  invalid_input: 'Choose a different event to copy from.',
}
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function ClubsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.draw,
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
  const query = get(params, 'q')
  const editingId = get(params, 'edit')
  const page = Math.max(1, Number(get(params, 'page')) || 1)
  const clubError = get(params, 'clubError')
  const clubUpdated = get(params, 'clubUpdated')
  const copyError = get(params, 'copyError')
  const copySummary = get(params, 'copySummary')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const listWhere: Where = query
    ? { and: [eventWhere, { or: [{ name: { contains: query } }, { slug: { contains: query } }] }] }
    : eventWhere
  const [clubs, otherEvents, editingDoc] = await Promise.all([
    access.payload.find({ collection: 'clubs', depth: 0, limit: 50, page, sort: 'name', where: listWhere }),
    access.payload.find({
      collection: 'events',
      depth: 0,
      limit: 100,
      sort: '-createdAt',
      where: { id: { not_equals: activeEvent.id } },
    }),
    editingId
      ? access.payload.findByID({ collection: 'clubs', id: editingId, depth: 0 }).catch(() => null)
      : null,
  ])
  const editing = editingDoc || undefined

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
        <SubmitButton className="w-full sm:w-auto">{editing ? 'Save club' : 'Add club'}</SubmitButton>
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

      <DataTableToolbar
        action={basePage}
        searchName="q"
        searchDefaultValue={query}
        searchPlaceholder="Search by name..."
        searchLabel="Search clubs by name"
        io={
          <>
            <ListIO menu="clubs" label="clubs" />
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
          </>
        }
        actions={
          <>
            <p className="text-sm font-semibold text-ink-soft whitespace-nowrap">{clubs.totalDocs} clubs</p>
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
          </>
        }
      />

      {clubs.docs.length === 0 ? (
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
            {clubs.docs.map((club) => (
              <TableRow key={club.id}>
                <TableCell className="font-bold">{club.name}</TableCell>
                <TableCell className="text-ink-soft">{club.contact_person || '—'}</TableCell>
                <TableCell className="text-ink-soft">{club.contact_email || '—'}</TableCell>
                <TableCell className="text-right">
                  <RowActions
                    editHref={`${basePage}?edit=${club.id}`}
                    deleteAction={deleteClubAction}
                    deleteId={club.id}
                    deleteDescription={`Delete "${club.name}"? Only allowed if it has no players, teams, or entries.`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {clubs.docs.length > 0 ? (
        <Pagination
          page={clubs.page || 1}
          totalPages={clubs.totalPages || 1}
          hasPrevPage={Boolean(clubs.hasPrevPage)}
          hasNextPage={Boolean(clubs.hasNextPage)}
          totalDocs={clubs.totalDocs}
          buildHref={(targetPage) => {
            const url = new URLSearchParams()
            if (query) url.set('q', query)
            url.set('page', String(targetPage))
            return `${basePage}?${url.toString()}`
          }}
        />
      ) : null}
    </>
  )
}
