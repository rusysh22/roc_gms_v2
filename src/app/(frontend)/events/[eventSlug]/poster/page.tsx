import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import QRCode from 'qrcode'

import config from '@payload-config'
import { getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { PrintButton } from './PrintButton'
import { formatDateTime } from '../../../workspaces/workspaceComponents'
import { getPublicEventBySlug, type EventBannerImage } from '../../publicEvents'

export const dynamic = 'force-dynamic'

// AUDIT_UI_UX_CSS PUB-08: ShareEventPanel already covers QR/copy-link/native-share, but the audit's
// fourth ask - a printable poster an organizer can put up at a venue entrance - had nothing built.
// This route is registered in CHROME_EXCLUDED_SUFFIXES (public-chrome.tsx) so it renders full-bleed
// with no site nav/footer eating into the printed page, the same mechanism the /display venue-TV
// route already uses. QR is generated server-side (no external image API call) at print resolution.
export default async function EventPosterPage({
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

  const eventPath = `/events/${event.slug}`
  const url = getAbsolutePublicUrl(eventPath)
  // No `width` option - the SVG then gets only a viewBox (no explicit pixel width/height), so it
  // scales to fill whatever CSS container holds it instead of overflowing a smaller one.
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: '#0c231f', light: '#ffffff' },
  })
  const logo = event.logo && typeof event.logo === 'object' ? (event.logo as EventBannerImage) : null

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-mist p-6 font-sans text-ink print:min-h-0 print:bg-paper print:p-0">
      <div className="flex w-full max-w-2xl flex-col items-center gap-3 print:hidden">
        <PrintButton />
        <p className="text-center text-xs text-ink-soft">
          Opens your browser&apos;s print dialog - choose &quot;Save as PDF&quot; if you just want a file.
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col items-center gap-8 rounded-panel border border-line bg-paper p-10 text-center shadow-sm print:w-auto print:max-w-none print:rounded-none print:border-0 print:p-16 print:shadow-none">
        {logo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- print layout, not a normal responsive page image
          <img src={logo.url} alt={logo.alt || `${event.name} logo`} className="h-20 w-auto object-contain" />
        ) : null}

        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">You&apos;re invited to</p>
          <h1 className="mt-1 text-4xl font-extrabold text-ink">{event.name}</h1>
          {event.hero_tagline ? <p className="mt-2 text-lg text-ink-soft">{event.hero_tagline}</p> : null}
        </div>

        <dl className="grid gap-2 text-sm font-semibold text-ink">
          <div>
            <dt className="sr-only">Dates</dt>
            <dd>
              {formatDateTime(event.event_start_at)} — {formatDateTime(event.event_end_at)}
            </dd>
          </div>
          {event.location ? (
            <div>
              <dt className="sr-only">Location</dt>
              <dd className="text-ink-soft">{event.location}</dd>
            </div>
          ) : null}
        </dl>

        <div
          className="h-64 w-64 shrink-0 rounded-card border border-line bg-paper p-2 [&>svg]:h-full [&>svg]:w-full"
          // eslint-disable-next-line react/no-danger -- generated server-side from our own URL, not user input
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div>
          <p className="text-sm font-bold text-ink">Scan for schedule, standings &amp; live scores</p>
          <p className="mt-1 break-all text-xs text-ink-soft">{url}</p>
        </div>
      </div>
    </main>
  )
}
