'use client'

import { CalendarClock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getRelationshipId, type WorkspaceMatch, type WorkspaceOption } from '../../workspaceComponents'
import { rescheduleMatchAction } from './schedulerActions'

const toDateTimeLocalValue = (iso?: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Rescheduling is scoped to one specific match, so the trigger lives right on that match's row
// instead of a generic bottom-of-page form that made you pick the match from a dropdown again.
// The underlying action (rescheduleMatchAction) is also how a match gets its FIRST time/venue/
// court - so the label switches to "Schedule" until a time has actually been set, otherwise
// "Reschedule" would misleadingly imply there's an existing schedule to change.
//
// AUDIT_UI_UX_CSS UI-04: migrated off a hand-rolled Dialog.Portal/Overlay/Content/Close copy onto
// the shared DialogContent (see AddMatchDialog for the same fix).
export function RescheduleMatchDialog({
  match,
  venues,
  courts,
}: {
  match: WorkspaceMatch
  venues: WorkspaceOption[]
  courts: WorkspaceOption[]
}) {
  const isScheduled = Boolean(match.scheduled_start_at)
  const verb = isScheduled ? 'Reschedule' : 'Schedule'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {verb}
        </Button>
      </DialogTrigger>
      <DialogContent title={`${verb} ${match.match_number}`} className="max-w-lg">
        <form action={rescheduleMatchAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="matchNumber" value={match.match_number} />
          <Field label="Start">
            <Input
              name="scheduledStart"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocalValue(match.scheduled_start_at)}
            />
          </Field>
          <Field label="End">
            <Input
              name="scheduledEnd"
              type="datetime-local"
              required
              defaultValue={toDateTimeLocalValue(match.scheduled_end_at)}
            />
          </Field>
          <Field label="Venue">
            <Select name="venueId" defaultValue={getRelationshipId(match.venue_id)}>
              <option value="">Select venue</option>
              {venues.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Court">
            <Select name="courtId" defaultValue={getRelationshipId(match.court_id)}>
              <option value="">Select court</option>
              {courts.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" className="sm:col-span-2">
            <Input name="reason" required placeholder={isScheduled ? 'e.g. Venue conflict resolved' : 'e.g. Initial schedule'} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton className="w-full">Confirm {verb.toLowerCase()}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
