'use client'

import * as React from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface NavItem {
  label: string
  href: string
}

export interface NavBarProps {
  brand: React.ReactNode
  items: NavItem[]
  activeHref?: string
  cta?: React.ReactNode
  className?: string
}

// Floating pill "island" navbar per prd/redesign/README.md sections 2.1 and 4.1: a detached
// rounded-full capsule, sticky while scrolling, active item marked by a contrasting pill inside
// it. Not wired into any layout yet (that is redesign phase R1) - this only needs to compile and
// be ready to consume.
export function NavBar({ brand, items, activeHref, cta, className }: NavBarProps) {
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn('sticky top-4 z-50 flex justify-center px-4 font-sans', className)}>
      <div
        className={cn(
          'flex w-full max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-paper px-4 py-2 shadow-sm transition-shadow duration-200',
          scrolled && 'shadow-md',
        )}
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 pl-2 text-sm font-extrabold whitespace-nowrap text-ink no-underline"
        >
          {brand}
        </Link>

        <nav className="hidden min-w-0 items-center gap-0.5 md:flex lg:gap-1" aria-label="Primary">
          {items.map((item) => {
            const isActive = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-2 text-sm font-semibold whitespace-nowrap text-ink-soft no-underline transition-colors hover:text-ink lg:px-3.5',
                  isActive && 'bg-green text-paper hover:text-paper',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">{cta}</div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
            <Dialog.Content
              className="fixed inset-y-0 right-0 z-50 flex w-[82vw] max-w-sm flex-col gap-1 bg-paper p-6 shadow-md outline-none"
              aria-describedby={undefined}
            >
              <div className="mb-4 flex items-center justify-between">
                <Dialog.Title className="text-sm font-extrabold text-ink">{brand}</Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <nav className="flex flex-col gap-1" aria-label="Primary">
                {items.map((item) => {
                  const isActive = item.href === activeHref
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'rounded-full px-4 py-3 text-base font-semibold text-ink-soft no-underline transition-colors hover:bg-mist hover:text-ink',
                        isActive && 'bg-green text-paper hover:bg-green hover:text-paper',
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              {cta ? <div className="mt-4">{cta}</div> : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  )
}
