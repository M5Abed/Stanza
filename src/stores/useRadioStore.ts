import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QueueTrack } from './usePlayerStore'

interface RadioState {
  isRadioEnabled: boolean
  suggestions: QueueTrack[]
  isFetching: boolean
  
  toggleRadio: () => void
  setRadioEnabled: (enabled: boolean) => void
  fetchRecommendations: (youtubeId: string) => Promise<void>
  clearSuggestions: () => void
}

export const useRadioStore = create<RadioState>()(
  persist(
    (set) => ({
      isRadioEnabled: false,
      suggestions: [],
      isFetching: false,

      toggleRadio: () => set((s) => ({ isRadioEnabled: !s.isRadioEnabled })),
      setRadioEnabled: (e) => set({ isRadioEnabled: e }),

      fetchRecommendations: async (youtubeId: string) => {
        set({ isFetching: true })
        try {
          const vs = window.vibestream
          if (!vs) throw new Error('Vibestream Preload missing')
          const recs = await vs.getRadioRecommendations(youtubeId)
          if (recs && recs.length > 0) {
            set({ suggestions: recs as QueueTrack[], isFetching: false })
          } else {
            set({ isFetching: false })
          }
        } catch (e) {
          console.error('[Radio] failed to fetch recommendations', e)
          set({ isFetching: false, suggestions: [] })
        }
      },
      
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
