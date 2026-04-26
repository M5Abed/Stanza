import { create } from 'zustand'

export type AppView = 'home' | 'search' | 'radio' | `playlist-${string}` | `album-${string}` | `artist-${string}` | `artist-songs-${string}`

interface UIState {
  activeView: AppView
  isMiniPlayer: boolean
  /** Navigation history stack */
  history: AppView[]
  /** Forward stack for redo */
  forwardStack: AppView[]
  setActiveView: (view: AppView) => void
  goBack: () => void
  goForward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  toggleMiniPlayer: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  activeView: 'home',
  isMiniPlayer: false,
  history: [],
  forwardStack: [],

  setActiveView: (view) => set((s) => {
    if (view === s.activeView) return s
    return {
      activeView: view,
      history: [...s.history, s.activeView],
      forwardStack: [], // clear forward on new navigation
    }
  }),

  goBack: () => set((s) => {
    if (s.history.length === 0) return s
    const prev = s.history[s.history.length - 1]
    return {
      activeView: prev,
      history: s.history.slice(0, -1),
      forwardStack: [s.activeView, ...s.forwardStack],
    }
  }),

  goForward: () => set((s) => {
    if (s.forwardStack.length === 0) return s
    const next = s.forwardStack[0]
    return {
      activeView: next,
      history: [...s.history, s.activeView],
      forwardStack: s.forwardStack.slice(1),
    }
  }),

  canGoBack: () => get().history.length > 0,
  canGoForward: () => get().forwardStack.length > 0,

  toggleMiniPlayer: () => set((s) => {
    const next = !s.isMiniPlayer
    window.vibestream?.setMiniPlayer?.(next)
    return { isMiniPlayer: next }
  }),
}))
