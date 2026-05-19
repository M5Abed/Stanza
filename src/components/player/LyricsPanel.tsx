import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Loader2,
  Mic2,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  Edit2,
  Save,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Share2,
  Download,
  Upload,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { motion } from 'framer-motion'
import { getDominantColor } from '@/utils/color'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { ArtistLinks } from '@/components/ui/ArtistLinks'

type LyricsSource = 'local' | 'lrclib' | 'genius' | 'none'

const Particles = React.memo(function Particles({ color, isPlaying }: { color: string; isPlaying: boolean }) {
  const [particles, setParticles] = useState<{id:number, x:number, y:number, s:number, d:number, delay:number}[]>([])
  
  useEffect(() => {
    setParticles(Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100 + 10,
      s: Math.random() * 4 + 2, // size
      d: Math.random() * 15 + 15, // duration
      delay: Math.random() * -20,
    })))
  }, [])

  return (
    <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden mix-blend-screen opacity-70'>
      {particles.map(p => (
        <motion.div
           key={p.id}
           className="absolute rounded-full"
           style={{ 
             width: p.s, 
             height: p.s, 
             left: `${p.x}%`, 
             top: `${p.y}%`, 
             backgroundColor: color, 
             boxShadow: `0 0 12px ${color}` 
           }}
           animate={isPlaying ? {
              y: ['0vh', '-110vh'],
              x: ['0px', '25px', '-15px', '0px'],
              opacity: [0, 0.8, 0.8, 0]
           } : undefined}
           transition={isPlaying ? {
              y: { duration: p.d, repeat: Infinity, ease: 'linear', delay: p.delay },
              x: { duration: p.d * 0.4, repeat: Infinity, ease: 'easeInOut', delay: p.delay },
              opacity: { duration: p.d, repeat: Infinity, ease: 'linear', delay: p.delay }
           } : { duration: 0 }}
        />
      ))}
    </div>
  )
})

function LyricsScroller({ 
  lines, 
  positionSec, 
  requestSeek,
  scrollContainer 
}: { 
  lines: { time: number; text: string }[]; 
  positionSec: number; 
  requestSeek: (sec: number) => void;
  scrollContainer: React.RefObject<HTMLDivElement>;
}) {
  // If no lines have valid timestamps, we can't sync.
  const isSynced = lines.some((l) => l.time >= 0)

  // Find active index based on timestamps
  let activeIndex = -1
  if (isSynced) {
    for (let i = 0; i < lines.length; i++) {
      // Small 0.2s offset to slightly anticipate line changes
      if (lines[i].time <= positionSec + 0.2) {
        activeIndex = i
      } else {
        break
      }
    }
  }

  const itemRefs = useRef<(HTMLParagraphElement | null)[]>([])

  useEffect(() => {
    if (activeIndex === -1 || !scrollContainer.current) return
    const el = itemRefs.current[activeIndex]
    if (!el) return

    const container = scrollContainer.current

    // Center active line roughly 35% from the top (parallel with the album cover)
    const targetScroll = el.offsetTop - (container.clientHeight * 0.35) + (el.clientHeight / 2)
    
    container.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }, [activeIndex, scrollContainer])

  return (
    <div className='flex flex-col gap-8 text-right px-8 md:px-16 w-full max-w-4xl ml-auto select-none'>
      {lines.map((line, idx) => {
        const isActive = isSynced && idx === activeIndex
        const isPast = isSynced && idx < activeIndex

        return (
          <motion.p
            key={idx}
            ref={(el) => (itemRefs.current[idx] = el as any)}
            layout
            initial={false}
            animate={{
              scale: isActive ? 1.05 : 1,
              opacity: isPast ? 0.6 : 1,
              color: !isSynced ? '#ffffff' : isActive ? '#ffffff' : '#b3b3b3',
              textShadow: isActive ? '0px 0px 15px rgba(255,255,255,0.4)' : '0px 0px 0px rgba(255,255,255,0)',
            }}
            onClick={() => { if (isSynced && line.time >= 0) requestSeek(line.time) }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              mass: 0.8
            }}
            className={`text-4xl md:text-[3.25rem] font-bold leading-[1.4] tracking-tight origin-right transition-colors cursor-pointer hover:text-white ${line.text.trim() ? '' : 'h-8 md:h-12'}`}
            dir='auto'
          >
            {line.text}
          </motion.p>
        )
      })}
    </div>
  )
}

const EditorLine = React.memo(function EditorLine({
  idx,
  line,
  isActive,
  removeLine,
  updateLineTime,
  requestSeek,
  play,
  stampLine,
  updateLineText,
  addLineAfter,
  setActiveLineIdx
}: {
  idx: number
  line: { time: number; text: string }
  isActive: boolean
  removeLine: (idx: number) => void
  updateLineTime: (idx: number, newTime: number) => void
  requestSeek: (sec: number) => void
  play: () => void
  stampLine: (idx: number) => void
  updateLineText: (idx: number, newText: string) => void
  addLineAfter: (idx: number) => void
  setActiveLineIdx: (idx: number) => void
}) {
  const ts = line.time >= 0
    ? `${Math.floor(line.time / 60).toString().padStart(2, '0')}:${(line.time % 60).toFixed(2).padStart(5, '0')}`
    : '--:--.--'

  return (
    <div
      data-line-idx={idx}
      onClick={() => setActiveLineIdx(idx)}
      className={`group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all cursor-pointer ${
        isActive
          ? 'bg-blue-500/10 ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); removeLine(idx) }}
        className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all ${
          isActive
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100'
        }`}
        title='Remove line'
      >
        <X className='h-4 w-4' />
      </button>

      {/* Time controls */}
      <div className='shrink-0 flex items-center gap-1'>
        <button
          onClick={(e) => { e.stopPropagation(); if (line.time >= 0) { const nt = Math.max(0, line.time - 5); updateLineTime(idx, nt); requestSeek(nt); play() } }}
          className='w-10 h-10 flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 rounded transition-all text-xl font-bold'
          title='-5s'
        >
          «
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (line.time >= 0) { const nt = Math.max(0, line.time - 0.5); updateLineTime(idx, nt); requestSeek(nt); play() } }}
          className='w-10 h-10 flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 rounded transition-all text-2xl font-light'
          title='-0.5s'
        >
          ‹
        </button>

        {/* Timestamp display / stamp button */}
        <button
          onClick={(e) => { e.stopPropagation(); stampLine(idx) }}
          className={`min-w-[90px] h-9 flex items-center justify-center rounded-md font-mono text-sm font-semibold transition-all ${
            isActive
              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              : line.time >= 0
                ? 'bg-white/5 text-white/50 hover:text-white/80'
                : 'bg-white/5 text-white/20 hover:text-white/50'
          }`}
          title='Stamp current time'
        >
          {ts}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); if (line.time >= 0) { const nt = Math.max(0, line.time + 0.5); updateLineTime(idx, nt); requestSeek(nt); play() } }}
          className='w-10 h-10 flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 rounded transition-all text-2xl font-light'
          title='+0.5s'
        >
          ›
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (line.time >= 0) { const nt = Math.max(0, line.time + 5); updateLineTime(idx, nt); requestSeek(nt); play() } }}
          className='w-10 h-10 flex items-center justify-center text-white/40 hover:text-white/90 hover:bg-white/10 rounded transition-all text-xl font-bold'
          title='+5s'
        >
          »
        </button>
      </div>

      {/* Play from here */}
      <button
        onClick={(e) => { e.stopPropagation(); if (line.time >= 0) requestSeek(line.time) }}
        className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all ${
          line.time >= 0
            ? 'text-white/40 hover:text-white hover:bg-white/10'
            : 'text-white/10 cursor-default'
        }`}
        title='Play from here'
        disabled={line.time < 0}
      >
        <Play className='h-4 w-4 fill-current' />
      </button>

      {/* Lyrics text — editable */}
      <input
        type='text'
        value={line.text}
        onChange={(e) => updateLineText(idx, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addLineAfter(idx)
          }
        }}
        className={`flex-1 bg-transparent border-none outline-none text-lg font-medium transition-colors select-text cursor-text ${
          isActive ? 'text-white' : 'text-white/60'
        }`}
        placeholder='Type lyrics here...'
        dir='auto'
      />
    </div>
  )
})


function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LyricsPanel() {
  const current = usePlayerStore((s) =>
    s.currentIndex >= 0 && s.currentIndex < s.queue.length ? s.queue[s.currentIndex] : null,
  )
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const toggle = usePlayerStore((s) => s.toggle)
  const play = usePlayerStore((s) => s.play)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const requestSeek = usePlayerStore((s) => s.requestSeek)
  const positionSecRaw = usePlayerStore((s) => s.positionSec)
  // Local position state for editor transport bar — updated via interval below, not store subscription
  const [editorPos, setEditorPos] = useState(0)
  const durationSec = usePlayerStore((s) => s.durationSec)
  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)

  const shuffle = usePlayerStore((s) => s.shuffle)
  const repeat = usePlayerStore((s) => s.repeat)
  const setShuffle = usePlayerStore((s) => s.setShuffle)
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat)

  const dur = useMemo(() => (durationSec > 0 ? durationSec : current?.durationSeconds ?? 0), [current?.durationSeconds, durationSec])

  const [lyricsData, setLyricsData] = useState<{ time: number; text: string }[] | null>(null)
  const [source, setSource] = useState<LyricsSource>('none')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dominantColor, setDominantColor] = useState('#8B5CF6')

  const [dragPos, setDragPos] = useState<number | null>(null)

  // Lyrics editor state
  const [isEditing, setIsEditing] = useState(false)
  const [editorLines, setEditorLines] = useState<{ time: number; text: string }[]>([])
  const [activeLineIdx, setActiveLineIdx] = useState(0)
  const [editorTrackId, setEditorTrackId] = useState<string | null>(null) // locked to the song being edited
  const editorScrollRef = useRef<HTMLDivElement>(null)

  // Poll positionSec at 4Hz while editing instead of subscribing to the 30Hz store updates.
  // This prevents the entire editor (hundreds of EditorLine components) from re-rendering every 33ms.
  useEffect(() => {
    if (!isEditing || !visible) return
    const id = setInterval(() => {
      setEditorPos(usePlayerStore.getState().positionSec)
    }, 250)
    return () => clearInterval(id)
  }, [isEditing, visible])
  const positionSec = isEditing ? editorPos : positionSecRaw
  const displayPos = dragPos !== null ? dragPos : positionSec

  // Track last manual interaction to gate auto-sync (avoids fighting with rapid stamping)
  const lastManualInteraction = useRef<number>(0)

  // Share dropdown state
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [copiedFeedback, setCopiedFeedback] = useState(false)
  const shareMenuRef = useRef<HTMLDivElement>(null)

  // Floating lyrics window
  const [floatingOpen, setFloatingOpen] = useState(false)

  // Relay lyrics state to floating window
  useEffect(() => {
    if (!floatingOpen || !window.vibestream) return
    const interval = setInterval(() => {
      const ps = usePlayerStore.getState()
      window.vibestream!.sendFloatingLyricsState({
        track: current ? { title: current.title, artist: current.artist ?? 'Unknown', thumbnailUrl: current.thumbnailUrl } : null,
        lyrics: lyricsData ?? [],
        position: ps.positionSec,
        isPlaying: ps.isPlaying,
      })
    }, 200)
    return () => clearInterval(interval)
  }, [floatingOpen, current?.youtubeId, lyricsData])

  // Listen for floating window closure
  useEffect(() => {
    const unsub = window.vibestream?.onFloatingLyricsClosed?.(() => {
      setFloatingOpen(false)
    })
    return () => { unsub?.() }
  }, [])

  // Close share menu on outside click
  useEffect(() => {
    if (!showShareMenu) return
    const handler = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showShareMenu])




  /** Parse LRC text into structured lines */
  const parseLrcToLines = (lrc: string): { time: number; text: string }[] => {
    return lrc.split('\n').filter(l => l.trim()).map(line => {
      const match = /^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/.exec(line)
      if (match) {
        const mins = parseInt(match[1], 10)
        const secs = parseFloat(match[2])
        return { time: mins * 60 + secs, text: match[3] }
      }
      return { time: -1, text: line.replace(/^\[.*?\]/, '') }
    })
  }

  /** Convert structured lines back to LRC text */
  const linesToLrc = (lines: { time: number; text: string }[]): string => {
    return lines.map(l => {
      if (l.time >= 0) {
        const m = Math.floor(l.time / 60).toString().padStart(2, '0')
        const s = (l.time % 60).toFixed(2).padStart(5, '0')
        return `[${m}:${s}]${l.text}`
      }
      return l.text
    }).join('\n')
  }

  /** Update a single line's timestamp */
  const updateLineTime = useCallback((idx: number, newTime: number) => {
    lastManualInteraction.current = Date.now()
    setEditorLines(prev => prev.map((l, i) => i === idx ? { ...l, time: Math.max(0, newTime) } : l))
  }, [])

  /** Update a single line's text */
  const updateLineText = useCallback((idx: number, newText: string) => {
    setEditorLines(prev => prev.map((l, i) => i === idx ? { ...l, text: newText } : l))
  }, [])

  /** Remove a line */
  const removeLine = useCallback((idx: number) => {
    lastManualInteraction.current = Date.now()
    setEditorLines(prev => prev.filter((_, i) => i !== idx))
    setActiveLineIdx(prev => (prev >= idx && prev > 0 ? prev - 1 : prev))
  }, [])

  /** Wrapper for manually setting active line — records interaction timestamp */
  const manualSetActiveLineIdx = useCallback((idx: number) => {
    lastManualInteraction.current = Date.now()
    setActiveLineIdx(idx)
  }, [])

  /** Add a new line after index */
  const addLineAfter = useCallback((idx: number) => {
    lastManualInteraction.current = Date.now()
    const pos = usePlayerStore.getState().positionSec
    setEditorLines(prev => {
      const next = [...prev]
      next.splice(idx + 1, 0, { time: pos, text: '' })
      return next
    })
    setActiveLineIdx(idx + 1)
  }, [])

  /** Stamp current playback time onto a line */
  const stampLine = useCallback((idx: number) => {
    lastManualInteraction.current = Date.now()
    const pos = usePlayerStore.getState().positionSec
    setEditorLines(prev => prev.map((l, i) => i === idx ? { ...l, time: Math.max(0, pos) } : l))
    setActiveLineIdx(idx)
  }, [])

  /** Scroll active line into view */
  useEffect(() => {
    if (!isEditing) return
    const el = editorScrollRef.current?.querySelector(`[data-line-idx="${activeLineIdx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeLineIdx, isEditing])

  // Auto-sync the editor's blue highlight with playback position.
  // Uses a polling interval + 2-second cooldown after manual interaction.
  // This avoids depending on the reactive positionSec which would re-render the whole editor at 30Hz.
  useEffect(() => {
    if (!isEditing || editorLines.length === 0) return
    const id = setInterval(() => {
      // Skip if user interacted manually within the last 2 seconds
      if (Date.now() - lastManualInteraction.current < 2000) return
      const pos = usePlayerStore.getState().positionSec
      // Find the editor line whose timestamp best matches the current playback position
      let bestIdx = -1
      for (let i = 0; i < editorLines.length; i++) {
        if (editorLines[i].time >= 0 && editorLines[i].time <= pos + 0.2) {
          bestIdx = i
        } else if (editorLines[i].time > pos + 0.2) {
          break
        }
      }
      if (bestIdx >= 0) {
        setActiveLineIdx(prev => prev !== bestIdx ? bestIdx : prev)
      }
    }, 166) // Poll at 6Hz for responsive highlight sync
    return () => clearInterval(id)
  }, [isEditing, editorLines])

  // Reference for the lyrics scrolling container
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (current?.thumbnailUrl) {
      getDominantColor(current.thumbnailUrl).then(setDominantColor)
    }
  }, [current?.thumbnailUrl])

  const fetchLyrics = useCallback(async () => {
    if (!current || !window.vibestream) return
    setLoading(true)
    setLyricsData(null)
    setSource('none')
    try {
      const result = await window.vibestream.getLyrics({
        youtubeId: current.youtubeId,
        title: current.title,
        artist: current.artist,
      })

      setSource(result.source as LyricsSource)

      if (result.lrcRaw) {
        // Parse LRC timestamps
        const lines = result.lrcRaw.split('\n')
        const parsed = lines.map((line) => {
          const match = /^\[(\d{2,}):(\d{2}(?:\.\d{2,3})?)\](.*)/.exec(line)
          if (match) {
            const minutes = parseInt(match[1], 10)
            const seconds = parseFloat(match[2])
            return {
              time: minutes * 60 + seconds,
              text: match[3].trim(),
            }
          }
          // Fallback for lines without timestamp
          return { time: -1, text: line.replace(/^\[[\d:.]+\]\s*/, '').trim() }
        }).filter((l) => l.text || l.time !== -1)

        setLyricsData(parsed.length > 0 ? parsed : null)
      } else {
        setLyricsData(null)
      }
    } catch (e) {
      console.error('[lyrics]', e)
      setLyricsData(null)
    } finally {
      setLoading(false)
    }
  }, [current?.youtubeId, current?.title, current?.artist])

  useEffect(() => {
    if ((visible || floatingOpen) && current) {
      // Reset scroll to top immediately for the new song
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0
      }
      void fetchLyrics()
    }
  }, [visible, floatingOpen, current?.youtubeId, fetchLyrics])

  /** Copy LRC text to clipboard */
  const handleCopyLyrics = useCallback(async () => {
    const lrc = lyricsData ? lyricsData.map(l => {
      if (l.time >= 0) {
        const m = Math.floor(l.time / 60).toString().padStart(2, '0')
        const s = (l.time % 60).toFixed(2).padStart(5, '0')
        return `[${m}:${s}]${l.text}`
      }
      return l.text
    }).join('\n') : ''
    if (!lrc) return
    await navigator.clipboard.writeText(lrc)
    setCopiedFeedback(true)
    setTimeout(() => setCopiedFeedback(false), 2000)
    setShowShareMenu(false)
  }, [lyricsData])

  /** Export lyrics as .lrc file */
  const handleExportLyrics = useCallback(async () => {
    const lrc = lyricsData ? lyricsData.map(l => {
      if (l.time >= 0) {
        const m = Math.floor(l.time / 60).toString().padStart(2, '0')
        const s = (l.time % 60).toFixed(2).padStart(5, '0')
        return `[${m}:${s}]${l.text}`
      }
      return l.text
    }).join('\n') : ''
    if (!lrc || !window.vibestream) return
    const name = `${current?.artist ?? 'Unknown'} - ${current?.title ?? 'Unknown'}.lrc`
    await window.vibestream.exportLyrics(lrc, name)
    setShowShareMenu(false)
  }, [lyricsData, current?.artist, current?.title])

  /** Import lyrics from .lrc file */
  const handleImportLyrics = useCallback(async () => {
    if (!window.vibestream || !current) return
    try {
      const result = await window.vibestream.importLyrics()
      if (result.ok && result.lrcRaw) {
        // Ensure the song exists in DB first (required for ManualLyrics FK)
        try {
          await window.vibestream.songUpsert({
            youtubeId: current.youtubeId,
            title: current.title,
            artist: current.artist ?? null,
            album: current.album ?? null,
            thumbnailUrl: current.thumbnailUrl ?? null,
            durationSeconds: current.durationSeconds != null ? Math.round(current.durationSeconds) : null,
          })
        } catch (e) {
          console.warn('[lyrics:import] songUpsert failed:', e)
        }
        // Save lyrics to DB
        try {
          await window.vibestream.saveManualLyrics(current.youtubeId, result.lrcRaw)
        } catch (e) {
          console.error('[lyrics:import] saveManualLyrics failed:', e)
        }
        // Re-fetch lyrics from DB (aggregator checks ManualLyrics first, evicts stale cache)
        await fetchLyrics()
      }
    } catch (e) {
      console.error('[lyrics:import] Import failed:', e)
    } finally {
      // Restore fullscreen (native dialog forces exit on Windows)
      if (visible) {
        window.vibestream?.setFullscreen(true).catch(() => {})
      }
    }
  }, [current, visible, fetchLyrics])

  // Handle OS Fullscreen Request
  useEffect(() => {
    if (visible && window.vibestream) {
      window.vibestream.setFullscreen(true).catch(() => {})
    } else if (window.vibestream) {
      window.vibestream.setFullscreen(false).catch(() => {})
    }
    return () => {
      if (window.vibestream) {
        window.vibestream.setFullscreen(false).catch(() => {})
      }
    }
  }, [visible])

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    requestSeek(Number(e.target.value))
  }

  const panel = (
    <div className='fixed inset-0 z-[9999] flex overflow-hidden bg-[#121212]'>
      {/* Blurred Album Art Background */}
      {!isEditing && current?.thumbnailUrl && (
        <div 
          className='absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 blur-[100px] saturate-200'
          style={{ backgroundImage: `url(${getHighResUrl(current.thumbnailUrl)})` }}
        />
      )}
      {!isEditing && <div className='absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/80 to-[#121212]/40' />}

      {!isEditing && <Particles color={dominantColor} isPlaying={isPlaying} />}

      {/* Close Button */}
      <button
        type='button'
        onClick={() => {
          setVisible(false)
          setIsEditing(false)
          setEditorTrackId(null)
        }}
        className='absolute top-8 right-8 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/80 hover:scale-105 transition-all'
      >
        <X className='h-6 w-6' />
      </button>

      {/* Main Layout - Top aligned two columns */}
      {!isEditing && (
        <div className='relative z-10 flex h-full w-full'>
        
        {/* Left Column: Player Info & Controls */}
        <div className='flex w-[40%] flex-col justify-center items-center px-16'>
          <div className='group relative aspect-square w-full max-w-[360px] shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-black bg-[#282828]'>
            {/* Fallback placeholder (always rendered behind) */}
            <div className='absolute inset-0 flex items-center justify-center text-4xl text-[#a7a7a7] z-0'>♪</div>
            
            {/* Foreground image */}
            {current?.thumbnailUrl && (
              <img 
                src={getHighResUrl(current.thumbnailUrl)} 
                alt='' 
                className='absolute inset-0 h-full w-full object-cover z-10' 
                onError={(e) => handleImgError(e)} 
                onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block' }}
              />
            )}
          </div>
          
          <div className='mt-10 flex flex-col items-center text-center'>
            <h2 className='text-3xl font-bold text-white line-clamp-2'>{current?.title ?? 'Nothing playing'}</h2>
            <div className='mt-2 flex items-center gap-3'>
              <span className='text-xl font-medium text-[#b3b3b3] truncate'>
                {current?.artist ? <ArtistLinks artist={current.artist} linkClassName='text-[#b3b3b3]' /> : 'Unknown Artist'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className='mt-10 flex w-full max-w-[400px] flex-col gap-3'>
            <div className='group relative flex h-2 w-full items-center'>
              <input
                type='range'
                min={0}
                max={dur > 0 ? dur : 100}
                step={0.1}
                value={displayPos}
                onPointerDown={() => setDragPos(positionSec)}
                onPointerUp={(e) => {
                  requestSeek(Number(e.currentTarget.value))
                  setDragPos(null)
                }}
                onChange={(e) => setDragPos(Number(e.target.value))}
                className='absolute inset-0 h-full w-full opacity-0 hover:cursor-pointer z-10'
              />
              <div className='absolute h-1.5 w-full rounded-full bg-white/20' />
              <div
                className='absolute h-1.5 rounded-full transition-colors bg-yellow-400'
                style={{ width: `${dur > 0 ? (Math.min(displayPos, dur) / dur) * 100 : 0}%` }}
              />
              <div
                className='absolute h-3.5 w-3.5 -ml-1.5 rounded-full bg-white opacity-0 shadow hover:opacity-100 transition-opacity'
                style={{ left: `${dur > 0 ? (Math.min(displayPos, dur) / dur) * 100 : 0}%` }}
              />
            </div>
            <div className='flex justify-between text-sm font-bold text-yellow-400 tracking-wider'>
              <span>{fmt(displayPos)}</span>
              <span>{fmt(dur)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className='mt-8 flex w-full max-w-[400px] items-center justify-between'>
            {/* Left: Repeat */}
            <button
              type='button'
              onClick={cycleRepeat}
              className={`transition-all hover:scale-110 ${repeat === 'off' ? 'text-theme-subtext hover:text-white' : 'text-theme-accent drop-shadow-[0_0_8px_rgba(212,0,33,0.5)]'}`}
              title={`Repeat: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 className='h-6 w-6' /> : <Repeat className='h-6 w-6' />}
            </button>

            {/* Center: Playback */}
            <div className='flex items-center gap-6'>
              <button onClick={() => previous()} className='text-white hover:scale-110 transition-transform'>
                <SkipBack className='h-10 w-10 fill-current' />
              </button>
              <button
                onClick={toggle}
                className='flex h-14 w-14 items-center justify-center text-white hover:scale-110 transition-transform'
              >
                {isPlaying ? <Pause className='h-12 w-12 fill-current' /> : <Play className='h-12 w-12 ml-1 fill-current' />}
              </button>
              <button onClick={() => next()} className='text-white hover:scale-110 transition-transform'>
                <SkipForward className='h-10 w-10 fill-current' />
              </button>
            </div>

            {/* Right: Volume Expandable Slider */}
            <div className='group relative flex items-center justify-start w-6 overflow-hidden transition-[width] duration-300 hover:w-28'>
              <Volume2 className='h-6 w-6 shrink-0 text-theme-subtext transition-colors group-hover:text-white cursor-pointer mr-2' />
              <input
                type='range'
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className='h-1 w-20 shrink-0 accent-theme-accent opacity-0 transition-opacity delay-100 group-hover:opacity-100 cursor-pointer'
              />
            </div>
          </div>
        </div>

        {/* Right Column: Lyrics Area */}
        <div className='flex h-full w-[60%] flex-col p-16' ref={containerRef}>
          {loading ? (
            <div className='flex h-full w-full flex-col items-center justify-center gap-4 text-[#a7a7a7]'>
              <Loader2 className='h-12 w-12 animate-spin text-theme-accent' />
              <span className='text-xl font-medium'>Fetching lyrics...</span>
            </div>
          ) : lyricsData ? (
             <div className='h-full overflow-y-auto pt-[50vh] pb-[50vh] relative scrollbar-hide mask-image-bottom-top' ref={scrollRef} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`
                  ::-webkit-scrollbar { display: none; }
                  .mask-image-bottom-top { mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent); }
                `}</style>
               <LyricsScroller lines={lyricsData} positionSec={positionSec} requestSeek={requestSeek} scrollContainer={scrollRef} />
             </div>
          ) : (
            <div className='flex h-full w-full flex-col items-center justify-center gap-6'>
              <Mic2 className='h-24 w-24 text-white/20' />
              <span className='text-3xl font-bold text-[#b3b3b3]'>No lyrics found</span>
              <div className='mt-4 flex items-center gap-3'>
                <button
                  onClick={() => { setEditorTrackId(current?.youtubeId ?? null); setIsEditing(true); setEditorLines([{ time: positionSec, text: '' }]); setActiveLineIdx(0) }}
                  className='flex items-center gap-2 px-6 py-3 bg-theme-accent rounded-full text-white font-semibold hover:scale-105 transition-transform'
                >
                  <Plus className='h-5 w-5' /> Add Lyrics
                </button>
                <button
                  onClick={handleImportLyrics}
                  className='flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full text-white/80 font-semibold hover:bg-white/20 hover:text-white hover:scale-105 transition-all'
                >
                  <Download className='h-5 w-5' /> Import .lrc
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Edit Lyrics Button (top-right of lyrics area) */}
        {!isEditing && lyricsData && (
          <div className='absolute top-8 right-24 z-20 flex items-center gap-2'>
            {/* Pop-out floating lyrics */}
            <button
              type='button'
              onClick={async () => {
                await window.vibestream?.openFloatingLyrics()
                setFloatingOpen(true)
                setVisible(false)
                // Send initial state immediately
                if (window.vibestream) {
                  const ps = usePlayerStore.getState()
                  window.vibestream.sendFloatingLyricsState({
                    track: current ? { title: current.title, artist: current.artist ?? 'Unknown', thumbnailUrl: current.thumbnailUrl } : null,
                    lyrics: lyricsData ?? [],
                    position: ps.positionSec,
                    isPlaying: ps.isPlaying,
                  })
                }
              }}
              className='flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all text-sm font-medium'
              title='Pop out floating lyrics'
            >
              <ExternalLink className='h-4 w-4' /> Float
            </button>
            {/* Edit button */}
            <button
              onClick={() => {
                setEditorTrackId(current?.youtubeId ?? null)
                setIsEditing(true)
                setEditorLines(lyricsData.map(l => ({ ...l })))
                setActiveLineIdx(0)
              }}
              className='flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all text-sm font-medium'
            >
              <Edit2 className='h-4 w-4' /> Edit
            </button>
          </div>
        )}
        </div>
      )}

        {/* Lyrics Editor Overlay — Musixmatch-style (covers full panel) */}
        {isEditing && (
          <div className='fixed inset-0 z-[10000] bg-[#0d0d0d] flex flex-col'>
            {/* Editor Header */}
            <div className='flex items-center justify-between px-8 py-5 border-b border-white/10 shrink-0'>
              <div className='flex items-center gap-4'>
                <h3 className='text-xl font-bold text-white'>Sync Editor</h3>
                <span className='text-xs font-medium text-theme-subtext bg-white/5 px-3 py-1 rounded-full'>
                  {editorLines.length} lines
                </span>
              </div>
              <div className='flex items-center gap-3'>
                {/* Share dropdown */}
                <div className='relative' ref={shareMenuRef}>
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className='flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium border border-white/10'
                  >
                    <Share2 className='h-4 w-4' /> Share
                  </button>
                  {showShareMenu && (
                    <div className='absolute top-full right-0 mt-2 w-52 rounded-xl bg-[#282828] border border-white/10 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200'>
                      <button
                        onClick={handleCopyLyrics}
                        className='flex w-full items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors'
                      >
                        {copiedFeedback ? <Check className='h-4 w-4 text-green-400' /> : <Copy className='h-4 w-4' />}
                        {copiedFeedback ? 'Copied!' : 'Copy LRC Text'}
                      </button>
                      <button
                        onClick={handleExportLyrics}
                        className='flex w-full items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors'
                      >
                        <Upload className='h-4 w-4' />
                        Export as .lrc File
                      </button>
                      <div className='border-t border-white/5' />
                      <button
                        onClick={handleImportLyrics}
                        className='flex w-full items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors'
                      >
                        <Download className='h-4 w-4' />
                        Import .lrc File
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    const trackId = editorTrackId
                    if (trackId && window.vibestream) {
                      const lrc = linesToLrc(editorLines)
                      await window.vibestream.saveManualLyrics(trackId, lrc)
                      setIsEditing(false)
                      setEditorTrackId(null)
                      fetchLyrics()
                    }
                  }}
                  className='flex items-center gap-2 px-5 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold hover:bg-green-500/30 transition-colors border border-green-500/20'
                >
                  <Save className='h-4 w-4' /> Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className='p-2.5 bg-white/5 rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>
            </div>

            {/* Line-by-line editor */}
            <div className='flex-1 overflow-y-auto px-6 py-4' ref={editorScrollRef} style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              <div className='flex flex-col gap-1.5 max-w-4xl mx-auto'>
                {editorLines.map((line, idx) => (
                  <EditorLine
                    key={idx}
                    idx={idx}
                    line={line}
                    isActive={idx === activeLineIdx}
                    removeLine={removeLine}
                    updateLineTime={updateLineTime}
                    requestSeek={requestSeek}
                    play={play}
                    stampLine={stampLine}
                    updateLineText={updateLineText}
                    addLineAfter={addLineAfter}
                    setActiveLineIdx={manualSetActiveLineIdx}
                  />
                ))}
              </div>
            </div>
            {/* Bottom bar: Transport + Tools */}
            <div className='flex flex-col border-t border-white/10 shrink-0'>
              {/* Mini transport bar — seek + play/pause */}
              <div className='flex items-center gap-4 px-8 py-3 bg-white/[0.02]'>
                <span className='text-xs font-mono text-white/50 w-10 text-right tabular-nums'>{fmt(displayPos)}</span>
                <div className='flex-1 group relative flex h-3 items-center'>
                  <input
                    type='range'
                    min={0}
                    max={dur > 0 ? dur : 100}
                    step={0.1}
                    value={displayPos}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setDragPos(val)
                      
                      // Debounce the actual seek command
                      if ((window as any)._lyricsSeekTimeout) {
                        clearTimeout((window as any)._lyricsSeekTimeout)
                      }
                      
                      ;(window as any)._lyricsSeekTimeout = setTimeout(() => {
                        requestSeek(val)
                        setDragPos(null)
                      }, 250)
                    }}
                    className='absolute inset-0 h-full w-full opacity-0 cursor-pointer z-10'
                  />
                  <div className='absolute h-1 w-full rounded-full bg-white/10' />
                  <div
                    className='absolute h-1 rounded-full bg-blue-500 transition-[width]'
                    style={{ width: `${dur > 0 ? (Math.min(displayPos, dur) / dur) * 100 : 0}%` }}
                  />
                  <div
                    className='absolute h-3 w-3 -ml-1.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity'
                    style={{ left: `${dur > 0 ? (Math.min(displayPos, dur) / dur) * 100 : 0}%` }}
                  />
                </div>
                <span className='text-xs font-mono text-white/50 w-10 tabular-nums'>{fmt(dur)}</span>
                <button
                  onClick={toggle}
                  className='flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors ml-1'
                >
                  {isPlaying ? <Pause className='h-4 w-4 fill-current' /> : <Play className='h-4 w-4 ml-0.5 fill-current' />}
                </button>
              </div>

              {/* Tools row */}
              <div className='flex items-center justify-between px-8 py-3 border-t border-white/5'>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={() => addLineAfter(editorLines.length - 1)}
                    className='flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium border border-white/10'
                  >
                    <Plus className='h-4 w-4' /> Add Line
                  </button>
                  <button
                    onClick={() => {
                      lastManualInteraction.current = Date.now()
                      const pos = usePlayerStore.getState().positionSec
                      setEditorLines([{ time: pos, text: '' }])
                      setActiveLineIdx(0)
                    }}
                    className='flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20'
                  >
                    <Trash2 className='h-4 w-4' /> Clear All
                  </button>
                </div>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={() => { lastManualInteraction.current = Date.now(); setActiveLineIdx(Math.max(0, activeLineIdx - 1)) }}
                    disabled={activeLineIdx <= 0}
                    className='w-20 h-10 flex items-center justify-center bg-white/5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-default border border-white/10'
                  >
                    <ChevronLeft className='h-5 w-5 rotate-90' />
                  </button>
                  <button
                    onClick={() => { lastManualInteraction.current = Date.now(); setActiveLineIdx(Math.min(editorLines.length - 1, activeLineIdx + 1)) }}
                    disabled={activeLineIdx >= editorLines.length - 1}
                    className='w-20 h-10 flex items-center justify-center bg-white/5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-default border border-white/10'
                  >
                    <ChevronRight className='h-5 w-5 rotate-90' />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )

  return (
    <>
      <button
        type='button'
        onClick={() => setVisible(!visible)}
        className={`transition-colors hover:text-white ${current ? (visible ? 'text-theme-accent' : 'text-[#a7a7a7]') : 'text-[#535353]'}`}
        title='Lyrics'
      >
        <Mic2 className='h-[18px] w-[18px]' />
      </button>
      {visible && createPortal(panel, document.body)}
    </>
  )
}

