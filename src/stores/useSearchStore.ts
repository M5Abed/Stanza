import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SearchState {
  history: string[]
  addSearchTerm: (term: string) => void
  removeSearchTerm: (term: string) => void
  clearHistory: () => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      history: [],
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
    }),
    {
      name: 'vibestream-search-history',
    }
  )
)
