import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePlayerStore, type QueueTrack } from './usePlayerStore'

function injectSuggestionsToQueue(suggestions: QueueTrack[]) {
  const playerStore = usePlayerStore.getState()
  const currentTrack = playerStore.queue[playerStore.currentIndex]
  if (currentTrack) {
    usePlayerStore.setState({
      queue: [currentTrack, ...suggestions],
      currentIndex: 0,
    })
  } else {
    playerStore.loadPlaylist(suggestions, 0)
  }
}

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
          if (state.suggestions.length > 0) {
            injectSuggestionsToQueue(state.suggestions)
          }
        }
      },
      setRadioEnabled: (e) => {
        const state = get()
        set({ isRadioEnabled: e })
        if (e) {
          usePlayerStore.setState({ repeat: 'off' })
          if (state.suggestions.length > 0) {
            injectSuggestionsToQueue(state.suggestions)
          }
        }
      },

      fetchRecommendations: async (youtubeId: string) => {
        set({ isFetching: true })
        try {
          const vs = window.vibestream
          if (!vs) throw new Error('Vibestream Preload missing')
          const recs = (await vs.getRadioRecommendations(youtubeId)) as QueueTrack[]
          if (recs && recs.length > 0) {
            set({ suggestions: recs, isFetching: false })
            const state = useRadioStore.getState()
            if (state.isRadioEnabled) {
              injectSuggestionsToQueue(recs)
            }
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
