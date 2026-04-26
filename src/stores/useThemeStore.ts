import { create } from 'zustand'

interface ThemeState {
  /** Dominant color extracted from current album art (hex string) */
  dominantColor: string
  /** Secondary color for gradients */
  secondaryColor: string
  /** Set from the current track's thumbnail */
  setColors: (dominant: string, secondary?: string) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  dominantColor: '#8B5CF6',
  secondaryColor: '#4C1D95',

  setColors: (dominant, secondary) =>
    set({
      dominantColor: dominant,
      secondaryColor: secondary ?? darken(dominant, 40),
    }),
}))

/** Simple hex color darkening utility */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
