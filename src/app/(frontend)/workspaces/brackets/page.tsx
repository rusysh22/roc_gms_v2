import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import {
  StatBlock,
  WorkspaceNav,
  getRelationshipId,
  getRelationshipLabel,
} from '../workspaceComponents'
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

export default async function BracketsWorkspacePage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const query = searchParams ? await searchParams : {}
  const bracketUpdated = query.bracketUpdated === '1'
  const bracketError = query.bracketError === 'missing_stage'
  const updatedMatches = typeof query.matches === 'string' ? query.matches : '0'
  const payload = await getPayload({ config })
  const [stagesResult, bracketsResult] = await Promise.all([
    payload.find({
      collection: 'stages',
      depth: 1,
      limit: 50,
      sort: ['category_id', 'order'],
      where: {
        stage_type: {
          equals: 'single_elimination',
        },
      },
    }),
    payload.find({
      collection: 'brackets',
      depth: 1,
      limit: 50,
      sort: ['category_id', 'stage_id'],
    }),
  ])
  const stages = stagesResult.docs as WorkspaceStage[]
  const brackets = bracketsResult.docs as WorkspaceBracket[]
  const firstStage = stages[0]

  return (
    <main className="workspace-shell">
      <WorkspaceNav />

      <section className="workspace-hero" aria-labelledby="brackets-workspace-title">
        <p className="eyebrow">Brackets Workspace</p>
        <h1 id="brackets-workspace-title">Single elimination bracket foundation</h1>
        <p className="summary">
          Generate cached bracket layout from single-elimination stage matches. The match records
          remain the source of truth for status, score, and winners.
        </p>
        <div className="actions">
          <a href="/brackets">View Public Brackets</a>
          <a href="/admin/collections/brackets">Backoffice Brackets</a>
        </div>
      </section>

      {bracketUpdated ? (
        <p className="match-banner match-banner--success">
          Bracket recalculated from {updatedMatches} match(es).
        </p>
      ) : null}
      {bracketError ? (
        <p className="match-banner match-banner--error">Choose a single-elimination stage first.</p>
      ) : null}

      <section className="workspace-stats" aria-label="Bracket stats">
        <StatBlock label="Bracket caches" value={brackets.length} />
        <StatBlock label="Single elimination stages" value={stages.length} />
        <StatBlock
          label="Cached matches"
          value={brackets.reduce(
            (sum, bracket) =>
              sum +
              (bracket.bracket_data?.rounds.reduce(
                (roundSum, round) => roundSum + round.matches.length,
                0,
              ) || 0),
            0,
          )}
        />
      </section>

      <section className="workspace-grid workspace-grid--two" aria-label="Bracket tools">
        <article className="workspace-panel">
          <h2>Recalculate Seeded Bracket</h2>
          {firstStage ? (
            <form action={recalculateBracketStageAction} className="standing-recalc-form">
              <input type="hidden" name="stageId" value={firstStage.id} />
              <dl className="workspace-facts">
                <div>
                  <dt>Category</dt>
                  <dd>{getRelationshipLabel(firstStage.category_id)}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{firstStage.name || 'Single Elimination'}</dd>
                </div>
                <div>
                  <dt>Stage ID</dt>
                  <dd>{getRelationshipId(firstStage)}</dd>
                </div>
              </dl>
              <button type="submit" className="match-action-button">
                Recalculate Bracket
              </button>
            </form>
          ) : (
            <p className="empty-state">
              No single-elimination stage exists yet. Seed the demo event before generating a
              bracket.
            </p>
          )}
        </article>

        <article className="workspace-panel">
          <h2>Cached Brackets</h2>
          {brackets.length === 0 ? (
            <p className="empty-state">No cached brackets yet.</p>
          ) : (
            <ul className="standing-summary-list">
              {brackets.map((bracket) => (
                <li key={bracket.id}>
                  <strong>{bracket.name}</strong>
                  <span>
                    {getRelationshipLabel(bracket.category_id)} /{' '}
                    {getRelationshipLabel(bracket.stage_id)} / {bracket.status}
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
