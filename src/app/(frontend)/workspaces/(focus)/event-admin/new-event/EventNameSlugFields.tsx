'use client'

import * as React from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Mirrors wizardShared.ts's slugify() - duplicated here (rather than imported) because that
// module is also used by 'use server' actions that call Payload, which can't be pulled into a
// client bundle.
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

export function EventNameSlugFields({
  defaultName,
  defaultSlug,
  suggestedSlug,
}: {
  defaultName: string
  defaultSlug: string
  suggestedSlug?: string
}) {
  const [name, setName] = React.useState(defaultName)
  const [slug, setSlug] = React.useState(defaultSlug)
  // Auto-fill tracks the name field until the user edits the slug directly - then it's theirs.
  const [slugTouched, setSlugTouched] = React.useState(Boolean(defaultSlug))

  return (
    <>
      <Field label="Event name" className="sm:col-span-2">
        <Input
          name="name"
          required
          placeholder="e.g. ROC Olympic 2026"
          value={name}
          onChange={(event) => {
            const value = event.target.value
            setName(value)
            if (!slugTouched) setSlug(slugify(value))
          }}
        />
      </Field>
      <Field label="Slug (advanced)" className="sm:col-span-2">
        <Input
          name="slug"
          placeholder="generated-from-name"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value)
            setSlugTouched(true)
          }}
        />
        <p className="mt-1 text-xs text-ink-soft">
          Event page: <span className="font-semibold text-ink">/events/{slug || 'generated-from-name'}</span>
        </p>
        {suggestedSlug ? (
          <button
            type="button"
            onClick={() => {
              setSlug(suggestedSlug)
              setSlugTouched(true)
            }}
            className="mt-1 text-left text-xs font-bold text-green underline underline-offset-2"
          >
            That slug is taken - use &ldquo;{suggestedSlug}&rdquo; instead
          </button>
        ) : null}
      </Field>
    </>
  )
}
