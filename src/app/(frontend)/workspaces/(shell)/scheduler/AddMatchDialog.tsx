'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { WorkspaceOption } from '../../workspaceComponents'
import { createScheduledMatchAction } from './schedulerActions'

const OptionSelect = ({ label, name, options }: { label: string; name: string; options: WorkspaceOption[] }) => (
  <Field label={label}>
    <Select name={name} defaultValue="">
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  </Field>
)

// Adding a match is an occasional action, not part of the queue you're scanning - keeping the
// form in a dialog means the monitoring view (stats/conflicts/queue/calendar) never has to share
// scroll space with it.
export function AddMatchDialog({
  sports,
  categories,
  entries,
  venues,
  courts,
}: {
  sports: WorkspaceOption[]
  categories: WorkspaceOption[]
  entries: WorkspaceOption[]
  venues: WorkspaceOption[]
  courts: WorkspaceOption[]
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Match
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-40 max-h-[90vh] w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel bg-paper p-6 shadow-md outline-none"
          aria-describedby={undefined}
        >
          <div className="mb-1 flex items-center justify-between">
            <Dialog.Title className="text-lg font-extrabold text-ink">Add Match</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <p className="mb-4 text-xs font-semibold text-ink-soft">
            The active event is derived automatically. Use business names, never IDs.
          </p>
          <form action={createScheduledMatchAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Match number" className="sm:col-span-2">
              <Input name="matchNumber" required placeholder="FB-001" />
            </Field>
            <OptionSelect label="Sport" name="sportId" options={sports} />
            <OptionSelect label="Category" name="categoryId" options={categories} />
            <OptionSelect label="Participant A" name="participantA" options={entries} />
            <OptionSelect label="Participant B" name="participantB" options={entries} />
            <Field label="Start">
              <Input name="scheduledStart" type="datetime-local" required />
            </Field>
            <Field label="End">
              <Input name="scheduledEnd" type="datetime-local" required />
            </Field>
            <OptionSelect label="Venue" name="venueId" options={venues} />
            <OptionSelect label="Court" name="courtId" options={courts} />
            <Field label="Status">
              <Select name="status" defaultValue="scheduled">
                <option value="draft">Draft</option>
                <option value="ready_for_scheduling">Ready for scheduling</option>
                <option value="scheduled">Scheduled</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold text-ink">
              <input type="checkbox" name="isPublic" className="h-4 w-4 rounded border-line text-green focus:ring-green/40" />
              Public schedule
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full">
                Create match
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
