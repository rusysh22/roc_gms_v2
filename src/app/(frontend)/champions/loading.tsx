import { Skeleton } from '@/components/ui/skeleton'

export default function ChampionsLoading() {
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
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </section>
    </main>
  )
}
