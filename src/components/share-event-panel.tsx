import Link from 'next/link'
import QRCode from 'qrcode'

import { getAbsolutePublicUrl } from '@/lib/shareMetadata'
import { Card, CardTitle } from '@/components/ui/card'
import { ShareButtons } from '@/components/share-buttons'

// AUDIT_UI_UX_CSS PUB-08: "no share/QR surface" was a literal gap - ShareButtons existed
// (match/article pages) but nothing surfaced it on the event home page itself, and there was no
// QR code anywhere. QR is generated server-side (the `qrcode` package, not a third-party image
// API - no network call, no dependency on an external service staying up) as inline SVG, so it
// renders with zero client JS and prints cleanly (an organizer handing out a QR poster is exactly
// the "distribute the event" use case this closes).
export async function ShareEventPanel({
  eventName,
  eventPath,
}: {
  eventName: string
  eventPath: string
}) {
  const url = getAbsolutePublicUrl(eventPath)
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: '#0c231f', light: '#ffffff' },
  })
  const qrDataUri = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className="h-24 w-24 shrink-0 rounded-card border border-line bg-paper p-1.5"
          // eslint-disable-next-line react/no-danger -- generated server-side from our own URL, not user input
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div>
          <CardTitle>Share this event</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            Scan the QR code or share the link so participants and spectators can find{' '}
            {eventName} again.
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <a
              href={qrDataUri}
              download={`${eventName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-qr.svg`}
              className="inline-block text-xs font-bold text-brand-secondary underline underline-offset-2"
            >
              Download QR (SVG)
            </a>
            <Link
              href={`${eventPath}/poster`}
              target="_blank"
              className="inline-block text-xs font-bold text-brand-secondary underline underline-offset-2"
            >
              Printable poster
            </Link>
          </div>
        </div>
      </div>
      <ShareButtons title={eventName} description={`Check out ${eventName} on InTourney`} url={url} />
    </Card>
  )
}
