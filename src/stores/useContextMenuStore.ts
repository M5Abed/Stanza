import { create } from 'zustand'
import { QueueTrack as Track } from './usePlayerStore'

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  track: Track | null
  openMenu: (e: React.MouseEvent, track: Track) => void
  closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  track: null,
  openMenu: (e, track) => {
    e.preventDefault()
    e.stopPropagation()
    set({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      track
    })
  },
  closeMenu: () => set({ isOpen: false, track: null })
}))
