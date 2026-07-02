import { Skeleton } from '@/components/ui/skeleton'

export default function BracketsLoading() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-8">
        <div className="mx-auto max-w-5xl">
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-10 w-3/4 sm:w-1/2" />
          <Skeleton className="mt-3 h-12 w-full max-w-xl" />
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Skeleton className="mb-1 h-4 w-40" />
                <Skeleton className="h-7 w-64" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </section>
    </main>
  )
}
