'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Layers,
  Menu,
  PlusCircle,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { UserRole } from '@/access/roles'

type SidebarLink = { label: string; href: string; icon: LucideIcon }
type SidebarSection = {
  label: string
  icon: LucideIcon
  href: string
  roles: UserRole[]
  links?: SidebarLink[]
}

const SECTIONS: SidebarSection[] = [
  {
    label: 'Event Setup',
    icon: Layers,
    href: '/workspaces/event-admin',
    roles: ['super_admin', 'event_admin'],
    links: [
      { label: 'Dashboard', href: '/workspaces/event-admin', icon: LayoutDashboard },
      { label: 'Create New Event', href: '/workspaces/event-admin/new-event', icon: PlusCircle },
      { label: 'Clubs', href: '/workspaces/event-admin/clubs', icon: Shield },
      { label: 'Entries', href: '/workspaces/event-admin/entries', icon: Users },
      { label: 'Participants', href: '/workspaces/event-admin/participants', icon: Users },
      { label: 'Facilities', href: '/workspaces/event-admin/facilities', icon: Layers },
    ],
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
    label: 'Content Desk',
    icon: FileText,
    href: '/workspaces/content-admin',
    roles: ['super_admin', 'event_admin', 'content_admin'],
  },
]

const has = (roles: UserRole[] | null | undefined, allowed: UserRole[]) =>
  Boolean(roles?.some((role) => allowed.includes(role)))

const isActive = (pathname: string, href: string) =>
  href === '/workspaces/event-admin' ? pathname === href : pathname.startsWith(href)

function SidebarContent({
  roles,
  pathname,
  onNavigate,
}: {
  roles: UserRole[] | null | undefined
  pathname: string
  onNavigate?: () => void
}) {
  const visibleSections = SECTIONS.filter((section) => has(roles, section.roles))

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Workspace navigation">
      {visibleSections.map((section) => {
        const active = isActive(pathname, section.href)
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
                        linkActive && 'bg-mist text-green',
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
    </nav>
  )
}

export function WorkspaceShellChrome({
  roles,
  email,
  children,
}: {
  roles: UserRole[] | null | undefined
  email?: string | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const isSuperAdmin = has(roles, ['super_admin'])

  return (
    <div className="flex min-h-svh bg-mist font-sans text-ink">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-line bg-paper lg:flex">
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green text-paper">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-ink">ROC GMS</p>
            <p className="truncate text-xs font-semibold text-ink-soft">Workspaces</p>
          </div>
        </div>
        <SidebarContent roles={roles} pathname={pathname} />
        <div className="flex flex-col gap-1 border-t border-line p-3">
          {isSuperAdmin ? (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-mist hover:text-ink"
            >
              <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
              Payload Admin
            </Link>
          ) : null}
          <Link
            href="/"
            className="flex items-center gap-3 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft no-underline transition-colors hover:bg-mist hover:text-ink"
          >
            View public site
          </Link>
          {email ? <p className="truncate px-3 pt-1 text-xs font-semibold text-ink-soft">{email}</p> : null}
        </div>
      </aside>

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-sm">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Open navigation"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist lg:hidden"
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
                  <Dialog.Title className="text-sm font-extrabold text-ink">ROC GMS</Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close navigation"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <SidebarContent roles={roles} pathname={pathname} onNavigate={() => setOpen(false)} />
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
  const match = SECTIONS.find((section) => isActive(pathname, section.href))
  return match?.label || 'Overview'
}
