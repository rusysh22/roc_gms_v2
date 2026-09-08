import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { ArrowRight } from 'lucide-react'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { DEFAULT_EVENT_TIMEZONE } from '@/lib/timezone'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ShareButtons } from '@/components/share-buttons'
import { BracketTree } from '../../brackets/bracketTree'
import { DoubleEliminationBracketSections } from '../../brackets/doubleEliminationSections'
import { getCurrentPublicUser } from '../../getCurrentPublicUser'
import { QUICK_BRACKET_OWNER_COOKIE } from '@/lib/quickBracketCookies'
import { ClaimOnLoad } from './ClaimOnLoad'

export const dynamic = 'force-dynamic'

const MS_PER_DAY = 24 * 60 * 60 * 1000

type QuickBracketDoc = {
  id: string | number
  name: string
  format: 'single_elimination' | 'double_elimination'
  third_place?: boolean
  bracket_size: number
  status: 'active' | 'claimed' | 'expired'
  expires_at: string
  owner_token?: string | null
  bracket_data?: SingleEliminationBracketData | DoubleEliminationBracketData | null
}

export default async function QuickBracketResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ claim?: string }>
}) {
  const { slug } = await params
  const { claim } = await searchParams
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'quick-brackets',
    depth: 0,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  const docs = result.docs as QuickBracketDoc[]
  const bracket = docs[0]
  if (!bracket) {
    notFound()
  }

  // Only the browser that created this guest bracket sees the "claim it" CTA/flow - anyone else
  // who opens a shared link still gets a growth CTA, just not one that would let them take
  // ownership of someone else's tournament. See claimQuickBracketAction.ts for the server-side
  // enforcement of the same rule (this check is UX only, not the security boundary).
  const ownerToken = (await cookies()).get(QUICK_BRACKET_OWNER_COOKIE)?.value
  const isOwner = Boolean(ownerToken && ownerToken === bracket.owner_token)
  const claimRedirect = `/quick-bracket/${slug}?claim=1`
  const user = await getCurrentPublicUser()
  const shouldAutoClaimNow = claim === '1' && isOwner && Boolean(user) && bracket.status === 'active'

  // Checked here even before the cleanup script (src/scripts/cleanupExpiredQuickBrackets.ts) has
  // run for this row - degrades gracefully with no cron dependency for correctness, only for
  // eventual deletion. See prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md section 3/8.
  const isExpired = bracket.status === 'expired' || new Date(bracket.expires_at).getTime() < Date.now()
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(bracket.expires_at).getTime() - Date.now()) / MS_PER_DAY),
  )

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-8 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                Guest tournament
              </p>
              <h1 className="text-3xl font-extrabold sm:text-4xl">{bracket.name}</h1>
            </div>
            {!isExpired ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/40 bg-blue/5 px-3 py-1 text-xs font-semibold text-blue">
                Expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
              </span>
            ) : null}
          </div>

          {shouldAutoClaimNow ? <ClaimOnLoad slug={slug} /> : null}

          {isExpired ? (
            <Card className="mt-8 text-sm text-ink-soft">
              This guest tournament has expired and is no longer available. Quick Bracket
              Tournaments are temporary previews - sign up on InTourney to keep one permanently.
            </Card>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
                <span className="rounded-full border border-line bg-mist px-3 py-1">
                  {bracket.format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination'}
                </span>
                <span className="rounded-full border border-line bg-mist px-3 py-1">
                  {bracket.bracket_size}-slot bracket
                </span>
                {bracket.format === 'single_elimination' && bracket.third_place ? (
                  <span className="rounded-full border border-line bg-mist px-3 py-1">3rd place match</span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Share</p>
                <ShareButtons
                  title={`${bracket.name} - bracket on InTourney`}
                  description="Check out this bracket generated with InTourney's Quick Bracket Tournament."
                />
              </div>

              {bracket.status === 'claimed' ? (
                <div className="mt-6 rounded-panel border border-line bg-mist p-4">
                  <p className="text-sm text-ink-soft">
                    This tournament has already been claimed and is now running as a full InTourney
                    event.
                  </p>
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-4 rounded-panel border border-green/30 bg-mist p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink">
                    {isOwner
                      ? 'This is a preview - no scores can be entered yet. Sign up to run this live, keep this bracket permanently, and unlock every other tournament format.'
                      : 'Like this bracket? Create your own free tournament on InTourney - no account needed to try it.'}
                  </p>
                  <div className="flex shrink-0 items-center gap-4">
                    {isOwner ? (
                      <Link
                        href={`/login?redirect=${encodeURIComponent(claimRedirect)}`}
                        className="text-sm font-bold text-ink-soft hover:text-ink"
                      >
                        Sign in
                      </Link>
                    ) : null}
                    <Link
                      href={
                        isOwner
                          ? `/register?redirect=${encodeURIComponent(claimRedirect)}`
                          : '/register'
                      }
                      className={buttonVariants({ variant: 'primary' })}
                    >
                      {isOwner ? 'Sign up to run this live' : 'Create your own'}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-8">
                {!bracket.bracket_data ? (
                  <Card className="text-sm text-ink-soft">This bracket has no data.</Card>
                ) : bracket.bracket_data.format === 'double_elimination' ? (
                  <DoubleEliminationBracketSections
                    bracketData={bracket.bracket_data}
                    timezone={DEFAULT_EVENT_TIMEZONE}
                  />
                ) : (
                  <BracketTree
                    rounds={bracket.bracket_data.rounds}
                    champion={bracket.bracket_data.champion}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
