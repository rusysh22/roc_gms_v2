import Link from 'next/link'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/ui/file-upload'
import { SubmitButton } from '@/components/ui/submit-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { readScratchJson } from '@/lib/importScratch'
import type { ScheduleImportPreview, ScheduleImportRowOutcome } from '@/lib/scheduleImport'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, StatBlock, StatGrid } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import {
  applyScheduleImportAction,
  cancelScheduleImportAction,
  previewScheduleImportAction,
} from '../schedulerActions'

export const dynamic = 'force-dynamic'

const importErrorMessages: Record<string, string> = {
  missing_event: 'No active event is selected.',
  invalid_file: 'Choose a .xlsx file exported from this page (or the Scheduler export) to import.',
  empty_import: 'That file has no rows with a Match # filled in.',
}

const outcomeStyles: Record<ScheduleImportRowOutcome['outcome'], string> = {
  updated: 'border-green/30 bg-paper text-green',
  skipped: 'border-line bg-paper text-ink-soft',
  error: 'border-danger/30 bg-danger-surface text-danger',
}

type ImportSearchParams = Promise<Record<string, string | string[] | undefined>>

const getParam = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value || ''
}

const ResultsTable = ({ rows }: { rows: ScheduleImportRowOutcome[] }) => (
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Match</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((result, index) => (
          <TableRow key={`${result.matchNumber}-${index}`}>
            <TableCell className="font-bold">
              <Link
                href={`/workspaces/matches/${result.matchNumber}`}
                className="text-blue no-underline hover:underline"
              >
                {result.matchNumber}
              </Link>
            </TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${outcomeStyles[result.outcome]}`}
              >
                {result.outcome === 'updated' ? 'will change' : result.outcome}
              </span>
            </TableCell>
            <TableCell className="text-sm text-ink-soft">
              {result.changePreview || result.message}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)

export default async function ScheduleImportPage({
  searchParams,
}: {
  searchParams?: ImportSearchParams
}) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.scheduler,
    returnTo: '/workspaces/scheduler/import',
    workspaceName: 'Scheduler Workspace',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const payload = access.payload
  const activeEvent = await getActiveEvent(payload)

  const params = searchParams ? await searchParams : {}
  const importError = getParam(params, 'importError')
  const importDone = getParam(params, 'importDone') === '1'
  const importUpdated = Number(getParam(params, 'importUpdated') || '0')
  const importErrors = Number(getParam(params, 'importErrors') || '0')
  const importMoreResults = Number(getParam(params, 'importMoreResults') || '0')
  const resultsRaw = getParam(params, 'importResults')
  let results: ScheduleImportRowOutcome[] = []
  if (resultsRaw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(resultsRaw)) as ScheduleImportRowOutcome[]
      if (Array.isArray(parsed)) results = parsed
    } catch {
      results = []
    }
  }

  const previewFile = getParam(params, 'previewFile')
  const preview = previewFile
    ? await readScratchJson<ScheduleImportPreview>(previewFile.replace(/\.xlsx$/, ''))
    : null

  return (
    <>
      <PageHero
        eyebrow="Scheduler Workspace"
        title="Bulk Schedule Import"
        summary="Export the current schedule, fill in the New Start/End/Venue/Court/Status columns for the matches you need to change, then upload it back. You see a preview of exactly what will change before anything is written; each row goes through the same validation as the single-match forms."
        actions={
          <Button asChild variant="secondary">
            <Link href="/workspaces/scheduler">Back to Scheduler</Link>
          </Button>
        }
      />

      {!activeEvent ? (
        <NoActiveEventNotice />
      ) : (
        <>
          {importError && importErrorMessages[importError] ? (
            <AlertBanner tone="error" className="mb-4">
              {importErrorMessages[importError]}
            </AlertBanner>
          ) : null}

          {importDone ? (
            <AlertBanner tone={importErrors > 0 ? 'warning' : 'success'} className="mb-4">
              {importUpdated} match{importUpdated === 1 ? '' : 'es'} updated
              {importErrors > 0 ? `, ${importErrors} row(s) had errors (see below)` : ''}.
            </AlertBanner>
          ) : null}

          {preview ? (
            <Card className="mb-6 flex flex-col gap-4 border-gold">
              <div>
                <CardTitle>Review before applying</CardTitle>
                <p className="mt-1 text-sm text-ink-soft">
                  Nothing has been written yet. This is what the upload would do:
                </p>
              </div>
              <StatGrid>
                <StatBlock label="Rows that will change" value={preview.updated} tone="good" />
                <StatBlock
                  label="Skipped (nothing filled in)"
                  value={preview.skipped}
                  tone="default"
                />
                <StatBlock
                  label="Rows with errors"
                  value={preview.errors}
                  tone={preview.errors > 0 ? 'warn' : 'default'}
                />
              </StatGrid>

              {preview.rows.filter((row) => row.outcome !== 'skipped').length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">
                    Row by row {preview.moreRows ? `(first ${preview.rows.length} of ${preview.total})` : ''}
                  </p>
                  <ResultsTable rows={preview.rows.filter((row) => row.outcome !== 'skipped')} />
                  {preview.moreRows ? (
                    <p className="text-xs font-semibold text-ink-soft">
                      + {preview.moreRows} more row(s) not shown.
                    </p>
                  ) : null}
                </div>
              ) : (
                <AlertBanner tone="info">
                  No row has a New Start/End/Venue/Court/Status filled in - nothing to apply.
                </AlertBanner>
              )}

              <div className="flex flex-wrap gap-3">
                <form action={applyScheduleImportAction}>
                  <input type="hidden" name="scratchFile" value={previewFile} />
                  <SubmitButton pendingLabel="Applying..." disabled={preview.updated === 0}>
                    Apply {preview.updated} change{preview.updated === 1 ? '' : 's'}
                  </SubmitButton>
                </form>
                <form action={cancelScheduleImportAction}>
                  <input type="hidden" name="scratchFile" value={previewFile} />
                  <SubmitButton variant="secondary">Cancel</SubmitButton>
                </form>
              </div>
            </Card>
          ) : (
            <>
              <Card className="mb-6 flex flex-col gap-3">
                <div>
                  <CardTitle>1. Export the current schedule</CardTitle>
                  <p className="mt-1 text-sm text-ink-soft">
                    Downloads every match in this event as one sheet. The first columns (Match #
                    through Public, including Club A / Club B) are read-only context; the
                    &ldquo;New ...&rdquo; columns are what this import reads.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm" className="self-start">
                  <a href="/workspaces/scheduler/export" download>
                    Download current schedule (.xlsx)
                  </a>
                </Button>
              </Card>

              <Card className="mb-6 flex flex-col gap-3">
                <div>
                  <CardTitle>2. Fill in changes</CardTitle>
                  <ul className="mt-1 list-disc pl-5 text-sm text-ink-soft">
                    <li>
                      To reschedule a match, fill in <strong>all four</strong> of New Start, New End,
                      New Venue, and New Court together (start/end as <code>YYYY-MM-DD HH:mm</code>,
                      venue/court matched by name).
                    </li>
                    <li>
                      To change status, fill in <strong>New Status</strong> with one of{' '}
                      <code>scheduled</code>, <code>postponed</code>, <code>cancelled</code>, or{' '}
                      <code>walkover</code>. Walkover also needs <strong>Winner (A/B)</strong>.
                    </li>
                    <li>Leave a row&apos;s &ldquo;New ...&rdquo; columns blank to leave that match untouched.</li>
                    <li>Reason is optional and recorded on the audit log for every changed row.</li>
                  </ul>
                </div>
              </Card>

              <Card className="mb-6 flex flex-col gap-3">
                <div>
                  <CardTitle>3. Upload it for a preview</CardTitle>
                  <p className="mt-1 text-sm text-ink-soft">
                    You&apos;ll see how many rows will change and exactly what each one does before
                    confirming. Nothing is written until you click Apply on the next screen.
                  </p>
                </div>
                <form
                  action={previewScheduleImportAction}
                  className="flex flex-col items-start gap-3 sm:max-w-sm"
                >
                  <FileUpload
                    id="schedule-import-upload"
                    name="file"
                    variant="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    required
                    triggerLabel="Choose Excel file"
                    helpText=".xlsx or .xls"
                    className="w-full"
                  />
                  <SubmitButton pendingLabel="Reading...">Preview import</SubmitButton>
                </form>
              </Card>
            </>
          )}

          {results.length > 0 ? (
            <Card className="flex flex-col gap-3">
              <div>
                <CardTitle>Row-by-row results</CardTitle>
                {importMoreResults ? (
                  <p className="mt-1 text-xs font-semibold text-ink-soft">
                    Showing {results.length} rows (errors and updates first) - {importMoreResults}{' '}
                    more skipped (no-op) row(s) not shown.
                  </p>
                ) : null}
              </div>
              <ResultsTable rows={results} />
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}
