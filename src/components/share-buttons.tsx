'use client'

import * as React from 'react'
import { Check, Copy, Mail, Share2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface ShareButtonsProps {
  title: string
  description?: string
  url?: string
}

// Share targets per prd/README.md section 22: WhatsApp, Microsoft Teams, Email, browser native
// share, copy link. WhatsApp/Teams/mailto use their documented public share-intent URL schemes
// (wa.me, teams.microsoft.com/share, mailto:) - not invented endpoints. The page URL is read from
// window.location client-side rather than guessed/constructed on the server.
export function ShareButtons({ title, description, url: providedUrl }: ShareButtonsProps) {
  const [currentUrl, setCurrentUrl] = React.useState(providedUrl || '')
  const [copied, setCopied] = React.useState(false)
  const [canNativeShare, setCanNativeShare] = React.useState(false)

  React.useEffect(() => {
    if (!providedUrl) {
      setCurrentUrl(window.location.href)
    }
    setCanNativeShare(typeof navigator.share === 'function')
  }, [providedUrl])

  const handleCopy = async () => {
    if (!currentUrl) return
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be unavailable (older browser, insecure context) - nothing to recover.
    }
  }

  const handleNativeShare = async () => {
    if (!currentUrl) return
    try {
      await navigator.share({ title, text: description, url: currentUrl })
    } catch {
      // User cancelled the native share sheet, or it's unsupported - nothing to recover.
    }
  }

  const encodedText = encodeURIComponent(title)
  const encodedDescription = encodeURIComponent(description || title)
  const encodedUrl = encodeURIComponent(currentUrl)
  const linkClassName =
    'inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-green hover:text-ink'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className={linkClassName}
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
      <a
        className={linkClassName}
        href={`https://teams.microsoft.com/share?href=${encodedUrl}&msgText=${encodedDescription}`}
        target="_blank"
        rel="noreferrer"
      >
        Teams
      </a>
      <a
        className={linkClassName}
        href={`mailto:?subject=${encodedText}&body=${encodedDescription}%0A%0A${encodedUrl}`}
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Email
      </a>
      <button type="button" onClick={handleCopy} className={linkClassName}>
        {copied ?
          <Check className="h-4 w-4" aria-hidden="true" />
        : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
      {canNativeShare ?
        <Button type="button" size="sm" onClick={handleNativeShare}>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
      : null}
    </div>
  )
}
