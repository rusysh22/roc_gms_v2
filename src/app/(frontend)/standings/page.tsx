import { getPayload } from 'payload'

import config from '@payload-config'
import {
  formatStatus,
  getRelationshipLabel,
} from '../workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

type StandingDoc = {
  id: string | number
  rank: number
  played: number
  won: number
  drawn: number
  lost: number
  points: number
  score_for: number
  score_against: number
  score_difference: number
  set_for: number
  set_against: number
  set_difference: number
  qualified_status: string
  event_id?: string | number | { name?: string } | null
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
  group_id?: string | number | { name?: string } | null
  entry_id?: string | number | { display_name?: string; name?: string } | null
}

const getScopeKey = (standing: StandingDoc) =>
  [
    getRelationshipLabel(standing.category_id, 'Category'),
    getRelationshipLabel(standing.stage_id, 'Stage'),
    getRelationshipLabel(standing.group_id, 'No group'),
  ].join(' / ')

export default async function PublicStandingsPage() {
  const payload = await getPayload({ config })
  const standingsResult = await payload.find({
    collection: 'standings',
    depth: 1,
    limit: 200,
    sort: ['category_id', 'stage_id', 'group_id', 'rank'],
  })
  const standings = standingsResult.docs as StandingDoc[]
  const scopes = standings.reduce<Map<string, StandingDoc[]>>((map, standing) => {
    const scopeKey = getScopeKey(standing)
    const rows = map.get(scopeKey) || []
    rows.push(standing)
    map.set(scopeKey, rows)

    return map
  }, new Map())

  return (
    <main className="schedule-shell">
      <section className="schedule-header" aria-labelledby="standings-title">
        <p className="eyebrow">Public Standings</p>
        <h1 id="standings-title">ROC Olympic 2026 Standings</h1>
        <p className="summary">
          Group and round-robin rankings are calculated from finished or result-published matches.
        </p>
        <div className="actions">
          <a href="/">Home</a>
          <a href="/schedule">Public Schedule</a>
        </div>
      </section>

      {scopes.size === 0 ? (
        <p className="empty-state">
          No standings are available yet. Standings appear after a group or round-robin match has a
          finished result and the standing cache has been recalculated.
        </p>
      ) : (
        <section className="standings-list" aria-label="Competition standings">
          {Array.from(scopes.entries()).map(([scopeKey, rows]) => (
            <article className="workspace-panel standings-panel" key={scopeKey}>
              <p className="match-meta">{scopeKey}</p>
              <div className="standings-table-wrap">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Entry</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>Pts</th>
                      <th>SF</th>
                      <th>SA</th>
                      <th>SD</th>
                      <th>Set</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((standing) => (
                      <tr key={standing.id}>
                        <td>{standing.rank}</td>
                        <td>{getRelationshipLabel(standing.entry_id)}</td>
                        <td>{standing.played}</td>
                        <td>{standing.won}</td>
                        <td>{standing.drawn}</td>
                        <td>{standing.lost}</td>
                        <td>{standing.points}</td>
                        <td>{standing.score_for}</td>
                        <td>{standing.score_against}</td>
                        <td>{standing.score_difference}</td>
                        <td>
                          {standing.set_for}-{standing.set_against}
                        </td>
                        <td>{formatStatus(standing.qualified_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
