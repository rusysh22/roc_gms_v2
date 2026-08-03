import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { AutoRefresh } from '@/components/auto-refresh'
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
  bracket_data?: SingleEliminationBracketData | DoubleEliminationBracketData | null
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold sm:text-4xl">{event.name} Brackets</h1>
            <AutoRefresh showIndicator className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-soft" />
          </div>
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

                {!bracket.bracket_data ? (
                  <Card className="text-sm text-ink-soft">This bracket has no matches yet.</Card>
                ) : bracket.bracket_data.format === 'double_elimination' ? (
                  <DoubleEliminationBracketSections bracketData={bracket.bracket_data} />
                ) : bracket.bracket_data.rounds.length === 0 ? (
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

// Same "three stacked BracketTree sections" approach as the workspace wizard's bracket step
// (src/app/(frontend)/workspaces/(focus)/event-admin/new-event/page.tsx's
// DoubleEliminationBracketView) - kept consistent rather than building a second, differently
// shaped renderer for the public page.
const DoubleEliminationBracketSections = ({ bracketData }: { bracketData: DoubleEliminationBracketData }) => {
  const { grand_final: grandFinal, grand_final_reset: grandFinalReset } = bracketData
  const grandFinalRounds =
    grandFinal ?
      [
        {
          name: 'Grand Final',
          order: 0,
          matches: [
            grandFinal,
            ...(grandFinalReset && grandFinalReset.status !== 'cancelled' ? [grandFinalReset] : []),
          ],
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-extrabold text-ink">Winners bracket</h3>
        <BracketTree rounds={bracketData.winners_rounds} champion={null} />
      </div>
      {bracketData.losers_rounds.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-extrabold text-ink">Losers bracket</h3>
          <BracketTree rounds={bracketData.losers_rounds} champion={null} />
        </div>
      ) : null}
      {grandFinalRounds.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-extrabold text-ink">Grand final</h3>
          <BracketTree rounds={grandFinalRounds} champion={bracketData.champion} />
        </div>
      ) : null}
    </div>
  )
}
