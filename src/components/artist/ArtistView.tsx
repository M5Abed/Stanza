import { useEffect, useState, useMemo } from 'react'
import { Play, Plus, Heart } from 'lucide-react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useUIStore } from '@/stores/useUIStore'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { useContextMenuStore } from '@/stores/useContextMenuStore'
import { useSavedArtistsStore } from '@/stores/useSavedArtistsStore'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'

type ArtistTab = 'top' | 'liked'

export function ArtistView({ artistId }: { artistId: string }) {
  const [artist, setArtist] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ArtistTab>('top')
  
  const playTrackNow = usePlayerStore(s => s.playTrackNow)
  const addToQueue = usePlayerStore(s => s.addToQueue)
  const loadPlaylist = usePlayerStore(s => s.loadPlaylist)
  const repeat = usePlayerStore(s => s.repeat)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const openMenu = useContextMenuStore(s => s.openMenu)
  const { isSaved, saveArtist, removeArtist } = useSavedArtistsStore()
  const playlists = usePlaylistsStore(s => s.playlists)
  const likedSongsPlaylistId = usePlaylistsStore(s => s.likedSongsPlaylistId)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const vs = window.vibestream
        if (!vs) throw new Error('Vibestream Preload missing')
        const details = await vs.getArtistDetails(artistId)
        setArtist(details)
      } catch (err: any) {
        setError(err.message || 'Failed to load artist')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [artistId])

  // Get liked songs filtered by this artist
  const likedByArtist = useMemo(() => {
    if (!artist?.name || !likedSongsPlaylistId) return []
    const likedPlaylist = playlists.find(p => p.id === likedSongsPlaylistId)
    if (!likedPlaylist) return []

    const artistNameLo = artist.name.toLowerCase().trim()
    return likedPlaylist.tracks
      .filter(t => {
        const songArtist = (t.song.artist || '').toLowerCase().trim()
        // Match if the artist name appears anywhere in the song's artist field
        // (handles "Artist1, Artist2" style fields)
        return songArtist.includes(artistNameLo) || artistNameLo.includes(songArtist)
      })
      .map(t => ({
        youtubeId: t.song.youtubeId,
        title: t.song.title,
        artist: t.song.artist || artist.name,
        album: t.song.album || null,
        thumbnailUrl: t.song.thumbnailUrl,
        durationSeconds: t.song.durationSeconds,
      }))
  }, [artist?.name, playlists, likedSongsPlaylistId])

  if (loading) return (
    <div className='flex h-full items-center justify-center'>
      <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-theme-accent' />
    </div>
  )

  if (error || !artist) return (
    <div className='flex h-full flex-col items-center justify-center p-8 text-center text-theme-subtext'>
      <span className='text-rose-400'>Error loading artist: {error || 'Not found'}</span>
    </div>
  )

  const displayTracks = activeTab === 'liked' ? likedByArtist : artist.topSongs

  return (
    <div className='flex flex-col gap-6 animate-in fade-in duration-500'>
      <div className='relative flex items-end overflow-hidden rounded-3xl bg-theme-surface/50 p-8 pt-32 shadow-xl border border-white/5'>
         {artist.thumbnailUrl && (
           <div 
             className="absolute inset-0 z-0 opacity-40 blur-3xl scale-125 bg-cover bg-center mix-blend-screen"
             style={{ backgroundImage: `url(${getHighResUrl(artist.thumbnailUrl)})` }}
           />
         )}
         <div className='relative z-10 flex items-center gap-6'>
            {artist.thumbnailUrl && (
              <img src={getHighResUrl(artist.thumbnailUrl)} alt={artist.name} className='h-32 w-32 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] object-cover border border-white/10' onError={handleImgError} />
            )}
            <div className='flex flex-col'>
              <span className='text-sm font-semibold tracking-widest text-[#a7a7a7] uppercase mb-1'>Artist</span>
              <h1 className='text-5xl font-black tracking-tighter text-white drop-shadow-md'>{artist.name}</h1>
              {artist.subscribers && <span className='text-sm text-theme-subtext mt-2'>{artist.subscribers}</span>}
            </div>
         </div>
      </div>

      <div className='flex items-center gap-4 mt-2'>
        <button 
          onClick={() => {
            const tracks = activeTab === 'liked' ? likedByArtist : artist.topSongs
            if (tracks.length > 0) loadPlaylist(tracks, 0)
          }}
          className='flex h-12 w-12 items-center justify-center rounded-full bg-theme-accent shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-transform hover:scale-105 active:scale-95'
        >
          <Play className='h-6 w-6 text-white ml-1' fill='currentColor' />
        </button>

        <button
          onClick={() => {
            const saved = isSaved(artist.artistId)
            if (saved) removeArtist(artist.artistId)
            else saveArtist({ artistId: artist.artistId, name: artist.name, thumbnailUrl: artist.thumbnailUrl })
          }}
          className={`rounded-full border px-6 py-2.5 font-semibold transition-colors flex items-center gap-2 ${
            isSaved(artist.artistId)
              ? 'border-theme-accent bg-theme-accent/10 text-theme-accent' 
              : 'border-white/20 text-white/90 hover:bg-white/10'
          }`}
        >
          <Heart className={`h-5 w-5 ${isSaved(artist.artistId) ? 'fill-current' : ''}`} />
          {isSaved(artist.artistId) ? 'Saved' : 'Favourite'}
        </button>

        {((artist.albums && artist.albums.length > 0) || (artist.singles && artist.singles.length > 0) || (artist.videos && artist.videos.length > 0)) && (
          <button 
            onClick={() => setActiveView(`artist-songs-${artistId}` as any)}
            className='rounded-full border border-white/20 px-6 py-2.5 font-semibold transition-colors text-white/90 hover:bg-white/10'
          >
             Discography
          </button>
        )}
      </div>

      {/* Tab Selector */}
      <div className='flex items-center gap-2 mt-4'>
        <button
          onClick={() => setActiveTab('top')}
          className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${
            activeTab === 'top' ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
        >
          Top Songs
        </button>
        <button
          onClick={() => setActiveTab('liked')}
          className={`px-5 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'liked' ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          }`}
        >
          <Heart className='h-4 w-4' fill={activeTab === 'liked' ? 'currentColor' : 'none'} />
          Liked
          {likedByArtist.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'liked' ? 'bg-black/10' : 'bg-white/10'}`}>
              {likedByArtist.length}
            </span>
          )}
        </button>
      </div>

      <div>
        {displayTracks.length === 0 ? (
          <div className='flex h-32 items-center justify-center rounded-2xl bg-theme-surface/40 border border-white/5'>
            <span className='text-theme-subtext'>
              {activeTab === 'liked'
                ? `No liked songs from ${artist.name} yet`
                : 'No songs available'}
            </span>
          </div>
        ) : (
          <div className='flex flex-col gap-1'>
            {displayTracks.map((track: any, i: number) => (
               <div 
                 key={track.youtubeId + '-' + i}
                 className='group flex items-center gap-4 rounded-xl p-2 transition-all hover:bg-white/5 cursor-pointer'
                 onContextMenu={(e) => openMenu(e, track)}
               >
                 <span className='w-6 text-right text-sm text-theme-subtext/50 font-mono'>{i + 1}</span>
                 <div className='relative h-12 w-12 overflow-hidden rounded-md bg-stone-800 shadow-sm'>
                   {track.thumbnailUrl && (
                     <img src={getHighResUrl(track.thumbnailUrl)} className='h-full w-full object-cover' alt={track.title} onError={handleImgError} />
                   )}
                   <button
                     onClick={() => {
                       if (repeat === 'all' && displayTracks.length > 1) {
                         loadPlaylist(displayTracks, i)
                       } else {
                         playTrackNow(track)
                       }
                     }}
                     className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'
                   >
                     <Play className='h-5 w-5 text-white' fill='currentColor' />
                   </button>
                 </div>
                 <div className='flex flex-1 flex-col min-w-0'>
                   <span className='truncate font-medium text-white/90 group-hover:text-theme-cyan transition-colors'>{track.title}</span>
                   <span className='truncate text-sm text-theme-subtext'>{track.artist || 'Unknown'}</span>
                 </div>
                 
                 <button
                   onClick={() => addToQueue(track)}
                   className='mr-4 opacity-0 group-hover:opacity-100 transition-opacity text-theme-subtext hover:text-white p-2 rounded-full hover:bg-white/10'
                   title="Add to Queue"
                 >
                   <Plus className='h-5 w-5' />
                 </button>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
