'use client'

import { RouteError } from '@/components/route-states'

// Nested inside (shell)'s own layout.tsx (WorkspaceShellChrome), so this only replaces the page
// content - the sidebar/header nav stays, letting the admin navigate away from the broken page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} />
}
