import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/usePlayerStore'

// Raw lucide-react SVGs optimized for simple rendering onto the DOM 1x1 offline canvas
const PLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
const PAUSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
const PREV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>`
const NEXT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`

function svgToPng(svgString: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 32, 32)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
  })
}

export function ThumbarManager() {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTrack = usePlayerStore((s) => s.queue[s.currentIndex])

  // Register SVGs as static offline canvases to map back to Electron NativeImage APIs
  useEffect(() => {
    if (!window.vibestream) return

    Promise.all([
      svgToPng(PLAY_SVG),
      svgToPng(PAUSE_SVG),
      svgToPng(PREV_SVG),
      svgToPng(NEXT_SVG),
    ]).then(([play, pause, prev, next]) => {
      window.vibestream?.registerThumbarIcons({ play, pause, prev, next })
      // Push first render
      window.vibestream?.updateThumbar({ isPlaying })
    })
  }, [])

  // Sync state
  useEffect(() => {
    if (window.vibestream) {
      window.vibestream.updateThumbar({ isPlaying })
    }
  }, [isPlaying, currentTrack])

  // Handle inbound bindings from Windows Taskbar Overlay
  useEffect(() => {
    if (!window.vibestream) return
    const cleanup = window.vibestream.onThumbarAction((action) => {
      const state = usePlayerStore.getState()
      if (action === 'togglePlay') state.toggle()
      if (action === 'prev') state.previous()
      if (action === 'next') state.next()
    })
    return cleanup
  }, [])

  return null
}
