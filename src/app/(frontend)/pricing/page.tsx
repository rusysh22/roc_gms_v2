import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { fetchPlans, type PlanDto } from '@/lib/berlanggan/client'
import { getBerlangganPricingConfig } from '@/lib/berlanggan/config'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Plans for running your tournament with InTourney Event Management.',
  alternates: { canonical: '/pricing' },
}

// Plans/prices are never hardcoded here - they're fetched live from Berlanggan (berlanggan.web.id,
// the billing platform Event Management access runs on), whatever the operator has configured as
// products there. Revalidated hourly (not on every request): prices change rarely, there's no
// webhook to trigger instant invalidation (Berlanggan doesn't send any - see src/lib/berlanggan/),
// and this page must not be force-dynamic or the hourly cache would never apply.
const REVALIDATE_SECONDS = 3600

const INTERVAL_LABEL: Record<PlanDto['interval'], string> = {
  none: 'one-time',
  monthly: '/mo',
  yearly: '/yr',
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price)

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
      {entitlementEntries.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm text-ink-soft">
          {entitlementEntries.map(([key, value]) => (
            <li key={key} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden="true" />
              <span>
                {key.replaceAll('_', ' ')}
                {typeof value === 'boolean' ? '' : `: ${String(value)}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
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

        <div className="mx-auto mt-10 max-w-5xl">
          {!config ? (
            <Card className="mx-auto max-w-md text-center">
              <CardTitle>Pricing coming soon</CardTitle>
              <CardDescription className="mt-2">
                Event Management plans aren&apos;t published yet - check back shortly.
              </CardDescription>
            </Card>
          ) : (
            <PricingPlans config={config} />
          )}
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
      <Card className="mx-auto max-w-md text-center">
        <CardTitle>Unable to load pricing right now</CardTitle>
        <CardDescription className="mt-2">Please try again shortly.</CardDescription>
      </Card>
    )
  }

  if (result.plans.length === 0) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardTitle>Pricing coming soon</CardTitle>
        <CardDescription className="mt-2">
          Event Management plans aren&apos;t published yet - check back shortly.
        </CardDescription>
      </Card>
    )
  }

  const sortedPlans = [...result.plans].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {sortedPlans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} baseUrl={config.baseUrl} />
      ))}
    </div>
  )
}
