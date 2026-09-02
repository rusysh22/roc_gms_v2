import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'

import { BrandLogo } from '@/components/brand-logo'
import { PublicChrome } from '@/components/public-chrome'
import { marketingShareCopy } from '@/lib/shareMessages'
import { getCurrentPublicUser } from './getCurrentPublicUser'

import './tailwind.css'

// Self-hosted via next/font/google (D021), exposed as the `--font-jakarta-sans` CSS variable
// consumed by the `font-sans` Tailwind utility.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta-sans',
  display: 'swap',
})

// A page-level `title` (a plain string, e.g. from an event/article's own generateMetadata)
// automatically becomes "<title> | InTourney" via this template - so the browser tab reflects
// whichever event/article is actually open instead of every tab reading the same static
// "InTourney". `default` only applies where nothing in the tree sets a title at all.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

const share = marketingShareCopy()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { template: '%s | InTourney', default: 'InTourney' },
  description: share.description,
  applicationName: 'InTourney',
  // The co-located (frontend)/opengraph-image.tsx is attached automatically and inherited by every
  // public page that doesn't ship its own; this sets the shared text + card type.
  openGraph: {
    type: 'website',
    siteName: 'InTourney',
    title: `InTourney - ${share.title}`,
    description: share.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `InTourney - ${share.title}`,
    description: share.description,
  },
}

type Props = {
  children: ReactNode
}

export default async function FrontendLayout({ children }: Props) {
  const user = await getCurrentPublicUser()

  return (
    <html lang="en" className={plusJakartaSans.variable}>
      {/* AUDIT_UI_UX_CSS CSS-04: Preflight's inherit-based baseline (CSS-02) mitigated the worst
          case (no more literal Times New Roman/black-on-transparent), but body itself still had no
          explicit token-based color/background/font - it was relying entirely on inheritance
          rather than being pinned to the actual design tokens, so any route/wrapper that broke the
          inheritance chain would fall back to plain browser defaults. */}
      <body className="bg-paper font-sans text-ink">
        <PublicChrome brand={<BrandLogo variant="horizontal" height={22} priority />} user={user}>
          {children}
        </PublicChrome>
      </body>
    </html>
  )
}
