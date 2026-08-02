import Link from 'next/link'
import type { ReactNode } from 'react'
import { Edit3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import type { PublicEditState } from './publicEditState'
import {
  updateAnnouncementPublicContentAction,
  updateArticlePublicContentAction,
  updateEventPublicContentAction,
} from './publicEditActions'

type EditableRegionProps = {
  state: PublicEditState
  label: string
  children: ReactNode
  editor: ReactNode
}

type StatusOption = 'draft' | 'review' | 'published' | 'archived'

const contentStatusOptions: StatusOption[] = ['draft', 'review', 'published', 'archived']

export function PublicEditToolbar({
  state,
  path,
}: {
  state: PublicEditState
  path: string
}) {
  if (!state.canEdit) {
    return null
  }

  const cleanPath = path || '/'
  const previewHref = `${cleanPath}?preview=1`
  const editHref = `${cleanPath}?preview=1&edit=1`
  const publicHref = cleanPath

  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-paper px-4 py-3 font-sans shadow-md">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Admin preview</p>
        <p className="text-sm font-semibold text-ink">
          {state.isEditMode ? 'Edit mode is on' : state.isPreview ? 'Preview mode is on' : 'Public view'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={publicHref}>Public</Link>
        </Button>
        <Button asChild variant={state.isPreview && !state.isEditMode ? 'primary' : 'secondary'} size="sm">
          <Link href={previewHref}>Preview</Link>
        </Button>
        <Button asChild variant={state.isEditMode ? 'primary' : 'secondary'} size="sm">
          <Link href={editHref}>
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function EditableRegion({ state, label, children, editor }: EditableRegionProps) {
  if (!state.isEditMode) {
    return <>{children}</>
  }

  return (
    <div className="relative rounded-panel outline outline-2 outline-offset-4 outline-blue/50">
      <div className="pointer-events-none absolute -top-3 left-3 z-10 rounded-full bg-blue px-3 py-1 text-xs font-bold uppercase tracking-wide text-paper">
        {label}
      </div>
      {children}
      <details className="mt-3 rounded-panel border border-line bg-paper p-4 font-sans shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-blue">
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          Edit {label}
        </summary>
        <div className="mt-4">{editor}</div>
      </details>
    </div>
  )
}

const Field = ({
  label,
  name,
  defaultValue,
  textarea,
}: {
  label: string
  name: string
  defaultValue?: string | null
  textarea?: boolean
}) => (
  <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
    {label}
    {textarea ? (
      <textarea
        name={name}
        defaultValue={defaultValue || ''}
        rows={4}
        className="min-h-28 rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-normal text-ink"
      />
    ) : (
      <input
        name={name}
        defaultValue={defaultValue || ''}
        className="h-11 rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-normal text-ink"
      />
    )}
  </label>
)

const StatusSelect = ({ defaultValue }: { defaultValue?: string | null }) => (
  <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
    Status
    <select
      name="status"
      defaultValue={defaultValue || 'draft'}
      className="h-11 rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-normal text-ink"
    >
      {contentStatusOptions.map((status) => (
        <option key={status} value={status}>
          {status.replace('_', ' ')}
        </option>
      ))}
    </select>
  </label>
)

const FormActions = ({ editHref }: { editHref: string }) => (
  <div className="flex flex-wrap items-center gap-2 pt-2">
    <SubmitButton size="sm">Save preview</SubmitButton>
    <Button asChild variant="secondary" size="sm">
      <Link href={editHref}>Full editor</Link>
    </Button>
  </div>
)

export function EventPublicEditor({
  id,
  heroTagline,
  description,
  visibility,
  returnTo,
}: {
  id: string | number
  heroTagline?: string | null
  description?: string | null
  visibility?: string | null
  returnTo: string
}) {
  return (
    <form action={updateEventPublicContentAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={String(id)} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label="Hero tagline" name="heroTagline" defaultValue={heroTagline} />
      <Field label="Event description" name="description" defaultValue={description} textarea />
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        Visibility
        <select
          name="visibility"
          defaultValue={visibility || 'hidden'}
          className="h-11 rounded-[10px] border border-line bg-paper px-3 py-2 text-sm font-normal text-ink"
        >
          {['hidden', 'coming_soon', 'preview_only', 'published', 'archived'].map((value) => (
            <option key={value} value={value}>
              {value.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <FormActions editHref="/workspaces/event-admin/details" />
    </form>
  )
}

export function ArticlePublicEditor({
  id,
  title,
  excerpt,
  status,
  shareTitle,
  shareDescription,
  returnTo,
}: {
  id: string | number
  title?: string | null
  excerpt?: string | null
  status?: string | null
  shareTitle?: string | null
  shareDescription?: string | null
  returnTo: string
}) {
  return (
    <form action={updateArticlePublicContentAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={String(id)} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label="Title" name="title" defaultValue={title} />
      <Field label="Excerpt" name="excerpt" defaultValue={excerpt} textarea />
      <StatusSelect defaultValue={status} />
      <Field label="Share title" name="shareTitle" defaultValue={shareTitle} />
      <Field label="Share description" name="shareDescription" defaultValue={shareDescription} textarea />
      <FormActions editHref={`/workspaces/content-admin/articles/${id}`} />
    </form>
  )
}

export function AnnouncementPublicEditor({
  id,
  title,
  summary,
  body,
  status,
  shareTitle,
  shareDescription,
  returnTo,
}: {
  id: string | number
  title?: string | null
  summary?: string | null
  body?: string | null
  status?: string | null
  shareTitle?: string | null
  shareDescription?: string | null
  returnTo: string
}) {
  return (
    <form action={updateAnnouncementPublicContentAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={String(id)} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label="Title" name="title" defaultValue={title} />
      <Field label="Summary" name="summary" defaultValue={summary} textarea />
      <Field label="Body" name="body" defaultValue={body} textarea />
      <StatusSelect defaultValue={status} />
      <Field label="Share title" name="shareTitle" defaultValue={shareTitle} />
      <Field label="Share description" name="shareDescription" defaultValue={shareDescription} textarea />
      <FormActions editHref={`/workspaces/content-admin/announcements/${id}`} />
    </form>
  )
}
