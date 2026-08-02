import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'

import { PublicChrome } from '@/components/public-chrome'
import { getCurrentPublicUser } from './getCurrentPublicUser'

import './tailwind.css'

// Self-hosted via next/font/google (D021), exposed as the `--font-jakarta-sans` CSS variable
// consumed by the `font-sans` Tailwind utility.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'InTourney',
  description: "InTourney - Hosting your Tournament's",
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
        <PublicChrome brand="InTourney" user={user}>
          {children}
        </PublicChrome>
      </body>
    </html>
  )
}
