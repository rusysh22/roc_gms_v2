'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavBar, type NavItem } from '@/components/nav-bar'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'

// Operational/internal tool routes never get the public floating nav + footer chrome, only the
// genuinely public destinations from prd/README.md section 21.2 do. `/workspaces` is the explicit
// exclusion from the redesign R1 brief; `/scheduler` (the standalone queue foundation route) is the
// same kind of internal tool and is excluded for the same reason.
const CHROME_EXCLUDED_PREFIXES = ['/workspaces', '/scheduler']

const PUBLIC_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Sports', href: '/sports' },
  { label: 'Articles', href: '/articles' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Standings', href: '/standings' },
  { label: 'Brackets', href: '/brackets' },
  { label: 'Champions', href: '/champions' },
]

export interface PublicChromeProps {
  brand: string
  children: React.ReactNode
}

export function PublicChrome({ brand, children }: PublicChromeProps) {
  const pathname = usePathname()
  const showChrome = !CHROME_EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))
  const activeHref =
    pathname === '/' ? '/'
    : PUBLIC_NAV_ITEMS.find((item) => item.href !== '/' && pathname?.startsWith(item.href))?.href

  if (!showChrome) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-svh flex-col">
      <NavBar
        brand={brand}
        items={PUBLIC_NAV_ITEMS}
        activeHref={activeHref}
        cta={
          <div className="flex items-center gap-2">
            <Link
              href="/workspaces"
              className="text-sm font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
            >
              Workspace Login
            </Link>
            <Button asChild size="sm">
              <Link href="/schedule">View Schedule</Link>
            </Button>
          </div>
        }
      />
      <div className="flex-1 pt-6">{children}</div>
      <Footer
        brand={brand}
        tagline="Run by the committee, for the whole office."
        links={PUBLIC_NAV_ITEMS}
      />
    </div>
  )
}
