'use client'

import * as React from 'react'
import { Check, Copy, Mail, Share2 } from 'lucide-react'
import { SiFacebook, SiThreads, SiWhatsapp, SiX } from 'react-icons/si'
import { BsMicrosoftTeams } from 'react-icons/bs'

import { cn } from '@/lib/utils'

export interface ShareButtonsProps {
  title: string
  description?: string
  url?: string
}

// Share targets per prd/README.md section 22 (WhatsApp, Teams, Email, browser native share, copy
// link) plus X/Threads/Facebook (added on request - icon-only row, not text buttons). Every network
// link uses its own documented public share-intent URL scheme - not an invented endpoint:
// wa.me, teams.microsoft.com/share, twitter.com/intent/tweet, threads.net/intent/post (Meta's
// official web intent, confirmed against their own announcement - both `text` and `url` params),
// facebook.com/sharer/sharer.php, mailto:. The page URL is read from window.location client-side
// rather than guessed/constructed on the server.
//
// Instagram has no public web share-intent for an arbitrary link (unlike every network above) -
// deliberately not included rather than shipping a button that can't actually do anything.
//
// Icons are brand logos (react-icons), not lucide's generic shapes, rendered as a white glyph on
// each brand's own color so the row reads as "share to X app" at a glance. Teams' logo comes from
// react-icons/bs (Bootstrap Icons) rather than /si (Simple Icons) - the installed simple-icons set
// (react-icons 5.7.0) has no Microsoft Teams icon at all, confirmed against the installed
// package's own type declarations rather than assumed from upstream docs.
const NETWORK_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 motion-reduce:transform-none'
const UTILITY_BUTTON_CLASS =
  'flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-ink-soft transition-colors hover:border-green hover:text-ink'
const ICON_SIZE = 'h-[18px] w-[18px]'

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className={cn(NETWORK_BUTTON_CLASS, 'bg-[#25D366]')}
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
      >
        <SiWhatsapp className={ICON_SIZE} aria-hidden="true" />
      </a>
      <a
        className={cn(NETWORK_BUTTON_CLASS, 'bg-[#6264A7]')}
        href={`https://teams.microsoft.com/share?href=${encodedUrl}&msgText=${encodedDescription}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on Microsoft Teams"
        title="Share on Microsoft Teams"
      >
        <BsMicrosoftTeams className={ICON_SIZE} aria-hidden="true" />
      </a>
      <a
        className={cn(NETWORK_BUTTON_CLASS, 'bg-black')}
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on X"
        title="Share on X"
      >
        <SiX className={ICON_SIZE} aria-hidden="true" />
      </a>
      <a
        className={cn(NETWORK_BUTTON_CLASS, 'bg-black')}
        href={`https://www.threads.net/intent/post?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on Threads"
        title="Share on Threads"
      >
        <SiThreads className={ICON_SIZE} aria-hidden="true" />
      </a>
      <a
        className={cn(NETWORK_BUTTON_CLASS, 'bg-[#1877F2]')}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on Facebook"
        title="Share on Facebook"
      >
        <SiFacebook className={ICON_SIZE} aria-hidden="true" />
      </a>
      <a
        className={UTILITY_BUTTON_CLASS}
        href={`mailto:?subject=${encodedText}&body=${encodedDescription}%0A%0A${encodedUrl}`}
        aria-label="Share by email"
        title="Share by email"
      >
        <Mail className={ICON_SIZE} aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className={UTILITY_BUTTON_CLASS}
        aria-label={copied ? 'Link copied' : 'Copy link'}
        title={copied ? 'Link copied' : 'Copy link'}
      >
        {copied ? <Check className={ICON_SIZE} aria-hidden="true" /> : <Copy className={ICON_SIZE} aria-hidden="true" />}
      </button>
      {canNativeShare ? (
        <button
          type="button"
          onClick={handleNativeShare}
          className={UTILITY_BUTTON_CLASS}
          aria-label="Share"
          title="Share"
        >
          <Share2 className={ICON_SIZE} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
