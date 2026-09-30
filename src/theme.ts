/**
 * Stanza Design Tokens & Theme Constants
 * Centralized theme definitions for cohesive UI aesthetics.
 */

export const themeTokens = {
  colors: {
    bg: '#0a0002',
    surface: '#140004',
    elevated: '#24000b',
    accent: '#d40021',
    accentHover: '#ff1a3c',
    accentGlow: 'rgba(212, 0, 33, 0.4)',
    textPrimary: '#f8f8f2',
    textSecondary: '#fecdd3',
    textMuted: '#9e7178',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.16)',
    glassBg: 'rgba(20, 0, 4, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
  },
  blur: {
    glass: '16px',
    panel: '32px',
  },
  radii: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
} as const

export type ThemeTokens = typeof themeTokens
