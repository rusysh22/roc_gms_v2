import * as React from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterProps {
  brand: React.ReactNode
  /** Plain-text brand name for the legal/copyright line (where a logo image would read oddly). */
  brandName?: string
  tagline?: string
  links?: FooterLink[]
  /** Company/legal links (About, Terms, Privacy, Contact) - rendered on the bottom copyright row,
   * kept visually separate from the primary `links` navigation above it. */
  legalLinks?: FooterLink[]
  className?: string
}

export function Footer({ brand, brandName, tagline, links = [], legalLinks = [], className }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className={cn('border-t border-line bg-mist px-4 py-10 font-sans text-ink', className)}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-extrabold">{brand}</div>
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
        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-soft">
            &copy; {year} {brandName ?? brand}. All rights reserved.
          </p>
          {legalLinks.length > 0 ? (
            <nav className="flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legal">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-semibold text-ink-soft no-underline transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
