'use client'

import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
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
//
// AUDIT_UI_UX_CSS UI-04: this used to hand-roll its own Dialog.Portal/Overlay/Content/Close markup
// instead of the shared primitive - same visual result, but every accessibility/style fix landing
// on DialogContent (close button size, description wiring) had to be copy-pasted here too, and
// hadn't been.
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
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Match
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add Match"
        description="The active event is derived automatically. Use business names, never IDs."
      >
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
            <SubmitButton className="w-full">Create match</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
