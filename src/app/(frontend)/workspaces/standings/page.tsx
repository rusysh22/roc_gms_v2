import { getPayload } from 'payload'

import config from '@payload-config'
import {
  StatBlock,
  WorkspaceNav,
  getRelationshipId,
  getRelationshipLabel,
} from '../workspaceComponents'
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
  const query = searchParams ? await searchParams : {}
  const standingUpdated = query.standingUpdated === '1'
  const standingError = query.standingError === 'missing_scope'
  const updatedRows = typeof query.rows === 'string' ? query.rows : '0'
  const payload = await getPayload({ config })
  const [stagesResult, groupsResult, standingsResult] = await Promise.all([
    payload.find({
      collection: 'stages',
      depth: 1,
      limit: 100,
      sort: ['category_id', 'order'],
      where: {
        stage_type: {
          in: ['group_stage', 'round_robin', 'league', 'swiss'],
        },
      },
    }),
    payload.find({
      collection: 'groups',
      depth: 1,
      limit: 100,
      sort: ['stage_id', 'order'],
    }),
    payload.find({
      collection: 'standings',
      depth: 1,
      limit: 200,
      sort: ['category_id', 'stage_id', 'group_id', 'rank'],
    }),
  ])
  const stages = stagesResult.docs as WorkspaceStage[]
  const groups = groupsResult.docs as WorkspaceGroup[]
  const standings = standingsResult.docs as WorkspaceStanding[]
  const firstGroupStage = stages.find((stage) => stage.stage_type === 'group_stage') || stages[0]
  const firstGroup = firstGroupStage
    ? groups.find((group) => getRelationshipId(group.stage_id) === String(firstGroupStage.id))
    : undefined

  return (
    <main className="workspace-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="standings-workspace-title">
        <p className="eyebrow">Standings Workspace</p>
        <h1 id="standings-workspace-title">Group standings foundation</h1>
        <p className="summary">
          Recalculate cached standings for group-stage and round-robin scopes. Payload Admin remains
          the fallback editor for raw standing rows.
        </p>
        <div className="actions">
          <a href="/standings">View Public Standings</a>
          <a href="/admin/collections/standings">Backoffice Standings</a>
        </div>
      </section>

      {standingUpdated ? (
        <p className="match-banner match-banner--success">
          Standings recalculated. {updatedRows} row(s) updated.
        </p>
      ) : null}
      {standingError ? (
        <p className="match-banner match-banner--error">Choose a category and stage first.</p>
      ) : null}

      <section className="workspace-stats" aria-label="Standing stats">
        <StatBlock label="Standing rows" value={standings.length} />
        <StatBlock label="Ranking scopes" value={stages.length} />
        <StatBlock label="Groups" value={groups.length} />
      </section>

      <section className="workspace-grid workspace-grid--two" aria-label="Standing tools">
        <article className="workspace-panel">
          <h2>Recalculate Seeded Group</h2>
          {firstGroupStage && firstGroup ? (
            <form action={recalculateStandingScopeAction} className="standing-recalc-form">
              <input
                type="hidden"
                name="categoryId"
                value={getRelationshipId(firstGroupStage.category_id)}
              />
              <input type="hidden" name="stageId" value={firstGroupStage.id} />
              <input type="hidden" name="groupId" value={firstGroup.id} />
              <dl className="workspace-facts">
                <div>
                  <dt>Category</dt>
                  <dd>{getRelationshipLabel(firstGroupStage.category_id)}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{firstGroupStage.name || 'Group Stage'}</dd>
                </div>
                <div>
                  <dt>Group</dt>
                  <dd>{firstGroup.name || 'Group'}</dd>
                </div>
              </dl>
              <button type="submit" className="match-action-button">
                Recalculate Standings
              </button>
            </form>
          ) : (
            <p className="empty-state">
              No group-stage scope exists yet. Seed the demo event before recalculating standings.
            </p>
          )}
        </article>

        <article className="workspace-panel">
          <h2>Cached Standings</h2>
          {standings.length === 0 ? (
            <p className="empty-state">No cached standings yet.</p>
          ) : (
            <ul className="standing-summary-list">
              {standings.slice(0, 8).map((standing) => (
                <li key={standing.id}>
                  <strong>
                    #{standing.rank} {getRelationshipLabel(standing.entry_id)}
                  </strong>
                  <span>
                    {getRelationshipLabel(standing.category_id)} /{' '}
                    {getRelationshipLabel(standing.group_id, 'No group')} / {standing.points} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  )
}
