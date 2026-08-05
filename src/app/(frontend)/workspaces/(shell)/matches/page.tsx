import Link from 'next/link'
import { Eye } from 'lucide-react'
import type { Where } from 'payload'

import { Button } from '@/components/ui/button'
import { DataTableToolbar } from '@/components/ui/data-table-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { StatusBadge, getMatchStatusTone } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getActiveEvent } from '../../activeEvent'
import { resolveEventTimezone } from '@/lib/timezone'
import {
  NoActiveEventNotice,
  PageHero,
  formatDateTime,
  formatStatus,
  getRelationshipLabel,
  type WorkspaceMatch,
} from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'

export const dynamic = 'force-dynamic'

const basePage = '/workspaces/matches'
const PAGE_SIZE = 25

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 15.7 (P0): "result review queue" - Command Center's
// "Review N results" / "N under review or disputed" cards need somewhere to land that isn't a
// 404. This is that somewhere: every match for the active event, searchable by match number/
// participant name, filterable by status, paginated - not scoped to review-only statuses by
// default so it doubles as a general match list, not a single-purpose queue.
export default async function MatchesListPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo: basePage,
    workspaceName: 'Matches',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  const timezone = resolveEventTimezone(activeEvent?.timezone)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Operations" title="Matches" summary="Every match for the active event." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const query = get(params, 'q')
  const statusFilter = get(params, 'status')
  const page = Math.max(1, Number(get(params, 'page')) || 1)

  const where: Where = {
    and: [
      { event_id: { equals: activeEvent.id } },
      ...(query ? [{ match_number: { contains: query } }] : []),
      ...(statusFilter ? [{ status: { equals: statusFilter } }] : []),
    ],
  }

  const matches = await access.payload.find({
    collection: 'matches',
    depth: 2,
    limit: PAGE_SIZE,
    page,
    sort: '-scheduled_start_at',
    where,
  })
  const docs = matches.docs as WorkspaceMatch[]

  return (
    <>
      <PageHero eyebrow="Operations" title="Matches" summary="Every match for the active event." />

      <DataTableToolbar
        action={basePage}
        searchName="q"
        searchDefaultValue={query}
        searchPlaceholder="Search by match number..."
        searchLabel="Search matches by match number"
        filters={
          <Select name="status" defaultValue={statusFilter} className="w-auto" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="finished">Finished (not yet published)</option>
            <option value="under_review">Under review</option>
            <option value="disputed">Disputed</option>
            <option value="result_published">Result published</option>
            <option value="ongoing">Ongoing</option>
            <option value="paused">Paused</option>
            <option value="postponed">Postponed</option>
            <option value="scheduled">Scheduled</option>
          </Select>
        }
      />

      {docs.length === 0 ? (
        <EmptyState>No matches match this filter.</EmptyState>
      ) : (
        <>
          <Table caption="Matches">
            <TableHeader>
              <TableRow>
                <TableHead>Match</TableHead>
                <TableHead>Sport / Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="font-bold">
                    {getRelationshipLabel(match.participant_a_entry_id)} vs{' '}
                    {getRelationshipLabel(match.participant_b_entry_id)}
                    <span className="block text-xs font-normal text-ink-soft">{match.match_number}</span>
                  </TableCell>
                  <TableCell className="text-ink-soft">
                    {getRelationshipLabel(match.sport_id)} / {getRelationshipLabel(match.category_id)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={getMatchStatusTone(match.status)}>{formatStatus(match.status)}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-ink-soft">{match.score_summary || '—'}</TableCell>
                  <TableCell className="text-ink-soft whitespace-nowrap">
                    {formatDateTime(match.scheduled_start_at, timezone)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}/${match.match_number}`}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        Review
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={matches.page || 1}
            totalPages={matches.totalPages || 1}
            hasPrevPage={Boolean(matches.hasPrevPage)}
            hasNextPage={Boolean(matches.hasNextPage)}
            totalDocs={matches.totalDocs}
            buildHref={(targetPage) => {
              const url = new URLSearchParams()
              if (query) url.set('q', query)
              if (statusFilter) url.set('status', statusFilter)
              url.set('page', String(targetPage))
              return `${basePage}?${url.toString()}`
            }}
          />
        </>
      )}
    </>
  )
}
