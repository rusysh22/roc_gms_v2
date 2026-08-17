import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Layers,
  Palette,
  Sparkles,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

type Feature = {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: 'Guided Event Wizard',
    description:
      'Create your event, add sports and categories, register clubs/teams/players, and seed entries - all in one guided flow.',
  },
  {
    icon: Trophy,
    title: 'Auto Brackets & Standings',
    description:
      'Single elimination, round robin, and group stages generate themselves from your entries - no manual bracket drawing.',
  },
  {
    icon: Zap,
    title: 'Live Scoring',
    description:
      'Match officials update scores in real time from any device. Standings and brackets recalculate automatically.',
  },
  {
    icon: Users,
    title: 'Role-Based Workspace',
    description:
      'Event Admin, Scheduler, Match Officer, and Content Admin roles keep the right people in the right screens.',
  },
  {
    icon: Palette,
    title: 'Your Own Branded Page',
    description:
      'Every event gets a public page with its own hero image and color theme - ready to share with players and spectators.',
  },
  {
    icon: BarChart3,
    title: 'Public Standings & Schedule',
    description:
      'Players and supporters follow live scores, schedules, and results without needing an account.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Create your event',
    description: 'Name it, set the dates, and pick which sports and competition categories run.',
  },
  {
    number: '02',
    title: 'Add your participants',
    description: 'Register clubs, teams, and players once - reuse them across every category.',
  },
  {
    number: '03',
    title: 'Generate matches',
    description: 'Brackets, round robins, and schedules build themselves from your entries.',
  },
  {
    number: '04',
    title: 'Share your event page',
    description: 'A live public page with your own branding is ready the moment matches are set.',
  },
]

export default function MarketingHomePage() {
  return (
    <main className="font-sans text-ink">
      {/* The floating nav pill is `position: sticky`, which still reserves its own height in
          normal flow (measured: ~62px on mobile below the `md:` nav breakpoint where the full
          item row collapses to a hamburger, ~54px at `md:` and up) - on top of PublicChrome's own
          `pt-6` (24px) content-wrapper padding. Left uncancelled, min-h-svh on this section would
          make it exactly one viewport tall starting *after* that ~78-86px of reserved space, so
          its bottom would sit that far past the fold instead of the section filling the actual
          first screen with the pill floating over it. Negative margin equal to reserved-space +
          padding pulls the section's top back up to y=0 so the two - together - fill exactly one
          screen; the pill still renders on top via its own z-50. Same fix as
          src/app/(frontend)/events/[eventSlug]/page.tsx's hero. */}
      <section
        className="relative -mt-[5.375rem] flex min-h-svh items-center overflow-hidden px-4 pb-16 pt-28 md:-mt-[4.875rem]"
        id="top"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 h-72 w-72 rounded-full bg-green/20 blur-[90px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-32 h-80 w-80 rounded-full bg-blue/15 blur-[90px]"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-green" aria-hidden="true" />
            Tournament & office games management
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Run any tournament without the{' '}
            <span className="bg-gradient-to-r from-green to-blue bg-clip-text text-transparent">
              spreadsheet chaos
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            InTourney is a guided setup wizard, auto-generated brackets and standings, live scoring,
            and a branded public page for every event you run - office olympiads, sports days, or
            multi-club tournaments.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="default">
              <Link href="/workspaces/event-admin/new-event">
                Create Your Event
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="#features">See what&apos;s included</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16" id="features" aria-labelledby="features-title">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-green">Features</p>
            <h2 id="features-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Everything a committee needs, in one place
            </h2>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="flex flex-col gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-green">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16" id="how-it-works" aria-labelledby="how-it-works-title">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-blue">How it works</p>
            <h2 id="how-it-works-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              From blank page to live bracket
            </h2>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <Card key={step.number} className="flex flex-col gap-2">
                {/* AUDIT_UI_UX_CSS axe: text-line on white measured 1.27:1, nowhere near the 3:1
                    large-text minimum. aria-hidden alone doesn't fix this - it only removes the
                    numeral from the accessibility tree (reasonable on its own, since the real
                    content is the CardTitle/description right below it and a screen reader
                    doesn't need "01" read aloud), but WCAG contrast still applies to anything
                    actually visible on screen, aria-hidden or not, for low-vision sighted users.
                    text-ink-soft/70 keeps the same quiet/faint design intent while clearing 3:1
                    (~3.67:1) - full-opacity text-ink-soft would look too heavy for a background
                    flourish. */}
                <span className="text-3xl font-extrabold text-ink-soft/70" aria-hidden="true">
                  {step.number}
                </span>
                <CardTitle className="text-base">{step.title}</CardTitle>
                <CardDescription className="leading-relaxed">{step.description}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-4xl">
          <Card className="flex flex-col items-center gap-4 border-green/30 bg-gradient-to-br from-paper to-mist p-8 text-center sm:p-12">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green text-paper">
              <Calendar className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to set up your event?</h2>
            <p className="max-w-xl text-base leading-relaxed text-ink-soft">
              Start the guided wizard now - you can explore every step before you need to create an
              account.
            </p>
            <Button asChild>
              <Link href="/workspaces/event-admin/new-event">
                Create Your Event
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </Card>
        </div>
      </section>
    </main>
  )
}
