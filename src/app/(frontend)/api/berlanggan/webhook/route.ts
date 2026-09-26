import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { getBerlangganWebhookConfig } from '@/lib/berlanggan/config'
import { processWebhookEvent } from '@/lib/berlanggan/processWebhookEvent'
import { WEBHOOK_SIGNATURE_HEADER, parseWebhookEvent, verifyWebhookSignature } from '@/lib/berlanggan/webhook'

export const dynamic = 'force-dynamic'

// Berlanggan (berlanggan.web.id) POSTs here, signed with the shared BERLANGGAN_WEBHOOK_SECRET,
// whenever a purchase is paid or a subscription changes billing state. This is the primary way an
// InTourney account's Event Management access turns on - no license key typing - with the
// /subscribe form kept only as a manual fallback. See src/lib/berlanggan/webhook.ts (verify +
// parse) and processWebhookEvent.ts (the Licenses / PendingLicenses writes).
//
// Response contract (Berlanggan retries until it gets a 2xx):
//   200  processed, or a structurally-fine event we deliberately don't act on (unknown type,
//        nothing matched) - either way, stop resending
//   401  bad/missing signature - stop, a wrong signature never becomes right on retry
//   400  signature OK but the body isn't valid JSON / is missing required fields - stop
//   404  BERLANGGAN_WEBHOOK_SECRET isn't configured on this deployment - auto-activation is off
//   500  transient failure on our side (DB, Berlanggan /v1/activate mid-call) - DO retry
export async function POST(request: NextRequest) {
  const webhookConfig = getBerlangganWebhookConfig()
  if (!webhookConfig) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 404 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get(WEBHOOK_SIGNATURE_HEADER)
  if (!verifyWebhookSignature(rawBody, signature, webhookConfig.webhookSecret)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const parsed = parseWebhookEvent(json)
  if (!parsed.ok) {
    if (parsed.reason === 'unknown_event') {
      return NextResponse.json({ ok: true, ignored: parsed.event }, { status: 200 })
    }
    return NextResponse.json({ ok: false, error: 'malformed_event' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    const result = await processWebhookEvent(payload, webhookConfig, parsed.event)
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[berlanggan-webhook] processing failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: 'processing_failed' }, { status: 500 })
  }
}
