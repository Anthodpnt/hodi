import { useEffect, useState, useSyncExternalStore } from 'react'
import { type ResumeEntry, UnauthorizedError, getResume } from '../api.ts'
import { getReadings } from './reading-stats.ts'
import { changeUserState, sendPendingChanges, subscribeUserState } from './user-state.ts'

// "Reprendre": the articles started lately and left before their end. Taken off with the cross, they stay off.

// Taken off here, before the server has it: a fetch in between must not bring them back.
const setAside = new Set<string>()

export const setAsideResume = (id: string) => {
  setAside.add(id)
  changeUserState(state => state, { method: 'DELETE', path: `/resume/${encodeURIComponent(id)}` })
}

// Where to take an article up again, once its text shows: given by the card it is opened from.
let resumeAt: { id: string; position: number } | null = null

export const resumeFrom = (id: string, position: number) => {
  resumeAt = { id, position }
}

export const resumePositionOf = (id: string) => (resumeAt?.id === id ? resumeAt.position : null)

// Once used: opening the article again from elsewhere starts at its top.
export const forgetResumePosition = () => {
  resumeAt = null
}

// Fetched again whenever the reading stats change: an article left, finished, or opened on another device. The
// progress just measured goes first: asked before the server has it, the article left would not be there.
export const useResume = (onUnauthorized: () => void) => {
  const readings = useSyncExternalStore(subscribeUserState, getReadings)
  const [entries, setEntries] = useState<ResumeEntry[]>([])

  useEffect(() => {
    let current = true
    sendPendingChanges()
      .then(() => getResume())
      .then(({ items }) => current && setEntries(items))
      .catch((error: unknown) => {
        if (current && error instanceof UnauthorizedError) onUnauthorized()
      })
    return () => {
      current = false
    }
  }, [readings, onUnauthorized])

  return entries.filter(entry => !setAside.has(entry.item.id))
}
