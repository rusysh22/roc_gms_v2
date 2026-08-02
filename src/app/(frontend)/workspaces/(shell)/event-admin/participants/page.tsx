import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { CrudFormModal } from '@/components/ui/crud-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getActiveEvent } from '../../../activeEvent'
import { NoActiveEventNotice, PageHero, toOptions, type WorkspaceOption } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { savePlayerAction, saveRosterAction, saveTeamAction } from './participantActions'

export const dynamic = 'force-dynamic'
const basePage = '/workspaces/event-admin/participants'
const participantErrorMessages: Record<string, string> = {
  invalid_player: 'Fill in a valid player name, email, and gender.',
  invalid_team: 'Fill in a valid team name, slug, and email.',
  invalid_roster: 'Choose a team, player, role, and status.',
  invalid_relationship: 'One of the selected club/team/player/category does not belong to the active event.',
  duplicate_slug: 'That name/slug is already used by another team.',
  duplicate_roster: 'That player is already on this team roster (for this category).',
}
type Params = Promise<Record<string, string | string[] | undefined>>
const get = (p: Record<string, string | string[] | undefined>, k: string) =>
  Array.isArray(p[k]) ? p[k][0] || '' : p[k] || ''
const idOf = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value ? String(value.id || '') : String(value || '')
const nameOf = (value: unknown) =>
  value && typeof value === 'object' && 'name' in value ? String(value.name || '—') : '—'

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
    returnTo: basePage,
    workspaceName: 'Participants Management',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const activeEvent = await getActiveEvent(access.payload)
  if (!activeEvent) {
    return (
      <>
        <PageHero
          eyebrow="Event Setup"
          title="Players, Teams, and Rosters"
          summary="Build eligible participants and team memberships for the active event. Changes are validated and audited."
        />
        <NoActiveEventNotice />
      </>
    )
  }

  const params = searchParams ? await searchParams : {}
  const kind = get(params, 'kind')
  const edit = get(params, 'edit')
  const participantError = get(params, 'participantError')
  const anyUpdated = get(params, 'playerUpdated') || get(params, 'teamUpdated') || get(params, 'rosterUpdated')
  const eventWhere = { event_id: { equals: activeEvent.id } }
  const [players, teams, rosters, clubs, categories] = await Promise.all([
    access.payload.find({ collection: 'players', depth: 0, limit: 300, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'teams', depth: 0, limit: 300, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'rosters', depth: 1, limit: 500, sort: '-createdAt', where: eventWhere }),
    access.payload.find({ collection: 'clubs', depth: 0, limit: 300, sort: 'name', where: eventWhere }),
    access.payload.find({ collection: 'competition-categories', depth: 0, limit: 100, sort: 'name', where: eventWhere }),
  ])
  const player = kind === 'player' ? players.docs.find((x) => String(x.id) === edit) : undefined
  const team = kind === 'team' ? teams.docs.find((x) => String(x.id) === edit) : undefined
  const roster = kind === 'roster' ? rosters.docs.find((x) => String(x.id) === edit) : undefined

  const playerForm = (
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
      <SubmitButton>Save player</SubmitButton>
    </form>
  )

  const teamForm = (
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
      <SubmitButton>Save team</SubmitButton>
    </form>
  )

  const rosterForm = (
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
        <SubmitButton className="w-full sm:w-auto">
          Save membership
        </SubmitButton>
      </div>
    </form>
  )

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Players, Teams, and Rosters"
        summary="Build eligible participants and team memberships for the active event. Changes are validated and audited."
      />

      {participantError && participantErrorMessages[participantError] ? (
        <AlertBanner tone="error" className="mb-4">
          {participantErrorMessages[participantError]}
        </AlertBanner>
      ) : null}
      {anyUpdated ? (
        <AlertBanner tone="success" className="mb-4">
          Saved.
        </AlertBanner>
      ) : null}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-ink">Players ({players.totalDocs})</h2>
          <CrudFormModal
            key={kind === 'player' ? edit || 'add-player' : 'closed-player'}
            title={player ? `Edit ${player.name}` : 'Add player'}
            openDefault={Boolean(player)}
            closeHref={basePage}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add player
              </Button>
            }
          >
            {playerForm}
          </CrudFormModal>
        </div>
        {players.docs.length === 0 ? (
          <EmptyState>No players yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.docs.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-bold">{x.name}</TableCell>
                  <TableCell className="text-ink-soft">{nameOf(x.club_id)}</TableCell>
                  <TableCell className="text-ink-soft">{x.email || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}?kind=player&edit=${x.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-ink">Teams ({teams.totalDocs})</h2>
          <CrudFormModal
            key={kind === 'team' ? edit || 'add-team' : 'closed-team'}
            title={team ? `Edit ${team.name}` : 'Add team'}
            openDefault={Boolean(team)}
            closeHref={basePage}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add team
              </Button>
            }
          >
            {teamForm}
          </CrudFormModal>
        </div>
        {teams.docs.length === 0 ? (
          <EmptyState>No teams yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Captain</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.docs.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-bold">{x.name}</TableCell>
                  <TableCell className="text-ink-soft">{nameOf(x.club_id)}</TableCell>
                  <TableCell className="text-ink-soft">{nameOf(x.captain_player_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}?kind=team&edit=${x.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-ink">Roster memberships ({rosters.totalDocs})</h2>
          <CrudFormModal
            key={kind === 'roster' ? edit || 'add-roster' : 'closed-roster'}
            title={roster ? 'Edit roster membership' : 'Add roster membership'}
            openDefault={Boolean(roster)}
            closeHref={basePage}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add membership
              </Button>
            }
          >
            {rosterForm}
          </CrudFormModal>
        </div>
        {rosters.docs.length === 0 ? (
          <EmptyState>No roster memberships yet.</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rosters.docs.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-bold">{nameOf(x.team_id)}</TableCell>
                  <TableCell className="text-ink-soft">{nameOf(x.player_id)}</TableCell>
                  <TableCell className="text-ink-soft">{String(x.role).replaceAll('_', ' ')}</TableCell>
                  <TableCell>
                    <StatusBadge tone={x.status === 'active' ? 'green' : 'neutral'}>{x.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`${basePage}?kind=roster&edit=${x.id}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  )
}
