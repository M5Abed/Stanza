import { useCallback, useEffect, useState, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Music2, Plus, Search, UserRound, Play, Clock, X } from 'lucide-react'
import { usePlayerStore, type QueueTrack } from '@/stores/usePlayerStore'
import { useSearchStore } from '@/stores/useSearchStore'
import { useUIStore } from '@/stores/useUIStore'
import { getHighResUrl, handleImgError } from '@/utils/image'

/* ---------- Spotify result types ---------- */
interface SpTrack {
  spotifyId: string
  name: string
  artists: string
  album: string | null
  imageUrl: string | null
  durationMs: number
  explicit: boolean
  previewUrl: string | null
  _youtubeId?: string // present when result came from YouTube fallback
}

interface SpArtist {
  spotifyId: string
  name: string
  imageUrl: string | null
  followers: number | null
  genres: string[]
}

/* ---------- YouTube fallback types ---------- */
interface YtSong {
  youtubeId: string
  title: string
  artist: string | null
  album: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  isExplicit: boolean
}

/**
 * Convert a Spotify track to a QueueTrack.
 * We need a youtubeId for playback — we'll resolve that on-the-fly.
 */
function spTrackToQueue(sp: SpTrack, youtubeId: string): QueueTrack {
  return {
    youtubeId,
    title: sp.name,
    artist: sp.artists,
    album: sp.album,
    thumbnailUrl: sp.imageUrl,
    durationSeconds: Math.round(sp.durationMs / 1000),
  }
}

function fmtDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SearchView() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tracks, setTracks] = useState<SpTrack[]>([])
  const [artists, setArtists] = useState<SpArtist[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const { history, addSearchTerm, removeSearchTerm, clearHistory } = useSearchStore()
  const setActiveView = useUIStore((s) => s.setActiveView)
  const playTrackNow = usePlayerStore((s) => s.playTrackNow)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  const handleHistorySearch = (term: string) => {
    setQ(term)
  }

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 350)
    return () => window.clearTimeout(t)
  }, [q])

  /* ---------- Resolve a track → YouTube ID for playback ---------- */
  const resolveAndPlay = useCallback(async (sp: SpTrack, mode: 'play' | 'queue') => {
    if (!window.vibestream) return

    // If we already have a YouTube ID (from fallback search), use it directly
    if (sp._youtubeId) {
      const qt = spTrackToQueue(sp, sp._youtubeId)
      if (mode === 'play') playTrackNow(qt)
      else addToQueue(qt)
      return
    }

    setResolvingId(sp.spotifyId)
    try {
      const ytQuery = `${sp.name} ${sp.artists}`
      const ytResults: YtSong[] = await window.vibestream.searchMusic(ytQuery)

      if (ytResults.length > 0) {
        const qt = spTrackToQueue(sp, ytResults[0].youtubeId)
        if (mode === 'play') playTrackNow(qt)
        else addToQueue(qt)
      } else {
        // Second attempt with just the track name
        const fallback: YtSong[] = await window.vibestream.searchMusic(sp.name)
        if (fallback.length > 0) {
          const qt = spTrackToQueue(sp, fallback[0].youtubeId)
          if (mode === 'play') playTrackNow(qt)
          else addToQueue(qt)
        } else {
          usePlayerStore.getState().setError('Could not find playable audio for this track.')
        }
      }
    } catch (e) {
      console.error('[resolve]', e)
      usePlayerStore.getState().setError('Failed to resolve playback source.')
    } finally {
      setResolvingId(null)
    }
  }, [playTrackNow, addToQueue])

  /* ---------- Main search using Spotify API ---------- */
  const runSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTracks([])
      setArtists([])
      setErr(null)
      return
    }
    if (!window.vibestream) return
    setLoading(true)
    setErr(null)
    try {
      let spotifyWorked = false

      // Try Spotify first
      try {
        const result = await window.vibestream.spotifySearch(query, 20)

        if (result.configured && !result.error && (result.tracks.length > 0 || result.artists.length > 0)) {
          spotifyWorked = true

          // Augment missing covers from YouTube
          const augmentedTracks = await Promise.all((result.tracks || []).map(async (t) => {
             if (!t.imageUrl) {
                try {
                   const fallback = await window.vibestream!.searchMusic(`${t.name} ${t.artists}`)
                   if (fallback && fallback.length > 0 && fallback[0].thumbnailUrl) {
                      return { ...t, imageUrl: fallback[0].thumbnailUrl }
                   }
                } catch(e) {}
             }
             return t
          }))

          const augmentedArtists = await Promise.all((result.artists || []).map(async (a) => {
             if (!a.imageUrl) {
                try {
                   const fallback = await window.vibestream!.searchArtists(a.name)
                   if (fallback && fallback.length > 0 && fallback[0].thumbnailUrl) {
                      return { ...a, imageUrl: fallback[0].thumbnailUrl }
                   }
                } catch(e) {}
             }
             return a
          }))

          setTracks(augmentedTracks)
          setArtists(augmentedArtists)
          addSearchTerm(query)
        }
      } catch (spErr) {
        console.warn('[search] Spotify failed, falling back to YouTube', spErr)
      }

      // Fallback to YouTube search if Spotify didn't work
      if (!spotifyWorked) {
        const [musicRes, artistRes] = await Promise.allSettled([
          window.vibestream.searchMusic(query),
          window.vibestream.searchArtists(query),
        ])

        const musics: YtSong[] = musicRes.status === 'fulfilled' ? musicRes.value : []
        const arts = artistRes.status === 'fulfilled' ? artistRes.value : []

        // Convert YT results to our SpTrack shape for unified rendering
        const converted: SpTrack[] = musics.map((m) => ({
          spotifyId: m.youtubeId,
          name: m.title,
          artists: m.artist ?? 'Unknown',
          album: m.album,
          imageUrl: m.thumbnailUrl,
          durationMs: (m.durationSeconds ?? 0) * 1000,
          explicit: m.isExplicit,
          previewUrl: null,
          _youtubeId: m.youtubeId, // keep for direct playback
        }))

        setTracks(converted)
        setArtists(arts.map((a) => ({
          spotifyId: a.artistId,
          name: a.name,
          imageUrl: a.thumbnailUrl,
          followers: null,
          genres: [],
        })))

        if (converted.length === 0 && arts.length === 0) {
          setErr('No results for that query.')
        }
      }
    } catch (e) {
      setTracks([])
      setArtists([])
      setErr(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void runSearch(debounced)
  }, [debounced, runSearch])

  return (
    <main className='flex w-full flex-col'>
      {/* Search Bar */}
      <div className='mb-6 max-w-[400px]'>
        <div className='relative flex items-center h-12 rounded-full bg-[#242424] px-4 ring-1 ring-transparent transition hover:bg-[#2a2a2a] focus-within:ring-white'>
          <Search className='h-5 w-5 text-[#a7a7a7]' />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='What do you want to play?'
            className='h-full w-full bg-transparent pl-3 pr-4 text-[15px] font-medium text-white placeholder:text-[#a7a7a7] outline-none'
          />
        </div>
      </div>

      <div className='flex flex-col gap-8'>
        {/* Search History */}
        {!loading && tracks.length === 0 && artists.length === 0 && q.trim() === '' && history.length > 0 && (
          <div className='flex flex-col gap-4 animate-in fade-in duration-300'>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-bold text-white'>Recent Searches</h2>
              <button 
                onClick={clearHistory}
                className='text-xs font-semibold uppercase tracking-widest text-theme-subtext transition-colors hover:text-white'
              >
                Clear All
              </button>
            </div>
            <div className='flex flex-wrap gap-3'>
              {history.map((term) => (
                <div 
                  key={term}
                  className='group flex items-center rounded-full bg-theme-surface/50 border border-white/10 px-4 py-2 transition-all hover:bg-white/10 hover:border-white/20'
            >
                  <button onClick={() => handleHistorySearch(term)} className='flex items-center gap-2 outline-none w-full text-theme-subtext transition-colors group-hover:text-white'>
                    <Clock className='h-4 w-4 shrink-0' />
                    <span className='truncate max-w-[150px] font-medium'>{term}</span>
                  </button>
                  <button 
                    onClick={() => removeSearchTerm(term)}
                    className='ml-2 text-theme-subtext/50 hover:text-red-400 focus:outline-none transition-colors'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className='flex items-center gap-3 py-10 text-[#a7a7a7]'>
            <Loader2 className='h-6 w-6 animate-spin text-theme-accent' />
            <span className='font-medium'>Searching...</span>
          </div>
        )}

        {err && (
          <div className='rounded-lg bg-[#e22134]/10 px-4 py-3 text-sm text-[#ff6666]'>
            {err}
          </div>
        )}

        {!loading && debounced && debounced.length >= 2 && tracks.length === 0 && !err && (
          <div className='flex flex-col items-center py-20 text-center gap-4'>
            <Search className='h-16 w-16 text-[#a7a7a7]' />
            <p className='text-lg font-semibold text-white'>No results found</p>
            <p className='text-[15px] text-[#a7a7a7]'>Please make sure your words are spelled correctly, or use fewer or different keywords.</p>
          </div>
        )}

        {tracks.length > 0 && (
          <section>
            <h2 className='mb-4 text-2xl font-bold tracking-tight text-white'>Songs</h2>
            <div className='flex flex-col'>
              {tracks.map((t, idx) => {
                const isResolving = resolvingId === t.spotifyId
                return (
                  <motion.div
                    key={t.spotifyId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.015 }}
                    className='group relative flex items-center justify-between rounded-md px-4 py-2 hover:bg-[#ffffff1a] transition-colors gap-4'
                  >
                    <div className='flex items-center gap-4 flex-1 min-w-0'>
                      <div className='relative h-[40px] w-[40px] shrink-0 overflow-hidden shadow bg-[#282828] rounded'>
                        {t.imageUrl ? (
                          <img src={getHighResUrl(t.imageUrl)} alt='' className='h-full w-full object-cover' onError={handleImgError} />
                        ) : null}
                        {/* Always render placeholder behind the image */}
                        <div className='absolute inset-0 flex items-center justify-center -z-10'>
                          <Music2 className='h-4 w-4 text-[#a7a7a7]' />
                        </div>
                        
                        {/* Play overlay on hover */}
                        <button 
                          onClick={() => resolveAndPlay(t, 'play')}
                          disabled={isResolving}
                          className='absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100'
                        >
                          {isResolving ? (
                            <Loader2 className='h-4 w-4 text-white animate-spin' />
                          ) : (
                            <Play className='h-5 w-5 text-white fill-current ml-0.5' />
                          )}
                        </button>
                      </div>
                      <div className='flex flex-col min-w-0 flex-1 justify-center'>
                        <span className='truncate text-[16px] font-normal text-white group-hover:underline cursor-pointer'>{t.name}</span>
                        <span className='truncate text-[14px] text-[#a7a7a7] hover:underline cursor-pointer group-hover:text-white transition-colors'>
                          {t.explicit && <span className='mr-1 inline-flex items-center rounded bg-[#a7a7a7] px-1 text-[9px] font-bold text-black leading-tight'>E</span>}
                          {t.artists}
                          {t.album ? ` · ${t.album}` : ''}
                        </span>
                      </div>
                    </div>
                    
                    {/* Duration + actions on hover */}
                    <div className='flex items-center gap-4'>
                      <span className='text-sm text-[#a7a7a7] tabular-nums'>{fmtDuration(t.durationMs)}</span>
                      <div className='flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                        <button
                          type='button'
                          onClick={() => resolveAndPlay(t, 'queue')}
                          disabled={isResolving}
                          className='text-[#a7a7a7] hover:text-white transition-colors'
                          title='Add to queue'
                        >
                          <Plus className='h-5 w-5' />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        {artists.length > 0 && (
          <section>
            <h2 className='mb-4 text-2xl font-bold tracking-tight text-white'>Artists</h2>
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'>
              {artists.map((a, idx) => (
                <motion.div
                  key={a.spotifyId + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + idx * 0.02 }}
                  onClick={() => {
                    const viewId = a.spotifyId.startsWith('UC') ? a.spotifyId : a.name
                    setActiveView(`artist-${viewId}` as any)
                  }}
                  className='group relative flex flex-col gap-3 rounded-2xl bg-theme-surface/40 backdrop-blur-md p-4 transition-all hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 overflow-hidden cursor-pointer'
                >
                  <div className='h-[120px] w-[120px] shrink-0 overflow-hidden rounded-full bg-[#282828] shadow-lg'>
                    {a.imageUrl ? (
                      <img src={getHighResUrl(a.imageUrl)} alt='' className='h-full w-full object-cover' onError={handleImgError} />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center text-[#a7a7a7]'>
                        <UserRound className='h-10 w-10' />
                      </div>
                    )}
                  </div>
                  <div className='flex w-full flex-col min-w-0 text-center gap-1'>
                    <span className='truncate font-bold text-white'>{a.name}</span>
                    <span className='truncate text-[14px] text-[#a7a7a7]'>Artist</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
