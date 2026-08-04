import Link from 'next/link'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { buildMedalTally, type MedalTallyRecord, type MedalType } from '@/lib/medals'
import { getActiveEvent } from '../../activeEvent'
import {
  NoActiveEventNotice,
  PageHero,
  StatBlock,
  StatGrid,
  getRelationshipId,
  getRelationshipLabel,
  type RelationshipDoc,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'
import { clearMedalOverrideAction, recalculateAllMedalsAction, setManualMedalAction } from './medalActions'

export const dynamic = 'force-dynamic'

type MedalRecordDoc = {
  id: string | number
  medal: MedalType
  is_manual: boolean
  source: string
  club_id?: RelationshipDoc | string | number | null
  category_id?: RelationshipDoc | string | number | null
  entry_id?: RelationshipDoc | string | number | null
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MedalsWorkspacePage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.medals,
    returnTo: '/workspaces/medals',
    workspaceName: 'Medal Tally Workspace',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const payload = access.payload
  const activeEvent = await getActiveEvent(payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Medal Tally Workspace"
          title="Medals & overall contingent standings"
          summary="Derive gold/silver/bronze from finished categories and rank contingents against each other (MSG-02)."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  // medal_tally_enabled/medal_ranking_method/medal_points_* are plain scalar fields on Events, so
  // they're present on the depth-0 doc getActiveEvent already fetched even though ActiveEventDoc's
  // own type doesn't declare them.
  const event = activeEvent as typeof activeEvent & {
    medal_tally_enabled?: boolean | null
    medal_ranking_method?: 'gold_first' | 'weighted_points' | null
    medal_points_gold?: number | null
    medal_points_silver?: number | null
    medal_points_bronze?: number | null
  }

  const query = searchParams ? await searchParams : {}
  const recalculated = query.medalRecalculated === '1'
  const writtenCount = typeof query.written === 'string' ? query.written : '0'
  const overrideSet = query.medalOverrideSet === '1'
  const overrideCleared = query.medalOverrideCleared === '1'
  const errorParam = typeof query.medalError === 'string' ? query.medalError : null

  if (!event.medal_tally_enabled) {
    return (
      <>
        <PageHero
          eyebrow="Medal Tally Workspace"
          title="Medals & overall contingent standings"
          summary="Derive gold/silver/bronze from finished categories and rank contingents against each other (MSG-02)."
        />
        <AlertBanner tone="info">
          Medal tally is off for {activeEvent.name}. Turn on &ldquo;Medal tally&rdquo; on the event&apos;s
          Details page to start deriving medals as categories finish.
        </AlertBanner>
      </>
    )
  }

  const recordsResult = await payload.find({
    collection: 'medal-records',
    depth: 2,
    limit: 2000,
    where: { event_id: { equals: activeEvent.id } },
  })
  const records = recordsResult.docs as unknown as MedalRecordDoc[]
  const mappedRecords = records.filter((record) => record.club_id)
  const unmappedRecords = records.filter((record) => !record.club_id)

  const tallyRecords: MedalTallyRecord[] = mappedRecords.map((record) => ({
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

  return (
    <>
      <PageHero
        eyebrow="Medal Tally Workspace"
        title="Medals & overall contingent standings"
        summary="Derive gold/silver/bronze from finished categories and rank contingents against each other (MSG-02)."
        actions={
          <>
            <Button asChild>
              <Link href={`/events/${activeEvent.slug}/medals`}>View Public Medal Tally</Link>
            </Button>
            <form action={recalculateAllMedalsAction}>
              <SubmitButton variant="secondary">Recalculate All Categories</SubmitButton>
            </form>
          </>
        }
      />

      {recalculated ? (
        <AlertBanner tone="success" className="mb-4">
          Medals recalculated across every medal-eligible category. {writtenCount} row(s) written.
        </AlertBanner>
      ) : null}
      {overrideSet ? (
        <AlertBanner tone="success" className="mb-4">
          Manual medal override saved.
        </AlertBanner>
      ) : null}
      {overrideCleared ? (
        <AlertBanner tone="success" className="mb-4">
          Override cleared - recalculated result restored where one exists.
        </AlertBanner>
      ) : null}
      {errorParam ? (
        <AlertBanner tone="error" className="mb-4">
          Could not save that - check the category and entry belong together.
        </AlertBanner>
      ) : null}

      <StatGrid>
        <StatBlock label="Contingents on tally" value={tally.length} />
        <StatBlock label="Medals awarded" value={records.length} />
        <StatBlock label="Unmapped medals" value={unmappedRecords.length} tone={unmappedRecords.length > 0 ? 'warn' : 'default'} />
      </StatGrid>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-line px-4 py-3">
            <CardTitle>Contingent standings</CardTitle>
          </div>
          {tally.length === 0 ? (
            <div className="p-4">
              <EmptyState>No medals mapped to a contingent yet.</EmptyState>
            </div>
          ) : (
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-ink-soft uppercase">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Contingent</th>
                  <th className="px-4 py-3 text-center">G</th>
                  <th className="px-4 py-3 text-center">S</th>
                  <th className="px-4 py-3 text-center">B</th>
                  <th className="px-4 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {tally.map((row) => (
                  <tr key={String(row.clubId)} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-bold text-ink">{row.rank}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{row.clubLabel}</td>
                    <td className="px-4 py-3 text-center font-bold text-gold">{row.gold}</td>
                    <td className="px-4 py-3 text-center text-ink-soft">{row.silver}</td>
                    <td className="px-4 py-3 text-center text-ink-soft">{row.bronze}</td>
                    <td className="px-4 py-3 text-center font-bold text-ink">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <CardTitle>Unmapped medals</CardTitle>
            <p className="text-xs text-ink-soft">
              These entries won a medal but couldn&apos;t be traced to a club - usually an individual/pair
              entry whose player or team is missing a club. Fix the participant&apos;s club, then
              recalculate.
            </p>
            {unmappedRecords.length === 0 ? (
              <EmptyState>Every medal is mapped to a contingent.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {unmappedRecords.map((record) => (
                  <li key={record.id} className="rounded-card border border-line bg-paper px-3 py-2 text-xs">
                    <strong className="block font-bold capitalize text-ink">{record.medal}</strong>
                    <span className="text-ink-soft">
                      {getRelationshipLabel(record.entry_id as RelationshipDoc, 'TBD')} &middot;{' '}
                      {getRelationshipLabel(record.category_id as RelationshipDoc, 'Category')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <CardTitle>Manual override</CardTitle>
            <p className="text-xs text-ink-soft">
              Overrides a category&apos;s medal for one position - use for a post-result disqualification
              or a category format recalculation doesn&apos;t derive automatically yet (double
              elimination). Replaces whatever recalculation would otherwise write for that slot.
            </p>
            <form action={setManualMedalAction} className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft uppercase">
                Category ID
                <input
                  name="categoryId"
                  required
                  className="rounded-card border border-line bg-paper px-3 py-2 text-sm font-normal normal-case text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft uppercase">
                Entry ID
                <input
                  name="entryId"
                  required
                  className="rounded-card border border-line bg-paper px-3 py-2 text-sm font-normal normal-case text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft uppercase">
                Medal
                <select
                  name="medal"
                  required
                  className="rounded-card border border-line bg-paper px-3 py-2 text-sm font-normal normal-case text-ink"
                >
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="bronze">Bronze</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-ink-soft uppercase">
                Note (optional)
                <input
                  name="note"
                  className="rounded-card border border-line bg-paper px-3 py-2 text-sm font-normal normal-case text-ink"
                />
              </label>
              <SubmitButton size="sm">Save override</SubmitButton>
            </form>
          </Card>

          {mappedRecords.some((record) => record.is_manual) ? (
            <Card className="flex flex-col gap-2">
              <CardTitle>Active overrides</CardTitle>
              <ul className="flex flex-col gap-2">
                {mappedRecords
                  .filter((record) => record.is_manual)
                  .map((record) => (
                    <li key={record.id} className="flex items-center justify-between gap-2 rounded-card border border-line bg-paper px-3 py-2 text-xs">
                      <span>
                        <strong className="font-bold capitalize text-ink">{record.medal}</strong>{' '}
                        <span className="text-ink-soft">
                          {getRelationshipLabel(record.entry_id as RelationshipDoc, 'TBD')} &middot;{' '}
                          {getRelationshipLabel(record.category_id as RelationshipDoc, 'Category')}
                        </span>
                      </span>
                      <form action={clearMedalOverrideAction}>
                        <input type="hidden" name="recordId" value={String(record.id)} />
                        <input
                          type="hidden"
                          name="categoryId"
                          value={String(getRelationshipId(record.category_id as RelationshipDoc))}
                        />
                        <SubmitButton size="sm" variant="secondary">
                          Clear
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </section>
    </>
  )
}
