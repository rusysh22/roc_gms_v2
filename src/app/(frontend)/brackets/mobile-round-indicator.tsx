'use client'

import { useEffect, useState } from 'react'

export function MobileRoundIndicator({ rounds }: { rounds: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0
        let maxIndex = activeIndex

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            maxIndex = Number(entry.target.getAttribute('data-round-index'))
          }
        })

        if (maxRatio > 0) {
          setActiveIndex(maxIndex)
        }
      },
      {
        root: document.getElementById('bracket-scroll-container'),
        threshold: [0.5, 0.75, 1],
      }
    )

    const headers = document.querySelectorAll('.bracket-round-header')
    headers.forEach((h) => observer.observe(h))

    return () => observer.disconnect()
  }, [activeIndex])

  if (rounds.length === 0) return null

  return (
    <div className="sticky left-0 right-0 top-14 z-40 flex justify-center pb-2 sm:hidden pointer-events-none">
      <div className="rounded-full bg-ink/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-paper shadow-md backdrop-blur">
        {rounds[activeIndex]} &middot; {activeIndex + 1}/{rounds.length}
      </div>
    </div>
  )
}
