import type { Metadata } from 'next'
import Link from 'next/link'
import { GitBranch, MessageCircle, ShieldCheck, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'About InTourney - a platform for planning and running multi-sport tournaments and games.',
  alternates: { canonical: '/about' },
}

const VALUES = [
  {
    icon: Zap,
    title: 'Quick to get running',
    description: 'From a no-account Quick Bracket to a full event, organizers can get going without lengthy training.',
  },
  {
    icon: GitBranch,
    title: 'Tournament flow done right',
    description: 'Brackets, schedules, and results follow the tournament formats organizers actually run.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparent for participants',
    description: 'A public event page, schedule, and standings are viewable by anyone, no login required.',
  },
]

export default function AboutPage() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-12 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">About Us</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            We help organizers run tournaments
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            InTourney is built for organizers running multi-sport tournaments and games - from
            creating the event and importing participants, through drawing brackets and building
            schedules, to match-day operations, results, standings, medal tallies, and a public
            website for the event.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {VALUES.map((value) => (
            <Card key={value.title}>
              <value.icon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
              <CardTitle as="h3" className="mt-3">
                {value.title}
              </CardTitle>
              <CardDescription className="mt-1">{value.description}</CardDescription>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-card border border-line bg-mist p-6 text-sm leading-relaxed text-ink-soft">
          <h2 className="text-base font-extrabold text-ink">Who runs InTourney</h2>
          <p className="mt-2">
            InTourney is currently operated by an individual (not yet incorporated as a limited
            liability company) as the platform provider. Quick Bracket Tournament stays free and
            account-free as the fastest way to try the Service; the Event Management area is paid to
            support ongoing development and operations - see{' '}
            <Link href="/pricing" className="font-semibold text-ink underline underline-offset-2">
              Pricing
            </Link>
            .
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/quick-bracket/new">Try Quick Bracket</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/contact">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Contact Us
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
