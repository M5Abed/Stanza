import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePlayerStore, type QueueTrack } from './usePlayerStore'



interface RadioState {
  isRadioEnabled: boolean
  suggestions: QueueTrack[]
  isFetching: boolean
  
  toggleRadio: () => void
  setRadioEnabled: (enabled: boolean) => void
  fetchRecommendations: (youtubeId: string, append?: boolean, single?: boolean) => Promise<void>
  removeSuggestion: (index: number) => void
  clearSuggestions: () => void
}

export const useRadioStore = create<RadioState>()(
  persist(
    (set, get) => ({
      isRadioEnabled: false,
      suggestions: [],
      isFetching: false,

      toggleRadio: () => {
        const state = get()
        const newState = !state.isRadioEnabled
        set({ isRadioEnabled: newState })
        if (newState) {
          usePlayerStore.setState({ repeat: 'off' })
        }
      },
      setRadioEnabled: (e) => {
        const state = get()
        set({ isRadioEnabled: e })
        if (e) {
          usePlayerStore.setState({ repeat: 'off' })
        }
      },

      fetchRecommendations: async (youtubeId: string, append = false, single = false) => {
        set({ isFetching: true })
        try {
          const vs = window.vibestream
          if (!vs) throw new Error('Vibestream Preload missing')
          const recs = (await vs.getRadioRecommendations(youtubeId)) as QueueTrack[]
          if (recs && recs.length > 0) {
            set((state) => {
              const existingIds = new Set(state.suggestions.map(s => s.youtubeId))
              let uniqueRecs = recs.filter(r => !existingIds.has(r.youtubeId))
              
              if (single && uniqueRecs.length > 0) {
                uniqueRecs = [uniqueRecs[0]]
              }

              return {
                suggestions: append ? [...state.suggestions, ...uniqueRecs] : recs,
                isFetching: false
              }
            })
          } else {
            set({ isFetching: false })
          }
        } catch (e) {
          console.error('[Radio] failed to fetch recommendations', e)
          set((state) => ({ isFetching: false, suggestions: append ? state.suggestions : [] }))
        }
      },
      
      removeSuggestion: (index) => set((s) => ({
        suggestions: s.suggestions.filter((_, i) => i !== index)
      })),
      
      clearSuggestions: () => set({ suggestions: [] })
    }),
    {
      name: 'vibestream-radio-storage',
      partialize: (state) => ({
        isRadioEnabled: state.isRadioEnabled,
      }),
    }
  )
)
