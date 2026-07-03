import Link from 'next/link'
import {
  ChevronRight,
  CircleDot,
  Crown,
  Gamepad2,
  Goal,
  Table2,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatStatus } from '../workspaces/workspaceComponents'
import { getSportCategories, type CategoryDoc, type SportDoc } from './publicSportData'

export const dynamic = 'force-dynamic'

const SPORT_ICONS: Record<string, LucideIcon> = {
  court: CircleDot,
  field: Goal,
  table: Table2,
  board: Crown,
  esport: Gamepad2,
  track: Timer,
  other: Trophy,
}

const getSportId = (sport: SportDoc | string | number | null | undefined) =>
  sport && typeof sport === 'object' ? String(sport.id) : String(sport || '')

export default async function PublicSportsPage() {
  const { sports, categories } = await getSportCategories()
  const categoriesBySport = categories.reduce<Map<string, CategoryDoc[]>>((map, category) => {
    const sportId = getSportId(category.sport_id)
    const rows = map.get(sportId) || []
    rows.push(category)
    map.set(sportId, rows)
    return map
  }, new Map())

  return (
    <main className="font-sans text-ink">
      <section className="px-4 pt-4 pb-8">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Sports &amp; Categories
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Find Your Competition</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            Browse each sport, open a category, and see the latest bracket, standings, schedule,
            and match rules in one place.
          </p>
        </div>
      </section>

      <section className="px-4 pb-16" aria-label="Sport categories">
        <div className="mx-auto max-w-5xl">
          {sports.length === 0 ? (
            <Card className="text-sm text-ink-soft">Sports have not been published yet.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {sports.map((sport) => {
                const Icon = SPORT_ICONS[sport.sport_type || 'other'] || Trophy
                const sportCategories = categoriesBySport.get(String(sport.id)) || []

                return (
                  <Card key={sport.id} className="flex flex-col gap-4">
                    <CardHeader>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mist text-green">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-xl">{sport.name}</CardTitle>
                          <CardDescription>
                            {sportCategories.length}{' '}
                            {sportCategories.length === 1 ? 'category' : 'categories'}
                          </CardDescription>
                        </div>
                      </div>
                      {sport.description ? (
                        <p className="text-sm leading-relaxed text-ink-soft">{sport.description}</p>
                      ) : null}
                    </CardHeader>

                    {sportCategories.length === 0 ? (
                      <p className="text-sm text-ink-soft">Categories will appear here soon.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {sportCategories.map((category) => (
                          <Link
                            key={category.id}
                            href={`/sports/${sport.slug}/${category.slug}`}
                            className="group flex items-center justify-between gap-3 rounded-card border border-line px-3 py-3 no-underline transition-colors hover:border-blue"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-ink">
                                {category.name}
                              </p>
                              <p className="mt-1 text-xs text-ink-soft">
                                {formatStatus(category.participant_mode)} /{' '}
                                {formatStatus(category.format_type)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge tone={category.status === 'published' ? 'green' : 'blue'}>
                                {formatStatus(category.status)}
                              </StatusBadge>
                              <ChevronRight
                                className="h-4 w-4 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-blue"
                                aria-hidden="true"
                              />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
