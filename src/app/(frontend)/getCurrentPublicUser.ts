import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'

export type PublicNavUser = {
  id: string | number
  email?: string | null
  name?: string | null
  roles?: string[] | null
}

// Used only to decide what the public nav's account area shows (name/role + logout) - separate
// from publicEditState.ts's canEdit check, since every authenticated user should see who they're
// logged in as here, not just the roles allowed to use the inline public-content editor.
export const getCurrentPublicUser = async (): Promise<PublicNavUser | null> => {
  const payload = await getPayload({ config })
  const headersList = await getHeaders()
  const { user } = await payload.auth({ headers: headersList })

  if (!user?.id) {
    return null
  }

  const typedUser = user as { id: string | number; email?: string | null; name?: string | null; roles?: string[] | null }
  return {
    id: typedUser.id,
    email: typedUser.email,
    name: typedUser.name,
    roles: typedUser.roles,
  }
}
