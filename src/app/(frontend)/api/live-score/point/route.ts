import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { applyLiveScorePoint } from '../../../workspaces/matches/matchActions'
import { WORKSPACE_ROLES, getAuthenticatedWorkspaceUser, hasWorkspaceRole } from '../../../workspaces/workspaceAuth'

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "offline scoring": the JSON counterpart to the live-score
// point form action, called by the offline queue (useOfflineScoreSync.ts) instead of a <form> POST
// so it can be retried from a fetch() call without triggering a full-page navigation, and so the
// caller gets a real success/failure body instead of a redirect to follow. Auth here deliberately
// does NOT use assertWorkspaceActionAccess/redirect() - a redirect response to a JSON fetch() call
// would silently resolve as "success" with the login page's HTML as the body, hiding an
// unauthenticated/unauthorized state from the retry logic instead of surfacing it.
export async function POST(request: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthenticatedWorkspaceUser(payload)

  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  if (!hasWorkspaceRole(user, WORKSPACE_ROLES.matchOfficer)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const matchNumber = typeof body?.matchNumber === 'string' ? body.matchNumber : ''
  const matchSetId = typeof body?.matchSetId === 'string' ? body.matchSetId : ''
  const side = body?.side === 'a' || body?.side === 'b' ? body.side : null
  const delta = body?.delta === 1 || body?.delta === -1 ? body.delta : null

  if (!matchNumber || !matchSetId || !side || !delta) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }

  const result = await applyLiveScorePoint({
    payload,
    matchNumber,
    matchSetId,
    side,
    delta,
    user,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
