'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { renameQuickBracketAction } from './quickBracketEditActions'

// Settings-editing for a quick bracket is scoped to renaming only for this pass - toggling
// format/third-place/split-participants or reseeding after results may already exist needs more
// careful design (what happens to already-recorded scores) and is deferred. See prd/design/
// QUICK_BRACKET_TOURNAMENT_DESIGN.md section 11.
export function RenameBracketControl({ slug, name }: { slug: string; name: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(name)
          setEditing(true)
        }}
        aria-label="Rename tournament"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist hover:text-ink"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const result = await renameQuickBracketAction(slug, value)
    setSaving(false)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={120}
          className="h-9 max-w-xs"
          autoFocus
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label="Save name"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-green transition-colors hover:bg-green/10 disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          aria-label="Cancel"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-mist"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  )
}
