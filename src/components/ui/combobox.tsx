'use client'

import * as React from 'react'
import { useCombobox } from 'downshift'
import { Check, ChevronDown, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Field } from './field'

// Standard searchable dropdown for the workspace forms.
//
// Why this exists: every relationship picker used to be a native <select> (src/components/ui/select.tsx).
// That's fine for a short enum (status, gender, tier) but unusable for Category / Player / Team /
// Club lists that can run to hundreds of rows - there's no type-to-filter. This is the one shared
// "combobox" used everywhere those pickers appear.
//
// Rule of thumb: use <Combobox> for relationship fields and any list that can grow; keep the native
// <Select> for short, fixed enums.
//
// Form compatibility: the workspace forms are plain <form action={serverAction}> - no client state.
// This renders a hidden <input name={name}> carrying the selected value so it participates in
// FormData exactly like the <select> it replaces, with zero changes to the server actions.

export type ComboboxOption = {
  value: string
  label: string
  /** Optional <optgroup>-style section header this option sits under. */
  group?: string
}

export interface ComboboxProps {
  name: string
  options: ComboboxOption[]
  defaultValue?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  /** Shown when the filter matches nothing. */
  emptyText?: string
  /** Adds a clear ("None") affordance - use for optional foreign keys. */
  allowClear?: boolean
  id?: string
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

const inputClasses =
  'h-11 w-full appearance-none rounded-[10px] border border-line bg-paper pl-3 pr-16 font-sans text-sm font-semibold text-ink transition-colors placeholder:font-normal placeholder:text-ink-soft focus-visible:border-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/20 disabled:cursor-not-allowed disabled:opacity-50'

export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    name,
    options,
    defaultValue = '',
    placeholder = 'Select or type to search...',
    required,
    disabled,
    emptyText = 'No matches',
    allowClear,
    id,
    className,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  },
  ref,
) {
  const initialItem = React.useMemo(
    () => options.find((option) => option.value === defaultValue) ?? null,
    [options, defaultValue],
  )
  const [selectedItem, setSelectedItem] = React.useState<ComboboxOption | null>(initialItem)
  const [inputValue, setInputValue] = React.useState('')

  const filtered = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) => option.label.toLowerCase().includes(query))
  }, [options, inputValue])

  const {
    isOpen,
    getToggleButtonProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
  } = useCombobox<ComboboxOption>({
    items: filtered,
    itemToString: (item) => item?.label ?? '',
    selectedItem,
    inputValue,
    onInputValueChange: ({ inputValue: next }) => setInputValue(next ?? ''),
    onSelectedItemChange: ({ selectedItem: next }) => {
      setSelectedItem(next ?? null)
      setInputValue('')
    },
    onIsOpenChange: ({ isOpen: open }) => {
      // Reset the filter text back to the current selection's label whenever the menu closes so a
      // half-typed query never lingers in the box.
      if (!open) setInputValue('')
    },
  })

  const displayValue = isOpen ? inputValue : selectedItem?.label ?? ''

  return (
    <div className={cn('relative', className)}>
      <input type="hidden" name={name} value={selectedItem?.value ?? ''} />
      {/* The visible input doubles as the validation target: while closed it shows the selected
          label (non-empty when a choice is made), so native `required` fires correctly on submit.
          It never carries the submitted value - the hidden input above does. */}
      <input
        {...getInputProps({
          ref,
          id,
          disabled,
          required,
          placeholder,
          'aria-describedby': ariaDescribedBy,
          'aria-invalid': ariaInvalid,
          value: displayValue,
          onChange: () => {},
        })}
        className={inputClasses}
        autoComplete="off"
      />

      <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
        {allowClear && selectedItem && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => {
              setSelectedItem(null)
              setInputValue('')
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          {...getToggleButtonProps({ disabled })}
          aria-label="Toggle options"
          className="flex h-6 w-6 items-center justify-center text-ink-soft"
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      <ul
        {...getMenuProps()}
        className={cn(
          'absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border border-line bg-paper py-1 shadow-md outline-none',
          !isOpen && 'hidden',
        )}
      >
        {isOpen && filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-ink-soft">{emptyText}</li>
        ) : null}
        {isOpen &&
          filtered.map((item, index) => {
            const prev = filtered[index - 1]
            const showGroupHeader = item.group && item.group !== prev?.group
            return (
              <React.Fragment key={item.value}>
                {showGroupHeader ? (
                  <li
                    aria-hidden="true"
                    className="px-3 pb-1 pt-2 text-[0.7rem] font-bold uppercase tracking-wide text-ink-soft"
                  >
                    {item.group}
                  </li>
                ) : null}
                <li
                  {...getItemProps({ item, index })}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-ink',
                    highlightedIndex === index && 'bg-mist',
                    item.group && 'pl-5',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {selectedItem?.value === item.value ? (
                    <Check className="h-4 w-4 shrink-0 text-green" aria-hidden="true" />
                  ) : null}
                </li>
              </React.Fragment>
            )
          })}
      </ul>
    </div>
  )
})

// Field + Combobox pairing, mirroring the inline `ChoiceField` helpers the list pages used to carry.
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
