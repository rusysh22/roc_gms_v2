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
import { RulesetFieldset } from '@/components/ui/RulesetFieldset'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatRulesetSummary } from '@/lib/rulesetSummary'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { ConfirmSubmitButton } from '../../../matches/ConfirmSubmitButton'
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
  const rulesetError = get(params, 'rulesetError')
  const rulesetUpdated = get(params, 'rulesetUpdated')

  const [rulesets, sports, categories] = await Promise.all([
    access.payload.find({
      collection: 'rulesets',
      depth: 0,
      limit: 200,
      sort: 'name',
      where: { event_id: { equals: activeEvent.id } },
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

  const form = (
    <form action={saveRulesetAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={editing?.id || ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ruleset name">
          <Input name="name" required defaultValue={editing?.name || ''} />
        </Field>
        <Field label="Sport">
          <Select name="sportId" required defaultValue={editing?.sport_id ? String(editing.sport_id) : ''}>
            <option value="" disabled>
              Select sport
            </option>
            {sports.docs.map((sport) => (
              <option key={sport.id} value={String(sport.id)}>
                {sport.name}
              </option>
            ))}
          </Select>
        </Field>
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

      <div className="mb-4 flex justify-end">
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
      </div>

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
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}?edit=${ruleset.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                    {(categoryCountByRuleset.get(String(ruleset.id)) || 0) === 0 ? (
                      <>
                        <form id={`delete-ruleset-${ruleset.id}`} action={deleteRulesetAction}>
                          <input type="hidden" name="id" value={String(ruleset.id)} />
                        </form>
                        <ConfirmSubmitButton
                          formId={`delete-ruleset-${ruleset.id}`}
                          tone="destructive"
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          confirmMessage={`Delete "${ruleset.name}"?`}
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
