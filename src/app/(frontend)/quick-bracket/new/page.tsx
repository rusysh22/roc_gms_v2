import { Suspense } from 'react'

import { QuickBracketForm } from './QuickBracketForm'

export const dynamic = 'force-dynamic'

export default function NewQuickBracketPage() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-8 pb-16">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            No login required
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Quick Create Bracket Tournament</h1>
          <p className="mt-3 max-w-xl text-base text-ink-soft">
            Generate a single or double elimination bracket in under a minute - no account needed.
            Sign up later if you want to record scores, share a public page, or unlock more formats.
          </p>

          <div className="mt-10">
            <Suspense fallback={null}>
              <QuickBracketForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  )
}
