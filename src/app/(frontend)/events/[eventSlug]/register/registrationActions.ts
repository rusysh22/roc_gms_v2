'use server'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { recordAuditLog } from '@/lib/audit'
import { checkRegistrationRateLimit } from '@/lib/registrationRateLimit'
import { getPublicEventBySlug } from '../../publicEvents'

const text = (form: FormData, key: string) =>
  typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''

const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const getClientIp = async () => {
  const headersList = await getHeaders()
  const forwardedFor = headersList.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return headersList.get('x-real-ip') || 'unknown'
}

const MAX_ROSTER_ROWS = 24

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md P2 item 2: the public registration form. This is the app's
// first unauthenticated write path, so every check here is deliberate: honeypot (silently
// "succeeds" without writing anything if tripped, so a bot never learns it was caught),
// per-IP-per-event rate limit, and a registration-window/category-open check that mirrors what
// the admin-side wizard already enforces for staff-entered participants - a public visitor should
// not be able to register into a category the admin hasn't opened, even though category status is
// otherwise only enforced in the wizard's own UI.
export async function submitRegistrationAction(formData: FormData): Promise<void> {
  const eventSlug = text(formData, 'eventSlug')
  const categoryId = text(formData, 'categoryId')
  const returnTo = `/events/${eventSlug}/register${categoryId ? `?categoryId=${categoryId}` : ''}`

  // Honeypot: a real visitor never fills this (it's visually hidden). A bot that fills every
  // field will trip it - redirect to the same "thanks" state as a real success so the bot gets no
  // signal that it was detected, but nothing is actually written.
  if (text(formData, 'website')) {
    redirect(`/events/${eventSlug}/register?submitted=1`)
  }

  const payload = await getPayload({ config })
  const event = await getPublicEventBySlug(payload, eventSlug)
  if (!event) {
    redirect(`/events/${eventSlug}/register?error=invalid_event`)
  }

  const ip = await getClientIp()
  if (!checkRegistrationRateLimit(ip, event.id)) {
    redirect(`${returnTo}&error=rate_limited`)
  }

  const category = await payload
    .findByID({ collection: 'competition-categories', id: categoryId, depth: 0 })
    .catch(() => null)
  if (!category || String(category.event_id) !== String(event.id)) {
    redirect(`/events/${eventSlug}/register?error=invalid_category`)
  }
  if (category!.status !== 'open') {
    redirect(`${returnTo}&error=category_not_open`)
  }

  const now = new Date()
  if (event.registration_open_at && now < new Date(event.registration_open_at)) {
    redirect(`${returnTo}&error=registration_not_open`)
  }
  if (event.registration_close_at && now > new Date(event.registration_close_at)) {
    redirect(`${returnTo}&error=registration_closed`)
  }

  const participantMode = String(category!.participant_mode || '')
  if (!['individual', 'pair', 'team', 'club'].includes(participantMode)) {
    // open/tbd categories haven't decided who competes yet - nothing for a visitor to register
    // into (mirrors the wizard's own "Belum ditentukan" guidance in
    // NOVICE_ADMIN_FLOW_UX_REDESIGN.md section 8.2).
    redirect(`${returnTo}&error=category_not_open`)
  }

  const displayName = text(formData, 'displayName')
  const clubName = text(formData, 'clubName')
  const contactName = text(formData, 'contactName')
  const contactEmail = text(formData, 'contactEmail')
  const contactPhone = text(formData, 'contactPhone')
  const notes = text(formData, 'notes')

  if (!displayName || !contactName || !contactEmail || !emailValid(contactEmail)) {
    redirect(`${returnTo}&error=invalid_submission`)
  }

  // Individual mode has no roster fieldset on the form - the top-level displayName field IS that
  // one person's name, so the single-row roster is synthesized here rather than asking for the
  // same name twice (see the page component's matching comment).
  const roster: { name: string; email?: string; phone?: string }[] =
    participantMode === 'individual' ? [{ name: displayName, email: contactEmail || undefined, phone: contactPhone || undefined }] : []
  if (participantMode !== 'individual') {
    for (let index = 0; index < MAX_ROSTER_ROWS; index += 1) {
      const name = text(formData, `rosterName_${index}`)
      if (!name) continue
      roster.push({
        name,
        email: text(formData, `rosterEmail_${index}`) || undefined,
        phone: text(formData, `rosterPhone_${index}`) || undefined,
      })
    }
  }

  if (participantMode === 'pair' && roster.length !== 2) {
    redirect(`${returnTo}&error=invalid_roster_size`)
  }
  if (participantMode === 'team' && category!.roster_required) {
    const min = category!.min_roster_size || 0
    const max = category!.max_roster_size
    if (roster.length < min || (max && roster.length > max)) {
      redirect(`${returnTo}&error=invalid_roster_size`)
    }
  }

  const data = {
    event_id: Number(event.id),
    category_id: Number(categoryId),
    participant_mode: participantMode as 'individual' | 'pair' | 'team' | 'club',
    display_name: displayName,
    club_name: clubName || undefined,
    roster: roster.length > 0 ? roster : undefined,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone || undefined,
    notes: notes || undefined,
    status: 'pending' as const,
    submitter_ip: ip,
  }

  const created = await payload.create({ collection: 'registration-submissions', data })
  // No authenticated actor - a public submission has no req.user, matching audit.ts's documented
  // "left empty when the action was performed without an authenticated session" convention.
  await recordAuditLog({
    payload,
    action: 'registration_submission.create',
    entityType: 'registration-submissions',
    entityId: created.id,
    before: null,
    after: { ...data, submitter_ip: undefined },
    actorUserId: null,
  })

  redirect(`/events/${eventSlug}/register?submitted=1`)
}
