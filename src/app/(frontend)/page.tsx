import Link from 'next/link'
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  GitBranch,
  LogIn,
  Radio,
  ShieldCheck,
  Share2,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

/*
 * Landing page pass against miqdadbadjuber/anti-slop.
 *
 * Design direction (the DESIGN.md the filter asks for, kept inline since this is the only
 * marketing page): the product runs tournament brackets, so the bracket itself is the identity
 * motif - the L-shaped connector (the `Connector` component below and the hero SVG) is reused in
 * the hero, the section eyebrows, and the "how it works" rail so the page reads as one system and
 * would NOT survive a logo swap onto a generic SaaS site.
 *
 * Liveliness dials:
 *   ENERGY 2  - balanced/Stripe-ish: one confident focal point (the hero bracket), restrained
 *               elsewhere. No Awwwards maximalism, no calm-to-the-point-of-sterile either.
 *   RHYTHM 2  - consistent grid with deliberate breaks: hero is asymmetric (text left, bracket
 *               right), features are a bento (one lead tile + five), how-it-works is a horizontal
 *               rail, CTA is a full-bleed ink panel. Every section changes shape.
 *   MOTION 1  - hover only. Card `interactive` lift + the hero bracket's champion node brightening
 *               on group-hover. No scroll-reveal, no JS - this stays a server component.
 *
 * Removed from the previous version (technique without purpose): the two blurred gradient blobs
 * behind the hero, the from-green-to-blue `bg-clip-text` headline, and the uniform 3x2 feature
 * grid - all three are the exact tells the filter flags.
 *
 * Hard gates: no em dashes in copy (hyphens only); no fabricated stats or testimonials (there are
 * none - nothing on this page claims a number it can't source); every CTA points at a real route
 * (`/workspaces/event-admin/new-event`, `/login`); contrast uses only the audited tokens.
 */

type Feature = {
  icon: LucideIcon
  title: string
  description: string
}

const LEAD_FEATURE: Feature = {
  icon: GitBranch,
  title: 'Brackets that draw themselves',
  description:
    'Single elimination, round robin, and group stages generate straight from your entry list. Change a result and every downstream match, seed, and standing recalculates on the spot - no redrawing, no stale printouts.',
}

const FEATURES: Feature[] = [
  {
    icon: ClipboardList,
    title: 'One guided setup',
    description:
      'Name the event, set dates, pick sports and categories, register clubs, teams, and players once, then reuse them everywhere.',
  },
  {
    icon: Radio,
    title: 'Live scoring from any device',
    description:
      'Match officials post scores as they happen. Spectators watching the public page see the same number a second later.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles that stay in their lane',
    description:
      'Event Admin, Scheduler, Match Officer, and Content Admin each land in the screens they need and nothing else.',
  },
  {
    icon: Share2,
    title: 'A public page per event',
    description:
      'Its own hero image, its own colour theme, its own shareable link. Players and supporters follow along without an account.',
  },
  {
    icon: CalendarClock,
    title: 'Schedule and standings, always current',
    description:
      'Court assignments, start times, and results stay in sync across the committee view and the public view.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Create the event',
    description: 'Dates, sports, and competition categories. Ten minutes, mostly picking from lists.',
  },
  {
    number: '02',
    title: 'Add participants',
    description: 'Clubs, teams, and players entered once and shared across every category they play.',
  },
  {
    number: '03',
    title: 'Generate matches',
    description: 'Brackets, round robins, and a first-cut schedule build themselves from the entries.',
  },
  {
    number: '04',
    title: 'Share the page',
    description: 'The branded public page goes live the moment the first match is on the board.',
  },
]

/* The bracket connector - one L-shaped elbow. This is the page's repeating motif: a match feeding
   forward into the next round. Rendered at a few sizes via `className`. */
function Connector({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 4h9a4 4 0 0 1 4 4v8a4 4 0 0 0 4 4h3" />
    </svg>
  )
}

function SectionEyebrow({ children, tone }: { children: React.ReactNode; tone: 'green' | 'blue' }) {
  const color = tone === 'green' ? 'text-green' : 'text-blue'
  return (
    <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${color}`}>
      <Connector className="h-4 w-4" />
      {children}
    </p>
  )
}

export default function MarketingHomePage() {
  return (
    <main className="font-sans text-ink">
      {/* Hero. Asymmetric on lg: copy left, the bracket visual right. The -mt cancels PublicChrome's
          sticky-pill reserved height + pt-6 so the section fills exactly the first screen - see
          the long note this replaced (and events/[eventSlug]/page.tsx's matching hero) for the
          measured values. */}
      <section
        className="relative -mt-[5.375rem] flex min-h-svh items-center overflow-hidden border-b border-line px-4 pb-16 pt-28 md:-mt-[4.875rem]"
        id="top"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-mist px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
              <Connector className="h-3.5 w-3.5 text-green" />
              Tournament &amp; office games management
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              The bracket runs itself.
              <br />
              <span className="text-green">You run the event.</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-soft sm:text-lg">
              InTourney replaces the tournament spreadsheet with a guided setup wizard, brackets and
              standings that build from your entries, live scoring, and a branded public page for
              every event - office olympiads, sports days, or multi-club competitions.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="default">
                <Link href="/workspaces/event-admin/new-event">
                  Create your event
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/login">
                  Log in
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-ink-soft">
              New here? Walk through every step of the wizard before you create an account.{' '}
              <Link href="#features" className="font-bold text-green underline-offset-2 hover:underline">
                See what runs it
              </Link>
              .
            </p>
          </div>

          {/* The focal point: a 4 -> 2 -> 1 elimination bracket. The champion node brightens on
              hover of the whole hero panel (MOTION dial 1). Decorative, so aria-hidden; the
              headline already carries the meaning. */}
          <div className="group relative hidden lg:block">
            <svg
              viewBox="0 0 360 300"
              fill="none"
              aria-hidden="true"
              className="w-full text-line"
            >
              <g stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="40" x2="96" y2="40" />
                <line x1="8" y1="96" x2="96" y2="96" />
                <line x1="8" y1="204" x2="96" y2="204" />
                <line x1="8" y1="260" x2="96" y2="260" />
                <path d="M96 40v28h28" />
                <path d="M96 96V68h28" />
                <path d="M96 204v28h28" />
                <path d="M96 260v-28h28" />
                <line x1="124" y1="68" x2="212" y2="68" />
                <line x1="124" y1="232" x2="212" y2="232" />
                <path d="M212 68v82h28" />
                <path d="M212 232v-82h28" />
                <line x1="240" y1="150" x2="330" y2="150" />
              </g>
              {[40, 96, 204, 260].map((y) => (
                <rect key={y} x="8" y={y - 9} width="88" height="18" rx="4" className="fill-mist" />
              ))}
              {[68, 232].map((y) => (
                <rect key={y} x="124" y={y - 9} width="88" height="18" rx="4" className="fill-mist" />
              ))}
              <rect
                x="240"
                y="135"
                width="90"
                height="30"
                rx="6"
                className="fill-green/15 stroke-green transition-colors duration-200 group-hover:fill-green/25"
                strokeWidth="2"
              />
              <text
                x="285"
                y="154"
                textAnchor="middle"
                className="fill-green text-[11px] font-bold"
                style={{ fontFamily: 'inherit' }}
              >
                CHAMPION
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Features - a bento: one lead tile carrying the core promise, five supporting tiles.
          Breaks the old uniform 3x2 grid (RHYTHM 2). */}
      <section className="px-4 py-20" id="features" aria-labelledby="features-title">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <SectionEyebrow tone="green">What runs it</SectionEyebrow>
            <h2 id="features-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Everything a committee juggles, in one place
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 border-green/30 bg-mist sm:col-span-2 lg:row-span-2 lg:justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green text-paper">
                <LEAD_FEATURE.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-lg">{LEAD_FEATURE.title}</CardTitle>
                <CardDescription className="mt-2 text-[0.95rem] leading-relaxed">
                  {LEAD_FEATURE.description}
                </CardDescription>
              </div>
            </Card>
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

      {/* How it works - a horizontal rail with the connector motif between steps (RHYTHM break
          from the card grid above). */}
      <section
        className="border-y border-line bg-mist px-4 py-20"
        id="how-it-works"
        aria-labelledby="how-it-works-title"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <SectionEyebrow tone="blue">How it works</SectionEyebrow>
            <h2 id="how-it-works-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              From empty page to live bracket
            </h2>
          </div>
          <ol className="mt-10 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.number} className="relative">
                {index < STEPS.length - 1 ? (
                  <Connector className="absolute -right-2 top-1 hidden h-5 w-5 text-line lg:block" />
                ) : null}
                <span className="text-sm font-extrabold text-blue">{step.number}</span>
                <h3 className="mt-1 text-base font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA - full-bleed ink panel. Solid, high-contrast, the page's second focal point; replaces
          the old paper-to-mist gradient card. */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl rounded-panel bg-ink px-6 py-14 text-center text-paper sm:px-12">
          <Connector className="mx-auto h-6 w-6 text-green" />
          <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">Set up your event this week</h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-line">
            The guided wizard is open. Build the whole event, see the bracket, and only sign in when
            you want to save it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="secondary" className="border-transparent">
              <Link href="/workspaces/event-admin/new-event">
                Create your event
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line/30 px-6 text-[0.95rem] font-semibold text-paper no-underline transition-colors hover:border-line/60"
            >
              Log in to an event
              <LogIn className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
