import Link from 'next/link'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { collectEntryClubLabels } from '@/lib/brackets'
import { getActiveEvent } from '../../activeEvent'
import {
  NoActiveEventNotice,
  PageHero,
  StatBlock,
  StatGrid,
  getRelationshipId,
  getRelationshipLabel,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { recalculateStandingScopeAction } from './standingActions'

export const dynamic = 'force-dynamic'

type WorkspaceStanding = {
  id: string | number
  rank: number
  played: number
  points: number
  score_difference: number
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
  group_id?: string | number | { name?: string } | null
  entry_id?: string | number | { display_name?: string; name?: string } | null
}

type WorkspaceGroup = {
  id: string | number
  name?: string
  stage_id?: string | number | { id?: string | number; name?: string } | null
}

type WorkspaceStage = {
  id: string | number
  name?: string
  stage_type?: string
  category_id?: string | number | { id?: string | number; name?: string } | null
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function StandingsWorkspacePage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.standings,
    returnTo: '/workspaces/standings',
    workspaceName: 'Standings Workspace',
  })
  if (!access.authorized) {
    return (
      <WorkspaceUnauthorized
        workspaceName={access.workspaceName}
        allowedRoles={access.allowedRoles}
      />
    )
  }

  const payload = access.payload
  const activeEvent = await getActiveEvent(payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Standings Workspace"
          title="Group standings foundation"
          summary="Recalculate cached standings for group-stage and round-robin scopes."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const query = searchParams ? await searchParams : {}
  const standingUpdated = query.standingUpdated === '1'
  const standingError = query.standingError === 'missing_scope'
  const updatedRows = typeof query.rows === 'string' ? query.rows : '0'
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const [stagesResult, groupsResult, standingsResult] = await Promise.all([
    payload.find({
      collection: 'stages',
      depth: 1,
      limit: 100,
      sort: ['category_id', 'order'],
      where: { and: [eventWhere, { stage_type: { in: ['group_stage', 'round_robin', 'league', 'swiss'] } }] },
    }),
    payload.find({ collection: 'groups', depth: 1, limit: 100, sort: ['stage_id', 'order'], where: eventWhere }),
    payload.find({
      collection: 'standings',
      depth: 1,
      limit: 200,
      sort: ['category_id', 'stage_id', 'group_id', 'rank'],
      where: eventWhere,
    }),
  ])
  const stages = stagesResult.docs as WorkspaceStage[]
  const groups = groupsResult.docs as WorkspaceGroup[]
  const standings = standingsResult.docs as WorkspaceStanding[]
  const standingEntryIds = standings.map((standing) => getRelationshipId(standing.entry_id)).filter(Boolean)
  const clubLabelByEntryId = await collectEntryClubLabels(payload, standingEntryIds)
  const firstGroupStage = stages.find((stage) => stage.stage_type === 'group_stage') || stages[0]
  const firstGroup = firstGroupStage
    ? groups.find((group) => getRelationshipId(group.stage_id) === String(firstGroupStage.id))
    : undefined

  return (
    <>
      <PageHero
        eyebrow="Standings Workspace"
        title="Group standings foundation"
        summary="Recalculate cached standings for group-stage and round-robin scopes."
        actions={
          <>
            <Button asChild>
              <Link href={`/events/${activeEvent.slug}/schedule?tab=standings`}>View Public Standings</Link>
            </Button>
          </>
        }
      />

      {standingUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Standings recalculated. {updatedRows} row(s) updated.
        </AlertBanner>
      ) : null}
      {standingError ? (
        <AlertBanner tone="error" className="mb-4">
          Choose a category and stage first.
        </AlertBanner>
      ) : null}

      <StatGrid>
        <StatBlock label="Standing rows" value={standings.length} />
        <StatBlock label="Ranking scopes" value={stages.length} />
        <StatBlock label="Groups" value={groups.length} />
      </StatGrid>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>Recalculate Seeded Group</CardTitle>
          {firstGroupStage && firstGroup ? (
            <form action={recalculateStandingScopeAction} className="flex flex-col gap-4">
              <input type="hidden" name="categoryId" value={getRelationshipId(firstGroupStage.category_id)} />
              <input type="hidden" name="stageId" value={firstGroupStage.id} />
              <input type="hidden" name="groupId" value={firstGroup.id} />
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Category</dt>
                  <dd className="font-semibold text-ink">{getRelationshipLabel(firstGroupStage.category_id)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Stage</dt>
                  <dd className="font-semibold text-ink">{firstGroupStage.name || 'Group Stage'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">Group</dt>
                  <dd className="font-semibold text-ink">{firstGroup.name || 'Group'}</dd>
                </div>
              </dl>
              <SubmitButton>Recalculate Standings</SubmitButton>
            </form>
          ) : (
            <EmptyState>No group-stage scope exists yet. Seed the demo event before recalculating standings.</EmptyState>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <CardTitle>Cached Standings</CardTitle>
          {standings.length === 0 ? (
            <EmptyState>No cached standings yet.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {standings.slice(0, 8).map((standing) => {
                const standingEntryId = getRelationshipId(standing.entry_id)
                const standingClub = standingEntryId !== undefined ? clubLabelByEntryId.get(String(standingEntryId)) : undefined
                return (
                  <li key={standing.id} className="rounded-card border border-line bg-paper px-4 py-3">
                    <strong className="block text-sm font-bold text-ink">
                      #{standing.rank} {getRelationshipLabel(standing.entry_id)}
                    </strong>
                    {standingClub ? (
                      <span className="block text-xs font-semibold text-ink-soft">{standingClub}</span>
                    ) : null}
                    <span className="text-xs font-semibold text-ink-soft">
                      {getRelationshipLabel(standing.category_id)} /{' '}
                      {getRelationshipLabel(standing.group_id, 'No group')} / {standing.points} pts
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </section>
    </>
  )
}
