import { Skeleton } from '@/components/ui/skeleton'

export default function StandingsLoading() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-8">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-10 w-3/4 sm:w-1/2" />
          <Skeleton className="mt-3 h-12 w-full max-w-xl" />
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <div>
            <Skeleton className="mb-3 h-4 w-40" />
            <div className="hidden sm:block">
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="flex flex-col gap-3 sm:hidden">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
