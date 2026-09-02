import { withPayload } from '@payloadcms/next/withPayload'

// AUDIT_E2E SEC-03: no security headers were configured at all. A Content-Security-Policy is
// deliberately NOT included here yet - Payload Admin, styled-components, and the g-loot bracket
// SVG renderer all need careful per-route CSP tuning (Admin needs different allowances than the
// public site), and a wrong CSP fails closed (breaks the app) rather than open, so it needs
// dedicated testing across every route before shipping - tracked as a follow-up, not shipped blind
// here. The headers below are safe defaults that don't change any page's behavior.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  // Only takes effect over HTTPS in production - harmless (and ignored by the browser) over plain
  // HTTP in local/dev.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs (used only by src/lib/eventDataTemplate.ts, in a Node route handler) is a large CJS
  // package that pulls optional stream/zip deps - let Next require it at runtime instead of trying
  // to bundle it into the route.
  serverExternalPackages: ['exceljs'],
  // The generated social cards (src/lib/ogCard.ts) read the brand PNGs and bundled font subsets
  // from disk at request time - make sure a traced/standalone build ships them.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./public/brand/*.png', './src/lib/og-fonts/*.woff'],
    '/events/[eventSlug]/opengraph-image': ['./public/brand/*.png', './src/lib/og-fonts/*.woff'],
    '/events/[eventSlug]/matches/[matchNumber]/opengraph-image': [
      './public/brand/*.png',
      './src/lib/og-fonts/*.woff',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  // Next's Server Action body parser defaults to 1MB, well under several file uploads already in
  // this app that go through a plain `<form action={serverAction}>` (not a separate upload
  // endpoint) - e.g. FileUpload declares up to 10MB for match attachments/media, 8MB for appearance
  // banners, 5MB for event/article logos. Any of those over ~1MB threw "Body exceeded 1 MB limit"
  // at submit time. Set well above the largest declared FileUpload limit (10MB) to leave headroom
  // for multipart/form-data overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
}

export default withPayload(nextConfig)
