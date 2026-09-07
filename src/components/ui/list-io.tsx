'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Download, Upload } from 'lucide-react'

import { Button } from './button'
import { Dialog, DialogContent, DialogTrigger } from './dialog'
import { AlertBanner } from './alert-banner'

// Import / Export controls for an Event Admin list menu, dropped into the DataTableToolbar `io`
// slot. Talks to /workspaces/event-admin/io/<menu> (see that route handler):
//   - Export  = GET  -> downloads the pre-filled workbook
//   - Import  = POST multipart -> preview (dry run), then POST json -> apply
// All the multi-step state lives here; the list page just renders <ListIO menu="clubs" />.

type RowPlan = {
  sheet: string
  rowNumber: number
  label: string
  action: 'create' | 'update' | 'skip' | 'error'
  reason?: string
}
type Plan = { rows: RowPlan[]; counts: { create: number; update: number; skip: number; error: number } }
type Summary = {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { sheet: string; rowNumber: number; label: string; reason: string }[]
}

const ACTION_STYLE: Record<RowPlan['action'], string> = {
  create: 'text-green',
  update: 'text-blue',
  skip: 'text-ink-soft',
  error: 'text-danger',
}

export function ListIO({ menu, label = 'data' }: { menu: string; label?: string }) {
  const router = useRouter()
  const base = `/workspaces/event-admin/io/${menu}`

  const [open, setOpen] = React.useState(false)
  const [phase, setPhase] = React.useState<'pick' | 'preview' | 'done'>('pick')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [plan, setPlan] = React.useState<Plan | null>(null)
  const [scratchId, setScratchId] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<Summary | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const reset = () => {
    setPhase('pick')
    setBusy(false)
    setError(null)
    setPlan(null)
    setScratchId(null)
    setSummary(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onUpload = async (event: React.FormEvent) => {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.set('file', file)
      const res = await fetch(base, { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'upload failed')
      setPlan(json.plan)
      setScratchId(json.scratchId)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed')
    } finally {
      setBusy(false)
    }
  }

  const onConfirm = async () => {
    if (!scratchId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scratchId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'import failed')
      setSummary(json.summary)
      setPhase('done')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button asChild size="sm" variant="secondary">
        <a href={base}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export
        </a>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogTrigger asChild>
          <Button size="sm" variant="secondary">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import
          </Button>
        </DialogTrigger>
        <DialogContent
          title={`Import ${label} from Excel`}
          description="Export first to get the current data with the right columns, edit it, then upload it here. Nothing is written until you confirm."
          className="max-w-2xl"
        >
          {error ? (
            <AlertBanner tone="error" className="mb-3">
              {error}
            </AlertBanner>
          ) : null}

          {phase === 'pick' ? (
            <form onSubmit={onUpload} className="flex flex-col gap-4">
              <input
                ref={fileRef}
                type="file"
                name="file"
                accept=".xlsx"
                required
                className="text-sm font-semibold text-ink file:mr-3 file:rounded-full file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink"
              />
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? 'Reading...' : 'Upload & preview'}
              </Button>
            </form>
          ) : null}

          {phase === 'preview' && plan ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-ink">
                <span className="text-green">{plan.counts.create} new</span> ·{' '}
                <span className="text-blue">{plan.counts.update} updated</span>
                {plan.counts.error > 0 ? (
                  <>
                    {' '}
                    · <span className="text-danger">{plan.counts.error} errors (skipped)</span>
                  </>
                ) : null}
              </p>
              <div className="max-h-72 overflow-y-auto rounded-panel border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-mist text-ink-soft">
                    <tr>
                      <th className="px-2 py-1.5 font-bold">Sheet</th>
                      <th className="px-2 py-1.5 font-bold">Row</th>
                      <th className="px-2 py-1.5 font-bold">Item</th>
                      <th className="px-2 py-1.5 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-2 py-1.5 text-ink-soft">{row.sheet}</td>
                        <td className="px-2 py-1.5 text-ink-soft">{row.rowNumber}</td>
                        <td className="px-2 py-1.5 font-semibold text-ink">{row.label}</td>
                        <td className={`px-2 py-1.5 font-bold ${ACTION_STYLE[row.action]}`}>
                          {row.action}
                          {row.reason ? <span className="font-normal"> — {row.reason}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onConfirm} disabled={busy || plan.counts.create + plan.counts.update === 0}>
                  {busy ? 'Importing...' : `Confirm import (${plan.counts.create + plan.counts.update})`}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={reset} disabled={busy}>
                  Choose another file
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'done' && summary ? (
            <div className="flex flex-col gap-3">
              <AlertBanner tone="success">
                Created {summary.created}, updated {summary.updated}
                {summary.failed > 0 ? `, ${summary.failed} failed` : ''}.
              </AlertBanner>
              {summary.errors.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto rounded-panel border border-line p-2 text-xs text-danger">
                  {summary.errors.map((e, i) => (
                    <li key={i}>
                      {e.sheet} row {e.rowNumber} ({e.label}): {e.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Done
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
