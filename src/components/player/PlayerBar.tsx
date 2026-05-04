import { useMemo, useState, useEffect } from 'react'
import {
  Heart,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
  Minimize2,
  Download,
  Check,
  Loader2,

  ListMusic
} from 'lucide-react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore, AppView } from '@/stores/useUIStore'
import { useContextMenuStore } from '@/stores/useContextMenuStore'
import { LyricsPanel } from './LyricsPanel'
import { motion } from 'framer-motion'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { useThemeStore } from '@/stores/useThemeStore'
import { ArtistLinks } from '@/components/ui/ArtistLinks'

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const current = usePlayerStore((s) =>
    s.currentIndex >= 0 && s.currentIndex < s.queue.length ? s.queue[s.currentIndex] : null,
  )
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const positionSec = usePlayerStore((s) => s.positionSec)
  const durationSec = usePlayerStore((s) => s.durationSec)
  const shuffle = usePlayerStore((s) => s.shuffle)
  const repeat = usePlayerStore((s) => s.repeat)
  const isLoading = usePlayerStore((s) => s.isLoading)
  const error = usePlayerStore((s) => s.error)

  const toggle = usePlayerStore((s) => s.toggle)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const activeView = useUIStore((s) => s.activeView)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const requestSeek = usePlayerStore((s) => s.requestSeek)
  const setShuffle = usePlayerStore((s) => s.setShuffle)
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat)
  const openMenu = useContextMenuStore(s => s.openMenu)

  const { isLiked, toggleLiked } = usePlaylistsStore()
  
  const [dragPos, setDragPos] = useState<number | null>(null)
  const displayPos = dragPos !== null ? dragPos : positionSec

  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value))
  }

  const handleVolumeWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Delta Y < 0 means scrolled UP
    const step = 0.05
    if (e.deltaY < 0) {
      setVolume(Math.min(1, volume + step))
    } else if (e.deltaY > 0) {
      setVolume(Math.max(0, volume - step))
    }
  }

  const liked = current ? isLiked(current.youtubeId) : false

  // Download state
  const [dlStatus, setDlStatus] = useState<'idle' | 'downloading' | 'done'>('idle')
  const [dlProgress, setDlProgress] = useState(0)

  useEffect(() => {
    if (!current?.youtubeId || !window.vibestream) return
    setDlStatus('idle')
    setDlProgress(0)
    window.vibestream.isDownloaded(current.youtubeId).then(r => {
      if (r.downloaded) setDlStatus('done')
    }).catch(() => {})
  }, [current?.youtubeId])

  useEffect(() => {
    if (!window.vibestream) return
    const unsub = window.vibestream.onDownloadProgress((data) => {
      if (data.youtubeId === current?.youtubeId) {
        setDlProgress(data.progress)
        if (data.progress >= 100) setDlStatus('done')
      }
    })
    return unsub
  }, [current?.youtubeId])

  const handleDownload = async () => {
    if (!current || !window.vibestream || dlStatus !== 'idle') return
    setDlStatus('downloading')
    try {
      await window.vibestream.downloadSong(current.youtubeId)
      setDlStatus('done')
      usePlaylistsStore.getState().fetchPlaylists()
    } catch {
      setDlStatus('idle')
    }
  }

  const dur = useMemo(() => (durationSec > 0 ? durationSec : current?.durationSeconds ?? 0), [current?.durationSeconds, durationSec])

  const dominantColor = useThemeStore((s) => s.dominantColor)

  return (
    <div className='px-4 pb-4 pt-1'>
      <footer className='flex h-[90px] shrink-0 items-center justify-between rounded-3xl bg-theme-surface/80 backdrop-blur-3xl px-6 py-3 shadow-2xl border border-white/5 relative z-20 overflow-hidden'>
        {/* Ambient glow */}
        {current && (
          <div
            className='absolute inset-0 opacity-15 transition-all duration-1000 pointer-events-none'
            style={{ background: `radial-gradient(ellipse at 30% 50%, ${dominantColor}40 0%, transparent 70%)` }}
          />
        )}
        {/* Left Column: Track Info */}
        <div 
          className='flex w-[30%] min-w-[180px] items-center gap-4 cursor-pointer rounded-xl hover:bg-white/5 transition-colors p-1 -ml-1'
          onContextMenu={(e) => {
            if (current) openMenu(e, current)
          }}
        >
        <div className='group relative h-14 w-14 shrink-0 overflow-hidden rounded bg-[#282828] shadow-lg'>
          {/* Fallback placeholder (always rendered behind) */}
          <div className='absolute inset-0 flex items-center justify-center text-xs text-theme-subtext z-0'>♪</div>
          
          {current?.thumbnailUrl && (
            <img 
              src={getHighResUrl(current.thumbnailUrl)} 
              alt='' 
              className='absolute inset-0 h-full w-full object-cover z-10 transition-transform duration-300 group-hover:scale-105' 
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.opacity = '0'; // Hide smoothly to reveal fallback
              }}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.opacity = '1';
              }}
            />
          )}
        </div>
        <div className='flex min-w-0 flex-col py-1'>
          <span className='truncate text-sm font-medium text-white'>{current?.title ?? 'Nothing playing'}</span>
          {current?.artist ? (
            <span className='truncate text-left text-xs text-theme-subtext/80'>
              <ArtistLinks artist={current.artist} linkClassName='text-theme-subtext/80' />
            </span>
          ) : (
            <span className='truncate text-left text-xs text-theme-subtext/80'>Pick a song from search</span>
          )}
          {error ? <div className='truncate text-xs text-red-500'>{error}</div> : null}
        </div>
        {current && (
          <>
          <button 
            onClick={() => toggleLiked(current)}
            className={`transition-all hover:scale-110 ml-2 ${liked ? 'text-theme-accent drop-shadow-[0_0_8px_rgba(212,0,33,0.8)]' : 'text-theme-subtext hover:text-white'}`}
          >
            <Heart className='h-5 w-5' fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={handleDownload}
            disabled={dlStatus === 'downloading'}
            className={`transition-all hover:scale-110 ${dlStatus === 'done' ? 'text-green-400' : dlStatus === 'downloading' ? 'text-theme-accent animate-pulse' : 'text-theme-subtext hover:text-white'}`}
            title={dlStatus === 'done' ? 'Downloaded' : dlStatus === 'downloading' ? `${Math.round(dlProgress)}%` : 'Download'}
          >
            {dlStatus === 'done' ? <Check className='h-5 w-5' /> : dlStatus === 'downloading' ? <Loader2 className='h-5 w-5 animate-spin' /> : <Download className='h-5 w-5' />}
          </button>
          </>
        )}
      </div>

      {/* Middle Column: Controls & Scrubber */}
      <div className='flex max-w-[722px] flex-1 flex-col items-center justify-center gap-2'>
        <div className='flex items-center gap-6'>
          <button
            type='button'
            onClick={() => setShuffle(!shuffle)}
            className={`transition-all hover:scale-110 ${shuffle ? 'text-theme-accent drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'text-theme-subtext hover:text-white'}`}
          >
            <Shuffle className='h-5 w-5' />
          </button>
          
          <button type='button' onClick={previous} className='transition-all hover:scale-110 text-theme-subtext hover:text-white' title='Previous'>
            <SkipBack className='h-5 w-5 fill-current' />
          </button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type='button'
            onClick={toggle}
            disabled={!current || isLoading}
            className='flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 hover:bg-theme-accent hover:text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]'
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className='h-[18px] w-[18px] fill-current' /> : <Play className='h-[18px] w-[18px] fill-current ml-0.5' />}
          </motion.button>
          
          <button type='button' onClick={next} className='transition-all hover:scale-110 text-theme-subtext hover:text-white' title='Next'>
            <SkipForward className='h-5 w-5 fill-current' />
          </button>
          
          <button
            type='button'
            onClick={cycleRepeat}
            className={`transition-all hover:scale-110 ${repeat === 'off' ? 'text-theme-subtext hover:text-white' : 'text-theme-accent drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]'}`}
            title={`Repeat: ${repeat}`}
          >
            {repeat === 'one' ? <Repeat1 className='h-5 w-5' /> : <Repeat className='h-5 w-5' />}
          </button>
        </div>
        
        {/* Scrubber */}
        <div className='flex w-full items-center gap-2'>
          <div className='text-xs font-medium text-theme-subtext w-10 text-right'>{fmt(displayPos)}</div>
          <div className='group relative flex h-2 flex-1 items-center max-w-xl'>
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
              disabled={!current || dur <= 0}
              className='absolute inset-0 h-full w-full opacity-0 hover:cursor-pointer z-10'
            />
            <div className='absolute h-1.5 w-full rounded-full bg-white/10' />
            <div className='absolute h-1.5 rounded-full bg-white group-hover:bg-theme-accent transition-colors' style={{ width: `${dur > 0 ? (Math.min(displayPos, dur) / dur) * 100 : 0}%` }} />
            <div className='absolute h-3.5 w-3.5 -ml-1.5 rounded-full bg-white opacity-0 shadow-md group-hover:opacity-100 transition-opacity' style={{ left: `${dur > 0 ? (Math.min(displayPos, dur) / dur) * 100 : 0}%` }} />
          </div>
          <span className='w-10 font-medium text-xs text-theme-subtext'>{fmt(dur)}</span>
        </div>
      </div>

      {/* Right Column: Lyrics + Volume */}
      <div className='flex w-[30%] min-w-[180px] items-center justify-end gap-4'>
        <div className='flex items-center gap-3 text-theme-subtext'>
          <button
            onClick={() => {
              if (activeView === 'queue') {
                const { history, goBack } = useUIStore.getState()
                if (history.length > 0) {
                  goBack()
                } else {
                  setActiveView('home')
                }
              } else {
                setActiveView('queue')
              }
            }}
            className={`transition-colors ${activeView === 'queue' ? 'text-theme-accent drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]' : 'text-theme-subtext hover:text-white'}`}
            title='Queue'
          >
            <ListMusic className='h-[18px] w-[18px]' />
          </button>
          <LyricsPanel />
          <div className='group relative flex h-2 w-24 items-center' onWheel={handleVolumeWheel}>
            <Volume2 className='h-5 w-5 mr-3 shrink-0' />
            <div className='group-hover:h-2 relative flex flex-1 h-2 items-center'>
              <input
                type='range'
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className='absolute inset-0 h-full w-full opacity-0 hover:cursor-pointer z-10'
              />
              <div className='absolute h-1.5 w-full rounded-full bg-white/10' />
              <div className='absolute h-1.5 rounded-full bg-white group-hover:bg-theme-accent transition-colors' style={{ width: `${volume * 100}%` }} />
              <div className='absolute h-3.5 w-3.5 -ml-1.5 rounded-full bg-white opacity-0 shadow-md group-hover:opacity-100' style={{ left: `${volume * 100}%` }} />
            </div>
          </div>
          <button 
            type='button' 
            onClick={handleFullscreenToggle}
            className='ml-2 text-theme-subtext transition-colors hover:text-white'
          >
            {isFullscreen ? <Minimize2 className='h-[18px] w-[18px]' /> : <Maximize2 className='h-[18px] w-[18px]' />}
          </button>

        </div>
      </div>
    </footer>
    </div>
  )
}
