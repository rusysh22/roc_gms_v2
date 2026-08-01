'use client'

import * as React from 'react'
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react'

import { cn } from '@/lib/utils'

// AUDIT_UI_UX_CSS FORM-01: seven different upload contexts across the workspace each hand-rolled
// their own file picker - a generic text-input primitive with no file-selector styling in some
// (the "Choose File" screenshot bug), raw `file:*` Tailwind utilities with two different color
// dialects in others. This is the one shared component all of them should render instead.
//
// It stays compatible with this app's existing `<form action={serverAction}>` Server Action
// pattern - the real `<input type="file" name={name}>` is always present in the DOM (inside a
// <label htmlFor> wrapper, not JS-triggered), so native form submission and FormData just work.
// Client-side size/type validation is a fast first check; every existing server action still
// re-validates (defense in depth, same principle as src/lib/uploadValidation.ts).

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}

export type FileUploadProps = {
  id: string
  name: string
  accept?: string
  required?: boolean
  maxSizeBytes?: number
  helpText?: string
  /** URL of an already-uploaded file (editing an existing record). */
  existingPreviewUrl?: string | null
  existingLabel?: string
  /** Renders a "Remove current file" checkbox alongside the existing preview, posted as a plain
   * checkbox field the Server Action reads with `formData.get(removeFieldName) === 'on'`. */
  showRemoveOption?: boolean
  removeFieldName?: string
  /** 'image' shows a thumbnail preview; 'file' shows a filename chip with a generic icon - use for
   * non-image uploads (documentation PDFs/videos, spreadsheet imports). */
  variant?: 'image' | 'file'
  triggerLabel?: string
  className?: string
}

export const FileUpload = ({
  id,
  name,
  accept,
  required,
  maxSizeBytes,
  helpText,
  existingPreviewUrl,
  existingLabel = 'Current file',
  showRemoveOption = false,
  removeFieldName,
  variant = 'image',
  triggerLabel,
  className,
}: FileUploadProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [markedForRemoval, setMarkedForRemoval] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const acceptedTypePrefix = accept?.split(',')[0]?.trim().replace('/*', '')

  const applyFile = (file: File | null) => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      setObjectUrl(null)
    }

    if (!file) {
      setSelectedFile(null)
      setError(null)
      return
    }

    if (maxSizeBytes && file.size > maxSizeBytes) {
      setError(`File is larger than ${formatBytes(maxSizeBytes)}.`)
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (acceptedTypePrefix && !file.type.startsWith(acceptedTypePrefix) && accept !== undefined) {
      // Only enforce prefix-style accept values (e.g. "image/*") client-side - exact/extension
      // lists (".xlsx,.xls,...") are left to the server, which already validates them properly.
      if (accept.includes('*')) {
        setError(`That file type isn’t supported here.`)
        setSelectedFile(null)
        if (inputRef.current) inputRef.current.value = ''
        return
      }
    }

    setError(null)
    setMarkedForRemoval(false)
    setSelectedFile(file)
    if (variant === 'image') {
      setObjectUrl(URL.createObjectURL(file))
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    applyFile(event.target.files?.[0] || null)
  }

  const clearSelection = () => {
    applyFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file && inputRef.current) {
      const transfer = new DataTransfer()
      transfer.items.add(file)
      inputRef.current.files = transfer.files
      applyFile(file)
    }
  }

  const showingExisting = !selectedFile && existingPreviewUrl && !markedForRemoval

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-line bg-mist px-4 py-5 text-center transition-colors focus-within:border-green focus-within:ring-2 focus-within:ring-green/20 hover:border-green/60',
          isDragging && 'border-green bg-green/5',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required && !showingExisting}
          onChange={handleInputChange}
          className="sr-only"
        />

        {selectedFile ? (
          variant === 'image' && objectUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not a Payload asset */}
              <img src={objectUrl} alt="" className="h-24 w-24 rounded-card object-cover" />
              <p className="text-sm font-bold text-ink">{selectedFile.name}</p>
            </>
          ) : (
            <>
              <FileText className="h-8 w-8 text-green" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">{selectedFile.name}</p>
            </>
          )
        ) : showingExisting ? (
          <>
            {variant === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- Payload upload URL has runtime dimensions
              <img src={existingPreviewUrl!} alt="" className="h-24 w-24 rounded-card object-cover" />
            ) : (
              <FileText className="h-8 w-8 text-ink-soft" aria-hidden="true" />
            )}
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{existingLabel}</p>
          </>
        ) : (
          <>
            {variant === 'image' ? (
              <ImageIcon className="h-8 w-8 text-ink-soft" aria-hidden="true" />
            ) : (
              <Upload className="h-8 w-8 text-ink-soft" aria-hidden="true" />
            )}
            <p className="text-sm font-bold text-ink">
              {triggerLabel || (variant === 'image' ? 'Choose an image' : 'Choose a file')}
            </p>
          </>
        )}

        <p className="text-xs text-ink-soft">
          {helpText || (maxSizeBytes ? `Up to ${formatBytes(maxSizeBytes)}` : 'Click or drag a file here')}
        </p>

        {selectedFile || showingExisting ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              clearSelection()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                clearSelection()
              }
            }}
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-xs font-bold text-ink-soft transition-colors hover:border-green hover:text-ink"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {selectedFile ? 'Clear selection' : 'Choose a different file'}
          </span>
        ) : null}
      </label>

      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}

      {showRemoveOption && existingPreviewUrl && removeFieldName ? (
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name={removeFieldName}
            checked={markedForRemoval}
            onChange={(event) => {
              setMarkedForRemoval(event.target.checked)
              if (event.target.checked) clearSelection()
            }}
            className="h-4 w-4 rounded border-line text-green focus:ring-green/40"
          />
          Remove current {variant === 'image' ? 'image' : 'file'}
        </label>
      ) : null}
    </div>
  )
}
