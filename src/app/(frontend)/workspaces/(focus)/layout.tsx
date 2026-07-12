import type { ReactNode } from 'react'

export default function WorkspaceFocusLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-mist font-sans text-ink">{children}</div>
}
