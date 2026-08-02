'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { promoteToKnockoutAction } from './groupActions'

export type QualifierSeedEntry = {
  entryId: string
  displayName: string
  groupLabel: string
}

// group_stage_to_knockout item 5: computeCrossGroupQualifierOrder's default cross-group seeding
// can't generally avoid same-group pairings for 3+ groups (see its own comment). Rather than
// solving that combinatorial problem, this lets the admin manually fix it - up/down buttons only
// (same accessible, no-new-dependency pattern as item 4's SeedOrderTable), since rank here is
// purely positional (derived from order), unlike SeedOrderTable's independently-typed seed numbers.
export const QualifierSeedOrder = ({
  eventId,
  categoryId,
  qualifiers,
  hasSameGroupPairing,
}: {
  eventId: string
  categoryId: string
  qualifiers: QualifierSeedEntry[]
  hasSameGroupPairing: boolean
}) => {
  const [order, setOrder] = useState(() => qualifiers.map((qualifier) => qualifier.entryId))
  const qualifierById = new Map(qualifiers.map((qualifier) => [qualifier.entryId, qualifier]))

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= order.length) {
      return
    }
    setOrder((current) => {
      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  return (
    <form action={promoteToKnockoutAction} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      {order.map((id, index) => (
        <input key={id} type="hidden" name={`rank_${id}`} value={index + 1} />
      ))}
      {hasSameGroupPairing ? (
        <AlertBanner tone="warning">
          This seed order pits two entries from the same group against each other in round one.
          Reorder below to avoid it, or continue if that&apos;s acceptable.
        </AlertBanner>
      ) : null}
      <div className="max-h-80 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-24">Order</TableHead>
              <TableHead>Qualifier</TableHead>
              <TableHead>Group</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.map((id, index) => {
              const qualifier = qualifierById.get(id)
              if (!qualifier) {
                return null
              }
              return (
                <TableRow key={id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Move ${qualifier.displayName} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Move ${qualifier.displayName} down`}
                        disabled={index === order.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">
                    #{index + 1} {qualifier.displayName}
                  </TableCell>
                  <TableCell className="text-ink-soft">{qualifier.groupLabel}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div>
        <SubmitButton>Generate Knockout Bracket</SubmitButton>
      </div>
    </form>
  )
}
