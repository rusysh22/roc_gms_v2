import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'

import { BrandLogo } from '@/components/brand-logo'
import { PublicChrome } from '@/components/public-chrome'
import { marketingShareCopy } from '@/lib/shareMessages'
import { getPublicBaseUrl } from '@/lib/shareMetadata'
import { isGoogleSsoEnabled } from '@/lib/auth/googleSso'
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
const SITE_DESCRIPTION =
  'InTourney is a platform for planning and running multi-sport tournaments and games - from ' +
  'creating the event and importing participants, through the draw and match generation, to ' +
  'match-day operations, results, standings, medals, and a public event website.'

const share = marketingShareCopy()

// `metadataBase` is what turns every relative `openGraph.images` / `alternates.canonical` in the
// tree into an absolute URL - without it Next logs a warning and social crawlers get relative
// paths they can't resolve. Driven by NEXT_PUBLIC_SITE_URL (see getPublicBaseUrl).
export const metadata: Metadata = {
  // Absolute base for every relative canonical / og:url / og:image (incl. the generated share
  // cards). Must resolve to the real public origin, not localhost - see getPublicBaseUrl.
  metadataBase: new URL(getPublicBaseUrl()),
  title: { template: '%s | InTourney', default: 'InTourney - run multi-sport tournaments & games' },
  description: share.description,
  applicationName: 'InTourney',
  alternates: { canonical: '/' },
  // The co-located (frontend)/opengraph-image.tsx is attached automatically and inherited by every
  // public page that doesn't ship its own; this sets the shared text + card type.
  openGraph: {
    type: 'website',
    siteName: 'InTourney',
    title: `InTourney - ${share.title}`,
    description: share.description,
    url: '/',
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

// Organization + WebSite structured data on every public page. This is what lets Google attach a
// name, logo and (eventually) a knowledge panel / sitelinks to the "InTourney" brand query rather
// than treating each page as an unrelated blue link. `sameAs` should list the official social
// profiles once they exist. https://schema.org/Organization + https://schema.org/WebSite
function siteJsonLd() {
  const base = getPublicBaseUrl()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: 'InTourney',
        url: base,
        // TODO: swap for a dedicated square logo (512x512) once one exists; og.png is the only
        // brand image currently shipped and beats a 404 here.
        logo: `${base}/og.png`,
        description: SITE_DESCRIPTION,
        sameAs: [] as string[],
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: 'InTourney',
        url: base,
        publisher: { '@id': `${base}/#organization` },
      },
    ],
  }
}

// GA4 measurement ID, inlined at build time. Analytics only loads when it's set AND this is a
// production build - so local dev and preview builds don't pollute the visitor numbers. The
// <GoogleAnalytics> helper (from @next/third-parties) also fires a page_view on client-side route
// changes, which a raw gtag snippet would miss in the App Router.
const gaId = process.env.NEXT_PUBLIC_GA_ID
const analyticsEnabled = Boolean(gaId) && process.env.NODE_ENV === 'production'

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
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- server-built from our own constants, no user HTML
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
        <PublicChrome
          brand={<BrandLogo variant="horizontal" height={22} priority />}
          user={user}
          googleSsoEnabled={isGoogleSsoEnabled()}
        >
          {children}
        </PublicChrome>
        {analyticsEnabled && gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  )
}
