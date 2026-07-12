import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PageHero, StatBlock, StatGrid } from '../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../workspaceAuth'

export const dynamic = 'force-dynamic'

export default async function ContentAdminWorkspacePage() {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.contentAdmin,
    returnTo: '/workspaces/content-admin',
    workspaceName: 'Content Admin Workspace',
  })
  if (!access.authorized) {
    return (
      <WorkspaceUnauthorized
        workspaceName={access.workspaceName}
        allowedRoles={access.allowedRoles}
      />
    )
  }

  const payload = access.payload
  const [
    events,
    articles,
    publishedArticles,
    reviewArticles,
    announcements,
    publishedAnnouncements,
    activeAlerts,
    publicMatches,
    documentationNeeded,
  ] = await Promise.all([
    payload.find({ collection: 'events', limit: 1 }),
    payload.find({ collection: 'articles', limit: 1 }),
    payload.find({ collection: 'articles', limit: 1, where: { status: { equals: 'published' } } }),
    payload.find({ collection: 'articles', limit: 1, where: { status: { equals: 'review' } } }),
    payload.find({ collection: 'announcements', limit: 1 }),
    payload.find({ collection: 'announcements', limit: 1, where: { status: { equals: 'published' } } }),
    payload.find({
      collection: 'announcements',
      limit: 1,
      where: { and: [{ status: { equals: 'published' } }, { urgency: { equals: 'urgent' } }] },
    }),
    payload.find({ collection: 'matches', limit: 1, where: { is_public: { equals: true } } }),
    payload.find({ collection: 'matches', limit: 1, where: { documentation_status: { equals: 'needed' } } }),
  ])

  return (
    <>
      <PageHero
        eyebrow="Content Admin Workspace"
        title="Content Operations"
        summary="Prepare articles, announcements, share previews, and match documentation from one focused content desk. Public reading pages and notification workflows are still scheduled for the next Phase 6 passes."
        actions={
          <>
            <Button asChild>
              <Link href="/admin/collections/articles">Edit Articles</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/collections/announcements">Edit Announcements</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/collections/media">Media Library</Link>
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatBlock label="Events" value={events.totalDocs} />
        <StatBlock label="Articles" value={articles.totalDocs} tone="good" />
        <StatBlock label="Announcements" value={announcements.totalDocs} tone="warn" />
        <StatBlock label="Public Matches" value={publicMatches.totalDocs} tone="good" />
        <StatBlock label="Docs Needed" value={documentationNeeded.totalDocs} tone="warn" />
      </StatGrid>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <CardTitle>Article Readiness</CardTitle>
          <p className="text-sm text-ink-soft">
            {publishedArticles.totalDocs} published article(s) and {reviewArticles.totalDocs} item(s)
            in review. Use the CMS editor for event stories, match recaps, cover images, and share
            metadata.
          </p>
          <Link href="/admin/collections/articles" className="text-sm font-bold text-blue no-underline hover:underline">
            Open article editor →
          </Link>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Announcement Readiness</CardTitle>
          <p className="text-sm text-ink-soft">
            {publishedAnnouncements.totalDocs} published announcement(s), including{' '}
            {activeAlerts.totalDocs} urgent alert(s). Targeting is ready for event, sport, category,
            and match updates.
          </p>
          <Link
            href="/admin/collections/announcements"
            className="text-sm font-bold text-blue no-underline hover:underline"
          >
            Open announcement editor →
          </Link>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Share Assets</CardTitle>
          <p className="text-sm text-ink-soft">
            Upload reusable article covers and share images in the media library. Public article
            pages, announcement feeds, email, and calendar export remain deliberately outside 6A.
          </p>
          <Link href="/admin/collections/media" className="text-sm font-bold text-blue no-underline hover:underline">
            Open media library →
          </Link>
        </Card>
      </section>
    </>
  )
}
