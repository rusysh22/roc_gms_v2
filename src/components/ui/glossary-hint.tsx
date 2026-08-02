'use client'

import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface GlossaryHintProps {
  term: string
  definition: ReactNode
  className?: string
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 10: "Terminologi Inggris dan teknis mendominasi tanpa
// glossary kontekstual" - jargon like Entry/Seed/Ruleset gets explained the moment it's introduced
// (choice cards already handled Individual/Pair/Team/Club, see CategoriesStep) instead of needing
// external documentation.
//
// A <button> + client toggle, not a <details> disclosure like this wizard's other "advanced"
// sections - this needs to sit inline inside flowing <p> text and, in one case, inside a <label>.
// <details> is flow content, not phrasing content, so it isn't valid inside a <p> (the browser
// would silently split the paragraph). <button> is phrasing content and is also one of the
// "labelable-excluded" interactive elements, so nesting it in a <label> doesn't cause a click on it
// to also forward focus/activation to the label's associated control the way a plain click would.
export const GlossaryHint = ({ term, definition, className }: GlossaryHintProps) => {
  const [open, setOpen] = useState(false)

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-inherit text-inherit underline decoration-dotted underline-offset-2"
      >
        {term}
        <Info className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-1 w-56 rounded-card border border-line bg-paper p-2 text-xs leading-snug font-normal text-ink-soft normal-case shadow-md"
        >
          {definition}
        </span>
      ) : null}
    </span>
  )
}
