import Link from 'next/link'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/ui/status-badge'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, StatBlock, StatGrid, getRelationshipLabel } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { ConfirmSubmitButton } from '../../../matches/ConfirmSubmitButton'
import {
  approveRegistrationSubmissionAction,
  promoteWaitlistedEntryAction,
  rejectRegistrationSubmissionAction,
} from './registrationActions'

const PENDING_PAGE_SIZE = 100

export const dynamic = 'force-dynamic'

const registrationErrorMessages: Record<string, string> = {
  invalid_request: 'That submission could not be found.',
  not_pending: 'This submission was already reviewed by someone else.',
  reason_required: 'A reason is required to reject a submission.',
  duplicate_registration: 'This person is already an approved entry in that category.',
  not_waitlisted: 'That entry is not on the waitlist.',
  category_full: 'This category is still at capacity - free a confirmed slot first.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

type SubmissionRoster = { name: string; email?: string | null; phone?: string | null }
type WorkspaceSubmission = {
  id: string | number
  display_name: string
  club_name?: string | null
  participant_mode: string
  roster?: SubmissionRoster[] | null
  contact_name: string
  contact_email: string
  contact_phone?: string | null
  notes?: string | null
  status: string
  review_notes?: string | null
  category_id?: { id?: string | number; name?: string } | string | number | null
  createdAt: string
}

export default async function RegistrationsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.registrationDesk,
    returnTo: '/workspaces/event-admin/registrations',
    workspaceName: 'Registration Approval Queue',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Registration"
          title="Approval Queue"
          summary="Review public registration submissions before they become real entries."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const registrationError = get(params, 'registrationError')
  const registrationUpdated = get(params, 'registrationUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }

  const [pendingResult, approvedCount, rejectedCount, waitlistedResult] = await Promise.all([
    access.payload.find({
      collection: 'registration-submissions',
      depth: 1,
      limit: PENDING_PAGE_SIZE,
      sort: 'createdAt',
      where: { and: [eventWhere, { status: { equals: 'pending' } }] },
    }),
    access.payload.count({ collection: 'registration-submissions', where: { and: [eventWhere, { status: { equals: 'approved' } }] } }),
    access.payload.count({ collection: 'registration-submissions', where: { and: [eventWhere, { status: { equals: 'rejected' } }] } }),
    access.payload.find({
      collection: 'competition-entries',
      depth: 1,
      limit: 200,
      sort: 'createdAt',
      where: { and: [eventWhere, { status: { equals: 'waitlisted' } }] },
    }),
  ])
  const submissions = pendingResult.docs as WorkspaceSubmission[]
  // REG-09: the pending queue is capped - a viral registration can push submissions past the page.
  const pendingNotShown = Math.max(0, pendingResult.totalDocs - submissions.length)
  const waitlistedEntries = waitlistedResult.docs as {
    id: string | number
    display_name: string
    category_id: Parameters<typeof getRelationshipLabel>[0]
  }[]

  return (
    <>
      <PageHero
        eyebrow="Registration"
        title="Approval Queue"
        summary="Review public registration submissions before they become real Club/Team/Player/Entry records. Approving creates the records automatically; rejecting just records why."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/events/${activeEvent.slug}/register`}>View Public Form</Link>
          </Button>
        }
      />

      {registrationError && registrationErrorMessages[registrationError] ? (
        <AlertBanner tone="error" className="mb-4">
          {registrationErrorMessages[registrationError]}
        </AlertBanner>
      ) : null}
      {registrationUpdated === 'approved' ? (
        <AlertBanner tone="success" className="mb-4">
          Submission approved - the club/team/player/entry records were created.
        </AlertBanner>
      ) : null}
      {registrationUpdated === 'rejected' ? (
        <AlertBanner tone="success" className="mb-4">
          Submission rejected.
        </AlertBanner>
      ) : null}
      {registrationUpdated === 'waitlisted' ? (
        <AlertBanner tone="success" className="mb-4">
          Submission approved - the category is at capacity, so this entry was added to the waitlist.
        </AlertBanner>
      ) : null}
      {registrationUpdated === 'promoted' ? (
        <AlertBanner tone="success" className="mb-4">
          Waitlisted entry promoted to confirmed.
        </AlertBanner>
      ) : null}

      <StatGrid>
        <StatBlock label="Pending review" value={pendingResult.totalDocs} tone={pendingResult.totalDocs > 0 ? 'warn' : 'default'} />
        <StatBlock label="Approved" value={approvedCount.totalDocs} tone="good" />
        <StatBlock label="Rejected" value={rejectedCount.totalDocs} />
      </StatGrid>

      {waitlistedEntries.length > 0 ? (
        <Card className="mb-4 flex flex-col gap-3">
          <CardTitle>Waitlist ({waitlistedEntries.length})</CardTitle>
          <p className="text-sm text-ink-soft">
            These entries were approved after their category filled up. Promote one when a confirmed entry withdraws
            or you raise the category&apos;s max entries.
          </p>
          <ul className="flex flex-col gap-2">
            {waitlistedEntries.map((entry) => {
              const formId = `promote-${entry.id}`
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-mist px-3 py-2">
                  <span className="text-sm font-semibold text-ink">
                    {entry.display_name}
                    <span className="ml-2 font-normal text-ink-soft">{getRelationshipLabel(entry.category_id)}</span>
                  </span>
                  <form id={formId} action={promoteWaitlistedEntryAction}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <SubmitButton size="sm" variant="secondary">Promote</SubmitButton>
                  </form>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {pendingNotShown > 0 ? (
        <AlertBanner tone="warning" className="mb-4">
          Showing the {PENDING_PAGE_SIZE} oldest pending submissions - {pendingNotShown} more are not shown. Work
          through these and refresh.
        </AlertBanner>
      ) : null}

      {submissions.length === 0 ? (
        <EmptyState>No submissions waiting for review.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((submission) => {
            const approveFormId = `approve-${submission.id}`
            const rejectFormId = `reject-${submission.id}`
            return (
              <Card key={submission.id} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      {getRelationshipLabel(submission.category_id)} &middot; {submission.participant_mode.replaceAll('_', ' ')}
                    </p>
                    <CardTitle>{submission.display_name}</CardTitle>
                    {submission.club_name ? (
                      <p className="text-sm text-ink-soft">Represents: {submission.club_name}</p>
                    ) : null}
                  </div>
                  <StatusBadge tone="neutral">
                    {new Date(submission.createdAt).toLocaleDateString('en', { dateStyle: 'medium' })}
                  </StatusBadge>
                </div>

                {submission.roster && submission.roster.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Roster</p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {submission.roster.map((row, index) => (
                        <li key={index} className="rounded-full border border-line bg-mist px-3 py-1 text-xs font-semibold text-ink">
                          {row.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Contact</dt>
                    <dd className="font-semibold text-ink">{submission.contact_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Email</dt>
                    <dd className="font-semibold text-ink">{submission.contact_email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Phone</dt>
                    <dd className="font-semibold text-ink">{submission.contact_phone || 'Not provided'}</dd>
                  </div>
                </dl>
                {submission.notes ? (
                  <p className="text-sm text-ink-soft">
                    <span className="font-bold text-ink">Notes: </span>
                    {submission.notes}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
                  <form id={approveFormId} action={approveRegistrationSubmissionAction}>
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <ConfirmSubmitButton
                      formId={approveFormId}
                      tone="default"
                      confirmMessage={`Approve ${submission.display_name}? This creates the club/team/player/entry records immediately.`}
                    >
                      Approve
                    </ConfirmSubmitButton>
                  </form>
                  <form id={rejectFormId} action={rejectRegistrationSubmissionAction} className="flex flex-1 flex-wrap items-end gap-3">
                    <input type="hidden" name="submissionId" value={submission.id} />
                    <Field label="Rejection reason" className="min-w-[240px] flex-1">
                      <Textarea name="reviewNotes" rows={1} required />
                    </Field>
                    <ConfirmSubmitButton
                      formId={rejectFormId}
                      tone="destructive"
                      confirmMessage={`Reject ${submission.display_name}? They will not become an entry.`}
                    >
                      Reject
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
