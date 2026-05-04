import { create } from 'zustand'

interface AppVisibilityState {
  /** Whether the app window is currently visible (not minimized/hidden) */
  visible: boolean
  setVisible: (v: boolean) => void
}

export const useAppVisibilityStore = create<AppVisibilityState>((set) => ({
  visible: true,
  setVisible: (v) => set({ visible: v }),
}))

// Bootstrap: listen for main-process visibility events once
if (typeof window !== 'undefined') {
  const init = () => {
    window.vibestream?.onAppVisibilityChange?.((data) => {
      useAppVisibilityStore.getState().setVisible(data.visible)
    })
  }
  // Defer until vibestream is available
  if (window.vibestream) init()
  else window.addEventListener('DOMContentLoaded', init, { once: true })
}
