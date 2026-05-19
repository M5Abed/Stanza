import { useEffect, useState, useRef, useCallback } from 'react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useUIStore } from '@/stores/useUIStore'
import { Play, Clock, Music2, ArrowLeft, Plus, Heart, Download, Check } from 'lucide-react'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { useContextMenuStore } from '@/stores/useContextMenuStore'
import { useSavedPlaylistsStore } from '@/stores/useSavedPlaylistsStore'
import { ArtistLinks } from '@/components/ui/ArtistLinks'

export function AlbumView({ albumId }: { albumId: string }) {
  const [album, setAlbum] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const current = usePlayerStore((s) => s.queue[s.currentIndex])
  const loadPlaylist = usePlayerStore((s) => s.loadPlaylist)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const openMenu = useContextMenuStore(s => s.openMenu)
  const { savePlaylist, removePlaylist, isSaved } = useSavedPlaylistsStore()

  const isYtmPlaylist = albumId.startsWith('VL') || albumId.startsWith('OLAK5uy_')
  const saved = isSaved(albumId)

  // Download state
  const [dlState, setDlState] = useState<'idle' | 'downloading' | 'done'>('idle')
  const [dlProgress, setDlProgress] = useState(0)
  const dlRef = useRef<{ total: number; completed: Set<string> }>({ total: 0, completed: new Set() })
  const cancelledRef = useRef(false)

  // Listen for download progress
  useEffect(() => {
    if (!window.vibestream || dlState !== 'downloading') return
    const unsub = window.vibestream.onDownloadProgress((data) => {
      if (cancelledRef.current) return
      if (data.progress >= 100 && data.youtubeId) {
        dlRef.current.completed.add(data.youtubeId)
        const pct = (dlRef.current.completed.size / dlRef.current.total) * 100
        setDlProgress(pct)
        if (dlRef.current.completed.size >= dlRef.current.total) {
          setDlState('done')
          setDlProgress(100)
        }
      }
    })
    return () => { unsub?.() }
  }, [dlState])

  const handleDownloadClick = useCallback(async () => {
    if (!album || !window.vibestream) return

    // Cancel if already downloading
    if (dlState === 'downloading') {
      cancelledRef.current = true
      setDlState('idle')
      setDlProgress(0)
      dlRef.current = { total: 0, completed: new Set() }
      return
    }

    // Reset if done, allow re-download
    cancelledRef.current = false

    const tracks = album.tracks.filter((t: any) => t.youtubeId)
    if (tracks.length === 0) return

    // Check which aren't downloaded yet
    const need: any[] = []
    for (const t of tracks) {
      try {
        const res = await window.vibestream.isDownloaded(t.youtubeId)
        if (!res?.downloaded) need.push(t)
      } catch { need.push(t) }
    }

    if (need.length === 0) {
      setDlState('done')
      setDlProgress(100)
      return
    }

    dlRef.current = { total: need.length, completed: new Set() }
    setDlState('downloading')
    setDlProgress(0)

    for (const t of need) {
      if (cancelledRef.current) break
      try {
        // Upsert song metadata first
        await window.vibestream.songUpsert({
          youtubeId: t.youtubeId,
          title: t.title,
          artist: t.artist || album.artist || 'Unknown',
          thumbnailUrl: t.thumbnailUrl || album.thumbnailUrl,
          durationSeconds: t.durationSeconds,
        })
        await window.vibestream.downloadSong(t.youtubeId)
      } catch (e) {
        console.error('[download]', t.youtubeId, e)
      }
    }
  }, [album, dlState])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const vs = window.vibestream
        if (!vs) throw new Error('Vibestream Preload missing')
        const details = await vs.getAlbumDetails(albumId)
        setAlbum(details)
      } catch (err: any) {
        setError(err.message || 'Failed to load album')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [albumId])

  if (loading) return (
    <div className='flex h-full items-center justify-center'>
      <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-theme-accent' />
    </div>
  )

  if (error || !album) return (
    <div className='flex h-full flex-col items-center justify-center p-8 text-center text-theme-subtext'>
      <span className='text-rose-400'>Error loading album: {error || 'Not found'}</span>
    </div>
  )

  const totalSec = album.tracks.reduce((acc: number, t: any) => acc + (t.durationSeconds ?? 0), 0)
  const totalMin = Math.floor(totalSec / 60)

  return (
    <div className='flex flex-col h-full animate-in fade-in'>
      {/* Header */}
      <div className='flex flex-col md:flex-row items-end gap-8 p-8 border-b border-white/5 bg-gradient-to-b from-theme-elevated/80 to-transparent relative'>
        <button 
          onClick={() => useUIStore.getState().goBack()}
          className='absolute top-6 left-6 p-2 rounded-full bg-white/5 text-white hover:bg-white/10 transition-colors z-20'
        >
           <ArrowLeft className='h-5 w-5' />
        </button>

        <div className='h-48 w-48 shrink-0 mt-8 shadow-[0_15px_40px_rgba(0,0,0,0.5)] rounded-2xl flex items-center justify-center bg-[#111] overflow-hidden relative z-10'>
           {album.thumbnailUrl ? (
             <img src={getHighResUrl(album.thumbnailUrl)} className='h-full w-full object-cover opacity-90' onError={handleImgError} />
           ) : (
             <Music2 className='h-16 w-16 text-theme-subtext/50 z-10' />
           )}
        </div>
        
        <div className='flex flex-col gap-3 min-w-0 z-10'>
          <span className='text-xs font-bold uppercase tracking-widest text-theme-subtext drop-shadow-sm'>{isYtmPlaylist ? 'Playlist' : 'Album'}</span>
          
          <div className='group flex items-center gap-4'>
            <h1 className='text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md truncate max-w-3xl'>
              {album.title}
            </h1>
          </div>

          <div className='text-sm font-medium text-theme-subtext mt-2 flex items-center gap-2'>
            <span className='text-white'>{album.artist ? <ArtistLinks artist={album.artist} linkClassName='text-white' /> : 'Unknown'}</span>
            {album.year && <><span>•</span><span>{album.year}</span></>}
            <span>•</span>
            <span>{album.tracks.length} songs</span>
            {totalMin > 0 && <><span>•</span><span>{totalMin} min</span></>}
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className='p-6 flex items-center gap-6 border-b border-white/5'>
        <button
          onClick={() => {
            if (album.tracks.length > 0) {
              loadPlaylist(album.tracks, 0)
            }
          }}
          disabled={album.tracks.length === 0}
          className='flex h-14 w-14 items-center justify-center rounded-full bg-theme-accent text-white shadow-[0_0_20px_rgba(212,0,33,0.3)] hover:scale-105 hover:bg-red-600 disabled:opacity-50 disabled:hover:scale-100 transition-all cursor-pointer'
        >
          <Play className='h-6 w-6 ml-1 fill-current' />
        </button>

        {/* Save to Library */}
        <button
          onClick={() => {
            if (saved) {
              removePlaylist(albumId)
            } else {
              savePlaylist({
                playlistId: albumId,
                title: album.title,
                author: album.artist || 'Unknown',
                thumbnailUrl: album.thumbnailUrl,
                trackCount: album.tracks.length,
                type: isYtmPlaylist ? 'playlist' : 'album',
              })
            }
          }}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all hover:scale-110 ${
            saved ? 'text-theme-accent' : 'text-white/50 hover:text-white'
          }`}
          title={saved ? 'Remove from Library' : 'Save to Library'}
        >
          <Heart className={`h-6 w-6 ${saved ? 'fill-current' : ''}`} />
        </button>

        {/* Download All */}
        {saved && (
          <button
            onClick={handleDownloadClick}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              dlState === 'done'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : dlState === 'downloading'
                ? 'bg-theme-accent/10 text-theme-accent border border-theme-accent/30 cursor-wait'
                : 'bg-white/5 text-theme-subtext hover:text-white hover:bg-white/10 border border-white/10'
            }`}
            title={dlState === 'done' ? 'All downloaded' : dlState === 'downloading' ? 'Click to cancel' : 'Download all tracks'}
          >
            {dlState === 'downloading' ? (
              <div className='relative flex items-center justify-center' style={{ width: 20, height: 20 }}>
                <svg className='-rotate-90' width='20' height='20' viewBox='0 0 20 20'>
                  <circle cx='10' cy='10' r='8' fill='none' stroke='currentColor' strokeWidth='2.5' opacity='0.15' />
                  <circle
                    cx='10' cy='10' r='8' fill='none' stroke='currentColor' strokeWidth='2.5'
                    strokeDasharray={`${2 * Math.PI * 8}`}
                    strokeDashoffset={`${2 * Math.PI * 8 * (1 - dlProgress / 100)}`}
                    strokeLinecap='round'
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                </svg>
                <span className='absolute inset-0 flex items-center justify-center text-[7px] font-black leading-none'>
                  {Math.round(dlProgress)}
                </span>
              </div>
            ) : dlState === 'done' ? (
              <Check className='h-4 w-4' />
            ) : (
              <Download className='h-4 w-4' />
            )}
            {dlState === 'done'
              ? 'Downloaded'
              : dlState === 'downloading'
              ? `${Math.round(dlProgress)}% — Cancel`
              : 'Download All'}
          </button>
        )}
      </div>

      {/* Track List */}
      <div className='flex-1 overflow-y-auto px-6 pb-[200px]'>
        <div className='grid grid-cols-[20px_1fr_60px_40px] md:grid-cols-[20px_1fr_minmax(120px,200px)_60px_40px] items-center gap-6 px-4 py-3 text-xs font-bold uppercase tracking-wider text-theme-subtext border-b border-white/5 sticky top-0 bg-theme-surface/90 backdrop-blur z-10'>
          <span className='text-center'>#</span>
          <span>Title</span>
          <span className='hidden md:block'>Artist</span>
          <span><Clock className='h-4 w-4 mx-auto' /></span>
          <span></span>
        </div>

        <div className='mt-2 flex flex-col gap-1'>
          {album.tracks.map((track: any, idx: number) => {
            const isPlayingThis = current?.youtubeId === track.youtubeId
            
            return (
              <div 
                key={track.youtubeId + idx}
                className={`group grid grid-cols-[20px_1fr_60px_40px] md:grid-cols-[20px_1fr_minmax(120px,200px)_60px_40px] items-center gap-6 rounded-xl px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer ${isPlayingThis ? 'bg-white/10 shadow-sm' : ''}`}
                onClick={() => loadPlaylist(album.tracks, idx)}
                onContextMenu={(e) => openMenu(e, track)}
              >
                <span className='text-sm font-medium text-theme-subtext text-center group-hover:hidden'>{idx + 1}</span>
                <span className='hidden group-hover:flex items-center justify-center -ml-1 text-white'><Play className='h-4 w-4 fill-current' /></span>
                
                <div className='flex items-center gap-4 min-w-0'>
                   <div className='flex flex-col truncate'>
                    <span className={`truncate font-semibold ${isPlayingThis ? 'text-theme-accent' : 'text-white/95'}`}>{track.title}</span>
                  </div>
                </div>

                <div className='hidden md:block truncate text-sm font-medium text-theme-subtext/80'>{track.artist ? <ArtistLinks artist={track.artist} linkClassName='text-theme-subtext/80' /> : ''}</div>
                <div className='text-sm font-medium text-theme-subtext/80 text-center'>{track.durationSeconds ? `${Math.floor(track.durationSeconds/60)}:${(track.durationSeconds%60).toString().padStart(2,'0')}` : '--:--'}</div>
                <div className='flex items-center justify-center'>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      addToQueue(track)
                    }}
                    className='opacity-0 group-hover:opacity-100 transition-opacity text-theme-subtext hover:text-white p-2'
                    title='Add to Queue'
                  >
                    <Plus className='h-5 w-5' />
                  </button>
                </div>
              </div>
            )
          })}
          {album.tracks.length === 0 && (
            <div className='py-20 flex flex-col items-center justify-center text-theme-subtext'>
              <Music2 className='h-12 w-12 mb-4 opacity-50' />
              <span className='font-medium'>This album is empty.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
