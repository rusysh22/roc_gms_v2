'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/ui/submit-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { saveSeedOrderAction } from './entriesSeedActions'

export type SeedOrderEntry = {
  id: string
  displayName: string
  clubLabel?: string
  seedNumber: number | null
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md item 4, option B: up/down buttons instead of drag-and-drop -
// native <button>, no new dependency, accessible by default (drag-and-drop needs a separate
// keyboard-accessible fallback built on top; buttons don't). Moving a row swaps its seed number
// with the row it passed, so dragging order and typing numbers stay two views of the same state
// instead of drifting apart. Duplicate seed numbers are flagged client-side as they're typed,
// closing the "no live validation" gap without a server round trip per keystroke.
export const SeedOrderTable = ({
  eventId,
  categoryId,
  entries,
}: {
  eventId: string
  categoryId: string
  entries: SeedOrderEntry[]
}) => {
  const [order, setOrder] = useState(() => entries.map((entry) => entry.id))
  const [seeds, setSeeds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      entries.map((entry) => [entry.id, entry.seedNumber != null ? String(entry.seedNumber) : '']),
    ),
  )
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= order.length) {
      return
    }
    const a = order[index]
    const b = order[targetIndex]
    setOrder((current) => {
      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
    setSeeds((current) => ({ ...current, [a]: current[b], [b]: current[a] }))
  }

  const duplicateSeeds = useMemo(() => {
    const seen = new Map<string, number>()
    for (const value of Object.values(seeds)) {
      const trimmed = value.trim()
      if (!trimmed) {
        continue
      }
      seen.set(trimmed, (seen.get(trimmed) || 0) + 1)
    }
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([value]) => value))
  }, [seeds])

  const hasDuplicates = duplicateSeeds.size > 0

  return (
    <form action={saveSeedOrderAction} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      {hasDuplicates ? (
        <AlertBanner tone="error">
          Two or more entries share the same seed number. Fix the highlighted rows before saving.
        </AlertBanner>
      ) : null}
      <div className="max-h-80 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-24">Order</TableHead>
              <TableHead>Participant</TableHead>
              {/* Seed's glossary hint lives in the card intro above, not here - a popover
                  anchored inside this scrollable/sticky table header gets clipped by the table's
                  own overflow-y-auto boundary. */}
              <TableHead>Seed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.map((id, index) => {
              const entry = entryById.get(id)
              if (!entry) {
                return null
              }
              const value = seeds[id] ?? ''
              const isDuplicate = value.trim() !== '' && duplicateSeeds.has(value.trim())
              return (
                <TableRow key={id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Move ${entry.displayName} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Move ${entry.displayName} down`}
                        disabled={index === order.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">
                    {entry.displayName}
                    {entry.clubLabel ? (
                      <span className="block text-xs font-normal text-ink-soft">{entry.clubLabel}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Input
                      name={`seed_${id}`}
                      type="number"
                      min="1"
                      aria-invalid={isDuplicate}
                      className={cn('w-20', isDuplicate && 'border-red-200 bg-red-50 text-red-700')}
                      value={value}
                      onChange={(event) => setSeeds((current) => ({ ...current, [id]: event.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div>
        <SubmitButton disabled={hasDuplicates}>Save Order</SubmitButton>
      </div>
    </form>
  )
}
