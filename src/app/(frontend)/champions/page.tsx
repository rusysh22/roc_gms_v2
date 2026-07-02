import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import { getRelationshipLabel } from '../workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

type ChampionBracket = {
  id: string | number
  name: string
  status: string
  bracket_data?: SingleEliminationBracketData | null
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
}

const getChampion = (bracketData?: SingleEliminationBracketData | null) =>
  bracketData?.champion || {
    status: 'pending',
    reason: 'Champion metadata has not been generated yet.',
  }

export default async function ChampionsPage() {
  const payload = await getPayload({ config })
  const bracketsResult = await payload.find({
    collection: 'brackets',
    depth: 1,
    limit: 50,
    sort: ['category_id', 'stage_id'],
    where: {
      status: {
        in: ['published', 'locked'],
      },
    },
  })
  const brackets = bracketsResult.docs as ChampionBracket[]

  return (
    <main className="schedule-shell">
      <section className="schedule-header" aria-labelledby="champions-title">
        <p className="eyebrow">Champions</p>
        <h1 id="champions-title">ROC Olympic 2026 Champions</h1>
        <p className="summary">
          Champions are detected from published final or last-round match results. Match records
          remain the source of truth.
        </p>
        <div className="actions">
          <a href="/">Home</a>
          <a href="/brackets">Brackets</a>
          <a href="/schedule">Schedule</a>
        </div>
      </section>

      {brackets.length === 0 ? (
        <p className="empty-state">
          No bracket caches are available yet. Champions will appear after elimination brackets are
          generated.
        </p>
      ) : (
        <section className="champion-list" aria-label="Champion list">
          {brackets.map((bracket) => {
            const champion = getChampion(bracket.bracket_data)

            return (
              <article
                className={
                  champion.status === 'decided' ?
                    'workspace-panel champion-card champion-card--decided'
                  : 'workspace-panel champion-card'
                }
                key={bracket.id}
              >
                <p className="match-meta">
                  {getRelationshipLabel(bracket.category_id)} /{' '}
                  {getRelationshipLabel(bracket.stage_id)}
                </p>
                <h2>{champion.status === 'decided' ? champion.label : 'Not decided yet'}</h2>
                <p>{champion.reason}</p>
                {champion.match_number ? (
                  <a className="match-card__details-link" href={`/matches/${champion.match_number}`}>
                    View deciding match
                  </a>
                ) : null}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
