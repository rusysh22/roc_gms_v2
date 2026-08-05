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

type ArticleRow = {
  id: string | number
  title: string
  status: string
  published_at?: string | null
  updatedAt?: string
}

const statusTone = (status: string): 'green' | 'gold' | 'neutral' =>
  status === 'published' ? 'green' : status === 'review' ? 'gold' : 'neutral'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function ArticlesListPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: '/workspaces/content-admin/articles',
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
        <PageHero eyebrow="Content Desk" title="Articles" summary="Write and publish event stories." />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const deleted = get(params, 'articleDeleted') === '1'

  const articles = await access.payload.find({
    collection: 'articles',
    depth: 0,
    limit: 100,
    sort: '-updatedAt',
    where: { event_id: { equals: activeEvent.id } },
  })

  return (
    <>
      <PageHero
        eyebrow="Content Desk"
        title="Articles"
        summary="Write, tag, and publish event stories - no Payload Admin required."
        actions={
          <Button asChild>
            <Link href="/workspaces/content-admin/articles/new">New Article</Link>
          </Button>
        }
      />

      {deleted ? <AlertBanner tone="success" className="mb-4">Article deleted.</AlertBanner> : null}

      {(articles.docs as ArticleRow[]).length === 0 ? (
        <EmptyState>No articles yet for this event.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(articles.docs as ArticleRow[]).map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-bold">{article.title}</TableCell>
                <TableCell>
                  <StatusBadge tone={statusTone(article.status)}>{formatStatus(article.status)}</StatusBadge>
                </TableCell>
                <TableCell>{article.published_at ? formatDateTime(article.published_at, timezone) : 'Not published'}</TableCell>
                <TableCell>{formatDateTime(article.updatedAt, timezone)}</TableCell>
                <TableCell>
                  <Link
                    href={`/workspaces/content-admin/articles/${article.id}`}
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
