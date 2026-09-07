import { Plus } from 'lucide-react'
import type { Where } from 'payload'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ComboboxField } from '@/components/ui/combobox'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { DataTableToolbar } from '@/components/ui/data-table-toolbar'
import { DetailModal } from '@/components/ui/detail-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ListIO } from '@/components/ui/list-io'
import { Pagination } from '@/components/ui/pagination'
import { RowActions } from '@/components/ui/row-actions'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, toOptions } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteCompetitionEntryAction, saveCompetitionEntryAction } from './entryActions'

export const dynamic = 'force-dynamic'
const basePage = '/workspaces/event-admin/entries'
const entryErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a display name, category, and a valid seed/status.',
  invalid_relationship: 'The selected player/team/club does not belong to the active event.',
  entry_in_use: 'This entry is used by a match, standing, or medal record - it cannot be deleted.',
}
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function EntriesPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.draw,
    returnTo: basePage,
    workspaceName: 'Competition Entries',
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
          title="Competition Entries"
          summary="Create and maintain eligible scheduling participants using names and categories."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const id = get(params, 'edit')
  const viewId = get(params, 'view')
  const entryError = get(params, 'entryError')
  const entryUpdated = get(params, 'entryUpdated')
  const query = get(params, 'q')
  const statusFilter = get(params, 'status')
  const page = Math.max(1, Number(get(params, 'page')) || 1)
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const listWhere: Where = {
    and: [
      eventWhere,
      ...(query ? [{ display_name: { contains: query } }] : []),
      ...(statusFilter ? [{ status: { equals: statusFilter } }] : []),
    ],
  }
  const [entries, categories, players, teams, clubs, editing, viewing] = await Promise.all([
    access.payload.find({
      collection: 'competition-entries',
      depth: 1,
      limit: 25,
      page,
      sort: 'display_name',
      where: listWhere,
    }),
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 500, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'players', depth: 0, limit: 1000, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'teams', depth: 0, limit: 1000, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'clubs', depth: 0, limit: 1000, sort: 'name', where: eventWhere }),
    // Fetched separately (not from the paginated/filtered `entries` list above) so editing an
    // entry that search/filter/pagination has scrolled out of view still opens correctly.
    id ? access.payload.findByID({ collection: 'competition-entries', id, depth: 1 }).catch(() => null) : null,
    viewId ? access.payload.findByID({ collection: 'competition-entries', id: viewId, depth: 1 }).catch(() => null) : null,
  ])
  const entry = editing || undefined
  const sourceValue =
    typeof entry?.player_id === 'object' && entry.player_id ? `player:${entry.player_id.id}`
    : typeof entry?.team_id === 'object' && entry.team_id ? `team:${entry.team_id.id}`
    : typeof entry?.club_id === 'object' && entry.club_id ? `club:${entry.club_id.id}`
    : ''

  const categoryOptions = toOptions(categories.docs).map((x) => ({ value: x.id, label: x.label }))
  const sourceOptions = [
    ...toOptions(players.docs).map((x) => ({ value: `player:${x.id}`, label: x.label, group: 'Players' })),
    ...toOptions(teams.docs).map((x) => ({ value: `team:${x.id}`, label: x.label, group: 'Teams' })),
    ...toOptions(clubs.docs).map((x) => ({ value: `club:${x.id}`, label: x.label, group: 'Clubs' })),
  ]

  const form = (
    <form action={saveCompetitionEntryAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={entry?.id || ''} />
      <Field label="Display name" className="sm:col-span-2">
        <Input name="displayName" required defaultValue={entry?.display_name || ''} />
      </Field>
      <ComboboxField
        label="Category"
        name="categoryId"
        required
        options={categoryOptions}
        defaultValue={
          typeof entry?.category_id === 'object'
            ? String(entry.category_id?.id || '')
            : String(entry?.category_id || '')
        }
      />
      <Field label="Type">
        <Select name="entryType" defaultValue={entry?.entry_type || 'individual'}>
          <option value="individual">Individual</option>
          <option value="team">Team</option>
          <option value="club">Club</option>
          <option value="pair">Pair</option>
          <option value="open">Open</option>
          <option value="tbd">TBD</option>
        </Select>
      </Field>
      <ComboboxField
        label="Player/team/club"
        name="sourceId"
        options={sourceOptions}
        defaultValue={sourceValue}
        allowClear
        placeholder="None / manual entry"
        emptyText="No participants match"
        fieldClassName="sm:col-span-2"
      />
      <Field label="Seed">
        <Input name="seedNumber" type="number" min="1" defaultValue={entry?.seed_number ?? ''} />
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={entry?.status || 'pending'}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="disqualified">Disqualified</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">Save entry</SubmitButton>
      </div>
    </form>
  )

  const labelFor = (value: unknown) =>
    value && typeof value === 'object' && 'name' in value
      ? String((value as { name?: string }).name || '—')
      : value && typeof value === 'object' && 'display_name' in value
        ? String((value as { display_name?: string }).display_name || '—')
        : '—'

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Competition Entries"
        summary="Create and maintain eligible scheduling participants using names and categories."
      />

      {entryError && entryErrorMessages[entryError] ? (
        <AlertBanner tone="error" className="mb-4">
          {entryErrorMessages[entryError]}
        </AlertBanner>
      ) : null}
      {entryUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <DataTableToolbar
        action={basePage}
        searchName="q"
        searchDefaultValue={query}
        searchPlaceholder="Search by display name..."
        searchLabel="Search entries by display name"
        filters={
          <Select name="status" defaultValue={statusFilter} className="w-auto" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="disqualified">Disqualified</option>
          </Select>
        }
        io={<ListIO menu="entries" label="entries" />}
        actions={
          <>
            <p className="text-sm font-semibold text-ink-soft whitespace-nowrap">{entries.totalDocs} entries</p>
            <CrudFormModal
              key={id || 'add'}
              title={entry ? `Edit ${entry.display_name}` : 'Add entry'}
              openDefault={Boolean(entry)}
              closeHref={basePage}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add entry
                </Button>
              }
            >
              {form}
            </CrudFormModal>
          </>
        }
      />

      {viewing ? (
        <DetailModal
          key={`view-${viewId}`}
          title={viewing.display_name}
          openDefault
          closeHref={basePage}
          items={[
            { label: 'Category', value: labelFor(viewing.category_id) },
            { label: 'Type', value: String(viewing.entry_type).replaceAll('_', ' ') },
            { label: 'Source', value: labelFor(viewing.player_id) !== '—' ? labelFor(viewing.player_id) : labelFor(viewing.team_id) !== '—' ? labelFor(viewing.team_id) : labelFor(viewing.club_id) },
            { label: 'Seed', value: viewing.seed_number ?? '—' },
            { label: 'Status', value: viewing.status },
          ]}
        />
      ) : null}

      {entries.docs.length === 0 ? (
        <EmptyState>No entries match.</EmptyState>
      ) : (
        <>
          <Table caption="Competition entries">
            <TableHeader>
              <TableRow>
                <TableHead>Display name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.docs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">{item.display_name}</TableCell>
                  <TableCell className="text-ink-soft">{String(item.entry_type).replaceAll('_', ' ')}</TableCell>
                  <TableCell>
                    <StatusBadge tone={item.status === 'confirmed' ? 'green' : 'neutral'}>
                      {item.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      viewHref={`${basePage}?view=${item.id}`}
                      editHref={`${basePage}?edit=${item.id}`}
                      deleteAction={deleteCompetitionEntryAction}
                      deleteId={item.id}
                      deleteDescription={`Delete "${item.display_name}"? Only allowed if it is not used by any match, standing, or medal.`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={entries.page || 1}
            totalPages={entries.totalPages || 1}
            hasPrevPage={Boolean(entries.hasPrevPage)}
            hasNextPage={Boolean(entries.hasNextPage)}
            totalDocs={entries.totalDocs}
            buildHref={(targetPage) => {
              const url = new URLSearchParams()
              if (query) url.set('q', query)
              if (statusFilter) url.set('status', statusFilter)
              url.set('page', String(targetPage))
              return `${basePage}?${url.toString()}`
            }}
          />
        </>
      )}
    </>
  )
}
