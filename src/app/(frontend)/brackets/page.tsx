import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import {
  formatStatus,
  getRelationshipLabel,
} from '../workspaces/workspaceComponents'

export const dynamic = 'force-dynamic'

type PublicBracket = {
  id: string | number
  name: string
  format: string
  status: string
  bracket_data?: SingleEliminationBracketData | null
  event_id?: string | number | { name?: string } | null
  category_id?: string | number | { name?: string } | null
  stage_id?: string | number | { name?: string } | null
}

const getScoreLabel = (match: SingleEliminationBracketData['rounds'][number]['matches'][number]) =>
  match.score_summary || (match.set_score ? `Sets: ${match.set_score}` : 'Score not published')

const getChampion = (bracketData?: SingleEliminationBracketData | null) =>
  bracketData?.champion || {
    status: 'pending',
    reason: 'Champion metadata has not been generated yet.',
  }

export default async function PublicBracketsPage() {
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
  const brackets = bracketsResult.docs as PublicBracket[]

  return (
    <main className="schedule-shell bracket-shell">
      <section className="schedule-header" aria-labelledby="brackets-title">
        <p className="eyebrow">Public Brackets</p>
        <h1 id="brackets-title">ROC Olympic 2026 Brackets</h1>
        <p className="summary">
          Single-elimination brackets are rendered from match records. Match status, scores, and
          winners remain sourced from the match data.
        </p>
        <div className="actions">
          <a href="/">Home</a>
          <a href="/schedule">Public Schedule</a>
          <a href="/standings">Standings</a>
          <a href="/champions">Champions</a>
        </div>
      </section>

      {brackets.length === 0 ? (
        <p className="empty-state">
          No public brackets are available yet. Brackets appear after an elimination stage is seeded
          and the bracket cache is generated.
        </p>
      ) : (
        <section className="bracket-list" aria-label="Tournament brackets">
          {brackets.map((bracket) => (
            <article className="workspace-panel bracket-panel" key={bracket.id}>
              <div className="bracket-heading">
                <div>
                  <p className="match-meta">
                    {getRelationshipLabel(bracket.category_id)} /{' '}
                    {getRelationshipLabel(bracket.stage_id)}
                  </p>
                  <h2>{bracket.name}</h2>
                </div>
                <span>{formatStatus(bracket.status)}</span>
              </div>

              {!bracket.bracket_data || bracket.bracket_data.rounds.length === 0 ? (
                <p className="empty-state">This bracket has no matches yet.</p>
              ) : (
                <>
                  <section
                    className={
                      getChampion(bracket.bracket_data).status === 'decided' ?
                        'champion-banner champion-banner--decided'
                      : 'champion-banner'
                    }
                    aria-label="Champion status"
                  >
                    <div>
                      <p className="match-meta">Champion</p>
                      <h3>
                        {getChampion(bracket.bracket_data).status === 'decided' ?
                          getChampion(bracket.bracket_data).label
                        : 'Not decided yet'}
                      </h3>
                    </div>
                    <p>{getChampion(bracket.bracket_data).reason}</p>
                  </section>

                  <div className="bracket-scroll">
                    <div className="bracket-rounds">
                      {bracket.bracket_data.rounds.map((round) => (
                        <section className="bracket-round" key={round.name}>
                          <h3>{round.name}</h3>
                          <div className="bracket-match-list">
                            {round.matches.map((match) => {
                              const champion = getChampion(bracket.bracket_data)
                              const isChampionMatch =
                                champion.status === 'decided' &&
                                String(champion.match_id) === String(match.id)

                              return (
                                <a
                                  className={
                                    isChampionMatch ?
                                      'bracket-match-card bracket-match-card--champion'
                                    : 'bracket-match-card'
                                  }
                                  href={match.detail_href}
                                  key={match.id}
                                >
                                  <div className="bracket-match-card__topline">
                                    <strong>{match.match_number}</strong>
                                    <span>{formatStatus(match.status)}</span>
                                  </div>
                                  <div className="bracket-participants">
                                    <p
                                      className={
                                        match.participant_a.isWinner ?
                                          'bracket-participant bracket-participant--winner'
                                        : 'bracket-participant'
                                      }
                                    >
                                      <span>{match.participant_a.seed || '-'}</span>
                                      {match.participant_a.label}
                                    </p>
                                    <p
                                      className={
                                        match.participant_b.isWinner ?
                                          'bracket-participant bracket-participant--winner'
                                        : 'bracket-participant'
                                      }
                                    >
                                      <span>{match.participant_b.seed || '-'}</span>
                                      {match.participant_b.label}
                                    </p>
                                  </div>
                                  <p className="bracket-score">{getScoreLabel(match)}</p>
                                </a>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
