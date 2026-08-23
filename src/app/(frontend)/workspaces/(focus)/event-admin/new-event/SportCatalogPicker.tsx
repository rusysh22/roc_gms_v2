'use client'

import * as React from 'react'

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SPORT_CATALOG, type CatalogSport } from '@/lib/sportCatalog'
import { addSportFromCatalogAction } from './sportCatalogActions'

const FORMAT_OPTIONS = [
  { value: 'single_elimination', label: 'Straight knockout - lose once, done' },
  { value: 'group_stage_to_knockout', label: 'Group stage, then knockout - group winners advance' },
  { value: 'round_robin', label: 'Round robin - everyone plays everyone' },
]

const PARTICIPANT_MODE_LABEL: Record<string, string> = {
  individual: 'individual',
  pair: 'pair',
  team: 'team',
  club: 'club',
  open: 'open',
}

// MSG-07: two-stage dialog - pick a catalog sport, then tick which of its standard events this
// event is actually running. Selection state (which events are ticked, so the submit button's
// count stays live) is the only thing that needs to be client-side; the actual creation goes
// through addSportFromCatalogAction exactly like every other form in this wizard.
export function SportCatalogPicker({ eventId }: { eventId: string }) {
  const [open, setOpen] = React.useState(false)
  const [selectedSport, setSelectedSport] = React.useState<CatalogSport | null>(null)
  const [search, setSearch] = React.useState('')
  const [checkedEvents, setCheckedEvents] = React.useState<Set<string>>(new Set())

  const openSport = (sport: CatalogSport) => {
    setSelectedSport(sport)
    setCheckedEvents(new Set(sport.events.map((event) => event.name)))
  }

  const reset = () => {
    setSelectedSport(null)
    setSearch('')
    setCheckedEvents(new Set())
  }

  const filtered = SPORT_CATALOG.filter((sport) => sport.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          + Add sport from catalog
        </Button>
      </DialogTrigger>
      <DialogContent
        title={selectedSport ? `${selectedSport.icon} ${selectedSport.name}` : 'Choose a sport'}
        description={
          selectedSport
            ? 'Tick the events you’re running. Rules are pre-filled - change anything before saving.'
            : 'Pick a sport, then tick which of its standard events you’re running.'
        }
      >
        {!selectedSport ? (
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Search sports..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {filtered.map((sport) => (
                <button
                  key={sport.key}
                  type="button"
                  onClick={() => openSport(sport)}
                  className="flex flex-col items-center gap-1 rounded-card border border-line bg-paper p-3 text-center transition-colors hover:border-green hover:bg-mist"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {sport.icon}
                  </span>
                  <span className="text-xs font-bold text-ink">{sport.name}</span>
                  <span className="text-[11px] text-ink-soft">{sport.events.length} events</span>
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-soft">
                No match. Close this and use &ldquo;Add a sport&rdquo; below to create one from scratch.
              </p>
            ) : null}
          </div>
        ) : (
          <form
            action={addSportFromCatalogAction}
            className="flex flex-col gap-4"
            onSubmit={() => {
              // Stay open on the sport-choice screen instead of closing - admins adding several
              // sports in one sitting shouldn't have to reopen this dialog for each one.
              setSelectedSport(null)
              setSearch('')
              setCheckedEvents(new Set())
            }}
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="sportKey" value={selectedSport.key} />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-bold tracking-wide text-ink-soft uppercase">
                Events
              </legend>
              {selectedSport.events.map((event) => (
                <label key={event.name} className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="eventName"
                      value={event.name}
                      checked={checkedEvents.has(event.name)}
                      onChange={(changeEvent) => {
                        setCheckedEvents((prev) => {
                          const next = new Set(prev)
                          if (changeEvent.target.checked) {
                            next.add(event.name)
                          } else {
                            next.delete(event.name)
                          }
                          return next
                        })
                      }}
                      className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
                    />
                    {event.name}
                  </span>
                  <span className="text-xs font-normal text-ink-soft">
                    {PARTICIPANT_MODE_LABEL[event.participantMode]}
                  </span>
                </label>
              ))}
              <div className="mt-1 flex gap-3 text-xs font-bold text-green">
                <button type="button" onClick={() => setCheckedEvents(new Set(selectedSport.events.map((e) => e.name)))}>
                  Select all
                </button>
                <button type="button" onClick={() => setCheckedEvents(new Set())}>
                  Clear all
                </button>
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Other event</p>
              <div className="grid grid-cols-2 gap-2">
                <Input name="customEventName" placeholder="e.g. Veterans Doubles" />
                <Select name="customParticipantMode" defaultValue="open">
                  <option value="individual">Individual</option>
                  <option value="pair">Pair</option>
                  <option value="team">Team</option>
                  <option value="club">Club</option>
                  <option value="open">Not sure yet</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Format</p>
              <Select name="formatType" defaultValue="group_stage_to_knockout">
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink-soft">{selectedSport.ruleset.summary}</p>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button type="button" variant="secondary" onClick={() => setSelectedSport(null)}>
                Back
              </Button>
              <SubmitButton>Add {checkedEvents.size} event{checkedEvents.size === 1 ? '' : 's'}</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
