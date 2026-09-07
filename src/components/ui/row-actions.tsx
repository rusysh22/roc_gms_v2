import Link from 'next/link'
import { Eye, Pencil, Trash2 } from 'lucide-react'

import { Button } from './button'
import { ConfirmDialog } from './confirm-dialog'

// The one standard row-action cluster for every Event Admin list table. Before this, each page
// hand-rolled its own "Edit" link and (on the three pages that had it) a differently-shaped delete
// button. Order is always View -> Edit -> Delete; delete goes through the shared ConfirmDialog with
// consequence copy, matching the ADM-13 convention.
export interface RowActionsProps {
  editHref: string
  /** Omit where "Edit" already shows the whole record (no separate read-only view needed). */
  viewHref?: string
  /** Server action for the delete <form>. Omit to hide delete entirely. */
  deleteAction?: (formData: FormData) => void | Promise<void>
  deleteId?: string | number
  /** Name of the hidden id field the delete action reads. Defaults to `id`. */
  deleteIdField?: string
  /** Consequence copy shown in the confirm dialog, e.g. `Delete "Court 1"? ...`. */
  deleteDescription?: React.ReactNode
  deleteConfirmLabel?: string
}

export function RowActions({
  editHref,
  viewHref,
  deleteAction,
  deleteId,
  deleteIdField = 'id',
  deleteDescription,
  deleteConfirmLabel = 'Delete',
}: RowActionsProps) {
  const formId = deleteAction && deleteId != null ? `row-delete-${deleteIdField}-${deleteId}` : undefined

  return (
    <div className="flex items-center justify-end gap-1">
      {viewHref ? (
        <Button asChild size="sm" variant="ghost">
          <Link href={viewHref}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            View
          </Link>
        </Button>
      ) : null}
      <Button asChild size="sm" variant="ghost">
        <Link href={editHref}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Link>
      </Button>
      {deleteAction && deleteId != null && formId ? (
        <>
          <form id={formId} action={deleteAction}>
            <input type="hidden" name={deleteIdField} value={String(deleteId)} />
          </form>
          <ConfirmDialog
            trigger={
              <Button type="button" size="sm" variant="ghost" className="text-danger hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </Button>
            }
            description={deleteDescription ?? 'This cannot be undone.'}
            confirmLabel={deleteConfirmLabel}
            confirmButtonProps={{ type: 'submit', form: formId }}
          />
        </>
      ) : null}
    </div>
  )
}
