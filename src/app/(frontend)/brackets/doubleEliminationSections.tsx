import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { BracketTree } from './bracketTree'

// Shared "three stacked BracketTree sections" (winners / losers / grand final) view for a double
// elimination bracket - used by the authenticated public bracket page, the public sport/category
// detail page, and the no-login Quick Bracket Tournament result page. Previously duplicated
// verbatim across the first two call sites; extracted once a third caller needed it.
export const DoubleEliminationBracketSections = ({
  bracketData,
  timezone,
  quickBracketSlug,
}: {
  bracketData: DoubleEliminationBracketData
  timezone: string
  quickBracketSlug?: string
}) => {
  const { grand_final: grandFinal, grand_final_reset: grandFinalReset } = bracketData
  const grandFinalRounds =
    grandFinal ?
      [
        {
          name: 'Grand Final',
          order: 0,
          matches: [
            grandFinal,
            // AUDIT_TOURNAMENT_STANDARDS BRK-03: the reset match is created up front as 'draft' -
            // it only actually happens if the losers-bracket finalist wins the grand final. Show it
            // only once it's a real fixture (a participant filled in / it has been played), so the
            // bracket doesn't imply a second game is certain when it's conditional.
            ...(grandFinalReset &&
            grandFinalReset.status !== 'cancelled' &&
            grandFinalReset.status !== 'draft'
              ? [grandFinalReset]
              : []),
          ],
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-extrabold text-ink">Winners bracket</h3>
        <BracketTree
          rounds={bracketData.winners_rounds}
          champion={null}
          timezone={timezone}
          quickBracketSlug={quickBracketSlug}
        />
      </div>
      {bracketData.losers_rounds.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-extrabold text-ink">Losers bracket</h3>
          <BracketTree
            rounds={bracketData.losers_rounds}
            champion={null}
            timezone={timezone}
            quickBracketSlug={quickBracketSlug}
          />
        </div>
      ) : null}
      {grandFinalRounds.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-extrabold text-ink">Grand final</h3>
          <BracketTree
            rounds={grandFinalRounds}
            champion={bracketData.champion}
            timezone={timezone}
            quickBracketSlug={quickBracketSlug}
          />
        </div>
      ) : null}
    </div>
  )
}
