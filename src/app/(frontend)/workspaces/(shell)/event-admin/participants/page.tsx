import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHero, toOptions, type WorkspaceOption } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { savePlayerAction, saveRosterAction, saveTeamAction } from './participantActions'

export const dynamic = 'force-dynamic'
type Params = Promise<Record<string, string | string[] | undefined>>
const get = (p: Record<string, string | string[] | undefined>, k: string) =>
  Array.isArray(p[k]) ? p[k][0] || '' : p[k] || ''
const idOf = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value ? String(value.id || '') : String(value || '')

const ChoiceField = ({
  name,
  label,
  options,
  value = '',
  required = false,
}: {
  name: string
  label: string
  options: WorkspaceOption[]
  value?: string
  required?: boolean
}) => (
  <Field label={label}>
    <Select name={name} required={required} defaultValue={value}>
      <option value="">Select {label.toLowerCase()}</option>
      {options.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </Select>
  </Field>
)

export default async function ParticipantsPage({ searchParams }: { searchParams?: Params }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin/participants',
    workspaceName: 'Participants Management',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const params = searchParams ? await searchParams : {}
  const kind = get(params, 'kind')
  const edit = get(params, 'edit')
  const [players, teams, rosters, clubs, categories] = await Promise.all([
    access.payload.find({ collection: 'players', depth: 0, limit: 300, sort: 'name' }),
    access.payload.find({ collection: 'teams', depth: 0, limit: 300, sort: 'name' }),
    access.payload.find({ collection: 'rosters', depth: 1, limit: 500, sort: '-createdAt' }),
    access.payload.find({ collection: 'clubs', depth: 0, limit: 300, sort: 'name' }),
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 100, sort: 'name' }),
  ])
  const player = kind === 'player' ? players.docs.find((x) => String(x.id) === edit) : undefined
  const team = kind === 'team' ? teams.docs.find((x) => String(x.id) === edit) : undefined
  const roster = kind === 'roster' ? rosters.docs.find((x) => String(x.id) === edit) : undefined

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Players, Teams, and Rosters"
        summary="Build eligible participants and team memberships for the active event. Changes are validated and audited."
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardTitle>{player ? `Edit ${player.name}` : 'Add player'}</CardTitle>
          <form action={savePlayerAction} className="grid gap-4">
            <input name="id" type="hidden" value={player?.id || ''} />
            <Field label="Name">
              <Input name="name" required defaultValue={player?.name || ''} />
            </Field>
            <ChoiceField name="clubId" label="Club" options={toOptions(clubs.docs)} value={idOf(player?.club_id)} />
            <Field label="Employee ID">
              <Input name="employeeId" defaultValue={player?.employee_id || ''} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={player?.email || ''} />
            </Field>
            <Field label="Phone">
              <Input name="phone" defaultValue={player?.phone || ''} />
            </Field>
            <Field label="Gender">
              <Select name="gender" defaultValue={player?.gender || ''}>
                <option value="">Not set</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </Select>
            </Field>
            <Button type="submit">Save player</Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>{team ? `Edit ${team.name}` : 'Add team'}</CardTitle>
          <form action={saveTeamAction} className="grid gap-4">
            <input name="id" type="hidden" value={team?.id || ''} />
            <Field label="Name">
              <Input name="name" required defaultValue={team?.name || ''} />
            </Field>
            <Field label="Slug">
              <Input name="slug" defaultValue={team?.slug || ''} />
            </Field>
            <ChoiceField name="clubId" label="Club" options={toOptions(clubs.docs)} value={idOf(team?.club_id)} />
            <ChoiceField
              name="captainId"
              label="Captain"
              options={toOptions(players.docs)}
              value={idOf(team?.captain_player_id)}
            />
            <Field label="Contact email">
              <Input name="email" type="email" defaultValue={team?.contact_email || ''} />
            </Field>
            <Field label="Description">
              <Textarea name="description" defaultValue={team?.description || ''} />
            </Field>
            <Button type="submit">Save team</Button>
          </form>
        </Card>
      </section>

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>{roster ? 'Edit roster membership' : 'Add roster membership'}</CardTitle>
        <form action={saveRosterAction} className="grid gap-4 sm:grid-cols-2">
          <input name="id" type="hidden" value={roster?.id || ''} />
          <ChoiceField name="teamId" label="Team" options={toOptions(teams.docs)} value={idOf(roster?.team_id)} required />
          <ChoiceField
            name="playerId"
            label="Player"
            options={toOptions(players.docs)}
            value={idOf(roster?.player_id)}
            required
          />
          <ChoiceField
            name="categoryId"
            label="Category"
            options={toOptions(categories.docs)}
            value={idOf(roster?.category_id)}
          />
          <Field label="Role">
            <Select name="role" defaultValue={roster?.role || 'player'}>
              <option value="player">Player</option>
              <option value="captain">Captain</option>
              <option value="coach">Coach</option>
              <option value="manager">Manager</option>
              <option value="substitute">Substitute</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={roster?.status || 'active'}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="withdrawn">Withdrawn</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit">Save membership</Button>
          </div>
        </form>
      </Card>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <CardTitle>Players ({players.totalDocs})</CardTitle>
          {players.docs.length === 0 ? (
            <EmptyState>No players yet.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {players.docs.map((x) => (
                <Link
                  key={x.id}
                  href={`/workspaces/event-admin/participants?kind=player&edit=${x.id}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
                >
                  <strong className="truncate text-sm font-bold text-ink">{x.name}</strong>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>Teams ({teams.totalDocs})</CardTitle>
          {teams.docs.length === 0 ? (
            <EmptyState>No teams yet.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {teams.docs.map((x) => (
                <Link
                  key={x.id}
                  href={`/workspaces/event-admin/participants?kind=team&edit=${x.id}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
                >
                  <strong className="truncate text-sm font-bold text-ink">{x.name}</strong>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card className="flex flex-col gap-2">
        <CardTitle>Roster memberships ({rosters.totalDocs})</CardTitle>
        {rosters.docs.length === 0 ? (
          <EmptyState>No roster memberships yet.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {rosters.docs.map((x) => (
              <Link
                key={x.id}
                href={`/workspaces/event-admin/participants?kind=roster&edit=${x.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-ink">
                    {typeof x.team_id === 'object' ? x.team_id?.name : 'Team'} &middot;{' '}
                    {typeof x.player_id === 'object' ? x.player_id?.name : 'Player'}
                  </strong>
                  <span className="text-xs font-semibold text-ink-soft">Role: {x.role}</span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
