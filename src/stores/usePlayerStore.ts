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
  history: QueueTrack[]
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
  /** Saved queue order before shuffle, so we can restore it */
  _preShuffleQueue: QueueTrack[] | null
  _preShuffleIndex: number
  /** Counts songs played — used for DJ transition trigger */
  songCounter: number

  playTrackNow: (track: QueueTrack, isAuto?: boolean) => void
  playQueueIndex: (index: number, isAuto?: boolean) => void
  loadPlaylist: (tracks: QueueTrack[], startIndex?: number, isAuto?: boolean) => void
  addToQueue: (track: QueueTrack) => void
  playNext: (track: QueueTrack) => void
  removeFromQueue: (index: number) => void
  reorderQueue: (startIndex: number, endIndex: number) => void
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

function addToHistory(history: QueueTrack[], track: QueueTrack): QueueTrack[] {
  const filtered = history.filter(t => t.youtubeId !== track.youtubeId)
  filtered.unshift(track)
  return filtered.slice(0, 50)
}

/** Fisher-Yates shuffle (in-place) */
function fisherYates<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
  queue: [],
  history: [],
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
  _preShuffleQueue: null,
  _preShuffleIndex: -1,
  songCounter: 0,


  playTrackNow: (track, isAuto = false) => {
    if (!isAuto) {
      useRadioStore.getState().clearSuggestions()
    }
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

    set((s) => ({
      queue: newQueue,
      currentIndex: newIdx,
      isPlaying: true,
      positionSec: 0,
      durationSec: track.durationSeconds ?? 0,
      error: null,
      pendingSeekSec: null,
      history: addToHistory(s.history, track),
      songCounter: s.songCounter + 1,
    }))
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

  playQueueIndex: (index, isAuto = false) => {
    if (!isAuto) {
      useRadioStore.getState().clearSuggestions()
    }
    const { queue } = get()
    if (index < 0 || index >= queue.length) return
    const t = queue[index]
    set((s) => ({
      currentIndex: index,
      isPlaying: true,
      positionSec: 0,
      durationSec: t.durationSeconds ?? 0,
      error: null,
      pendingSeekSec: null,
      history: addToHistory(s.history, t),
      songCounter: s.songCounter + 1,
    }))
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

  loadPlaylist: (tracks, startIndex = 0, isAuto = false) => {
    if (!isAuto) {
      useRadioStore.getState().clearSuggestions()
    }
    const { shuffle } = get()
    let finalQueue = tracks
    let finalIndex = startIndex

    if (shuffle && tracks.length > 1) {
      // Shuffle is active: keep the selected track at index 0, shuffle the rest
      const startTrack = tracks[startIndex]
      const rest = tracks.filter((_, i) => i !== startIndex)
      finalQueue = [startTrack, ...fisherYates([...rest])].filter(Boolean)
      finalIndex = 0
    }

    set((s) => ({
      queue: finalQueue,
      currentIndex: finalIndex,
      isPlaying: true,
      positionSec: 0,
      durationSec: tracks[startIndex]?.durationSeconds ?? 0,
      error: null,
      pendingSeekSec: null,
      history: tracks[startIndex] ? addToHistory(s.history, tracks[startIndex]) : s.history,
      // Update pre-shuffle state so unshuffle restores original order
      ...(shuffle && tracks.length > 1 ? {
        _preShuffleQueue: [...tracks],
        _preShuffleIndex: startIndex,
      } : {}),
    }))
    
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
    set((s) => {
      const q = [...s.queue, track]
      if (s.queue.length === 0) {
        return { queue: q, currentIndex: 0, isPlaying: true, positionSec: 0, durationSec: track.durationSeconds ?? 0 }
      }
      return { queue: q }
    })
  },

  playNext: (track) => {
    set((s) => {
      const q = [...s.queue]
      const nextIdx = s.currentIndex >= 0 ? s.currentIndex + 1 : q.length
      q.splice(nextIdx, 0, track)
      if (s.queue.length === 0) {
        return { queue: q, currentIndex: 0, isPlaying: true, positionSec: 0, durationSec: track.durationSeconds ?? 0 }
      }
      return { queue: q }
    })
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

  reorderQueue: (startIndex, endIndex) => {
    set((s) => {
      const q = [...s.queue]
      const [removed] = q.splice(startIndex, 1)
      q.splice(endIndex, 0, removed)

      let idx = s.currentIndex
      if (idx === startIndex) {
        idx = endIndex
      } else {
        if (idx > startIndex && idx <= endIndex) idx -= 1
        else if (idx < startIndex && idx >= endIndex) idx += 1
      }
      return { queue: q, currentIndex: idx }
    })
  },

  clearQueue: () => {
    const { queue, currentIndex } = get()
    const current = queue[currentIndex]
    if (current) {
      // Keep only the currently playing track
      set({ queue: [current], currentIndex: 0 })
    } else {
      set({
        queue: [],
        currentIndex: -1,
        isPlaying: false,
        positionSec: 0,
        durationSec: 0,
        error: null,
      })
    }
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentIndex, repeat } = get()
    if (queue.length === 0) return
    const nextIdx = currentIndex + 1
    if (nextIdx >= queue.length) {
      if (repeat === 'all') {
        if (get().shuffle && queue.length > 1) {
          // Re-shuffle the queue for a fresh random order on each loop
          const currentTrack = queue[currentIndex]
          const rest = queue.filter((_, i) => i !== currentIndex)
          const reshuffled = [currentTrack, ...fisherYates([...rest])].filter(Boolean)
          set({ queue: reshuffled, currentIndex: 0 })
        }
        get().playQueueIndex(0, true)
        return
      }
      
      // Always auto-play related songs when the queue ends
      const radioState = useRadioStore.getState()
      if (radioState.suggestions.length > 0) {
        const nextRadioTrack = radioState.suggestions[0]
        radioState.removeSuggestion(0)
        get().playTrackNow(nextRadioTrack, true)
        return
      }

      set({ isPlaying: false, positionSec: 0 })
      return
    }
    get().playQueueIndex(nextIdx, true)
  },

  previous: () => {
    const { queue, currentIndex, repeat } = get()
    if (queue.length === 0) return
    const prevIdx = currentIndex - 1
    if (prevIdx < 0) {
      if (repeat === 'all') {
        get().playQueueIndex(queue.length - 1, true)
        return
      }
      set({ isPlaying: false })
      return
    }
    get().playQueueIndex(prevIdx, true)
  },

  setVolume: (v) => set({ volume: clamp(v, 0, 1) }),
  requestSeek: (sec) => set({ pendingSeekSec: sec }),
  clearPendingSeek: () => set({ pendingSeekSec: null }),

  setShuffle: (v) => {
    const { queue, currentIndex } = get()
    if (v) {
      // Turning shuffle ON: save original order, then shuffle the queue
      // keeping the current track at index 0
      const currentTrack = queue[currentIndex]
      const rest = queue.filter((_, i) => i !== currentIndex)
      const shuffled = [currentTrack, ...fisherYates([...rest])].filter(Boolean)
      set({
        shuffle: true,
        _preShuffleQueue: [...queue],
        _preShuffleIndex: currentIndex,
        queue: shuffled,
        currentIndex: 0,
      })
    } else {
      // Turning shuffle OFF: restore original order
      const { _preShuffleQueue, _preShuffleIndex } = get()
      const currentTrack = queue[currentIndex]
      if (_preShuffleQueue && _preShuffleQueue.length > 0) {
        // Find where the current track was in the original order
        const origIdx = _preShuffleQueue.findIndex(t => t.youtubeId === currentTrack?.youtubeId)
        set({
          shuffle: false,
          queue: _preShuffleQueue,
          currentIndex: origIdx >= 0 ? origIdx : _preShuffleIndex,
          _preShuffleQueue: null,
          _preShuffleIndex: -1,
        })
      } else {
        set({ shuffle: false, _preShuffleQueue: null, _preShuffleIndex: -1 })
      }
    }
  },
  cycleRepeat: () =>
    set((s) => {
      const nextRepeat = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off'
      if (nextRepeat !== 'off') {
        useRadioStore.getState().setRadioEnabled(false)
      }
      return { repeat: nextRepeat }
    }),

  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg }),
  syncProgress: (pos, dur) => {
    const s = get()
    // Throttle: only commit a state update when position drifts ≥ 0.03s
    // This allows ~30 Hz updates for precise lyric stamping and smooth progress bars
    if (Math.abs(pos - s.positionSec) < 0.03 && (dur <= 0 || s.durationSec > 0)) return
    set({ positionSec: pos, durationSec: dur > 0 ? dur : s.durationSec })
  },
  setDurationFromMeta: (sec) => set({ durationSec: sec }),
    }),
    {
      name: 'vibestream-player-storage',
      partialize: (state) => ({
        queue: state.queue,
        history: state.history,
        currentIndex: state.currentIndex,
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        songCounter: state.songCounter,
      }),
    }
  )
)
