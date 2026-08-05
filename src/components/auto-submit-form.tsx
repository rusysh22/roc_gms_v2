'use client'

import type { FormHTMLAttributes } from 'react'

// A plain GET filter form (Select/date-input choices re-navigate the page with an updated query
// string) that submits itself the moment any field changes - the standard "pick a filter, results
// update immediately" pattern, without hand-wiring an onChange on every individual field.
export function AutoSubmitForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onChange={(event) => {
        event.currentTarget.requestSubmit()
      }}
    />
  )
}
