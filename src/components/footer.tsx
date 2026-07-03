import * as React from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterProps {
  brand: React.ReactNode
  tagline?: string
  links?: FooterLink[]
  className?: string
}

export function Footer({ brand, tagline, links = [], className }: FooterProps) {
  return (
    <footer className={cn('border-t border-line bg-mist px-4 py-10 font-sans text-ink', className)}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold">{brand}</p>
          {tagline ? <p className="mt-1 text-sm text-ink-soft">{tagline}</p> : null}
        </div>
        {links.length > 0 ? (
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </footer>
  )
}
