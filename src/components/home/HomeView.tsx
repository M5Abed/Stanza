import { useEffect, useState } from 'react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { motion } from 'framer-motion'
import { Plus, Play, Loader2 } from 'lucide-react'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { useRadioStore } from '@/stores/useRadioStore'
import { useContextMenuStore } from '@/stores/useContextMenuStore'
import { useUIStore } from '@/stores/useUIStore'

interface ExploreSection {
  title: string
  playlists: {
    browseId: string
    title: string
    subtitle: string
    thumbnailUrl: string | null
  }[]
}

export function HomeView() {
  const queue = usePlayerStore(s => s.queue)
  const currentIndex = usePlayerStore(s => s.currentIndex)
  const history = usePlayerStore(s => s.history)
  const playQueueIndex = usePlayerStore(s => s.playQueueIndex)
  const playTrackNow = usePlayerStore(s => s.playTrackNow)
  const addToQueue = usePlayerStore(s => s.addToQueue)
  const loadPlaylist = usePlayerStore(s => s.loadPlaylist)
  const repeat = usePlayerStore(s => s.repeat)
  const suggestions = useRadioStore(s => s.suggestions)
  const fetchRecommendations = useRadioStore(s => s.fetchRecommendations)
  const openMenu = useContextMenuStore(s => s.openMenu)
  const setActiveView = useUIStore(s => s.setActiveView)

  const [exploreSections, setExploreSections] = useState<ExploreSection[]>([])
  const [exploreLoading, setExploreLoading] = useState(false)

  // Use the new dedicated history array, taking up to the 8 most recent unique tracks
  const recent = history.slice(0, 8)

  // Fetch explore playlists on mount
  useEffect(() => {
    async function fetchExplore() {
      if (!window.vibestream?.getExplorePlaylists) return
      setExploreLoading(true)
      try {
        const sections = await window.vibestream.getExplorePlaylists()
        setExploreSections(sections)
      } catch (err) {
        console.error('[home] Failed to load explore:', err)
      } finally {
        setExploreLoading(false)
      }
    }
    fetchExplore()
  }, [])

  return (
    <div className='flex flex-col gap-8'>
      <div>
        <h2 className='mb-6 text-3xl font-bold text-white drop-shadow-md'>Recently Played</h2>
        {recent.length === 0 ? (
          <div className='flex h-32 items-center justify-center rounded-2xl bg-theme-surface/40 border border-white/5'>
            <span className='text-theme-subtext'>Start listening to tracks to see your history here!</span>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
            {recent.map((track, i) => (
              <motion.div
                key={`${track.youtubeId}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className='group relative flex items-center gap-4 rounded-2xl bg-theme-surface/40 backdrop-blur-md p-3 transition-all hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-theme-accent/10 cursor-pointer overflow-hidden border border-white/5'
                onClick={() => playTrackNow(track)}
                onContextMenu={(e) => openMenu(e, track)}
              >
                <div className='h-16 w-16 shrink-0 overflow-hidden rounded-xl shadow-lg'>
                  {track.thumbnailUrl ? (
                    <img src={getHighResUrl(track.thumbnailUrl)} alt={track.title} className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105' onError={(e) => handleImgError(e)} />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center bg-black text-theme-subtext'>♪</div>
                  )}
                </div>
                <div className='flex flex-col truncate pr-2'>
                  <span className='truncate font-medium text-white/90 drop-shadow-sm'>{track.title}</span>
                  <span className='truncate text-xs text-theme-subtext mt-0.5'>{track.artist ?? 'Unknown Artist'}</span>
                </div>
                
                {/* Play Button Overlay */}
                <div className='absolute right-4 opacity-0 transition-all group-hover:opacity-100'>
                  <button className='flex h-10 w-10 items-center justify-center rounded-full bg-theme-accent text-white shadow-[0_0_15px_rgba(139,92,246,0.6)] hover:scale-110 hover:brightness-125 transition-all'>
                    <Play className='h-5 w-5 ml-1 fill-current' />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className='mb-6 text-3xl font-bold text-white drop-shadow-md'>Suggestions for You</h2>
        {suggestions.length === 0 ? (
          <div className='flex h-48 items-center justify-center rounded-2xl bg-gradient-to-br from-theme-surface/60 to-theme-elevated/40 border border-white/5 backdrop-blur-md shadow-inner'>
            <span className='text-theme-subtext/70'>Play more tracks to generate dynamic AI suggestions...</span>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
            {suggestions.map((track: any, i: number) => (
               <div 
                 key={`${track.youtubeId}-${i}-home`}
                 className='group flex flex-col gap-3 rounded-2xl p-4 transition-all hover:bg-white/5 bg-theme-surface/30 border border-white/5 shadow-md relative'
                 onContextMenu={(e) => openMenu(e, track)}
               >
                 <div className='relative aspect-square w-full overflow-hidden rounded-xl bg-stone-800 shadow-lg'>
                   {track.thumbnailUrl && (
                     <img src={getHighResUrl(track.thumbnailUrl)} className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105' alt={track.title} onError={(e) => handleImgError(e)} />
                   )}
                   <div className='absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center gap-4'>
                     <button
                       onClick={() => {
                         if (repeat === 'all' && suggestions.length > 1) {
                           loadPlaylist(suggestions, i)
                         } else {
                           playTrackNow(track)
                         }
                       }}
                       className='flex h-12 w-12 items-center justify-center rounded-full bg-theme-accent text-white shadow-[0_0_20px_rgba(236,72,153,0.5)] hover:scale-110 active:scale-95 transition-all'
                     >
                       <Play className='h-6 w-6 ml-1 fill-current' />
                     </button>
                   </div>
                 </div>
                 <div className='flex flex-col min-w-0'>
                   <span className='truncate font-bold text-white/90 drop-shadow-sm group-hover:text-theme-cyan transition-colors'>{track.title}</span>
                   <span className='truncate text-sm text-theme-subtext mt-1'>{track.artist || 'Unknown'}</span>
                 </div>
                 <button
                   onClick={() => addToQueue(track)}
                   className='absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all text-white p-2 rounded-full bg-black/50 hover:bg-theme-accent hover:scale-110 shadow-lg'
                   title="Add to Queue"
                 >
                   <Plus className='h-5 w-5' />
                 </button>
               </div>
            ))}
          </div>
        )}
      </div>

      {/* YouTube Music Explore — Curated Playlists */}
      {exploreLoading && (
        <div className='flex items-center gap-3 py-10 text-[#a7a7a7]'>
          <Loader2 className='h-6 w-6 animate-spin text-theme-accent' />
          <span className='font-medium'>Loading playlists...</span>
        </div>
      )}

      {exploreSections.map((section, si) => (
        <div key={`explore-${si}`}>
          <h2 className='mb-6 text-3xl font-bold text-white drop-shadow-md'>{section.title}</h2>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {section.playlists.map((pl, pi) => (
              <motion.div
                key={`${pl.browseId}-${pi}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pi * 0.03 }}
                onClick={() => setActiveView(`album-${pl.browseId}` as any)}
                className='group flex flex-col gap-3 rounded-2xl p-4 transition-all hover:bg-white/5 bg-theme-surface/30 border border-white/5 shadow-md cursor-pointer'
              >
                <div className='relative aspect-square w-full overflow-hidden rounded-xl bg-stone-800 shadow-lg'>
                  {pl.thumbnailUrl && (
                    <img
                      src={getHighResUrl(pl.thumbnailUrl)}
                      className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                      alt={pl.title}
                      onError={(e) => handleImgError(e)}
                    />
                  )}
                  <div className='absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center'>
                    <Play className='h-10 w-10 text-white drop-shadow-lg' fill='currentColor' />
                  </div>
                </div>
                <div className='flex flex-col min-w-0'>
                  <span className='truncate font-bold text-white/90 drop-shadow-sm group-hover:text-theme-cyan transition-colors'>{pl.title}</span>
                  {pl.subtitle && (
                    <span className='truncate text-sm text-theme-subtext mt-1'>{pl.subtitle}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
