'use client'

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'

export type SummaryDetailItem = {
  id: string | number
  primary: string
  secondary?: string
  tag?: string
}

export function SummaryDetailModal({
  title,
  columnLabel,
  items,
  triggerLabel,
}: {
  title: string
  columnLabel: string
  items: SummaryDetailItem[]
  triggerLabel: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs font-bold text-blue underline-offset-2 hover:underline"
        >
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent title={title}>
        {items.length === 0 ? (
          <EmptyState>Nothing here yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{columnLabel}</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-bold">{item.primary}</TableCell>
                  <TableCell className="text-ink-soft">{item.secondary || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
