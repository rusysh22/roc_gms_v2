import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Payload } from 'payload'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  computeCrossGroupQualifierOrder,
  findSameGroupFirstRoundPairings,
  type GroupStandingForSeeding,
} from '@/lib/matchGeneration'
import { calculateStandingsForScope } from '@/lib/standings'
import { UNSTARTED_TARGET_STATUSES } from '@/lib/winnerAdvancement'
import { formatStatus, getRelationshipId, getRelationshipLabel, type RelationshipDoc } from '../../../workspaceComponents'
import { ConfirmSubmitButton } from '../../../matches/ConfirmSubmitButton'
import {
  autoSplitGroupsAction,
  createGroupsAction,
  finalizeGroupStandingsAction,
  generateGroupMatchesAction,
  recordGroupMatchResultAction,
  saveGroupAssignmentsAction,
  setGroupQualifyCountAction,
  undoPromoteToKnockoutAction,
} from './groupActions'
import { QualifierSeedOrder } from './QualifierSeedOrder'

const RESULT_STATUSES = new Set(['result_published', 'walkover'])

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

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 5, option A (full pipeline): four sibling Cards - matching
// DrawStep/GenerateStep's established granularity (a fragment of Cards, never one big panel) -
// covering the whole group_stage_to_knockout lifecycle this format has never had: assign entries to
// groups, generate group round-robins, watch live standings through to finalize, then promote
// qualifiers into a knockout bracket. Rendered inside GenerateStep in place of that format's old
// dead-end "manual scheduling only" badge.
export const GroupKnockoutPanel = async ({
  payload,
  eventId,
  categoryId,
  category,
}: {
  payload: Payload
  eventId: string
  categoryId: string
  category: { name: string; slug: string; group_qualify_count?: number | null }
}) => {
  const groupStageResult = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 1,
    where: { and: [{ category_id: { equals: categoryId } }, { order: { equals: 1 } }] },
  })
  const groupStage = groupStageResult.docs[0]

  const [groupsResult, entriesResult, groupMatchesResult] = await Promise.all([
    groupStage
      ? payload.find({
          collection: 'groups',
          depth: 0,
          limit: 12,
          sort: 'order',
          where: { stage_id: { equals: groupStage.id } },
        })
      : Promise.resolve({ docs: [] }),
    payload.find({
      collection: 'competition-entries',
      depth: 0,
      limit: 500,
      sort: 'display_name',
      where: { and: [{ category_id: { equals: categoryId } }, { status: { equals: 'confirmed' } }] },
    }),
    groupStage
      ? payload.find({ collection: 'matches', depth: 0, limit: 500, where: { stage_id: { equals: groupStage.id } } })
      : Promise.resolve({ docs: [] }),
  ])
  const groups = groupsResult.docs
  const entries = entriesResult.docs
  const entryLabelById = new Map(entries.map((entry) => [String(entry.id), String(entry.display_name)]))
  const groupMatches = groupMatchesResult.docs as Array<{
    id: string | number
    group_id?: unknown
    round_name?: string | null
    match_number?: string | null
    status: string
    participant_a_entry_id?: unknown
    participant_b_entry_id?: unknown
    winner_entry_id?: unknown
  }>
  const matchesByGroupId = new Map<string, typeof groupMatches>()
  for (const match of groupMatches) {
    const key = String(match.group_id)
    matchesByGroupId.set(key, [...(matchesByGroupId.get(key) ?? []), match])
  }

  const entryCountByGroup = new Map<string, number>()
  for (const entry of entries) {
    if (entry.group_id) {
      const key = String(entry.group_id)
      entryCountByGroup.set(key, (entryCountByGroup.get(key) || 0) + 1)
    }
  }
  const matchCountByGroup = new Map<string, number>()
  const decidedCountByGroup = new Map<string, number>()
  for (const match of groupMatchesResult.docs) {
    const key = String(match.group_id)
    matchCountByGroup.set(key, (matchCountByGroup.get(key) || 0) + 1)
    if (RESULT_STATUSES.has(String(match.status))) {
      decidedCountByGroup.set(key, (decidedCountByGroup.get(key) || 0) + 1)
    }
  }
  const allGroupMatchesDecided =
    groupMatchesResult.docs.length > 0 && groupMatchesResult.docs.every((match) => RESULT_STATUSES.has(String(match.status)))
  const isFinalized = groupStage?.status === 'completed'

  // ---- Card 1: groups & qualifiers -------------------------------------------------------------
  const groupsCard = (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Groups &amp; qualifiers</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Split entries into groups, then set how many advance from each group into the knockout
          stage.
        </p>
      </div>

      {groups.length === 0 ? (
        <form action={createGroupsAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <Field label="Number of groups" className="w-40">
            <Input name="groupCount" type="number" min="2" max="12" defaultValue="2" />
          </Field>
          <SubmitButton>Create groups</SubmitButton>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <form action={createGroupsAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <Field label="Total groups" className="w-28">
                <Input name="groupCount" type="number" min="2" max="12" defaultValue={String(groups.length)} />
              </Field>
              <Button type="submit" variant="secondary" size="sm">
                Update
              </Button>
            </form>
            <form action={autoSplitGroupsAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <SubmitButton variant="secondary" size="sm">
                Auto-split entries evenly
              </SubmitButton>
            </form>
            <form action={setGroupQualifyCountAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <Field label="Qualifiers per group" className="w-36">
                <Input
                  name="qualifyCount"
                  type="number"
                  min="1"
                  defaultValue={String(category.group_qualify_count || 2)}
                />
              </Field>
              <Button type="submit" variant="secondary" size="sm">
                Save
              </Button>
            </form>
          </div>

          {entries.length === 0 ? (
            <EmptyState>No confirmed entries yet - add participants in Registration first.</EmptyState>
          ) : (
            <form action={saveGroupAssignmentsAction} className="flex flex-col gap-3">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Entry</TableHead>
                      <TableHead>Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-bold">{entry.display_name}</TableCell>
                        <TableCell>
                          <Select
                            name={`group_${entry.id}`}
                            defaultValue={entry.group_id ? String(entry.group_id) : ''}
                            className="w-40"
                          >
                            <option value="">Unassigned</option>
                            {groups.map((group) => (
                              <option key={group.id} value={String(group.id)}>
                                {group.name}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <SubmitButton>Save assignments</SubmitButton>
              </div>
            </form>
          )}
        </>
      )}
    </Card>
  )

  // ---- Card 2: group matches -------------------------------------------------------------------
  const matchesCard = (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Group matches</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Generate a round-robin schedule for every group with at least two assigned entries.
        </p>
      </div>
      {groups.length === 0 ? (
        <EmptyState>Create groups first.</EmptyState>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Matches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-bold">{group.name}</TableCell>
                  <TableCell>{entryCountByGroup.get(String(group.id)) || 0}</TableCell>
                  <TableCell>
                    {matchCountByGroup.get(String(group.id)) || 0} ({decidedCountByGroup.get(String(group.id)) || 0}{' '}
                    decided)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {groupMatches.length === 0 ? (
            <form action={generateGroupMatchesAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <SubmitButton>Generate round-robin matches</SubmitButton>
            </form>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs text-ink-soft">
                  Enter each match&apos;s final score below to record its result. Full lifecycle
                  scoring (live points, per-set, referees) lives in the{' '}
                  <Link href="/workspaces/matches" className="font-semibold underline">
                    Matches workspace
                  </Link>{' '}
                  - this shortcut is for an organizer scoring a small group stage themselves. Every
                  group match needs a result before you can finalize and promote to the knockout.
                </p>
              </div>
              {groups.map((group) => {
                const groupFixtures = matchesByGroupId.get(String(group.id)) ?? []
                if (groupFixtures.length === 0) return null
                return (
                  <div key={group.id} className="flex flex-col gap-2">
                    <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">{group.name}</p>
                    {groupFixtures.map((match) => {
                      const labelA = entryLabelById.get(String(match.participant_a_entry_id)) || 'TBD'
                      const labelB = entryLabelById.get(String(match.participant_b_entry_id)) || 'TBD'
                      const decided = RESULT_STATUSES.has(String(match.status))
                      const winnerId = String(match.winner_entry_id ?? '')
                      return (
                        <div
                          key={match.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-paper px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 font-semibold text-ink">
                            {labelA} <span className="text-ink-soft">vs</span> {labelB}
                          </span>
                          {decided ? (
                            <StatusBadge tone="green">
                              Result in
                              {winnerId
                                ? ` · ${entryLabelById.get(winnerId) || 'winner'} won`
                                : ''}
                            </StatusBadge>
                          ) : (
                            <form
                              action={recordGroupMatchResultAction}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <input type="hidden" name="eventId" value={eventId} />
                              <input type="hidden" name="categoryId" value={categoryId} />
                              <input type="hidden" name="matchId" value={String(match.id)} />
                              <Input
                                name="scoreA"
                                type="number"
                                min="0"
                                required
                                aria-label={`${labelA} score`}
                                className="h-9 w-16"
                              />
                              <span className="text-ink-soft">-</span>
                              <Input
                                name="scoreB"
                                type="number"
                                min="0"
                                required
                                aria-label={`${labelB} score`}
                                className="h-9 w-16"
                              />
                              <Select name="winner" defaultValue="" className="h-9 w-32 text-xs">
                                <option value="">Winner if drawn…</option>
                                <option value="A">{labelA}</option>
                                <option value="B">{labelB}</option>
                              </Select>
                              <SubmitButton size="sm" variant="secondary">
                                Save score
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <form action={generateGroupMatchesAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="categoryId" value={categoryId} />
                <SubmitButton variant="ghost" size="sm">
                  Re-generate any missing fixtures
                </SubmitButton>
              </form>
            </div>
          )}
        </>
      )}
    </Card>
  )

  // ---- Card 3: standings & finalize ------------------------------------------------------------
  const standingsByGroup =
    groups.length > 0
      ? await Promise.all(
          groups.map((group) =>
            calculateStandingsForScope(payload, { eventId, categoryId, stageId: groupStage!.id, groupId: group.id }),
          ),
        )
      : []

  const standingsCard = (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Standings &amp; finalize</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Standings update live as results come in. Finalizing locks them in and marks who
          qualifies for the knockout stage.
        </p>
      </div>
      {groups.length === 0 ? (
        <EmptyState>Create groups first.</EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {groups.map((group, index) => (
              <div key={group.id}>
                <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">{group.name}</p>
                {standingsByGroup[index]?.rows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Entry</TableHead>
                        <TableHead>P</TableHead>
                        <TableHead>Pts</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standingsByGroup[index].rows.map((row) => (
                        <TableRow key={row.entry_id}>
                          <TableCell>{row.rank}</TableCell>
                          <TableCell className="font-bold">{row.entry_label}</TableCell>
                          <TableCell>{row.played}</TableCell>
                          <TableCell>{row.points}</TableCell>
                          <TableCell>
                            <StatusBadge tone={getQualifiedTone(row.qualified_status)}>
                              {formatStatus(row.qualified_status)}
                            </StatusBadge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState>No matches generated for this group yet.</EmptyState>
                )}
              </div>
            ))}
          </div>
          {isFinalized ? (
            <AlertBanner tone="success">Group stage finalized - standings are locked.</AlertBanner>
          ) : (
            <form action={finalizeGroupStandingsAction} className="flex flex-col gap-2">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              {!allGroupMatchesDecided ? (
                <p className="text-xs font-semibold text-gold">
                  Every group match needs a published result before finalizing.
                </p>
              ) : null}
              <div>
                <SubmitButton disabled={!allGroupMatchesDecided}>Finalize &amp; lock group stage</SubmitButton>
              </div>
            </form>
          )}
        </>
      )}
    </Card>
  )

  // ---- Card 4: promote to knockout -------------------------------------------------------------
  const knockoutStageResult = await payload.find({
    collection: 'stages',
    depth: 0,
    limit: 1,
    where: { and: [{ category_id: { equals: categoryId } }, { order: { equals: 2 } }] },
  })
  const knockoutStage = knockoutStageResult.docs[0]
  const knockoutMatchesResult = knockoutStage
    ? await payload.find({ collection: 'matches', depth: 0, limit: 500, where: { stage_id: { equals: knockoutStage.id } } })
    : { totalDocs: 0, docs: [] as Array<{ status: string }> }
  const alreadyPromoted = Boolean(knockoutStage) && knockoutMatchesResult.totalDocs > 0
  // Section 15.5's lock: Undo Phase can only reverse a promotion that hasn't started playing yet -
  // once any knockout match has progressed, deleting it would destroy real results, so the button
  // is replaced with an explanatory banner instead.
  const knockoutStarted = knockoutMatchesResult.docs.some((match) => !UNSTARTED_TARGET_STATUSES.has(String(match.status)))

  let promoteCard: ReactNode

  if (!isFinalized) {
    promoteCard = (
      <Card className="flex flex-col gap-3">
        <CardTitle>Promote to knockout</CardTitle>
        <EmptyState>Finalize the group stage above to compute qualifiers.</EmptyState>
      </Card>
    )
  } else if (alreadyPromoted) {
    promoteCard = (
      <Card className="flex flex-col gap-3">
        <CardTitle>Promote to knockout</CardTitle>
        <AlertBanner tone="success">Knockout bracket generated. Group results are locked while this phase is active.</AlertBanner>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={`/workspaces/event-admin/new-event?eventId=${eventId}&step=bracket&categoryId=${categoryId}`}>
              View bracket
            </Link>
          </Button>
          {knockoutStarted ? (
            <p className="text-xs text-ink-soft">
              Knockout matches have already started - this phase can no longer be undone.
            </p>
          ) : (
            <form id="undo-promote-to-knockout-form" action={undoPromoteToKnockoutAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <ConfirmSubmitButton
                formId="undo-promote-to-knockout-form"
                variant="secondary"
                tone="destructive"
                confirmMessage="Undo this phase? The generated knockout matches will be deleted and group results will unlock for revision."
              >
                Undo Phase
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </Card>
    )
  } else {
    // Persisted standings rows (frozen by finalizeGroupStandingsAction), not the live
    // calculateStandingsForScope calls above - promotion must reflect the locked result, not
    // whatever the standings happen to say right now.
    const persistedStandings = await payload.find({
      collection: 'standings',
      depth: 1,
      limit: 200,
      sort: ['group_id', 'rank'],
      where: { and: [{ category_id: { equals: categoryId } }, { stage_id: { equals: groupStage!.id } }] },
    })
    const qualifiersByGroupOrdered: GroupStandingForSeeding[][] = groups.map((group) =>
      persistedStandings.docs
        .filter((row) => String(getRelationshipId(row.group_id as RelationshipDoc)) === String(group.id))
        .filter((row) => row.qualified_status === 'qualified')
        .sort((left, right) => Number(left.rank) - Number(right.rank))
        .map((row) => ({
          entryId: String(getRelationshipId(row.entry_id as RelationshipDoc) ?? row.entry_id),
          displayName: getRelationshipLabel(row.entry_id as RelationshipDoc, 'TBD'),
          groupId: String(group.id),
          groupLabel: group.name,
          rankInGroup: Number(row.rank),
        })),
    )
    const order = computeCrossGroupQualifierOrder(qualifiersByGroupOrdered)
    const collisions = findSameGroupFirstRoundPairings(order)

    promoteCard = (
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Promote to knockout</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            {order.length} qualifier{order.length === 1 ? '' : 's'} seeded across groups. Reorder if
            needed, then generate the bracket.
          </p>
        </div>
        {order.length < 2 ? (
          <EmptyState>Not enough qualified entries yet.</EmptyState>
        ) : (
          <QualifierSeedOrder
            eventId={eventId}
            categoryId={categoryId}
            qualifiers={order.map((qualifier) => ({
              entryId: String(qualifier.entryId),
              displayName: qualifier.displayName,
              groupLabel: qualifier.groupLabel,
            }))}
            hasSameGroupPairing={collisions.length > 0}
          />
        )}
      </Card>
    )
  }

  return (
    <>
      {groupsCard}
      {matchesCard}
      {standingsCard}
      {promoteCard}
    </>
  )
}
