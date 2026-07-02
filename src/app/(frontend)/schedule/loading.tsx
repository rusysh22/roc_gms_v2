import { Skeleton } from '@/components/ui/skeleton'

export default function ScheduleLoading() {
  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-6">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-10 w-3/4 sm:w-1/2" />
          <Skeleton className="mt-3 h-12 w-full max-w-xl" />
        </div>
      </section>

      <div className="sticky top-20 z-40 border-y border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto">
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        </div>
      </div>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-4xl flex flex-col gap-8">
          <div>
            <Skeleton className="mb-3 h-4 w-40" />
            <div className="flex flex-col gap-3">
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
