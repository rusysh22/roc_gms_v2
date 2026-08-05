import Link from 'next/link'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getActiveEvent } from '../../../activeEvent'
import { resolveEventTimezone } from '@/lib/timezone'
import { NoActiveEventNotice, PageHero, formatDateTime, formatStatus } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'

export const dynamic = 'force-dynamic'

type AnnouncementRow = {
  id: string | number
  title: string
  status: string
  urgency: string
  target_scope: string
  published_at?: string | null
}

const statusTone = (status: string): 'green' | 'gold' | 'neutral' =>
  status === 'published' ? 'green' : status === 'review' ? 'gold' : 'neutral'
const urgencyTone = (urgency: string): 'green' | 'blue' | 'gold' | 'neutral' =>
  urgency === 'urgent' ? 'gold' : urgency === 'result' ? 'green' : urgency === 'schedule_change' ? 'blue' : 'neutral'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function AnnouncementsListPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: '/workspaces/content-admin/announcements',
    workspaceName: 'Content Desk',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  const timezone = resolveEventTimezone(activeEvent?.timezone)
  if (!activeEvent) {
    return (
      <>
        <PageHero eyebrow="Content Desk" title="Announcements" summary="Post event updates and alerts." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const deleted = get(params, 'announcementDeleted') === '1'

  const announcements = await access.payload.find({
    collection: 'announcements',
    depth: 0,
    limit: 100,
    sort: '-updatedAt',
    where: { event_id: { equals: activeEvent.id } },
  })

  return (
    <>
      <PageHero
        eyebrow="Content Desk"
        title="Announcements"
        summary="Post event updates, schedule changes, and alerts - no Payload Admin required."
        actions={
          <Button asChild>
            <Link href="/workspaces/content-admin/announcements/new">New Announcement</Link>
          </Button>
        }
      />

      {deleted ? <AlertBanner tone="success" className="mb-4">Announcement deleted.</AlertBanner> : null}

      {(announcements.docs as AnnouncementRow[]).length === 0 ? (
        <EmptyState>No announcements yet for this event.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(announcements.docs as AnnouncementRow[]).map((announcement) => (
              <TableRow key={announcement.id}>
                <TableCell className="font-bold">{announcement.title}</TableCell>
                <TableCell>
                  <StatusBadge tone={urgencyTone(announcement.urgency)}>{formatStatus(announcement.urgency)}</StatusBadge>
                </TableCell>
                <TableCell>{formatStatus(announcement.target_scope)}</TableCell>
                <TableCell>
                  <StatusBadge tone={statusTone(announcement.status)}>{formatStatus(announcement.status)}</StatusBadge>
                </TableCell>
                <TableCell>
                  {announcement.published_at ? formatDateTime(announcement.published_at, timezone) : 'Not published'}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/workspaces/content-admin/announcements/${announcement.id}`}
                    className="text-sm font-bold text-blue no-underline hover:underline"
                  >
                    Edit →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
