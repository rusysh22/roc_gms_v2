import type { Metadata } from 'next'
import { Bell } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { buildShareMetadata } from '@/lib/shareMetadata'
import { AnnouncementCard } from '../contentComponents'
import { getPublicAnnouncements } from '../contentData'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildShareMetadata({
  title: 'Announcements / ROC Olympic 2026',
  description: 'Important public updates for ROC Olympic 2026 schedules, venues, and results.',
  path: '/announcements',
})

export default async function AnnouncementsPage() {
  const announcements = await getPublicAnnouncements(50)

  return (
    <main className="font-sans text-ink">
      <section className="px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Bell className="h-3.5 w-3.5 text-green" aria-hidden="true" />
            Official updates
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Announcements
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
            Schedule changes, urgent notices, and committee updates in one place.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          {announcements.length === 0 ? (
            <Card className="text-sm text-ink-soft">
              No active public announcements are available right now.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {announcements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
