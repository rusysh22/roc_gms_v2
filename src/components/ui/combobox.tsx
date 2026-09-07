'use client'

import * as React from 'react'

import { Field } from './field'
import { SearchableSelect, type SearchableSelectOption } from './searchable-select'

// Thin adapter over the app's existing SearchableSelect (src/components/ui/searchable-select.tsx) -
// the WAI-ARIA "combobox with list autocomplete" the wizard already uses and e2e/combobox.spec.ts
// covers. This just adds the `ComboboxField` (Field + control) pairing and a couple of
// call-site conveniences (`group` -> the option's description line, `allowClear` -> a leading
// blank option) so the Event Admin list pages have one import to reach for.
//
// Rule of thumb: use <Combobox>/<ComboboxField> for relationship fields and any list that can
// grow; keep the native <Select> for short, fixed enums (status, gender, tier).

export type ComboboxOption = {
  value: string
  label: string
  /** Shown as the option's secondary line - handy as a lightweight group tag. */
  group?: string
}

export interface ComboboxProps {
  name: string
  options: ComboboxOption[]
  defaultValue?: string
  placeholder?: string
  /** Accepted for call-site intent; not enforced client-side - the server actions validate. */
  required?: boolean
  disabled?: boolean
  emptyText?: string
  /** Prepends a blank "none" option - use for optional foreign keys. */
  allowClear?: boolean
  id?: string
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function Combobox({
  name,
  options,
  defaultValue,
  placeholder = 'Select or type to search...',
  emptyText = 'No matches',
  allowClear,
  id,
  className,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: ComboboxProps) {
  const mapped: SearchableSelectOption[] = React.useMemo(() => {
    const base = options.map((o) => ({ value: o.value, label: o.label, description: o.group }))
    return allowClear ? [{ value: '', label: placeholder }, ...base] : base
  }, [options, allowClear, placeholder])

  return (
    <SearchableSelect
      id={id}
      name={name}
      options={mapped}
      defaultValue={defaultValue}
      placeholder={placeholder}
      emptyMessage={emptyText}
      className={className}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
    />
  )
}

export interface ComboboxFieldProps extends Omit<ComboboxProps, 'aria-describedby' | 'aria-invalid'> {
  label: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  optional?: boolean
  fieldClassName?: string
}

export function ComboboxField({
  label,
  description,
  error,
  optional,
  fieldClassName,
  ...props
}: ComboboxFieldProps) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      optional={optional}
      className={fieldClassName}
    >
      <Combobox {...props} />
    </Field>
  )
}
