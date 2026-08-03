// NOVICE_ADMIN_FLOW_UX_REDESIGN.md 15.2 "offline scoring": a minimal IndexedDB-backed queue for
// point taps made while the live-score page has no connectivity. No dependency was added for this
// - a single object store with an auto-incrementing key is all a FIFO queue needs, and IndexedDB
// (unlike localStorage) survives a hard reload/tab close without a synchronous-blocking API.
// Queue items are applied via applyLiveScorePoint strictly in insertion order (see
// useOfflineScoreSync.ts) because the server-side delta is capped at the ruleset's max_score -
// replaying out of order can produce a different final score near that cap.

const DB_NAME = 'intourney-live-score'
const DB_VERSION = 1
const STORE_NAME = 'pending_points'

export type QueuedPoint = {
  id: number
  matchNumber: string
  matchSetId: string
  side: 'a' | 'b'
  delta: 1 | -1
  createdAt: number
}

export type QueuedPointInput = Omit<QueuedPoint, 'id'>

const isIndexedDbAvailable = () => typeof window !== 'undefined' && 'indexedDB' in window

const openDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const enqueuePoint = async (item: QueuedPointInput): Promise<QueuedPoint> => {
  if (!isIndexedDbAvailable()) {
    // No IndexedDB (very old browser/private-mode edge case) - fall back to an in-memory-only
    // item with a synthetic id. It can still be flushed immediately while online; it just won't
    // survive a reload while offline.
    return { ...item, id: Date.now() }
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(item)
    request.onsuccess = () => resolve({ ...item, id: request.result as number })
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export const listPendingPoints = async (matchNumber: string): Promise<QueuedPoint[]> => {
  if (!isIndexedDbAvailable()) {
    return []
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const all = (request.result as QueuedPoint[]) || []
      resolve(all.filter((item) => item.matchNumber === matchNumber).sort((a, b) => a.id - b.id))
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export const removePendingPoint = async (id: number): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}
