import { useEffect, useState } from 'react'
import { Play, Plus, ArrowLeft } from 'lucide-react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useUIStore } from '@/stores/useUIStore'
import { getHighResUrl, handleImgError } from '@/utils/image'

export function ArtistAllSongsView({ artistId }: { artistId: string }) {
  const [artist, setArtist] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const playTrackNow = usePlayerStore(s => s.playTrackNow)
  const addToQueue = usePlayerStore(s => s.addToQueue)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const [activeTab, setActiveTab] = useState<'albums' | 'singles'>('albums')

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
  
  const singles = artist.singles || []
  const albums = artist.albums || []

  const handleItemClick = (item: any) => {
    setActiveView(`album-${item.youtubeId}`)
  }

  let displayTab = activeTab
  if (displayTab === 'albums' && albums.length === 0 && singles.length > 0) displayTab = 'singles'
  if (displayTab === 'singles' && singles.length === 0 && albums.length > 0) displayTab = 'albums'

  let currentList = displayTab === 'albums' ? albums : singles

  return (
    <div className='flex flex-col gap-6 animate-in fade-in duration-500'>
      <div className='sticky top-0 z-20 flex flex-col gap-4 bg-theme-surface/95 backdrop-blur-md pb-4 pt-2 -mt-2 -mx-2 px-2'>
        <div className='flex items-center gap-4'>
          <button 
            onClick={() => useUIStore.getState().goBack()}
            className='flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm'
          >
            <ArrowLeft className='h-5 w-5' />
          </button>
          <h2 className='text-3xl font-black tracking-tight text-white drop-shadow-sm'>
            {artist.name} <span className='text-theme-subtext font-medium'>— Discography</span>
          </h2>
        </div>
        <div className='flex items-center gap-2'>
          {albums.length > 0 && <button onClick={() => setActiveTab('albums')} className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${displayTab === 'albums' ? 'bg-theme-accent text-white shadow-md' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>Albums</button>}
          {singles.length > 0 && <button onClick={() => setActiveTab('singles')} className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${displayTab === 'singles' ? 'bg-theme-accent text-white shadow-md' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>Singles & EPs</button>}
        </div>
      </div>

      {currentList.length === 0 ? (
        <div className='flex h-48 items-center justify-center rounded-2xl bg-theme-surface/40 border border-white/5'>
           <span className='text-theme-subtext'>No items found.</span>
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {currentList.map((track: any, i: number) => (
               <div 
                 key={`${track.youtubeId}-${i}-allsongs`}
                 className='group flex flex-col gap-3 rounded-2xl p-4 transition-all hover:bg-white/5 bg-theme-surface/30 border border-white/5 shadow-md relative cursor-pointer'
                 onClick={() => handleItemClick(track)}
               >
                 <div className='relative aspect-square w-full overflow-hidden rounded-xl bg-stone-800 shadow-lg'>
                   {track.thumbnailUrl && (
                     <img src={getHighResUrl(track.thumbnailUrl)} className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105' alt={track.title} onError={handleImgError} />
                   )}
                 </div>
                 <div className='flex flex-col min-w-0'>
                   <span className='truncate font-bold text-white/90 drop-shadow-sm group-hover:text-theme-cyan transition-colors'>{track.title}</span>
                   <span className='truncate text-sm text-theme-subtext mt-1'>
                     {track.year || 'Unknown'}
                   </span>
                 </div>
               </div>
            ))}
        </div>
      )}
    </div>
  )
}
