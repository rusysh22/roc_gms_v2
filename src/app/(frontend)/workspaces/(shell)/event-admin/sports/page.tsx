import { Plus } from 'lucide-react'
import type { Where } from 'payload'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ComboboxField } from '@/components/ui/combobox'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { DataTableToolbar } from '@/components/ui/data-table-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ListIO } from '@/components/ui/list-io'
import { RowActions } from '@/components/ui/row-actions'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteSportAction, saveSportAction } from './sportActions'

export const dynamic = 'force-dynamic'
const basePage = '/workspaces/event-admin/sports'
const sportErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a valid sport name and type.',
  invalid_relationship: 'The selected ruleset does not belong to this event.',
  duplicate_slug: 'A sport with that name/slug already exists in this event.',
  sport_in_use: 'This sport has categories, rulesets, or courts - remove those first.',
}
const SPORT_TYPES = ['court', 'field', 'table', 'board', 'esport', 'track', 'other'] as const

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function SportsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: basePage,
    workspaceName: 'Sports',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Event Setup" title="Sports" summary="The sports contested at this event. Categories and rulesets attach to these." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const editingId = get(params, 'edit')
  const query = get(params, 'q')
  const sportError = get(params, 'sportError')
  const sportUpdated = get(params, 'sportUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const listWhere: Where = query ? { and: [eventWhere, { name: { contains: query } }] } : eventWhere

  const [sports, rulesets, categories] = await Promise.all([
    access.payload.find({ collection: 'sports', depth: 0, limit: 200, sort: 'name', where: listWhere }),
    access.payload.find({ collection: 'rulesets', depth: 0, limit: 500, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 1000, where: eventWhere }),
  ])

  const rulesetNameById = new Map(rulesets.docs.map((r) => [String(r.id), r.name]))
  const categoryCountBySport = new Map<string, number>()
  for (const c of categories.docs) {
    if (!c.sport_id) continue
    const key = String(c.sport_id)
    categoryCountBySport.set(key, (categoryCountBySport.get(key) || 0) + 1)
  }

  const editing = sports.docs.find((sport) => String(sport.id) === editingId)
  const rulesetOptions = rulesets.docs.map((r) => ({ value: String(r.id), label: r.name }))

  const form = (
    <form action={saveSportAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={editing?.id || ''} />
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={editing?.name || ''} />
      </Field>
      <details className="sm:col-span-2">
        <summary className="cursor-pointer text-xs font-bold text-ink-soft select-none">
          Advanced: custom URL slug
        </summary>
        <div className="mt-2">
          <Field label="Slug">
            <Input name="slug" defaultValue={editing?.slug || ''} placeholder="generated-from-name" />
          </Field>
        </div>
      </details>
      <Field label="Type">
        <Select name="sportType" defaultValue={editing?.sport_type || 'court'}>
          {SPORT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type[0].toUpperCase() + type.slice(1)}
            </option>
          ))}
        </Select>
      </Field>
      <ComboboxField
        label="Default ruleset"
        name="defaultRulesetId"
        optional
        allowClear
        options={rulesetOptions}
        defaultValue={editing?.default_ruleset_id ? String(editing.default_ruleset_id) : ''}
      />
      <Field label="Icon" optional>
        <Input name="icon" defaultValue={editing?.icon || ''} placeholder="icon key or URL" />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={editing ? Boolean(editing.is_active) : true}
          className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
        />
        Active
      </label>
      <Field label="Description" optional className="sm:col-span-2">
        <Textarea name="description" defaultValue={editing?.description || ''} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">{editing ? 'Save sport' : 'Add sport'}</SubmitButton>
      </div>
    </form>
  )

  return (
    <>
      <PageHero eyebrow="Event Setup" title="Sports" summary="The sports contested at this event. Categories and rulesets attach to these." />

      {sportError && sportErrorMessages[sportError] ? (
        <AlertBanner tone="error" className="mb-4">
          {sportErrorMessages[sportError]}
        </AlertBanner>
      ) : null}
      {sportUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <DataTableToolbar
        action={basePage}
        searchName="q"
        searchDefaultValue={query}
        searchPlaceholder="Search by name..."
        searchLabel="Search sports by name"
        io={<ListIO menu="sports" label="sports" />}
        actions={
          <>
            <p className="text-sm font-semibold text-ink-soft whitespace-nowrap">{sports.totalDocs} sports</p>
            <CrudFormModal
              key={editingId || 'add'}
              title={editing ? `Edit ${editing.name}` : 'Add sport'}
              openDefault={Boolean(editing)}
              closeHref={basePage}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add sport
                </Button>
              }
            >
              {form}
            </CrudFormModal>
          </>
        }
      />

      {sports.docs.length === 0 ? (
        <EmptyState>No sports yet.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Default ruleset</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sports.docs.map((sport) => (
              <TableRow key={sport.id}>
                <TableCell className="font-bold">{sport.name}</TableCell>
                <TableCell className="text-ink-soft">{String(sport.sport_type)}</TableCell>
                <TableCell className="text-ink-soft">
                  {sport.default_ruleset_id ? rulesetNameById.get(String(sport.default_ruleset_id)) || '—' : '—'}
                </TableCell>
                <TableCell className="text-ink-soft">{categoryCountBySport.get(String(sport.id)) || 0}</TableCell>
                <TableCell>
                  <StatusBadge tone={sport.is_active ? 'green' : 'neutral'}>
                    {sport.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    editHref={`${basePage}?edit=${sport.id}`}
                    deleteAction={deleteSportAction}
                    deleteId={sport.id}
                    deleteDescription={`Delete "${sport.name}"? Only allowed if it has no categories, rulesets, or courts.`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
