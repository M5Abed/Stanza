import { useEffect, useState, useRef, useCallback } from 'react'
import { Pin, PinOff, X, GripHorizontal } from 'lucide-react'

interface LyricLine {
  time: number
  text: string
}

interface FloatingState {
  track: { title: string; artist: string; thumbnailUrl: string | null } | null
  lyrics: LyricLine[]
  position: number
  isPlaying: boolean
}

export function FloatingLyricsView() {
  const [state, setState] = useState<FloatingState>({
    track: null,
    lyrics: [],
    position: 0,
    isPlaying: false,
  })
  const [pinned, setPinned] = useState(true)
  const [activeIdx, setActiveIdx] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastAutoScroll = useRef(0)

  // Listen for lyrics state from main window
  useEffect(() => {
    const unsub = window.vibestream?.onFloatingLyricsState?.((data: FloatingState) => {
      setState(data)
    })
    return () => { unsub?.() }
  }, [])

  // Determine active line
  useEffect(() => {
    if (!state.lyrics.length) return
    let idx = -1
    for (let i = state.lyrics.length - 1; i >= 0; i--) {
      if (state.lyrics[i].time >= 0 && state.position >= state.lyrics[i].time) {
        idx = i
        break
      }
    }
    setActiveIdx(idx)
  }, [state.position, state.lyrics])

  // Auto-scroll to active line
  useEffect(() => {
    if (activeIdx < 0 || !scrollRef.current) return
    const now = Date.now()
    if (now - lastAutoScroll.current < 200) return
    lastAutoScroll.current = now

    const el = scrollRef.current.querySelector(`[data-line="${activeIdx}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIdx])

  const handleClose = useCallback(() => {
    window.vibestream?.closeFloatingLyrics()
  }, [])

  const handleTogglePin = useCallback(async () => {
    const result = await window.vibestream?.toggleFloatingLyricsPin()
    if (result) setPinned(result.pinned)
  }, [])

  return (
    <div className='h-screen w-screen flex flex-col overflow-hidden select-none'
      style={{
        background: 'rgba(15, 15, 15, 0.92)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Draggable Title Bar */}
      <div
        className='flex items-center justify-between px-4 py-2.5 shrink-0'
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className='flex items-center gap-2 min-w-0'>
          <GripHorizontal className='h-4 w-4 text-white/20 shrink-0' />
          <span className='text-xs font-semibold text-white/50 truncate uppercase tracking-wider'>Lyrics</span>
        </div>
        <div className='flex items-center gap-1' style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={handleTogglePin}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
              pinned ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
            title={pinned ? 'Unpin from top' : 'Pin to top'}
          >
            {pinned ? <Pin className='h-3.5 w-3.5' /> : <PinOff className='h-3.5 w-3.5' />}
          </button>
          <button
            onClick={handleClose}
            className='flex h-7 w-7 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all'
            title='Close'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* Track info */}
      {state.track && (
        <div className='px-4 pb-2 shrink-0'>
          <div className='text-sm font-bold text-white truncate'>{state.track.title}</div>
          <div className='text-xs text-white/50 truncate'>{state.track.artist}</div>
        </div>
      )}

      {/* Lyrics scroll area */}
      <div
        ref={scrollRef}
        className='flex-1 overflow-y-auto px-4 pb-6'
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {state.lyrics.length === 0 ? (
          <div className='flex h-full items-center justify-center'>
            <span className='text-white/30 text-sm'>
              {state.track ? 'No lyrics available' : 'Waiting for playback...'}
            </span>
          </div>
        ) : (
          <div className='flex flex-col gap-1 py-4'>
            {state.lyrics.map((line, idx) => (
              <div
                key={idx}
                data-line={idx}
                className={`py-1.5 px-2 rounded-lg text-sm font-medium leading-relaxed transition-all duration-300 ${
                  idx === activeIdx
                    ? 'text-white scale-[1.02] bg-white/5'
                    : idx < activeIdx
                      ? 'text-white/25'
                      : 'text-white/40'
                }`}
              >
                {line.text || '♪'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resize handle visual hint */}
      <div className='h-1 shrink-0 flex items-center justify-center'>
        <div className='w-8 h-0.5 rounded-full bg-white/10' />
      </div>
    </div>
  )
}
