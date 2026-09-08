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
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteCategoryAction, saveCategoryAction } from './categoryActions'

export const dynamic = 'force-dynamic'
const basePage = '/workspaces/event-admin/categories'
const categoryErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a name, sport, and valid mode/format/status.',
  invalid_relationship: 'The selected sport or ruleset does not belong to this event.',
  duplicate_slug: 'A category with that name already exists for this sport.',
  category_in_use: 'This category has entries, stages, rosters, or matches - remove those first.',
}
const PARTICIPANT_MODES = ['individual', 'pair', 'team', 'club', 'open', 'tbd'] as const
const FORMAT_TYPES = [
  'single_elimination',
  'double_elimination',
  'round_robin',
  'group_stage_to_knockout',
  'league',
  'friendly',
  'time_trial',
  'score_ranking',
] as const
const STATUSES = ['draft', 'open', 'locked', 'published', 'archived'] as const
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''
const idOf = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value ? String((value as { id?: unknown }).id || '') : String(value || '')

export default async function CategoriesPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: basePage,
    workspaceName: 'Competition Categories',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Event Setup" title="Competition Categories" summary="The competitions within each sport - what entries register into and brackets are drawn for." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const editingId = get(params, 'edit')
  const viewId = get(params, 'view')
  const query = get(params, 'q')
  const sportFilter = get(params, 'sport')
  const page = Math.max(1, Number(get(params, 'page')) || 1)
  const categoryError = get(params, 'categoryError')
  const categoryUpdated = get(params, 'categoryUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const listWhere: Where = {
    and: [
      eventWhere,
      ...(query ? [{ name: { contains: query } }] : []),
      ...(sportFilter ? [{ sport_id: { equals: sportFilter } }] : []),
    ],
  }

  const [categories, sports, rulesets, entries] = await Promise.all([
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 50, page, sort: 'name', where: listWhere }),
    access.payload.find({ collection: 'sports', depth: 0, limit: 500, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'rulesets', depth: 0, limit: 500, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'competition-entries', depth: 0, limit: 5000, where: eventWhere }),
  ])

  const sportNameById = new Map(sports.docs.map((s) => [String(s.id), s.name]))
  const rulesetNameById = new Map(rulesets.docs.map((r) => [String(r.id), r.name]))
  const entryCountByCategory = new Map<string, number>()
  for (const entry of entries.docs) {
    if (!entry.category_id) continue
    const key = idOf(entry.category_id)
    entryCountByCategory.set(key, (entryCountByCategory.get(key) || 0) + 1)
  }

  const editing = categories.docs.find((c) => String(c.id) === editingId)
  const viewing = viewId ? categories.docs.find((c) => String(c.id) === viewId) : undefined
  const sportOptions = sports.docs.map((s) => ({ value: String(s.id), label: s.name }))
  const rulesetOptions = rulesets.docs.map((r) => ({ value: String(r.id), label: r.name }))

  const form = (
    <form action={saveCategoryAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={editing?.id || ''} />
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={editing?.name || ''} />
      </Field>
      <ComboboxField
        label="Sport"
        name="sportId"
        required
        options={sportOptions}
        defaultValue={editing ? idOf(editing.sport_id) : sportFilter}
      />
      <ComboboxField
        label="Ruleset"
        name="rulesetId"
        optional
        allowClear
        options={rulesetOptions}
        defaultValue={editing ? idOf(editing.ruleset_id) : ''}
      />
      <Field label="Participant mode">
        <Select name="participantMode" defaultValue={editing?.participant_mode || 'open'}>
          {PARTICIPANT_MODES.map((m) => (
            <option key={m} value={m}>
              {humanize(m)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Format">
        <Select name="formatType" defaultValue={editing?.format_type || 'single_elimination'}>
          {FORMAT_TYPES.map((f) => (
            <option key={f} value={f}>
              {humanize(f)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={editing?.status || 'draft'}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Third place">
        <Select name="thirdPlacePolicy" defaultValue={editing?.third_place_policy || 'none'}>
          <option value="none">No third place</option>
          <option value="match">Bronze final</option>
          <option value="shared">Shared third</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name="rosterRequired"
          defaultChecked={Boolean(editing?.roster_required)}
          className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
        />
        Roster required
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name="medalEligible"
          defaultChecked={editing ? Boolean(editing.medal_eligible) : true}
          className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
        />
        Medal eligible
      </label>
      <Field label="Min roster size" optional>
        <Input name="minRosterSize" type="number" min="0" defaultValue={editing?.min_roster_size ?? ''} />
      </Field>
      <Field label="Max roster size" optional>
        <Input name="maxRosterSize" type="number" min="0" defaultValue={editing?.max_roster_size ?? ''} />
      </Field>
      <Field label="Group qualify count" optional description="Top-N per group that advance.">
        <Input name="groupQualifyCount" type="number" min="1" defaultValue={editing?.group_qualify_count ?? ''} />
      </Field>
      <Field label="Medal weight" optional>
        <Input name="medalWeight" type="number" min="0" defaultValue={editing?.medal_weight ?? 1} />
      </Field>
      <Field label="Result unit" optional description='Time trial / score ranking, e.g. "seconds".' className="sm:col-span-2">
        <Input name="resultUnit" defaultValue={editing?.result_unit || ''} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">{editing ? 'Save category' : 'Add category'}</SubmitButton>
      </div>
    </form>
  )

  return (
    <>
      <PageHero eyebrow="Event Setup" title="Competition Categories" summary="The competitions within each sport - what entries register into and brackets are drawn for." />

      {categoryError && categoryErrorMessages[categoryError] ? (
        <AlertBanner tone="error" className="mb-4">
          {categoryErrorMessages[categoryError]}
        </AlertBanner>
      ) : null}
      {categoryUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <DataTableToolbar
        action={basePage}
        searchName="q"
        searchDefaultValue={query}
        searchPlaceholder="Search by name..."
        searchLabel="Search categories by name"
        filters={
          <Select name="sport" defaultValue={sportFilter} className="w-auto" aria-label="Filter by sport">
            <option value="">All sports</option>
            {sports.docs.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </Select>
        }
        io={<ListIO menu="categories" label="categories" />}
        actions={
          <>
            <p className="text-sm font-semibold text-ink-soft whitespace-nowrap">{categories.totalDocs} categories</p>
            {sports.docs.length === 0 ? null : (
              <CrudFormModal
                key={editingId || 'add'}
                title={editing ? `Edit ${editing.name}` : 'Add category'}
                openDefault={Boolean(editing)}
                closeHref={basePage}
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add category
                  </Button>
                }
              >
                {form}
              </CrudFormModal>
            )}
          </>
        }
      />

      {viewing ? (
        <DetailModal
          key={`view-${viewId}`}
          title={viewing.name}
          openDefault
          closeHref={basePage}
          items={[
            { label: 'Sport', value: sportNameById.get(idOf(viewing.sport_id)) || '—' },
            { label: 'Ruleset', value: viewing.ruleset_id ? rulesetNameById.get(idOf(viewing.ruleset_id)) || '—' : '—' },
            { label: 'Mode', value: humanize(String(viewing.participant_mode)) },
            { label: 'Format', value: humanize(String(viewing.format_type)) },
            { label: 'Status', value: humanize(String(viewing.status)) },
            { label: 'Roster', value: viewing.roster_required ? `Required (${viewing.min_roster_size ?? 0}–${viewing.max_roster_size ?? '∞'})` : 'Not required' },
            { label: 'Third place', value: humanize(String(viewing.third_place_policy)) },
            { label: 'Medal', value: viewing.medal_eligible ? `Eligible (weight ${viewing.medal_weight ?? 1})` : 'Not eligible' },
            { label: 'Entries', value: entryCountByCategory.get(String(viewing.id)) || 0 },
          ]}
        />
      ) : null}

      {sports.docs.length === 0 ? (
        <EmptyState>Add a sport first, then create its categories.</EmptyState>
      ) : categories.docs.length === 0 ? (
        <EmptyState>No categories match.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sport</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.docs.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-bold">{category.name}</TableCell>
                <TableCell className="text-ink-soft">{sportNameById.get(idOf(category.sport_id)) || '—'}</TableCell>
                <TableCell className="text-ink-soft">{humanize(String(category.participant_mode))}</TableCell>
                <TableCell className="text-ink-soft">{humanize(String(category.format_type))}</TableCell>
                <TableCell className="text-ink-soft">{entryCountByCategory.get(String(category.id)) || 0}</TableCell>
                <TableCell>
                  <StatusBadge tone={category.status === 'published' || category.status === 'open' ? 'green' : 'neutral'}>
                    {category.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    viewHref={`${basePage}?view=${category.id}`}
                    editHref={`${basePage}?edit=${category.id}`}
                    deleteAction={deleteCategoryAction}
                    deleteId={category.id}
                    deleteDescription={`Delete "${category.name}"? Only allowed if it has no entries, stages, rosters, or matches.`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {categories.docs.length > 0 ? (
        <Pagination
          page={categories.page || 1}
          totalPages={categories.totalPages || 1}
          hasPrevPage={Boolean(categories.hasPrevPage)}
          hasNextPage={Boolean(categories.hasNextPage)}
          totalDocs={categories.totalDocs}
          buildHref={(targetPage) => {
            const url = new URLSearchParams()
            if (query) url.set('q', query)
            if (sportFilter) url.set('sport', sportFilter)
            url.set('page', String(targetPage))
            return `${basePage}?${url.toString()}`
          }}
        />
      ) : null}
    </>
  )
}
