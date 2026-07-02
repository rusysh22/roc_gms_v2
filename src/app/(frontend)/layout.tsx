import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'

import './styles.css'
import './tailwind.css'

// Self-hosted via next/font/google (D021). Only exposed as the `--font-jakarta-sans` CSS
// variable on <html> for now - `styles.css` still sets `body { font-family: Inter, ... }`
// explicitly, so existing pages keep rendering unchanged until a later redesign phase opts in.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ROC GMS V2',
  description: 'ROC Game Management System V2 foundation',
}

type Props = {
  children: ReactNode
}

export default function FrontendLayout({ children }: Props) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  )
}
