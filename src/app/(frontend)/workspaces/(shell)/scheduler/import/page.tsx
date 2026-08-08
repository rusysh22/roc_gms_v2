import Link from 'next/link'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/ui/file-upload'
import { SubmitButton } from '@/components/ui/submit-button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import type { ScheduleImportRowOutcome } from '@/lib/scheduleImport'
import { applyScheduleImportAction } from '../schedulerActions'

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
      results = JSON.parse(decodeURIComponent(resultsRaw)) as ScheduleImportRowOutcome[]
    } catch {
      results = []
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Scheduler Workspace"
        title="Bulk Schedule Import"
        summary="Export the current schedule, fill in the New Start/End/Venue/Court/Status columns for whichever matches you need to change, then upload it here. Every row goes through the same reschedule and status-transition validation as the single-match forms - conflicts, invalid states, and missing winners are rejected per row, not silently applied."
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

          <Card className="mb-6 flex flex-col gap-3">
            <div>
              <CardTitle>1. Export the template</CardTitle>
              <p className="mt-1 text-sm text-ink-soft">
                Downloads every match in this event as one sheet. The first columns (Match # through
                Public) are read-only context; the "New ..." columns are what this import reads.
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
                  To reschedule a match, fill in <strong>all four</strong> of New Start, New End, New
                  Venue, and New Court together (start/end as <code>YYYY-MM-DD HH:mm</code>, venue/court
                  matched by name).
                </li>
                <li>
                  To change status, fill in <strong>New Status</strong> with one of{' '}
                  <code>scheduled</code>, <code>postponed</code>, <code>cancelled</code>, or{' '}
                  <code>walkover</code>. Walkover also needs <strong>Winner (A/B)</strong>.
                </li>
                <li>Leave a row&apos;s "New ..." columns blank to leave that match untouched.</li>
                <li>Reason is optional and recorded on the audit log for every changed row.</li>
              </ul>
            </div>
          </Card>

          <Card className="mb-6 flex flex-col gap-3">
            <div>
              <CardTitle>3. Upload it back</CardTitle>
              <p className="mt-1 text-sm text-ink-soft">
                Applies immediately, row by row - there is no separate preview/confirm step, since
                every row is validated (and rejected on its own if invalid) the same way the
                Scheduler and Match Officer forms already validate a single change.
              </p>
            </div>
            <form action={applyScheduleImportAction} className="flex flex-col items-start gap-3 sm:max-w-sm">
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
              <SubmitButton pendingLabel="Applying...">Apply import</SubmitButton>
            </form>
          </Card>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, index) => (
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
                          {result.outcome}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-ink-soft">{result.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}
