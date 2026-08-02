import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, toOptions } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveCompetitionEntryAction } from './entryActions'

export const dynamic = 'force-dynamic'
const basePage = '/workspaces/event-admin/entries'
const entryErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a display name, category, and a valid seed/status.',
  invalid_relationship: 'The selected player/team/club does not belong to the active event.',
}
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function EntriesPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
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
  const entryError = get(params, 'entryError')
  const entryUpdated = get(params, 'entryUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const [entries, categories, players, teams, clubs] = await Promise.all([
    access.payload.find({
      collection: 'competition-entries',
      depth: 1,
      limit: 300,
      sort: 'display_name',
      where: eventWhere,
    }),
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 100, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'players', depth: 0, limit: 300, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'teams', depth: 0, limit: 300, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'clubs', depth: 0, limit: 300, sort: 'name', where: eventWhere }),
  ])
  const entry = entries.docs.find((item) => String(item.id) === id)
  const sourceId =
    typeof entry?.player_id === 'object' ? String(entry.player_id?.id || '')
    : typeof entry?.team_id === 'object' ? String(entry.team_id?.id || '')
    : typeof entry?.club_id === 'object' ? String(entry.club_id?.id || '')
    : ''

  const form = (
    <form action={saveCompetitionEntryAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={entry?.id || ''} />
      <Field label="Display name" className="sm:col-span-2">
        <Input name="displayName" required defaultValue={entry?.display_name || ''} />
      </Field>
      <Field label="Category">
        <Select
          name="categoryId"
          required
          defaultValue={
            typeof entry?.category_id === 'object'
              ? String(entry.category_id?.id || '')
              : String(entry?.category_id || '')
          }
        >
          <option value="">Select category</option>
          {toOptions(categories.docs).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </Select>
      </Field>
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
      <Field label="Player/team/club" className="sm:col-span-2">
        <Select name="sourceId" defaultValue={sourceId}>
          <option value="">None / manual entry</option>
          <optgroup label="Players">
            {toOptions(players.docs).map((x) => (
              <option key={`p-${x.id}`} value={x.id}>
                {x.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Teams">
            {toOptions(teams.docs).map((x) => (
              <option key={`t-${x.id}`} value={x.id}>
                {x.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Clubs">
            {toOptions(clubs.docs).map((x) => (
              <option key={`c-${x.id}`} value={x.id}>
                {x.label}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>
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
        <SubmitButton className="w-full sm:w-auto">
          Save entry
        </SubmitButton>
      </div>
    </form>
  )

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

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-soft">{entries.totalDocs} entries</p>
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
      </div>

      {entries.docs.length === 0 ? (
        <EmptyState>No entries yet.</EmptyState>
      ) : (
        <Table>
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
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`${basePage}?edit=${item.id}`}>
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
