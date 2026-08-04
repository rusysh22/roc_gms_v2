import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { Medal } from 'lucide-react'

import config from '@payload-config'
import { buildMedalTally, type MedalTallyRecord, type MedalType } from '@/lib/medals'
import { Card, CardTitle } from '@/components/ui/card'
import { getRelationshipId, getRelationshipLabel, type RelationshipDoc } from '../../../workspaces/workspaceComponents'
import { getPublicEventBySlug } from '../../publicEvents'

export const dynamic = 'force-dynamic'

type MedalRecordDoc = {
  id: string | number
  medal: MedalType
  club_id?: (RelationshipDoc & { name?: string }) | string | number | null
  category_id?: (RelationshipDoc & { name?: string }) | string | number | null
  entry_id?: (RelationshipDoc & { display_name?: string }) | string | number | null
}

// MSG-02: the public counterpart to /workspaces/medals - read-only, no "unmapped medals" panel
// (that's an admin data-quality concern, not something a visitor needs to see), no manual-override
// controls. Anonymous visitors only ever reach this for an event with medal_tally_enabled on -
// notFound() otherwise, same pattern the poster route uses for a feature-gated page.
export default async function EventMedalsPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event || !event.medal_tally_enabled) {
    notFound()
  }

  const recordsResult = await payload.find({
    collection: 'medal-records',
    depth: 2,
    limit: 2000,
    where: { event_id: { equals: event.id } },
  })
  const records = recordsResult.docs as unknown as MedalRecordDoc[]

  const tallyRecords: MedalTallyRecord[] = records
    .filter((record) => record.club_id)
    .map((record) => ({
      clubId: getRelationshipId(record.club_id as RelationshipDoc),
      clubLabel: getRelationshipLabel(record.club_id as RelationshipDoc, 'Unknown'),
      medal: record.medal,
      weight: 1,
    }))

  const method = event.medal_ranking_method || 'gold_first'
  const tally = buildMedalTally(tallyRecords, {
    method,
    pointsGold: event.medal_points_gold ?? 3,
    pointsSilver: event.medal_points_silver ?? 2,
    pointsBronze: event.medal_points_bronze ?? 1,
  })

  const recordsByCategory = new Map<string, { label: string; records: MedalRecordDoc[] }>()
  for (const record of records) {
    const categoryId = getRelationshipId(record.category_id as RelationshipDoc) || 'unknown'
    const bucket = recordsByCategory.get(categoryId) ?? {
      label: getRelationshipLabel(record.category_id as RelationshipDoc, 'Category'),
      records: [],
    }
    bucket.records.push(record)
    recordsByCategory.set(categoryId, bucket)
  }
  const medalOrder: MedalType[] = ['gold', 'silver', 'bronze']

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-ink-soft uppercase">
          <Medal className="h-4 w-4" aria-hidden="true" /> Medal Tally
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-ink">{event.name}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Overall standings across every category, ranked{' '}
          {method === 'weighted_points' ? 'by weighted points' : 'gold-first, Olympic-style'}.
        </p>
      </div>

      {tally.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">No medals have been decided yet - check back once categories finish.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-ink-soft uppercase">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Contingent</th>
                <th className="px-4 py-3 text-center">Gold</th>
                <th className="px-4 py-3 text-center">Silver</th>
                <th className="px-4 py-3 text-center">Bronze</th>
                <th className="px-4 py-3 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {tally.map((row) => (
                <tr key={String(row.clubId)} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-bold text-ink">{row.rank}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{row.clubLabel}</td>
                  <td className="px-4 py-3 text-center font-bold text-gold">{row.gold}</td>
                  <td className="px-4 py-3 text-center font-semibold text-ink-soft">{row.silver}</td>
                  <td className="px-4 py-3 text-center font-semibold text-ink-soft">{row.bronze}</td>
                  <td className="px-4 py-3 text-center font-bold text-ink">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {recordsByCategory.size > 0 ? (
        <div className="flex flex-col gap-3">
          <CardTitle>Medals by category</CardTitle>
          <div className="flex flex-col gap-2">
            {Array.from(recordsByCategory.entries()).map(([categoryId, bucket]) => (
              <Card key={categoryId} className="flex flex-col gap-2">
                <p className="text-sm font-bold text-ink">{bucket.label}</p>
                <ul className="flex flex-col gap-1 text-sm text-ink-soft">
                  {medalOrder.map((medal) =>
                    bucket.records
                      .filter((record) => record.medal === medal)
                      .map((record) => (
                        <li key={record.id} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 font-semibold capitalize text-ink">{medal}</span>
                          <span>
                            {getRelationshipLabel(record.entry_id as RelationshipDoc, 'TBD')}
                            {record.club_id ? ` (${getRelationshipLabel(record.club_id as RelationshipDoc, '')})` : ''}
                          </span>
                        </li>
                      )),
                  )}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <Link href={`/events/${eventSlug}`} className="text-sm font-bold text-brand-secondary underline underline-offset-2">
        &larr; Back to {event.name}
      </Link>
    </main>
  )
}
