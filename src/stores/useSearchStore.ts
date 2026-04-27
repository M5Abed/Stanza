import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SearchState {
  history: string[]
  /** Cached last search so results survive navigation */
  lastQuery: string
  lastTracks: any[]
  lastArtists: any[]
  addSearchTerm: (term: string) => void
  removeSearchTerm: (term: string) => void
  clearHistory: () => void
  setLastResults: (query: string, tracks: any[], artists: any[]) => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      history: [],
      lastQuery: '',
      lastTracks: [],
      lastArtists: [],
      addSearchTerm: (term) =>
        set((state) => {
          const trimmed = term.trim()
          if (!trimmed) return state
          
          // Remove if it already exists to move it to the front
          const newHistory = state.history.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())
          newHistory.unshift(trimmed)
          
          return { history: newHistory.slice(0, 20) } // Keep top 20 searches
        }),
      removeSearchTerm: (term) =>
        set((state) => ({
          history: state.history.filter((t) => t.toLowerCase() !== term.toLowerCase())
        })),
      clearHistory: () => set({ history: [] }),
      setLastResults: (query, tracks, artists) =>
        set({ lastQuery: query, lastTracks: tracks, lastArtists: artists }),
    }),
    {
      name: 'vibestream-search-history',
      partialize: (state) => ({
        history: state.history,
      }),
    }
  )
)
