'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// prd/redesign/import-data-and-draft-persistence.md track DR: every wizard form is a plain
// uncontrolled <form action={serverAction}> with no client state, so a browser refresh, tab crash,
// or accidental in-app navigation mid-edit lost everything typed. UnsavedChangesGuard only fired
// the native beforeunload prompt - it did nothing for an actual reload or a crash. This supersedes
// it: keeps the beforeunload dirty guard AND autosaves the named form controls to localStorage,
// offering an explicit opt-in "restore?" banner on the next mount. Recovery is never a silent
// auto-repopulate - a form the user thought was blank quietly filling itself in is its own trap.
//
// File inputs are deliberately never persisted: the browser does not allow programmatic restore of
// <input type=file> for security reasons, so the banner tells the user to re-attach instead.

const STALE_MS = 7 * 24 * 60 * 60 * 1000
const SAVE_DEBOUNCE_MS = 400

type DraftPayload = { savedAt: string; values: Record<string, string> }

const readDraft = (key: string): DraftPayload | null => {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftPayload
    if (!parsed || typeof parsed.savedAt !== 'string' || typeof parsed.values !== 'object' || parsed.values === null) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeDraft = (key: string, values: Record<string, string>) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), values } satisfies DraftPayload))
  } catch {
    // Private-mode browsers and storage-blocked contexts throw on access - degrade to no
    // persistence rather than crash the form.
  }
}

const clearDraft = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* see writeDraft */
  }
}

const collectValues = (root: HTMLElement): Record<string, string> => {
  const values: Record<string, string> = {}
  const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    'input[name], select[name], textarea[name]',
  )
  controls.forEach((control) => {
    if (control instanceof HTMLInputElement) {
      if (control.type === 'file' || control.type === 'password') return
      if (control.type === 'checkbox') {
        values[control.name] = control.checked ? 'on' : ''
        return
      }
      if (control.type === 'radio') {
        if (control.checked) values[control.name] = control.value
        return
      }
    }
    values[control.name] = control.value
  })
  return values
}

const hasMeaningfulValue = (values: Record<string, string>) =>
  Object.values(values).some((value) => value.trim() !== '')

// React tracks its own value on controlled inputs (EventNameSlugFields), so a plain
// `control.value = x` is silently reverted on the next render. Going through the native setter and
// dispatching a bubbling `input` event makes React's onChange fire and adopt the value.
const setControlValue = (
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set
  if (setter) {
    setter.call(control, value)
  } else {
    control.value = value
  }
  control.dispatchEvent(new Event('input', { bubbles: true }))
  control.dispatchEvent(new Event('change', { bubbles: true }))
}

const formatRelative = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'barusan'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.round(hours / 24)} hari lalu`
}

export const WizardFormDraft = ({
  storageKey,
  children,
}: {
  storageKey: string
  children: ReactNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [restorable, setRestorable] = useState<DraftPayload | null>(null)

  // Decide once, on mount, whether to offer a restore.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const draft = readDraft(storageKey)
    if (!draft) return
    if (Date.now() - new Date(draft.savedAt).getTime() > STALE_MS) {
      clearDraft(storageKey)
      return
    }
    if (!hasMeaningfulValue(draft.values)) return
    // The server already repopulates the form from query params after a validation bounce - if the
    // live form is non-empty, that path won, and re-prompting to restore would be noise.
    if (hasMeaningfulValue(collectValues(container))) return

    setRestorable(draft)
  }, [storageKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scheduleSave = () => {
      dirtyRef.current = true
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        writeDraft(storageKey, collectValues(container))
      }, SAVE_DEBOUNCE_MS)
    }
    const handleSubmit = () => {
      dirtyRef.current = false
      clearTimeout(saveTimerRef.current)
      clearDraft(storageKey)
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault()
    }

    container.addEventListener('input', scheduleSave)
    container.addEventListener('change', scheduleSave)
    container.addEventListener('submit', handleSubmit, true)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      container.removeEventListener('input', scheduleSave)
      container.removeEventListener('change', scheduleSave)
      container.removeEventListener('submit', handleSubmit, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearTimeout(saveTimerRef.current)
    }
  }, [storageKey])

  const restore = useCallback(() => {
    const container = containerRef.current
    if (!container || !restorable) return

    for (const [name, value] of Object.entries(restorable.values)) {
      const control = container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        `[name="${CSS.escape(name)}"]`,
      )
      if (!control) continue

      if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        control.checked = value === 'on'
        control.dispatchEvent(new Event('change', { bubbles: true }))
        continue
      }
      if (control instanceof HTMLInputElement && control.type === 'radio') {
        if (value && control.value === value) {
          control.checked = true
          control.dispatchEvent(new Event('change', { bubbles: true }))
        }
        continue
      }
      if (!value) continue
      setControlValue(control, value)
    }

    setRestorable(null)
  }, [restorable])

  const discard = useCallback(() => {
    clearDraft(storageKey)
    setRestorable(null)
  }, [storageKey])

  return (
    <div ref={containerRef}>
      {restorable ? (
        <div className="mb-4 flex flex-col gap-2 rounded-card border border-blue/40 bg-blue/5 p-3 text-sm">
          <p className="font-bold text-ink">Melanjutkan draft sebelumnya?</p>
          <p className="text-ink-soft">
            Kami menyimpan isian form ini di browser Anda ({formatRelative(restorable.savedAt)}). File
            logo tidak ikut tersimpan &mdash; lampirkan ulang bila perlu.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restore}
              className="inline-flex h-8 items-center rounded-full bg-green px-3 text-xs font-bold text-paper"
            >
              Pulihkan
            </button>
            <button
              type="button"
              onClick={discard}
              className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-bold text-ink-soft hover:text-ink"
            >
              Buang draft
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  )
}
