'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarClock, LayoutGrid, Medal, Radio, Trophy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/brand-logo'

// Slide content mirrors real product surfaces (see package.json's brackets:recalculate,
// standings:recalculate, medals:recalculate scripts, the live-score workspace route, and
// participantActions.ts's club/team/pair/player + sportActions.ts's multi-sport support) rather
// than invented marketing claims - each mockup is a simplified stand-in for a screen that exists.
const slides = [
  {
    icon: Radio,
    title: 'Live scoring, every venue',
    body: 'Update scores straight from courtside - spectators and other admins see the change instantly.',
    mock: (
      <div className="rounded-card border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs font-bold text-paper/70">
          <span>Court 3 &middot; Badminton</span>
          <span className="flex items-center gap-1 rounded-full bg-danger/90 px-2 py-0.5 text-paper">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper" aria-hidden="true" />
            LIVE
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-paper">
          <span className="text-sm font-bold">Garuda</span>
          <span className="text-lg font-extrabold tabular-nums">21&ndash;18</span>
          <span className="text-sm font-bold">Elang</span>
        </div>
      </div>
    ),
  },
  {
    icon: CalendarClock,
    title: 'Auto-scheduling, fewer clashes',
    body: 'Schedule hundreds of matches across venues and days without double-booking a team or referee.',
    mock: (
      <div className="flex flex-col gap-2 rounded-card border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        {[
          ['08:00', 'Court 1', 'Badminton'],
          ['08:00', 'Court 2', 'Basketball 3x3'],
          ['08:30', 'Court 1', 'Badminton'],
        ].map(([time, court, sport]) => (
          <div key={time + court} className="flex items-center gap-2 text-xs font-semibold text-paper/90">
            <span className="w-11 shrink-0 tabular-nums text-paper/60">{time}</span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-paper/40" aria-hidden="true" />
            <span className="shrink-0">{court}</span>
            <span className="truncate text-paper/60">{sport}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Medal,
    title: 'Brackets & standings, automatic',
    body: 'Brackets and standings update themselves the moment a new result comes in - no manual tallying.',
    mock: (
      <div className="rounded-card border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        {[
          ['1', 'Garuda', 'text-gold'],
          ['2', 'Elang', 'text-paper/70'],
          ['3', 'Rajawali', 'text-paper/70'],
        ].map(([rank, team, tone]) => (
          <div key={rank} className="flex items-center gap-2 border-b border-white/10 py-1.5 text-xs font-semibold last:border-0">
            <span className={cn('w-4 shrink-0 font-extrabold', tone)}>{rank}</span>
            <span className="text-paper/90">{team}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: LayoutGrid,
    title: 'One event, many sports',
    body: 'Manage multiple sports, clubs, teams, and players all inside the same event.',
    mock: (
      <div className="flex flex-wrap gap-2 rounded-card border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        {['Badminton', 'Basketball 3x3', 'Volleyball', 'Futsal'].map((sport) => (
          <span key={sport} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-paper/90">
            {sport}
          </span>
        ))}
      </div>
    ),
  },
]

export function LoginShowcase() {
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  // Starts false so server and first client render match (no window on the server); flipped
  // right after mount once we actually know the user's motion preference.
  const [autoplay, setAutoplay] = React.useState(false)

  React.useEffect(() => {
    setAutoplay(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const active = slides[index]
  const Icon = active.icon

  return (
    <div
      className="relative isolate flex h-full flex-col justify-between overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Ambient depth: slow-drifting blurred blobs + a giant near-invisible trophy watermark.
          Kept strictly inside the green/blue brand pair (no gold accent here) and very low
          opacity - the first pass at this page used a loud multi-color gradient + tiled pattern
          and it read as busy, so this time texture comes from motion and blur rather than
          contrast. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={cn(
            'absolute -top-16 -right-10 h-72 w-72 rounded-full bg-white/10 blur-3xl',
            autoplay && 'animate-[drift_9s_ease-in-out_infinite]',
          )}
        />
        <div
          className={cn(
            'absolute top-1/2 -left-16 h-64 w-64 rounded-full bg-[#34d399]/20 blur-3xl',
            autoplay && 'animate-[drift_11s_ease-in-out_-3s_infinite]',
          )}
        />
        <div
          className={cn(
            'absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-blue/25 blur-3xl',
            autoplay && 'animate-[drift_13s_ease-in-out_-6s_infinite]',
          )}
        />
        <Trophy
          className="absolute -right-10 -bottom-10 h-64 w-64 text-white/[0.06]"
          strokeWidth={1}
          aria-hidden="true"
        />
      </div>

      <Link href="/" className="relative flex w-fit items-center gap-2.5 text-paper no-underline">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
          <BrandLogo variant="icon" height={22} />
        </span>
        <span className="text-sm font-extrabold tracking-wide">InTourney</span>
      </Link>

      {/* `key={index}` forces a remount on every slide change so `starting:` (@starting-style) has
          a genuinely new element to animate in from - native CSS enter transition, no JS tweening
          library. Text and mock card are staggered a few ms apart for a livelier arrival. */}
      <div key={index} className="relative mt-10">
        <span
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-paper transition-all duration-500 ease-out starting:translate-y-3 starting:opacity-0"
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-2xl font-extrabold text-paper transition-all duration-500 ease-out starting:translate-y-3 starting:opacity-0">
          {active.title}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-paper/70 transition-all delay-75 duration-500 ease-out starting:translate-y-3 starting:opacity-0">
          {active.body}
        </p>
        <div className="mt-6 max-w-sm transition-all delay-150 duration-500 ease-out starting:translate-y-3 starting:opacity-0">
          {active.mock}
        </div>
      </div>

      <div className="relative flex items-center gap-1.5" role="tablist" aria-label="Showcase slides">
        {slides.map((slide, slideIndex) => {
          const isActive = slideIndex === index
          const isDone = slideIndex < index
          return (
            <button
              key={slide.title}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Show "${slide.title}"`}
              onClick={() => setIndex(slideIndex)}
              className="h-1 max-w-12 flex-1 overflow-hidden rounded-full bg-white/25"
            >
              {/* Re-keying the fill on every activation restarts the width animation from 0; its
                  own `animationend` (not a JS timer) is what advances the slide, so the visible
                  progress and the actual advance can never drift out of sync with each other. */}
              <span
                key={isActive ? `active-${index}` : 'idle'}
                onAnimationEnd={isActive ? () => setIndex((current) => (current + 1) % slides.length) : undefined}
                style={isActive && paused ? { animationPlayState: 'paused' } : undefined}
                className={cn(
                  'block h-full rounded-full bg-paper',
                  isDone && 'w-full',
                  !isActive && !isDone && 'w-0',
                  isActive && !autoplay && 'w-full',
                  isActive && autoplay && 'w-0 animate-[fill-bar_5000ms_linear_forwards]',
                )}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
