import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

import config from '@payload-config'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { getPublicEventBySlug } from '../../publicEvents'
import { submitRegistrationAction } from './registrationActions'

export const dynamic = 'force-dynamic'

type CategoryDoc = {
  id: string | number
  name: string
  participant_mode: string
  status: string
  roster_required?: boolean | null
  min_roster_size?: number | null
  max_roster_size?: number | null
  sport_id?: { id?: string | number; name?: string } | string | number | null
}

const errorMessages: Record<string, string> = {
  invalid_event: 'This event could not be found.',
  invalid_category: 'Choose a category to register for.',
  category_not_open: 'This category is not currently open for registration.',
  registration_not_open: 'Registration has not opened yet for this event.',
  registration_closed: 'Registration for this event has closed.',
  invalid_submission: 'Fill in the participant name and your contact details before submitting.',
  invalid_roster_size:
    'Check the number of people listed - a pair needs exactly two, individual needs exactly one, and teams have a minimum/maximum roster size.',
  rate_limited: 'Too many submissions from this connection recently - please try again in a bit.',
}

const participantModeCopy: Record<string, { label: string; helper: string }> = {
  individual: { label: 'Individual athlete', helper: 'One person competes as one entry.' },
  pair: { label: 'Pair', helper: 'Exactly two people compete together as one entry.' },
  team: { label: 'Team', helper: 'A full team roster competes as one entry.' },
  club: { label: 'Club / delegation', helper: 'Your organization is the entry - roster details are optional.' },
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>
  searchParams: Promise<{ categoryId?: string; submitted?: string; error?: string }>
}) {
  const [{ eventSlug }, query] = await Promise.all([params, searchParams])
  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    notFound()
  }
  const eventPath = `/events/${event.slug}`

  const categoriesResult = await payload.find({
    collection: 'competition-categories',
    depth: 1,
    limit: 200,
    sort: 'name',
    where: {
      and: [
        { event_id: { equals: event.id } },
        { status: { equals: 'open' } },
        { participant_mode: { in: ['individual', 'pair', 'team', 'club'] } },
      ],
    },
  })
  const categories = categoriesResult.docs as CategoryDoc[]

  const now = new Date()
  const registrationNotOpenYet = Boolean(event.registration_open_at && now < new Date(event.registration_open_at))
  const registrationClosed = Boolean(event.registration_close_at && now > new Date(event.registration_close_at))
  const registrationWindowMessage =
    registrationNotOpenYet ?
      `Registration opens ${new Date(event.registration_open_at!).toLocaleDateString('en', { dateStyle: 'medium' })}.`
    : registrationClosed ?
      'Registration for this event has closed.'
    : null

  const selectedCategoryId = query.categoryId
  const selectedCategory = selectedCategoryId
    ? categories.find((category) => String(category.id) === selectedCategoryId)
    : undefined

  if (query.submitted === '1') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center font-sans text-ink">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold">Registration submitted</h1>
        <p className="mt-3 text-base text-ink-soft">
          Thanks - your submission is now pending review by the event committee. They will reach
          out using the contact details you provided if anything needs clarifying.
        </p>
        <Button asChild className="mt-6">
          <Link href={eventPath}>Back to {event.name}</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={eventPath}
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary no-underline hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to {event.name}
          </Link>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Register for {event.name}</h1>
          <p className="mt-3 text-base text-ink-soft">
            Submit your details below. A committee member reviews every submission before it
            becomes an official entry.
          </p>

          {registrationWindowMessage ? (
            <AlertBanner tone="info" className="mt-6">
              {registrationWindowMessage}
            </AlertBanner>
          ) : null}
          {query.error && errorMessages[query.error] ? (
            <AlertBanner tone="error" className="mt-6">
              {errorMessages[query.error]}
            </AlertBanner>
          ) : null}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          {categories.length === 0 ? (
            <Card>
              <EmptyState>No categories are currently open for registration.</EmptyState>
            </Card>
          ) : selectedCategory ? (
            <RegistrationForm event={event} category={selectedCategory} eventSlug={eventSlug} disabled={Boolean(registrationWindowMessage)} />
          ) : (
            <div className="flex flex-col gap-3">
              {categories.map((category) => {
                const mode = participantModeCopy[category.participant_mode]
                return (
                  <Card key={category.id} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                        {typeof category.sport_id === 'object' ? category.sport_id?.name : ''}
                      </p>
                      <h2 className="truncate text-lg font-extrabold">{category.name}</h2>
                      <p className="mt-1 text-xs text-ink-soft">{mode?.helper}</p>
                    </div>
                    <Button asChild size="sm">
                      <Link href={`${eventPath}/register?categoryId=${category.id}`}>Register</Link>
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

const RegistrationForm = ({
  event,
  category,
  eventSlug,
  disabled,
}: {
  event: { id: string | number; slug: string }
  category: CategoryDoc
  eventSlug: string
  disabled: boolean
}) => {
  const mode = category.participant_mode
  // Individual mode doesn't get its own roster fieldset - the top-level "Athlete name" field
  // below already collects that one person's name, and submitRegistrationAction synthesizes the
  // single-row roster from it server-side. Asking for the same name twice would be confusing.
  const rosterRowCount =
    mode === 'pair' ? 2
    : mode === 'team' ? Math.max(category.max_roster_size || 0, category.min_roster_size || 0, 6)
    : 0

  return (
    <Card>
      <CardTitle>{category.name}</CardTitle>
      <p className="mb-4 mt-1 text-sm text-ink-soft">{participantModeCopy[mode]?.helper}</p>
      <form action={submitRegistrationAction} className="flex flex-col gap-4">
        <input type="hidden" name="eventSlug" value={eventSlug} />
        <input type="hidden" name="categoryId" value={category.id} />
        {/* Honeypot - visually hidden, never seen or filled by a real visitor. Not `type="hidden"`
            (some bots skip those) - off-screen positioning instead, still absent from tab order. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
          <label htmlFor="website">Leave this field empty</label>
          <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <Field label={mode === 'club' ? 'Club / delegation name' : mode === 'team' ? 'Team name' : mode === 'pair' ? 'Pair name' : 'Athlete name'}>
          <Input type="text" name="displayName" required maxLength={200} />
        </Field>

        {mode !== 'club' ? (
          <Field label="Represents (club/organization)" optional>
            <Input type="text" name="clubName" maxLength={200} />
          </Field>
        ) : null}

        {rosterRowCount > 0 ? (
          <fieldset className="flex flex-col gap-3 rounded-card border border-line p-4">
            <legend className="px-1 text-sm font-bold text-ink">
              {mode === 'team' ? `Roster (${category.min_roster_size || 0}-${category.max_roster_size || 'many'} players)` : 'Players'}
            </legend>
            {Array.from({ length: rosterRowCount }, (_, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-3">
                <Field label={`Player ${index + 1} name`} optional={mode === 'team'}>
                  <Input type="text" name={`rosterName_${index}`} required={mode !== 'team'} />
                </Field>
                <Field label="Email" optional>
                  <Input type="email" name={`rosterEmail_${index}`} />
                </Field>
                <Field label="Phone" optional>
                  <Input type="tel" name={`rosterPhone_${index}`} />
                </Field>
              </div>
            ))}
          </fieldset>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name (primary contact)">
            <Input type="text" name="contactName" required maxLength={200} />
          </Field>
          <Field label="Your email">
            <Input type="email" name="contactEmail" required maxLength={200} />
          </Field>
        </div>
        <Field label="Your phone" optional>
          <Input type="tel" name="contactPhone" maxLength={40} />
        </Field>
        <Field label="Notes" optional>
          <Textarea name="notes" rows={3} maxLength={1000} />
        </Field>

        <SubmitButton disabled={disabled}>Submit registration</SubmitButton>
        {disabled ? (
          <p className="text-xs text-ink-soft">Registration is not currently open - the form above cannot be submitted.</p>
        ) : null}
      </form>
    </Card>
  )
}
