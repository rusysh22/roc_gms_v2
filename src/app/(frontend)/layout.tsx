import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'

import { PublicChrome } from '@/components/public-chrome'
import { getCurrentPublicUser } from './getCurrentPublicUser'

import './styles.css'
import './tailwind.css'

// Self-hosted via next/font/google (D021), exposed as the `--font-jakarta-sans` CSS variable
// consumed by the `font-sans` Tailwind utility.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'InTourney',
  description: "InTourney - Hosting your Tournament's",
}

type Props = {
  children: ReactNode
}

export default async function FrontendLayout({ children }: Props) {
  const user = await getCurrentPublicUser()

  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body>
        <PublicChrome brand="InTourney" user={user}>
          {children}
        </PublicChrome>
      </body>
    </html>
  )
}
