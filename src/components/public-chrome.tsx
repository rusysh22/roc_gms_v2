'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
// Articles+Announcements collapse into one "Updates" destination, and Champions collapses into
// Schedule's own tabs - Brackets is dropped from top-level nav entirely (still reachable from a
// category's own page, since there's no single event-wide bracket) to keep the bar short.
//
// AUDIT_UI_UX_CSS PUB-06: Standings used to be reachable only as a tab buried inside Schedule -
// legible once you're already on that page, invisible from anywhere else. It's a single
// well-defined destination (unlike Bracket, which is genuinely per-category), so it earns its own
// top-level entry.
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
    { label: 'Standings', href: `${base}/schedule?tab=standings` },
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
        {/* AUDIT_UI_UX_CSS axe: text-green on bg-mist at 10px measured 4.24:1, under 4.5:1 -
            text-ink passes easily and keeps the mist fill that makes this read as an avatar
            chip (bg-paper would blend into the summary it sits inside). */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mist text-[10px] font-extrabold text-ink">
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
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:border-danger/30 hover:text-danger disabled:opacity-50"
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
  const searchParams = useSearchParams()
  const showChrome = !CHROME_EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))
  const eventSlug = pathname?.match(EVENT_SLUG_PATTERN)?.[1] || null
  const navItems = buildNavItems(eventSlug)
  const homeHref = navItems[0].href
  // Schedule and Standings share a pathname (Standings is a `?tab=` query variant of the same
  // page), so pathname alone can't tell them apart. Two passes: first try to find a `?tab=`-
  // specific item whose tab actually matches the current URL (Standings); only fall back to a
  // plain pathname-only match (Schedule, Sports, Updates - which also happens to use its own
  // unrelated `?tab=` query, correctly ignored here since it has no `?` in its *nav* href) if
  // nothing tab-specific matched.
  const currentTab = searchParams?.get('tab')
  const tabSpecificMatch = navItems.find(
    (item) =>
      item.href.includes('?') &&
      pathname?.startsWith(item.href.split('?')[0]) &&
      new URLSearchParams(item.href.split('?')[1]).get('tab') === currentTab,
  )
  const plainMatch = navItems.find(
    (item) => item.href !== homeHref && !item.href.includes('?') && pathname?.startsWith(item.href),
  )
  const activeHref = pathname === homeHref ? homeHref : (tabSpecificMatch ?? plainMatch)?.href

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
