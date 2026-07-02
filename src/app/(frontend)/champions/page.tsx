import Link from 'next/link'
import { getPayload } from 'payload'
import { ArrowRight, Crown } from 'lucide-react'

import config from '@payload-config'
import { cn } from '@/lib/utils'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import { Card } from '@/components/ui/card'
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
    status: 'pending' as const,
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
    <main className="font-sans text-ink">
      <section className="relative overflow-hidden px-4 pt-4 pb-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-0 h-64 w-64 rounded-full bg-gold/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Champions</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">ROC Olympic 2026 Champions</h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Champions are detected from published final or last-round match results — match
            records stay the source of truth.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16" aria-label="Champion list">
        <div className="mx-auto max-w-5xl">
          {brackets.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              No bracket caches are available yet. Champions will appear after elimination brackets
              are generated.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {brackets.map((bracket) => {
                const champion = getChampion(bracket.bracket_data)
                const isDecided = champion.status === 'decided'

                return (
                  <Card
                    key={bracket.id}
                    className={cn(
                      'flex flex-col gap-3',
                      isDecided && 'border-gold bg-gradient-to-br from-paper to-mist',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                        {getRelationshipLabel(bracket.category_id)} /{' '}
                        {getRelationshipLabel(bracket.stage_id)}
                      </p>
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          isDecided ? 'bg-gold text-paper' : 'bg-mist text-ink-soft',
                        )}
                      >
                        <Crown className="h-5 w-5" aria-hidden="true" />
                      </span>
                    </div>

                    <h2 className={cn('text-2xl font-extrabold', !isDecided && 'text-ink-soft')}>
                      {isDecided ? champion.label : 'Not decided yet'}
                    </h2>
                    <p className="text-sm text-ink-soft">{champion.reason}</p>

                    {champion.match_number ? (
                      <Link
                        href={`/matches/${champion.match_number}`}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue hover:underline"
                      >
                        View deciding match
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
