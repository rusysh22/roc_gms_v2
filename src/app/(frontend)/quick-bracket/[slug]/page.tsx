import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { SingleEliminationBracketData } from '@/lib/brackets'
import type { DoubleEliminationBracketData } from '@/lib/doubleElimination'
import { DEFAULT_EVENT_TIMEZONE } from '@/lib/timezone'
import { Card } from '@/components/ui/card'
import { ShareButtons } from '@/components/share-buttons'
import { BracketTree } from '../../brackets/bracketTree'
import { DoubleEliminationBracketSections } from '../../brackets/doubleEliminationSections'
import { getCurrentPublicUser } from '../../getCurrentPublicUser'
import { quickBracketOwnerCookieName } from '@/lib/quickBracketCookies'
import { EditorAccessOnLoad } from './EditorAccessOnLoad'
import { QuickBracketEditor } from './QuickBracketEditor'
import { RenameBracketControl } from './RenameBracketControl'
import { UpsizeEventButton } from './UpsizeEventButton'

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
  owner_user_id?: (string | number) | { id: string | number } | null
  bracket_data?: SingleEliminationBracketData | DoubleEliminationBracketData | null
}

const resolveOwnerUserId = (bracket: QuickBracketDoc): string | number | null => {
  const raw = bracket.owner_user_id
  if (!raw) return null
  return typeof raw === 'object' ? raw.id : raw
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

  // Sign in/up unlocks EDITOR access (prd/design/QUICK_BRACKET_TOURNAMENT_DESIGN.md section 11) -
  // it does not create a real event. Two ownership signals: `isBrowserOwner` (the owner_token
  // cookie, present the moment the bracket was created - true even signed out) authorizes
  // *attaching* an account; `isEditor` (owner_user_id matches the signed-in user) is what actually
  // unlocks the edit UI below, and works from any device once attached.
  const ownerToken = (await cookies()).get(quickBracketOwnerCookieName(slug))?.value
  const isBrowserOwner = Boolean(ownerToken && ownerToken === bracket.owner_token)
  const editorRedirect = `/quick-bracket/${slug}?claim=1`
  const user = await getCurrentPublicUser()
  const ownerUserId = resolveOwnerUserId(bracket)
  const isEditor = Boolean(user && ownerUserId && String(ownerUserId) === String(user.id))
  const shouldAttachEditorNow =
    claim === '1' && isBrowserOwner && Boolean(user) && !isEditor && bracket.status === 'active'

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
                {isEditor ? 'Your guest tournament' : 'Guest tournament'}
              </p>
              <div className="flex items-center gap-1">
                <h1 className="text-3xl font-extrabold sm:text-4xl">{bracket.name}</h1>
                {isEditor ? <RenameBracketControl slug={slug} name={bracket.name} /> : null}
              </div>
            </div>
            {!isExpired ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue/40 bg-blue/5 px-3 py-1 text-xs font-semibold text-blue">
                Expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
              </span>
            ) : null}
          </div>

          {shouldAttachEditorNow ? <EditorAccessOnLoad slug={slug} /> : null}

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
                    This tournament has already been upgraded and is now running as a full
                    InTourney event.
                  </p>
                </div>
              ) : isEditor ? (
                <div className="mt-6 flex flex-col gap-4 rounded-panel border border-green/30 bg-mist p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink">
                    You can enter results below - no need to sign up again on this device. Want
                    multiple sports, categories, or a public event page? Upsize this into a full
                    InTourney event any time.
                  </p>
                  <UpsizeEventButton slug={slug} />
                </div>
              ) : (
                <div className="mt-6 flex flex-col gap-4 rounded-panel border border-green/30 bg-mist p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink">
                    {isBrowserOwner
                      ? 'This is a preview - sign in to edit results directly on this page, from any device.'
                      : 'Like this bracket? Create your own free tournament on InTourney - no account needed to try it.'}
                  </p>
                  <div className="flex shrink-0 items-center gap-4">
                    {isBrowserOwner ? (
                      <Link
                        href={`/login?redirect=${encodeURIComponent(editorRedirect)}`}
                        className="text-sm font-bold text-ink-soft hover:text-ink"
                      >
                        Sign in
                      </Link>
                    ) : null}
                    <Link
                      href={
                        isBrowserOwner
                          ? `/register?redirect=${encodeURIComponent(editorRedirect)}`
                          : '/register'
                      }
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-green px-6 text-[0.95rem] font-semibold text-paper no-underline transition-colors hover:bg-green/90"
                    >
                      {isBrowserOwner ? 'Sign up to edit' : 'Create your own'}
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

              {isEditor && bracket.bracket_data ? (
                <QuickBracketEditor slug={slug} format={bracket.format} bracketData={bracket.bracket_data} />
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
