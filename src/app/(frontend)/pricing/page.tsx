import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Sparkles, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { fetchPlans, type PlanDto } from '@/lib/berlanggan/client'
import { getBerlangganPricingConfig } from '@/lib/berlanggan/config'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Plans for running your tournament with InTourney Event Management.',
  alternates: { canonical: '/pricing' },
}

// Plans/prices for the PAID tiers are never hardcoded here - they're fetched live from Berlanggan
// (berlanggan.web.id, the billing platform Event Management access runs on), whatever the operator
// has configured as products there. Revalidated hourly (not on every request): prices change
// rarely, there's no webhook to trigger instant invalidation (Berlanggan doesn't send any - see
// src/lib/berlanggan/), and this page must not be force-dynamic or the hourly cache would never
// apply.
const REVALIDATE_SECONDS = 3600

const INTERVAL_LABEL: Record<PlanDto['interval'], string> = {
  none: 'one-time',
  monthly: '/mo',
  yearly: '/yr',
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)

// A simple included/not-included row, shared by the Free card (fully hardcoded, since Quick
// Bracket isn't a real Berlanggan product to fetch) and every paid card (as a baseline fact that's
// true for every paid tier today - see the comment on BASELINE_PAID_FEATURE below).
const FeatureRow = ({ label, included }: { label: string; included: boolean }) => (
  <li className="flex items-start gap-2">
    {included ? (
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden="true" />
    ) : (
      <X className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft/50" aria-hidden="true" />
    )}
    <span className={cn(!included && 'text-ink-soft/70 line-through decoration-ink-soft/40')}>{label}</span>
  </li>
)

const FREE_INCLUDED = [
  'No sign-up required',
  'Single & double elimination brackets',
  'Live score entry once you claim it (still free)',
  'Share via WhatsApp, Teams, email, or link',
]

// What Quick Bracket does NOT include, shown crossed out on the Free card so the gap versus a paid
// Event Management plan is explicit rather than something people discover only after hitting a
// paywall. These are genuine Event Management features Quick Bracket has no equivalent of - not a
// guess at Berlanggan's own plan-tier differences (see BASELINE_PAID_FEATURE below for why those
// aren't hardcoded).
const FREE_NOT_INCLUDED = [
  'Full Event Management workspace',
  'Multi-sport events & competition categories',
  'Participant/roster database & Excel import',
  'Public branded event website',
  'Standings & medal tally automation',
  'Role-based team access (Scheduler, Match Officer, Content Admin)',
]

const FreePlanCard = () => (
  <Card className="flex flex-col gap-4">
    <div>
      <CardTitle as="h3">Free</CardTitle>
      <p className="mt-2 text-3xl font-extrabold text-ink">
        {formatPrice(0)}
        <span className="ml-1 text-sm font-semibold text-ink-soft">forever</span>
      </p>
      <CardDescription className="mt-1">Quick Bracket Tournament only</CardDescription>
    </div>
    <ul className="flex flex-col gap-2 text-sm text-ink-soft">
      {FREE_INCLUDED.map((label) => (
        <FeatureRow key={label} label={label} included />
      ))}
      {FREE_NOT_INCLUDED.map((label) => (
        <FeatureRow key={label} label={label} included={false} />
      ))}
    </ul>
    <Button asChild variant="secondary" className="mt-auto">
      <Link href="/quick-bracket/new">Start free with Quick Bracket</Link>
    </Button>
  </Card>
)

// The one feature claim shown on every paid card that isn't sourced from Berlanggan's own
// `entitlements` - unlike price/name/interval, this is safe to state unconditionally because
// checkSubscription (src/lib/berlanggan/subscriptionGate.ts) gates /workspaces as a single
// account-level on/off switch, not per-entitlement: every active paid license gets full Event
// Management access today, regardless of which plan was purchased. Plan-specific differentiators
// beyond that (seat limits, support tier, etc.) are NOT hardcoded here - only `plan.entitlements`
// (whatever the operator actually configures on Berlanggan) can state those truthfully.
const BASELINE_PAID_FEATURE = 'Full Event Management workspace access'

const PlanCard = ({ plan, baseUrl }: { plan: PlanDto; baseUrl: string }) => {
  const entitlementEntries = Object.entries(plan.entitlements ?? {})

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle as="h3">{plan.name}</CardTitle>
        <p className="mt-2 text-3xl font-extrabold text-ink">
          {formatPrice(plan.price)}
          <span className="ml-1 text-sm font-semibold text-ink-soft">{INTERVAL_LABEL[plan.interval]}</span>
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-ink-soft">
        <FeatureRow label={BASELINE_PAID_FEATURE} included />
        {entitlementEntries.map(([key, value]) => (
          <FeatureRow
            key={key}
            included
            label={key.replaceAll('_', ' ') + (typeof value === 'boolean' ? '' : `: ${String(value)}`)}
          />
        ))}
      </ul>
      <Button asChild className="mt-auto">
        <a href={`${baseUrl}${plan.checkout_url}`}>Choose {plan.name}</a>
      </Button>
    </Card>
  )
}

export default async function PricingPage() {
  const config = getBerlangganPricingConfig()

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-12 pb-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" />
            Pricing
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Run your tournament with Event Management
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            Just want to try a bracket first? Start free with{' '}
            <Link href="/quick-bracket/new" className="font-semibold text-ink underline underline-offset-2">
              Quick Bracket
            </Link>{' '}
            - no account needed.
          </p>
        </div>

        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-ink-soft">
          Checkout and billing are handled by our payment partner, Berlanggan (berlanggan.web.id).
          See our <Link href="/terms" className="font-semibold text-ink underline underline-offset-2">Terms</Link> for details.
        </p>

        <div className="mx-auto mt-10 max-w-5xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FreePlanCard />
            {!config ? (
              <Card className="sm:col-span-1 lg:col-span-2">
                <CardTitle>Paid plans coming soon</CardTitle>
                <CardDescription className="mt-2">
                  Event Management plans aren&apos;t published yet - check back shortly.
                </CardDescription>
              </Card>
            ) : (
              <PricingPlans config={config} />
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

const PricingPlans = async ({
  config,
}: {
  config: NonNullable<ReturnType<typeof getBerlangganPricingConfig>>
}) => {
  const result = await fetchPlans(config, { next: { revalidate: REVALIDATE_SECONDS } })

  if (!result.ok) {
    return (
      <Card className="sm:col-span-1 lg:col-span-2">
        <CardTitle>Unable to load pricing right now</CardTitle>
        <CardDescription className="mt-2">Please try again shortly.</CardDescription>
      </Card>
    )
  }

  if (result.plans.length === 0) {
    return (
      <Card className="sm:col-span-1 lg:col-span-2">
        <CardTitle>Paid plans coming soon</CardTitle>
        <CardDescription className="mt-2">
          Event Management plans aren&apos;t published yet - check back shortly.
        </CardDescription>
      </Card>
    )
  }

  const sortedPlans = [...result.plans].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <>
      {sortedPlans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} baseUrl={config.baseUrl} />
      ))}
    </>
  )
}
