import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHero } from '../../../workspaceComponents'
import { WORKSPACE_ROLES, WorkspaceUnauthorized, requireWorkspaceAccess } from '../../../workspaceAuth'
import { saveClubAction } from './clubActions'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const get = (params: Record<string, string | string[] | undefined>, key: string) =>
  Array.isArray(params[key]) ? params[key][0] || '' : params[key] || ''

export default async function ClubsPage({ searchParams }: { searchParams?: SearchParams }) {
  const access = await requireWorkspaceAccess({
    allowedRoles: WORKSPACE_ROLES.eventAdmin,
    returnTo: '/workspaces/event-admin/clubs',
    workspaceName: 'Club Management',
  })
  if (!access.authorized) {
    return <WorkspaceUnauthorized workspaceName={access.workspaceName} allowedRoles={access.allowedRoles} />
  }

  const params = searchParams ? await searchParams : {}
  const query = get(params, 'q').toLowerCase()
  const editingId = get(params, 'edit')
  const clubs = await access.payload.find({ collection: 'clubs', depth: 0, limit: 200, sort: 'name' })
  const editing = clubs.docs.find((club) => String(club.id) === editingId)
  const visible = clubs.docs.filter(
    (club) => !query || `${club.name} ${club.slug}`.toLowerCase().includes(query),
  )

  return (
    <>
      <PageHero
        eyebrow="Event Setup"
        title="Clubs"
        summary="Create and maintain the clubs in the active event without using Advanced Data Administration."
      />

      <Card className="mb-6 flex flex-col gap-4">
        <CardTitle>{editing ? `Edit ${editing.name}` : 'Add Club'}</CardTitle>
        <form action={saveClubAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={editing?.id || ''} />
          <Field label="Name">
            <Input name="name" required defaultValue={editing?.name || ''} />
          </Field>
          <Field label="Slug (advanced)">
            <Input name="slug" defaultValue={editing?.slug || ''} placeholder="generated-from-name" />
          </Field>
          <Field label="Logo URL">
            <Input name="logo" type="url" defaultValue={editing?.logo || ''} />
          </Field>
          <Field label="Contact person">
            <Input name="contactPerson" defaultValue={editing?.contact_person || ''} />
          </Field>
          <Field label="Contact email">
            <Input name="contactEmail" type="email" defaultValue={editing?.contact_email || ''} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" defaultValue={editing?.description || ''} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{editing ? 'Save club' : 'Add club'}</Button>
            {editing ? (
              <Button asChild variant="secondary">
                <Link href="/workspaces/event-admin/clubs">Cancel</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <form className="mb-4 flex gap-2" action="/workspaces/event-admin/clubs">
        <Input name="q" defaultValue={query} placeholder="Search by name..." />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card className="flex flex-col gap-2">
        <CardTitle>Club directory</CardTitle>
        {visible.length === 0 ? (
          <EmptyState>No clubs found.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((club) => (
              <Link
                key={club.id}
                href={`/workspaces/event-admin/clubs?edit=${club.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 no-underline transition-colors hover:border-green hover:bg-mist"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-ink">{club.name}</strong>
                  <span className="text-xs font-semibold text-ink-soft">
                    {club.contact_person || 'No contact'}
                    {club.contact_email ? ` · ${club.contact_email}` : ''}
                  </span>
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
