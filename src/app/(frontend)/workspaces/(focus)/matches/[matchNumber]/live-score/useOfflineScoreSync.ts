'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { enqueuePoint, listPendingPoints, removePendingPoint, type QueuedPoint } from './offlineScoreQueue'

const RETRY_INTERVAL_MS = 15000

type PostPointResult =
  | { kind: 'ok'; participant_a_score: number; participant_b_score: number }
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

  const body = (await response.json().catch(() => null)) as
    | { ok: true; participant_a_score: number; participant_b_score: number }
    | { ok: false; error: string }
    | null

  if (!body) {
    return { kind: 'network_error' }
  }
  if (body.ok) {
    return { kind: 'ok', participant_a_score: body.participant_a_score, participant_b_score: body.participant_b_score }
  }
  return { kind: 'rejected', retryable: false }
}

// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "offline scoring": drives LiveScoreControls' tap-to-sync
// loop. Every tap is enqueued in IndexedDB *before* the network attempt, so a hard reload or tab
// close mid-flight never loses a point. The queue is drained strictly in order (never in
// parallel) because the server clamps each delta to the ruleset's max_score, so replay order can
// change the final score near that cap.
export function useOfflineScoreSync(matchNumber: string) {
  const [pending, setPending] = useState<QueuedPoint[]>([])
  const [failed, setFailed] = useState<QueuedPoint[]>([])
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const flushingRef = useRef(false)

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    flushingRef.current = true
    setSyncing(true)
    try {
      // Re-read from IndexedDB at flush time rather than trusting the `pending` closure, so a
      // point enqueued by a fast double-tap during an in-flight flush is never skipped.
      let queue = await listPendingPoints(matchNumber)
      while (queue.length > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
        const item = queue[0]
        const result = await postPoint(item)

        if (result.kind === 'ok') {
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
    }
  }, [matchNumber])

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

  const dismissFailed = useCallback(() => setFailed([]), [])

  return {
    isOnline,
    syncing,
    pendingCount: pending.length,
    failedCount: failed.length,
    addPoint,
    pendingDeltaForSet,
    dismissFailed,
  }
}
