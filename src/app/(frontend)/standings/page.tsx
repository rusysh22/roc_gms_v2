import { getPayload } from 'payload'

import config from '@payload-config'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { formatStatus, getRelationshipLabel } from '../workspaces/workspaceComponents'

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

// Global tone mapping per prd/redesign/README.md section 4.1 extended to standings: qualified is
// the "winner/positive" state (green), champion gets the sparse gold accent, everything else
// (eliminated, pending) is neutral rather than a red/error color.
const getQualifiedTone = (status: string): StatusTone => {
  switch (status) {
    case 'qualified':
      return 'green'
    case 'champion':
      return 'gold'
    case 'runner_up':
      return 'blue'
    default:
      return 'neutral'
  }
}

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
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-8">
        <div className="mx-auto max-w-4xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Public Standings
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">ROC Olympic 2026 Standings</h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Group and round-robin rankings, calculated from finished or result-published matches.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16" aria-label="Competition standings">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          {scopes.size === 0 ? (
            <Card className="text-sm text-ink-soft">
              No standings are available yet. Standings appear after a group or round-robin match
              has a finished result.
            </Card>
          ) : (
            Array.from(scopes.entries()).map(([scopeKey, rows]) => (
              <div key={scopeKey}>
                <p className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">
                  {scopeKey}
                </p>

                {/* Desktop / tablet: table */}
                <Card className="hidden overflow-x-auto p-0 sm:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-ink-soft">
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Entry</th>
                        <th className="px-3 py-3 text-right">P</th>
                        <th className="px-3 py-3 text-right">W</th>
                        <th className="px-3 py-3 text-right">D</th>
                        <th className="px-3 py-3 text-right">L</th>
                        <th className="px-3 py-3 text-right">Pts</th>
                        <th className="px-3 py-3 text-right">SD</th>
                        <th className="px-3 py-3 text-right">Set</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((standing) => (
                        <tr key={standing.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-3 font-bold tabular-nums">{standing.rank}</td>
                          <td className="px-4 py-3 font-semibold">
                            {getRelationshipLabel(standing.entry_id)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{standing.played}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{standing.won}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{standing.drawn}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{standing.lost}</td>
                          <td className="px-3 py-3 text-right font-bold tabular-nums">
                            {standing.points}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {standing.score_difference}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {standing.set_for}-{standing.set_against}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={getQualifiedTone(standing.qualified_status)}>
                              {formatStatus(standing.qualified_status)}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                {/* Mobile: cards */}
                <div className="flex flex-col gap-3 sm:hidden">
                  {rows.map((standing) => (
                    <Card key={standing.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-extrabold tabular-nums text-ink">
                            {standing.rank}
                          </span>
                          <CardTitle>{getRelationshipLabel(standing.entry_id)}</CardTitle>
                        </div>
                        <StatusBadge tone={getQualifiedTone(standing.qualified_status)}>
                          {formatStatus(standing.qualified_status)}
                        </StatusBadge>
                      </div>
                      <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <dt className="font-bold uppercase tracking-wide text-ink-soft">P</dt>
                          <dd className="mt-0.5 font-bold tabular-nums text-ink">{standing.played}</dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wide text-ink-soft">W-D-L</dt>
                          <dd className="mt-0.5 font-bold tabular-nums text-ink">
                            {standing.won}-{standing.drawn}-{standing.lost}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wide text-ink-soft">Pts</dt>
                          <dd className="mt-0.5 font-bold tabular-nums text-ink">{standing.points}</dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wide text-ink-soft">SD</dt>
                          <dd className="mt-0.5 font-bold tabular-nums text-ink">
                            {standing.score_difference}
                          </dd>
                        </div>
                      </dl>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
