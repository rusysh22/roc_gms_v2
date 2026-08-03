'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  FileText,
  Gauge,
  Handshake,
  ImageIcon,
  LayoutDashboard,
  Layers,
  ListChecks,
  Megaphone,
  Menu,
  Palette,
  PlusCircle,
  Settings,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { UserRole } from '@/access/roles'
import type { ActiveEventDoc } from '../activeEvent'
import { EventSwitcher } from './EventSwitcher'

type SidebarLink = { label: string; href: string; icon: LucideIcon }
type SidebarSection = {
  label: string
  icon: LucideIcon
  href: string
  roles: UserRole[]
  links?: SidebarLink[]
}
type SidebarGroup = { label: string; sections: SidebarSection[] }

// Grouped by task, not by which collection a page happens to be a CRUD screen for: Event Setup
// (the tournament shell itself - configure once, rarely revisit) -> Registration (who's competing
// - Clubs/Participants/Entries all live here now, previously split across two different groups
// which made "where do I manage who's playing" needlessly hard to guess) -> Operations (day-of
// transactions - scheduling and live scoring) -> Reports (read-only, computed from Operations) ->
// Content. Each group's sections are flat peers (no nested sub-menu) so the sidebar's depth is
// consistent everywhere instead of Event Setup alone exploding into 7 indented links when active.
const GROUPS: SidebarGroup[] = [
  {
    label: 'Event Setup',
    sections: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/workspaces/event-admin',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Event Details',
        icon: Settings,
        href: '/workspaces/event-admin/details',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Create New Event',
        icon: PlusCircle,
        href: '/workspaces/event-admin/new-event',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Facilities & Venues',
        icon: Layers,
        href: '/workspaces/event-admin/facilities',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Appearance',
        icon: Palette,
        href: '/workspaces/event-admin/appearance',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Sponsors',
        icon: Handshake,
        href: '/workspaces/event-admin/sponsors',
        roles: ['super_admin', 'event_admin'],
      },
    ],
  },
  {
    label: 'Registration',
    sections: [
      {
        label: 'Clubs',
        icon: Shield,
        href: '/workspaces/event-admin/clubs',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Participants',
        icon: Users,
        href: '/workspaces/event-admin/participants',
        roles: ['super_admin', 'event_admin'],
      },
      {
        label: 'Entries',
        icon: ListChecks,
        href: '/workspaces/event-admin/entries',
        roles: ['super_admin', 'event_admin'],
      },
    ],
  },
  {
    label: 'Operations',
    sections: [
      {
        label: 'Command Center',
        icon: Gauge,
        href: '/workspaces/command-center',
        roles: ['super_admin', 'event_admin', 'scheduler'],
      },
      {
        label: 'Scheduler',
        icon: Calendar,
        href: '/workspaces/scheduler',
        roles: ['super_admin', 'event_admin', 'scheduler'],
      },
      {
        label: 'Match Officer',
        icon: CheckCircle2,
        href: '/workspaces/match-officer',
        roles: ['super_admin', 'event_admin', 'match_officer'],
      },
      {
        label: 'Matches',
        icon: ListChecks,
        href: '/workspaces/matches',
        roles: ['super_admin', 'event_admin', 'scheduler'],
      },
    ],
  },
  {
    label: 'Reports',
    sections: [
      {
        label: 'Standings',
        icon: BarChart3,
        href: '/workspaces/standings',
        roles: ['super_admin', 'event_admin', 'scheduler'],
      },
      {
        label: 'Brackets',
        icon: Trophy,
        href: '/workspaces/brackets',
        roles: ['super_admin', 'event_admin', 'scheduler'],
      },
      {
        label: 'Analytics',
        icon: Activity,
        href: '/workspaces/analytics',
        roles: ['super_admin', 'event_admin', 'scheduler'],
      },
    ],
  },
  {
    label: 'Content',
    sections: [
      {
        label: 'Content Desk',
        icon: FileText,
        href: '/workspaces/content-admin',
        roles: ['super_admin', 'event_admin', 'content_admin'],
        links: [
          { label: 'Dashboard', href: '/workspaces/content-admin', icon: LayoutDashboard },
          { label: 'Articles', href: '/workspaces/content-admin/articles', icon: FileText },
          { label: 'Announcements', href: '/workspaces/content-admin/announcements', icon: Megaphone },
          { label: 'Media Library', href: '/workspaces/content-admin/media', icon: ImageIcon },
        ],
      },
    ],
  },
]
const SECTIONS: SidebarSection[] = GROUPS.flatMap((group) => group.sections)

const has = (roles: UserRole[] | null | undefined, allowed: UserRole[]) =>
  Boolean(roles?.some((role) => allowed.includes(role)))

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

// Some sections' URLs are prefixes of a sibling section's URL (e.g. Event Setup's
// `/workspaces/event-admin` vs Entries' `/workspaces/event-admin/entries`), so a plain prefix
// match would keep BOTH highlighted/expanded at once. Pick whichever matching section has the
// longest (most specific) href - that's the one the current page actually belongs to, and it's
// what keeps a section's own sub-menu open across its own child pages without also hijacking a
// sibling section's pages.
const getActiveSectionHref = (pathname: string) => {
  let bestHref = ''
  for (const section of SECTIONS) {
    if (isActive(pathname, section.href) && section.href.length > bestHref.length) {
      bestHref = section.href
    }
  }
  return bestHref
}

function SidebarContent({
  roles,
  pathname,
  onNavigate,
}: {
  roles: UserRole[] | null | undefined
  pathname: string
  onNavigate?: () => void
}) {
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) => has(roles, section.roles)),
  })).filter((group) => group.sections.length > 0)
  const activeSectionHref = getActiveSectionHref(pathname)

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3" aria-label="Workspace navigation">
      {visibleGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {/* AUDIT_UI_UX_CSS axe: 70%-opacity ink-soft at this size measured 3.65:1, under the
              4.5:1 minimum - full-opacity ink-soft passes comfortably and these labels don't
              need to be any more muted than the nav items already below them. */}
          <p className="px-3 pb-1 text-[0.65rem] font-bold tracking-wide text-ink-soft uppercase">
            {group.label}
          </p>
          {group.sections.map((section) => {
            const active = section.href === activeSectionHref
            return (
              <div key={section.label} className="flex flex-col gap-0.5">
                <Link
                  href={section.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-mist hover:text-ink',
                    active && 'bg-green text-paper hover:bg-green hover:text-paper',
                  )}
                >
                  <section.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {section.label}
                </Link>
                {section.links && active ? (
                  <div className="ml-4 flex flex-col gap-0.5 border-l border-line pl-3">
                    {section.links.map((link) => {
                      const linkActive = pathname === link.href
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={onNavigate}
                          aria-current={linkActive ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-mist hover:text-ink',
                            // AUDIT_UI_UX_CSS axe: text-green on bg-mist measured 4.24:1 here
                            // (under 4.5:1) - unlike other bg-mist+text-green fixes in this
                            // pass, bg-paper isn't an option: the sidebar itself is already
                            // bg-paper, so the active item would lose its fill entirely.
                            // text-ink (already proven to pass easily) keeps a real visual
                            // "you are here" state without relying on colored text for it.
                            linkActive && 'bg-mist text-ink',
                          )}
                        >
                          <link.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {link.label}
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SidebarFooter({
  email,
  events,
  activeEventId,
}: {
  email?: string | null
  events: ActiveEventDoc[]
  activeEventId?: string | number
}) {
  const activeEvent = events.find((event) => String(event.id) === String(activeEventId))
  const publicSiteHref = activeEvent?.slug ? `/events/${activeEvent.slug}` : '/'

  return (
    <div className="flex flex-col border-t border-line">
      <EventSwitcher events={events} activeEventId={activeEventId} />
      <div className="flex flex-col gap-1 border-t border-line p-3">
        <Link
          href={publicSiteHref}
          className="flex items-center gap-3 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft no-underline transition-colors hover:bg-mist hover:text-ink"
        >
          View public site
        </Link>
        {email ? <p className="truncate px-3 pt-1 text-xs font-semibold text-ink-soft">{email}</p> : null}
      </div>
    </div>
  )
}

export function WorkspaceShellChrome({
  roles,
  email,
  events,
  activeEventId,
  children,
}: {
  roles: UserRole[] | null | undefined
  email?: string | null
  events: ActiveEventDoc[]
  activeEventId?: string | number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex min-h-svh bg-mist font-sans text-ink">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-line bg-paper lg:flex">
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green text-paper">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-ink">InTourney</p>
            <p className="truncate text-xs font-semibold text-ink-soft">Workspaces</p>
          </div>
        </div>
        <SidebarContent roles={roles} pathname={pathname} />
        <SidebarFooter email={email} events={events} activeEventId={activeEventId} />
      </aside>

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-sm">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist lg:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
              <Dialog.Content
                className="fixed inset-y-0 left-0 z-40 flex w-[82vw] max-w-xs flex-col bg-paper shadow-md outline-none lg:hidden"
                aria-describedby={undefined}
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-4">
                  <Dialog.Title className="text-sm font-extrabold text-ink">InTourney</Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close navigation"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <SidebarContent roles={roles} pathname={pathname} onNavigate={() => setOpen(false)} />
                <SidebarFooter email={email} events={events} activeEventId={activeEventId} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <p className="text-sm font-bold text-ink-soft">
            Workspace <span className="text-ink-soft/60">/</span>{' '}
            <span className="text-ink">{sectionLabel(pathname)}</span>
          </p>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

function sectionLabel(pathname: string) {
  const activeHref = getActiveSectionHref(pathname)
  const match = SECTIONS.find((section) => section.href === activeHref)
  return match?.label || 'Overview'
}
