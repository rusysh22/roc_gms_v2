'use client'

import type { ChangeEvent } from 'react'

export interface SelectAllCheckboxProps {
  /** Selects every checkbox with this `name` inside the nearest ancestor <form>. */
  targetName: string
  className?: string
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 6: bulk-adding entries only helps if checking 40 boxes by
// hand isn't the alternative to clicking 40 buttons. No React state needed - this only ever toggles
// DOM checkboxes that already carry their own value/checked state for the form submit.
export const SelectAllCheckbox = ({ targetName, className }: SelectAllCheckboxProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const form = event.currentTarget.closest('form')
    if (!form) return
    const boxes = form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${targetName}"]`)
    boxes.forEach((box) => {
      box.checked = event.currentTarget.checked
    })
  }

  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className={className}
      onChange={handleChange}
    />
  )
}
