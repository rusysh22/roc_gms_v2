import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageHero, toOptions } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveCompetitionEntryAction } from './entryActions'

export const dynamic = 'force-dynamic'
type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function EntriesPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin/entries',
    workspaceName: 'Competition Entries',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const params = searchParams ? await searchParams : {}
  const id = get(params, 'edit')
  const [entries, categories, players, teams, clubs] = await Promise.all([
    access.payload.find({ collection: 'competition-entries', depth: 1, limit: 300, sort: 'display_name' }),
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 100, sort: 'name' }),
    access.payload.find({ collection: 'players', depth: 0, limit: 300, sort: 'name' }),
    access.payload.find({ collection: 'teams', depth: 0, limit: 300, sort: 'name' }),
    access.payload.find({ collection: 'clubs', depth: 0, limit: 300, sort: 'name' }),
  ])
  const entry = entries.docs.find((item) => String(item.id) === id)
  const sourceId =
    typeof entry?.player_id === 'object' ? String(entry.player_id?.id || '')
    : typeof entry?.team_id === 'object' ? String(entry.team_id?.id || '')
    : typeof entry?.club_id === 'object' ? String(entry.club_id?.id || '')
    : ''

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Competition Entries"
        summary="Create and maintain eligible scheduling participants using names and categories."
      />

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>{entry ? `Edit ${entry.display_name}` : 'Add entry'}</CardTitle>
        <form action={saveCompetitionEntryAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={entry?.id || ''} />
          <Field label="Display name">
            <Input name="displayName" required defaultValue={entry?.display_name || ''} />
          </Field>
          <Field label="Category">
            <Select
              name="categoryId"
              required
              defaultValue={
                typeof entry?.category_id === 'object'
                  ? String(entry.category_id?.id || '')
                  : String(entry?.category_id || '')
              }
            >
              <option value="">Select category</option>
              {toOptions(categories.docs).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="entryType" defaultValue={entry?.entry_type || 'individual'}>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
              <option value="club">Club</option>
              <option value="pair">Pair</option>
              <option value="open">Open</option>
              <option value="tbd">TBD</option>
            </Select>
          </Field>
          <Field label="Player/team/club">
            <Select name="sourceId" defaultValue={sourceId}>
              <option value="">None / manual entry</option>
              <optgroup label="Players">
                {toOptions(players.docs).map((x) => (
                  <option key={`p-${x.id}`} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Teams">
                {toOptions(teams.docs).map((x) => (
                  <option key={`t-${x.id}`} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Clubs">
                {toOptions(clubs.docs).map((x) => (
                  <option key={`c-${x.id}`} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <Field label="Seed">
            <Input name="seedNumber" type="number" min="1" defaultValue={entry?.seed_number ?? ''} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={entry?.status || 'pending'}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="disqualified">Disqualified</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Save entry</Button>
          </div>
        </form>
      </Card>

      <Card className="flex flex-col gap-2">
        <CardTitle>Current entries</CardTitle>
        {entries.docs.length === 0 ? (
          <EmptyState>No entries yet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.docs.map((item) => (
              <Link
                key={item.id}
                href={`/workspaces/event-admin/entries?edit=${item.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-ink">{item.display_name}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={item.status === 'confirmed' ? 'green' : 'neutral'}>
                    {item.status}
                  </StatusBadge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
