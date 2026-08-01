'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, LogOut } from 'lucide-react'

import { NavBar, type NavItem } from '@/components/nav-bar'
import { Footer } from '@/components/footer'
import type { PublicNavUser } from '@/app/(frontend)/getCurrentPublicUser'

// Operational/internal tool routes never get the public floating nav + footer chrome, only the
// genuinely public destinations from prd/README.md section 21.2 do. `/workspaces` is the explicit
// exclusion from the redesign R1 brief; `/scheduler` (the standalone queue foundation route) is the
// same kind of internal tool and is excluded for the same reason.
const CHROME_EXCLUDED_PREFIXES = ['/workspaces', '/scheduler']
const EVENT_SLUG_PATTERN = /^\/events\/([^/]+)/

// Nav items are event-scoped (see src/app/(frontend)/events/[eventSlug]/) - public visitors have
// no session, so the current event slug is read straight off the URL and every non-Home link is
// prefixed with it. Off an event page entirely, this is the marketing/company-profile site (the
// SaaS "sales" homepage) instead, so it gets its own nav pointing at the marketing sections.
// Articles+Announcements collapse into one "Updates" destination, and Schedule/Standings/Champions
// collapse into "Schedule" (which shows all three as tabs) - Brackets is dropped from top-level
// nav entirely (still reachable from a category's own page) to keep the bar short.
const buildNavItems = (eventSlug: string | null): NavItem[] => {
  if (!eventSlug) {
    return [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/#features' },
      { label: 'How it works', href: '/#how-it-works' },
    ]
  }

  const base = `/events/${eventSlug}`
  return [
    { label: 'Home', href: base },
    { label: 'Sports', href: `${base}/sports` },
    { label: 'Updates', href: `${base}/updates` },
    { label: 'Schedule', href: `${base}/schedule` },
  ]
}

function UserMenu({ user }: { user: PublicNavUser }) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null)
  const router = useRouter()
  const [loggingOut, setLoggingOut] = React.useState(false)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/users/logout', { method: 'POST' })
    } finally {
      router.push('/')
      router.refresh()
    }
  }

  const initial = (user.name || user.email || '?').trim().slice(0, 1).toUpperCase()
  const primaryRole = user.roles?.[0]?.replaceAll('_', ' ')

  return (
    <details ref={detailsRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink no-underline [&::-webkit-details-marker]:hidden">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mist text-[10px] font-extrabold text-green">
          {initial}
        </span>
        <span className="max-w-28 truncate">{user.name || user.email}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-panel border border-line bg-paper p-3 shadow-md">
        <p className="truncate text-sm font-bold text-ink">{user.name || 'Signed in'}</p>
        {user.email ? <p className="truncate text-xs text-ink-soft">{user.email}</p> : null}
        {primaryRole ? <p className="mt-1 text-xs font-bold text-green">{primaryRole}</p> : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:border-red-200 hover:text-red-700 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </details>
  )
}

function NavCta({ user }: { user: PublicNavUser | null }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/workspaces"
        className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold whitespace-nowrap text-ink-soft no-underline transition-colors hover:border-green hover:text-ink"
      >
        Event Management
      </Link>
      {user ? <UserMenu user={user} /> : null}
    </div>
  )
}

export interface PublicChromeProps {
  brand: string
  user: PublicNavUser | null
  children: React.ReactNode
}

export function PublicChrome({ brand, user, children }: PublicChromeProps) {
  const pathname = usePathname()
  const showChrome = !CHROME_EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))
  const eventSlug = pathname?.match(EVENT_SLUG_PATTERN)?.[1] || null
  const navItems = buildNavItems(eventSlug)
  const homeHref = navItems[0].href
  const activeHref =
    pathname === homeHref ? homeHref
    : navItems.find((item) => item.href !== homeHref && pathname?.startsWith(item.href))?.href

  if (!showChrome) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-svh flex-col font-sans">
      <NavBar
        brand={brand}
        items={navItems}
        activeHref={activeHref}
        cta={<NavCta user={user} />}
      />
      <div className="flex-1 pt-6">{children}</div>
      <Footer brand={brand} tagline="Hosting your Tournament's" links={navItems} />
    </div>
  )
}
