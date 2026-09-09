import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { sanitizeRedirect } from '@/lib/auth/googleSso'
import { getCurrentPublicUser } from '../getCurrentPublicUser'
import { ActivateLicenseForm } from './ActivateLicenseForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Subscribe',
  alternates: { canonical: '/subscribe' },
}

// The landing page for a user blocked from /workspaces by workspaceAuth.tsx's subscription check
// (?reason=no_license|blocked), and the only place to paste a Berlanggan license key and link it
// to this account - see activateLicenseAction.ts. Deliberately not linked from primary nav; a
// blocked user reaches it via the redirect, an unblocked one has no reason to visit.
const REASON_COPY: Record<string, { title: string; description: string }> = {
  no_license: {
    title: 'Activate your subscription',
    description:
      "Event Management needs an active InTourney subscription. Paste the license key you received after checking out on Berlanggan below.",
  },
  blocked: {
    title: 'Your subscription needs attention',
    description:
      'Your license is not currently active. Check its status below, or visit Pricing to renew or buy a new plan.',
  },
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; redirect?: string }>
}) {
  const { reason, redirect: redirectParam } = await searchParams
  const returnTo = sanitizeRedirect(redirectParam, '/workspaces')
  const user = await getCurrentPublicUser()
  if (!user) {
    const ownUrl = `/subscribe?${new URLSearchParams({ ...(reason ? { reason } : {}), redirect: returnTo }).toString()}`
    redirect(`/login?redirect=${encodeURIComponent(ownUrl)}`)
  }

  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'licenses',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { user_id: { equals: user.id } },
  })
  const license = existing.docs[0]

  const copy = REASON_COPY[reason || ''] ?? REASON_COPY.no_license

  return (
    <main className="font-sans text-ink">
      <section className="px-4 py-16">
        <div className="mx-auto max-w-md">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Event Management</p>
          <h1 className="text-2xl font-extrabold">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{copy.description}</p>

          {license ? (
            <Card className="mt-6">
              <CardTitle as="h2">Current status</CardTitle>
              <CardDescription className="mt-1 capitalize">
                {license.effective_status.replaceAll('_', ' ')}
              </CardDescription>
              {license.last_error ? (
                <p className="mt-2 text-xs text-ink-soft">Last billing note: {license.last_error}</p>
              ) : null}
            </Card>
          ) : null}

          <Card className="mt-6">
            <CardTitle as="h2" className="mb-3">
              Enter your license key
            </CardTitle>
            <ActivateLicenseForm redirectTo={returnTo} />
          </Card>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href="/pricing">View plans</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-ink-soft">
            Payment is processed by our third-party billing partner, Berlanggan (berlanggan.web.id)
            - see the &quot;Subscription, Payment &amp; Refunds&quot; section of our{' '}
            <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  )
}
