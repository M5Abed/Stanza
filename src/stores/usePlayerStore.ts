import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useRadioStore } from './useRadioStore'

export type RepeatMode = 'off' | 'all' | 'one'

export interface QueueTrack {
  youtubeId: string
  title: string
  artist: string | null
  album: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
}

export interface PlayerState {
  queue: QueueTrack[]
  currentIndex: number
  volume: number
  isPlaying: boolean
  positionSec: number
  durationSec: number
  shuffle: boolean
  repeat: RepeatMode
  isLoading: boolean
  error: string | null
  pendingSeekSec: number | null

  playTrackNow: (track: QueueTrack) => void
  playQueueIndex: (index: number) => void
  loadPlaylist: (tracks: QueueTrack[], startIndex?: number) => void
  addToQueue: (track: QueueTrack) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void

  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  previous: () => void

  setVolume: (v: number) => void
  requestSeek: (sec: number) => void
  clearPendingSeek: () => void

  setShuffle: (v: boolean) => void
  cycleRepeat: () => void

  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  syncProgress: (pos: number, dur: number) => void
  setDurationFromMeta: (sec: number) => void
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
  queue: [],
  currentIndex: -1,
  volume: 0.85,
  isPlaying: false,
  positionSec: 0,
  durationSec: 0,
  shuffle: false,
  repeat: 'off',
  isLoading: false,
  error: null,
  pendingSeekSec: null,

  playTrackNow: (track) => {
    const { queue, currentIndex } = get()
    let newQueue: QueueTrack[]
    let newIdx: number

    if (queue.length === 0) {
      // Empty queue — start fresh
      newQueue = [track]
      newIdx = 0
    } else {
      // Insert after current track and jump to it
      const insertAt = currentIndex + 1
      newQueue = [...queue.slice(0, insertAt), track, ...queue.slice(insertAt)]
      newIdx = insertAt
    }

    set({
      queue: newQueue,
      currentIndex: newIdx,
      isPlaying: true,
      positionSec: 0,
      durationSec: track.durationSeconds ?? 0,
      error: null,
      pendingSeekSec: null,
    })
    window.vibestream?.songUpsert({
      youtubeId: track.youtubeId,
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnailUrl: track.thumbnailUrl,
      durationSeconds: track.durationSeconds,
    }).then((upserted: any) => {
      if (upserted && upserted.thumbnailUrl && upserted.thumbnailUrl !== track.thumbnailUrl) {
        set((s) => {
          const q = [...s.queue]
          const idx = q.findIndex(t => t.youtubeId === track.youtubeId)
          if (idx !== -1) {
            q[idx] = { ...q[idx], thumbnailUrl: upserted.thumbnailUrl }
          }
          return { queue: q }
        })
      }
    })
  },

  playQueueIndex: (index) => {
    const { queue } = get()
    if (index < 0 || index >= queue.length) return
    const t = queue[index]
    set({
      currentIndex: index,
      isPlaying: true,
      positionSec: 0,
      durationSec: t.durationSeconds ?? 0,
      error: null,
      pendingSeekSec: null,
    })
    window.vibestream?.songUpsert({
      youtubeId: t.youtubeId,
      title: t.title,
      artist: t.artist,
      album: t.album,
      thumbnailUrl: t.thumbnailUrl,
      durationSeconds: t.durationSeconds,
    }).then((upserted: any) => {
      if (upserted && upserted.thumbnailUrl && upserted.thumbnailUrl !== t.thumbnailUrl) {
        set((s) => {
          const q = [...s.queue]
          const idx = q.findIndex(track => track.youtubeId === t.youtubeId)
          if (idx !== -1) {
            q[idx] = { ...q[idx], thumbnailUrl: upserted.thumbnailUrl }
          }
          return { queue: q }
        })
      }
    })
  },

  loadPlaylist: (tracks, startIndex = 0) => {
    set({
      queue: tracks,
      currentIndex: startIndex,
      isPlaying: true,
      positionSec: 0,
      durationSec: tracks[startIndex]?.durationSeconds ?? 0,
      error: null,
      pendingSeekSec: null,
    })
    
    // Automatically register the selected song object natively
    if (tracks[startIndex]) {
      const t = tracks[startIndex]
      window.vibestream?.songUpsert({
        youtubeId: t.youtubeId,
        title: t.title,
        artist: t.artist,
        album: t.album,
        thumbnailUrl: t.thumbnailUrl,
        durationSeconds: t.durationSeconds,
      }).then((upserted: any) => {
        if (upserted && upserted.thumbnailUrl && upserted.thumbnailUrl !== t.thumbnailUrl) {
          set((s) => {
            const q = [...s.queue]
            const idx = q.findIndex(track => track.youtubeId === t.youtubeId)
            if (idx !== -1) {
              q[idx] = { ...q[idx], thumbnailUrl: upserted.thumbnailUrl }
            }
            return { queue: q }
          })
        }
      })
    }
  },

  addToQueue: (track) => {
    set((s) => ({ queue: [...s.queue, track] }))
  },

  removeFromQueue: (index) => {
    set((s) => {
      const q = s.queue.filter((_, i) => i !== index)
      let idx = s.currentIndex
      if (index < idx) idx -= 1
      else if (index === idx) idx = clamp(idx, 0, Math.max(0, q.length - 1))
      if (q.length === 0) {
        return { queue: [], currentIndex: -1, isPlaying: false, positionSec: 0, durationSec: 0 }
      }
      idx = clamp(idx, 0, q.length - 1)
      return { queue: q, currentIndex: idx }
    })
  },

  clearQueue: () => {
    set({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      positionSec: 0,
      durationSec: 0,
      error: null,
    })
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentIndex, shuffle, repeat } = get()
    if (queue.length === 0) return
    let nextIdx: number
    if (shuffle && queue.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * queue.length)
      } while (nextIdx === currentIndex)
    } else {
      nextIdx = currentIndex + 1
    }
    if (nextIdx >= queue.length) {
      if (repeat === 'all') {
        get().playQueueIndex(0)
        return
      }
      
      // Always auto-play related songs when the queue ends
      const radioState = useRadioStore.getState()
      if (radioState.suggestions.length > 0) {
        const nextRadioTrack = radioState.suggestions[0]
        get().playTrackNow(nextRadioTrack)
        // Chain: fetch new genre-similar recommendations for the radio track
        useRadioStore.getState().fetchRecommendations(nextRadioTrack.youtubeId)
        return
      }

      set({ isPlaying: false, positionSec: 0 })
      return
    }
    get().playQueueIndex(nextIdx)
  },

  previous: () => {
    const { queue, currentIndex, shuffle, repeat } = get()
    if (queue.length === 0) return
    let prevIdx: number
    if (shuffle && queue.length > 1) {
      do {
        prevIdx = Math.floor(Math.random() * queue.length)
      } while (prevIdx === currentIndex)
    } else {
      prevIdx = currentIndex - 1
    }
    if (prevIdx < 0) {
      if (repeat === 'all') {
        get().playQueueIndex(queue.length - 1)
        return
      }
      set({ isPlaying: false })
      return
    }
    get().playQueueIndex(prevIdx)
  },

  setVolume: (v) => set({ volume: clamp(v, 0, 1) }),
  requestSeek: (sec) => set({ pendingSeekSec: sec }),
  clearPendingSeek: () => set({ pendingSeekSec: null }),

  setShuffle: (v) => set({ shuffle: v }),
  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    })),

  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),
  syncProgress: (pos, dur) => set({ positionSec: pos, durationSec: dur > 0 ? dur : get().durationSec }),
  setDurationFromMeta: (sec) => set({ durationSec: sec }),
    }),
    {
      name: 'vibestream-player-storage',
      partialize: (state) => ({
        queue: state.queue,
        currentIndex: state.currentIndex,
        volume: state.volume,
        repeat: state.repeat,
        shuffle: state.shuffle,
      }),
    }
  )
)
