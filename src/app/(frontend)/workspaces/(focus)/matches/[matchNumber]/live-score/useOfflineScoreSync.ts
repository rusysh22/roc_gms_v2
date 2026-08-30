'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { enqueuePoint, listPendingPoints, removePendingPoint, type QueuedPoint } from './offlineScoreQueue'

const RETRY_INTERVAL_MS = 15000

export type SyncedMatchOutcome = {
  decided: boolean
  winner_side: 'a' | 'b' | null
  sets_won_a: number
  sets_won_b: number
}

type OkBody = {
  ok: true
  participant_a_score: number
  participant_b_score: number
  set_winner_side?: 'a' | 'b' | null
  match_outcome?: SyncedMatchOutcome
}

type PostPointResult =
  | ({ kind: 'ok' } & OkBody)
  | { kind: 'network_error' }
  | { kind: 'rejected'; retryable: boolean }

const postPoint = async (item: QueuedPoint): Promise<PostPointResult> => {
  let response: Response
  try {
    response = await fetch('/api/live-score/point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        matchNumber: item.matchNumber,
        matchSetId: item.matchSetId,
        side: item.side,
        delta: item.delta,
      }),
    })
  } catch {
    return { kind: 'network_error' }
  }

  if (response.status === 401 || response.status === 403) {
    return { kind: 'rejected', retryable: true }
  }

  const body = (await response.json().catch(() => null)) as OkBody | { ok: false; error: string } | null

  if (!body) {
    return { kind: 'network_error' }
  }
  if (body.ok) {
    return { kind: 'ok', ...body }
  }
  return { kind: 'rejected', retryable: false }
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "offline scoring": drives LiveScoreControls' tap-to-sync
// loop. Every tap is enqueued in IndexedDB *before* the network attempt, so a hard reload or tab
// close mid-flight never loses a point. The queue is drained strictly in order (never in
// parallel) because the server clamps each delta to the ruleset's max_score, so replay order can
// change the final score near that cap.
export function useOfflineScoreSync(matchNumber: string) {
  const router = useRouter()
  const [pending, setPending] = useState<QueuedPoint[]>([])
  const [failed, setFailed] = useState<QueuedPoint[]>([])
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  // The server returns the authoritative post-tap score with every OK response; keep the latest per
  // set so the displayed number stays correct after a tap syncs (issue #1: it used to snap back to
  // the stale prop). `lastOutcome` carries the ruleset-derived match state for the "match complete"
  // prompt without waiting for a refresh.
  const [confirmed, setConfirmed] = useState<Record<string, { a: number; b: number }>>({})
  const [lastOutcome, setLastOutcome] = useState<SyncedMatchOutcome | null>(null)
  const flushingRef = useRef(false)

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    flushingRef.current = true
    setSyncing(true)
    let syncedAny = false
    try {
      // Re-read from IndexedDB at flush time rather than trusting the `pending` closure, so a
      // point enqueued by a fast double-tap during an in-flight flush is never skipped.
      let queue = await listPendingPoints(matchNumber)
      while (queue.length > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
        const item = queue[0]
        const result = await postPoint(item)

        if (result.kind === 'ok') {
          syncedAny = true
          setConfirmed((prev) => ({
            ...prev,
            [item.matchSetId]: { a: result.participant_a_score, b: result.participant_b_score },
          }))
          if (result.match_outcome) {
            setLastOutcome(result.match_outcome)
          }
          await removePendingPoint(item.id)
          queue = queue.slice(1)
          setPending(queue)
          continue
        }

        if (result.kind === 'rejected' && !result.retryable) {
          await removePendingPoint(item.id)
          queue = queue.slice(1)
          setPending(queue)
          setFailed((prev) => [...prev, item])
          continue
        }

        // network_error or a retryable rejection - stop here, keep this and everything after it
        // queued for the next flush.
        break
      }
    } finally {
      flushingRef.current = false
      setSyncing(false)
      // Once the queue is fully drained, pull a fresh server render so the side "Sets" list, match
      // status and Match-flow actions catch up. `confirmed` keeps the big score steady across it.
      const remaining = await listPendingPoints(matchNumber)
      if (syncedAny && remaining.length === 0) {
        router.refresh()
      }
    }
  }, [matchNumber, router])

  useEffect(() => {
    listPendingPoints(matchNumber).then(setPending)
    void flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchNumber])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void flush()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flush])

  useEffect(() => {
    if (pending.length === 0) return
    const interval = setInterval(() => void flush(), RETRY_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [pending.length, flush])

  const addPoint = useCallback(
    async (matchSetId: string, side: 'a' | 'b', delta: 1 | -1) => {
      const item = await enqueuePoint({ matchNumber, matchSetId, side, delta, createdAt: Date.now() })
      setPending((prev) => [...prev, item])
      void flush()
    },
    [matchNumber, flush],
  )

  const pendingDeltaForSet = useCallback(
    (matchSetId: string, side: 'a' | 'b') =>
      pending
        .filter((item) => item.matchSetId === matchSetId && item.side === side)
        .reduce((sum, item) => sum + item.delta, 0),
    [pending],
  )

  const confirmedScoreForSet = useCallback(
    (matchSetId: string, side: 'a' | 'b'): number | undefined => {
      const row = confirmed[matchSetId]
      return row ? row[side] : undefined
    },
    [confirmed],
  )

  const dismissFailed = useCallback(() => setFailed([]), [])

  return {
    isOnline,
    syncing,
    pendingCount: pending.length,
    failedCount: failed.length,
    addPoint,
    pendingDeltaForSet,
    confirmedScoreForSet,
    lastSyncOutcome: lastOutcome,
    dismissFailed,
  }
}
