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
import { RowActions } from '@/components/ui/row-actions'
import { RulesetFieldset } from '@/components/ui/RulesetFieldset'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatRulesetSummary } from '@/lib/rulesetSummary'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { deleteRulesetAction, saveRulesetAction } from './rulesetActions'

export const dynamic = 'force-dynamic'

const basePage = '/workspaces/event-admin/rulesets'
const rulesetErrorMessages: Record<string, string> = {
  invalid_input: 'Fill in a valid ruleset name, sport, and score type.',
  invalid_relationship: 'The selected sport does not belong to this event.',
  duplicate_slug: 'A ruleset with that name already exists.',
  ruleset_in_use: 'This ruleset is attached to a category or stage - detach it there before deleting.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

// MSG-08: this list is the closing of a real gap, not just convenience - before this page existed,
// default_duration_minutes/min_rest_minutes/points_*/tie_breakers had no editor anywhere in the
// workspace (only the wizard's original 4-field quick create, or Payload admin directly). A
// ruleset that "looked done" in the wizard silently left the schedule optimizer and standings
// running on defaults - see MULTI_SPORT_GAMES_ENHANCEMENTS_DESIGN.md MSG-08.
export default async function RulesetsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: basePage,
    workspaceName: 'Rulesets',
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
          title="Rulesets"
          summary="Edit how score, winning, standings, and tie-breaks work for each sport - the full field set, not just the wizard's quick-create form."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const editingId = get(params, 'edit')
  const viewId = get(params, 'view')
  const query = get(params, 'q')
  const rulesetError = get(params, 'rulesetError')
  const rulesetUpdated = get(params, 'rulesetUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const listWhere: Where = query ? { and: [eventWhere, { name: { contains: query } }] } : eventWhere

  const [rulesets, sports, categories] = await Promise.all([
    access.payload.find({
      collection: 'rulesets',
      depth: 0,
      limit: 200,
      sort: 'name',
      where: listWhere,
    }),
    access.payload.find({
      collection: 'sports',
      depth: 0,
      limit: 100,
      sort: 'name',
      where: { event_id: { equals: activeEvent.id } },
    }),
    access.payload.find({
      collection: 'competition-categories',
      depth: 0,
      limit: 500,
      where: { event_id: { equals: activeEvent.id } },
    }),
  ])

  const sportNameById = new Map(sports.docs.map((sport) => [String(sport.id), sport.name]))
  const categoryCountByRuleset = new Map<string, number>()
  for (const category of categories.docs) {
    if (!category.ruleset_id) continue
    const key = String(category.ruleset_id)
    categoryCountByRuleset.set(key, (categoryCountByRuleset.get(key) || 0) + 1)
  }

  const editing = rulesets.docs.find((ruleset) => String(ruleset.id) === editingId)
  const viewing = viewId ? rulesets.docs.find((ruleset) => String(ruleset.id) === viewId) : undefined
  const sportOptions = sports.docs.map((sport) => ({ value: String(sport.id), label: sport.name }))

  const form = (
    <form action={saveRulesetAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={editing?.id || ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ruleset name">
          <Input name="name" required defaultValue={editing?.name || ''} />
        </Field>
        <ComboboxField
          label="Sport"
          name="sportId"
          required
          options={sportOptions}
          defaultValue={editing?.sport_id ? String(editing.sport_id) : ''}
        />
      </div>
      <RulesetFieldset
        values={{
          scoreType: editing?.score_type,
          setBased: editing?.set_based,
          bestOf: editing?.best_of,
          targetScore: editing?.target_score,
          maxScore: editing?.max_score,
          deuceEnabled: editing?.deuce_enabled,
          allowDraw: editing?.allow_draw,
          defaultDurationMinutes: editing?.default_duration_minutes,
          minRestMinutes: editing?.min_rest_minutes,
          pointsWin: editing?.points_win,
          pointsDraw: editing?.points_draw,
          pointsLoss: editing?.points_loss,
          tieBreakers: (editing?.tie_breakers as string[] | undefined) ?? undefined,
        }}
      />
      <SubmitButton className="w-full sm:w-auto">{editing ? 'Save ruleset' : 'Add ruleset'}</SubmitButton>
    </form>
  )

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Rulesets"
        summary="Edit how score, winning, standings, and tie-breaks work for each sport - the full field set, not just the wizard's quick-create form."
      />

      {rulesetError && rulesetErrorMessages[rulesetError] ? (
        <AlertBanner tone="error" className="mb-4">
          {rulesetErrorMessages[rulesetError]}
        </AlertBanner>
      ) : null}
      {rulesetUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <DataTableToolbar
        action={basePage}
        searchName="q"
        searchDefaultValue={query}
        searchPlaceholder="Search by name..."
        searchLabel="Search rulesets by name"
        io={<ListIO menu="rulesets" label="rulesets" />}
        actions={
          <>
            <p className="text-sm font-semibold text-ink-soft whitespace-nowrap">{rulesets.totalDocs} rulesets</p>
            {sports.docs.length === 0 ? null : (
              <CrudFormModal
                key={editingId || 'add'}
                title={editing ? `Edit ${editing.name}` : 'Add ruleset'}
                openDefault={Boolean(editing)}
                closeHref={basePage}
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add ruleset
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
            { label: 'Sport', value: sportNameById.get(String(viewing.sport_id)) || '—' },
            { label: 'Summary', value: formatRulesetSummary(viewing) },
            { label: 'Score type', value: viewing.score_type || '—' },
            { label: 'Points (W/D/L)', value: `${viewing.points_win ?? '—'} / ${viewing.points_draw ?? '—'} / ${viewing.points_loss ?? '—'}` },
            { label: 'Duration (min)', value: viewing.default_duration_minutes ?? '—' },
            { label: 'Min rest (min)', value: viewing.min_rest_minutes ?? '—' },
            { label: 'Used by', value: `${categoryCountByRuleset.get(String(viewing.id)) || 0} categories` },
          ]}
        />
      ) : null}

      {sports.docs.length === 0 ? (
        <EmptyState>Add a sport first, then come back to define its rules.</EmptyState>
      ) : rulesets.docs.length === 0 ? (
        <EmptyState>No rulesets yet.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sport</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Used by</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rulesets.docs.map((ruleset) => (
              <TableRow key={ruleset.id}>
                <TableCell className="font-bold">{ruleset.name}</TableCell>
                <TableCell className="text-ink-soft">{sportNameById.get(String(ruleset.sport_id)) || '—'}</TableCell>
                <TableCell className="text-ink-soft">{formatRulesetSummary(ruleset)}</TableCell>
                <TableCell className="text-ink-soft">
                  {categoryCountByRuleset.get(String(ruleset.id)) || 0} categor
                  {(categoryCountByRuleset.get(String(ruleset.id)) || 0) === 1 ? 'y' : 'ies'}
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    viewHref={`${basePage}?view=${ruleset.id}`}
                    editHref={`${basePage}?edit=${ruleset.id}`}
                    deleteAction={
                      (categoryCountByRuleset.get(String(ruleset.id)) || 0) === 0 ? deleteRulesetAction : undefined
                    }
                    deleteId={ruleset.id}
                    deleteDescription={`Delete "${ruleset.name}"?`}
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
