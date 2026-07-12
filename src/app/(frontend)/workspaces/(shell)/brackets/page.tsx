import Link from 'next/link'

import type { SingleEliminationBracketData } from '@/lib/brackets'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHero, StatBlock, StatGrid, getRelationshipId, getRelationshipLabel } from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { recalculateBracketStageAction } from './bracketActions'

export const dynamic = 'force-dynamic'

type WorkspaceStage = {
  id: string | number
  name?: string
  stage_type?: string
  category_id?: string | number | { id?: string | number; name?: string } | null
}

type WorkspaceBracket = {
  id: string | number
  name: string
  status: string
  bracket_data?: SingleEliminationBracketData | null
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const getChampion = (bracketData?: SingleEliminationBracketData | null) =>
  bracketData?.champion || {
    status: 'pending',
    reason: 'Champion metadata has not been generated yet.',
  }

export default async function BracketsWorkspacePage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.brackets,
    returnTo: '/workspaces/brackets',
    workspaceName: 'Brackets Workspace',
  })
  if (!access.authorized) {
    return (
      <WorkspaceUnauthorized
        workspaceName={access.workspaceName}
        allowedRoles={access.allowedRoles}
      />
    )
  }

  const query = searchParams ? await searchParams : {}
  const bracketUpdated = query.bracketUpdated === '1'
  const bracketError = query.bracketError === 'missing_stage'
  const updatedMatches = typeof query.matches === 'string' ? query.matches : '0'
  const payload = access.payload
  const [stagesResult, bracketsResult] = await Promise.all([
    payload.find({
      collection: 'stages',
      depth: 1,
      limit: 50,
      sort: ['category_id', 'order'],
      where: { stage_type: { equals: 'single_elimination' } },
    }),
    payload.find({ collection: 'brackets', depth: 1, limit: 50, sort: ['category_id', 'stage_id'] }),
  ])
  const stages = stagesResult.docs as WorkspaceStage[]
  const brackets = bracketsResult.docs as WorkspaceBracket[]
  const firstStage = stages[0]

  return (
    <>
      <PageHero
        eyebrow="Brackets Workspace"
        title="Single elimination bracket foundation"
        summary="Generate cached bracket layout from single-elimination stage matches. The match records remain the source of truth for status, score, and winners."
        actions={
          <>
            <Button asChild>
              <Link href="/brackets">View Public Brackets</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/champions">View Champions</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/collections/brackets">Backoffice Brackets</Link>
            </Button>
          </>
        }
      />

      {bracketUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Bracket recalculated from {updatedMatches} match(es).
        </AlertBanner>
      ) : null}
      {bracketError ? (
        <AlertBanner tone="error" className="mb-4">
          Choose a single-elimination stage first.
        </AlertBanner>
      ) : null}

      <StatGrid>
        <StatBlock label="Bracket caches" value={brackets.length} />
        <StatBlock label="Single elimination stages" value={stages.length} />
        <StatBlock
          label="Champions decided"
          value={brackets.filter((bracket) => getChampion(bracket.bracket_data).status === 'decided').length}
          tone="good"
        />
        <StatBlock
          label="Cached matches"
          value={brackets.reduce(
            (sum, bracket) =>
              sum + (bracket.bracket_data?.rounds.reduce((roundSum, round) => roundSum + round.matches.length, 0) || 0),
            0,
          )}
        />
      </StatGrid>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>Recalculate Seeded Bracket</CardTitle>
          {firstStage ? (
            <form action={recalculateBracketStageAction} className="flex flex-col gap-4">
              <input type="hidden" name="stageId" value={firstStage.id} />
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Category</dt>
                  <dd className="font-semibold text-ink">{getRelationshipLabel(firstStage.category_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Stage</dt>
                  <dd className="font-semibold text-ink">{firstStage.name || 'Single Elimination'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Stage ID</dt>
                  <dd className="font-semibold text-ink">{getRelationshipId(firstStage)}</dd>
                </div>
              </dl>
              <Button type="submit">Recalculate Bracket</Button>
            </form>
          ) : (
            <EmptyState>No single-elimination stage exists yet. Seed the demo event before generating a bracket.</EmptyState>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <CardTitle>Cached Brackets</CardTitle>
          {brackets.length === 0 ? (
            <EmptyState>No cached brackets yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {brackets.map((bracket) => (
                <li key={bracket.id} className="rounded-card border border-line bg-paper px-4 py-3">
                  <strong className="block text-sm font-bold text-ink">{bracket.name}</strong>
                  <span className="block text-xs font-semibold text-ink-soft">
                    {getRelationshipLabel(bracket.category_id)} / {getRelationshipLabel(bracket.stage_id)} /{' '}
                    {bracket.status}
                  </span>
                  <span className="block text-xs font-semibold text-ink-soft">
                    Champion:{' '}
                    {getChampion(bracket.bracket_data).status === 'decided'
                      ? getChampion(bracket.bracket_data).label
                      : 'Not decided'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  )
}
