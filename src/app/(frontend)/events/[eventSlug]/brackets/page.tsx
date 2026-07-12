import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatStatus, getRelationshipLabel } from '../../../workspaces/workspaceComponents'
import { BracketTree } from '../../../brackets/bracketTree'
import { getPublicEventBySlug } from '../../publicEvents'

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

export default async function PublicBracketsPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }

  const bracketsResult = await payload.find({
    collection: 'brackets',
    depth: 1,
    limit: 50,
    sort: ['category_id', 'stage_id'],
    where: {
      and: [{ event_id: { equals: event.id } }, { status: { in: ['published', 'locked'] } }],
    },
  })
  const brackets = bracketsResult.docs as PublicBracket[]

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Public Brackets
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{event.name} Brackets</h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Single-elimination brackets rendered from match records. Status, scores, and winners
            stay sourced from the match data - nothing here is edited directly.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16" aria-label="Tournament brackets">
        <div className="mx-auto flex max-w-7xl flex-col gap-10">
          {brackets.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              No public brackets are available yet. Brackets appear after an elimination stage is
              seeded and the bracket cache is generated.
            </Card>
          ) : (
            brackets.map((bracket) => (
              <div key={bracket.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      {getRelationshipLabel(bracket.category_id)} /{' '}
                      {getRelationshipLabel(bracket.stage_id)}
                    </p>
                    <h2 className="text-xl font-extrabold">{bracket.name}</h2>
                  </div>
                  <StatusBadge tone={bracket.status === 'published' ? 'green' : 'neutral'}>
                    {formatStatus(bracket.status)}
                  </StatusBadge>
                </div>

                {!bracket.bracket_data || bracket.bracket_data.rounds.length === 0 ? (
                  <Card className="text-sm text-ink-soft">This bracket has no matches yet.</Card>
                ) : (
                  <BracketTree
                    rounds={bracket.bracket_data.rounds}
                    champion={bracket.bracket_data.champion}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
