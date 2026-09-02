import * as React from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils'

import iconSrc from '../../public/brand/icon.png'
import wordmarkSrc from '../../public/brand/wordmark.png'
import lockupSrc from '../../public/brand/lockup.png'

export type BrandLogoVariant = 'horizontal' | 'icon' | 'wordmark' | 'stacked'

export interface BrandLogoProps {
  /**
   * horizontal - icon + "InTourney" wordmark side by side (default, for nav bars / headers)
   * icon       - the "iT" mark on its own (compact / collapsed rails, avatars)
   * wordmark   - the "InTourney" wordmark on its own (footers, dense rows)
   * stacked    - the full lockup with the mark above the wordmark (splash / marketing)
   */
  variant?: BrandLogoVariant
  /** Rendered pixel height of the mark/wordmark. Width scales automatically. */
  height?: number
  className?: string
  priority?: boolean
}

const LABEL = 'InTourney'

export function BrandLogo({
  variant = 'horizontal',
  height = 24,
  className,
  priority,
}: BrandLogoProps) {
  if (variant === 'icon') {
    return (
      <Image
        src={iconSrc}
        alt={LABEL}
        height={height}
        width={Math.round((iconSrc.width / iconSrc.height) * height)}
        className={cn('w-auto', className)}
        priority={priority}
      />
    )
  }

  if (variant === 'wordmark') {
    return (
      <Image
        src={wordmarkSrc}
        alt={LABEL}
        height={height}
        width={Math.round((wordmarkSrc.width / wordmarkSrc.height) * height)}
        className={cn('w-auto', className)}
        priority={priority}
      />
    )
  }

  if (variant === 'stacked') {
    return (
      <Image
        src={lockupSrc}
        alt={LABEL}
        height={height}
        width={Math.round((lockupSrc.width / lockupSrc.height) * height)}
        className={cn('h-auto', className)}
        priority={priority}
      />
    )
  }

  // horizontal: the mark plus the wordmark, spaced as one lockup
  const iconH = height
  const wordmarkH = Math.round(height * 0.62)
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src={iconSrc}
        alt=""
        aria-hidden
        height={iconH}
        width={Math.round((iconSrc.width / iconSrc.height) * iconH)}
        className="w-auto"
        priority={priority}
      />
      <Image
        src={wordmarkSrc}
        alt={LABEL}
        height={wordmarkH}
        width={Math.round((wordmarkSrc.width / wordmarkSrc.height) * wordmarkH)}
        className="w-auto"
        priority={priority}
      />
    </span>
  )
}
