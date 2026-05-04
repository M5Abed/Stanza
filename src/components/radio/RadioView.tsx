import { useEffect } from 'react'
import { Plus, Play } from 'lucide-react'
import { useRadioStore } from '@/stores/useRadioStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { handleImgError } from '@/utils/image'

export function RadioView() {
  const suggestions = useRadioStore(s => s.suggestions)
  const isFetching = useRadioStore(s => s.isFetching)
  const isRadioEnabled = useRadioStore(s => s.isRadioEnabled)
  const toggleRadio = useRadioStore(s => s.toggleRadio)
  const fetchRecommendations = useRadioStore(s => s.fetchRecommendations)

  const queue = usePlayerStore(s => s.queue)
  const currentIndex = usePlayerStore(s => s.currentIndex)
  const playTrackNow = usePlayerStore(s => s.playTrackNow)
  const addToQueue = usePlayerStore(s => s.addToQueue)

  const currentTrack = queue[currentIndex]

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight text-white mb-2'>Stanza Radio</h2>
          <p className='text-theme-subtext text-sm max-w-xl'>
            Get personalized smart recommendations based on the currently playing track. 
            Toggle Auto-Play to automatically keep your queue going.
          </p>
        </div>

        <label className='relative flex cursor-pointer items-center'>
          <input 
            type='checkbox' 
            className='peer sr-only' 
            checked={isRadioEnabled} 
            onChange={toggleRadio} 
          />
          <div className="peer h-8 w-14 rounded-full bg-white/10 shadow-inner after:absolute after:left-1 after:top-[4px] after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-theme-accent peer-checked:after:translate-x-full peer-checked:after:border-white focus:outline-none" />
          <span className='ml-3 text-sm font-semibold text-white/90'>Auto Play</span>
        </label>
      </div>

      <div className='space-y-2 mt-4'>
        <h3 className='text-lg font-bold text-white/80 mb-4'>Recommendations</h3>
        
        {!currentTrack && (
          <div className='p-8 text-center text-theme-subtext'>Play a song to get started!</div>
        )}

        {isFetching && (
          <div className='flex justify-center p-8'>
            <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-theme-accent' />
          </div>
        )}

        {!isFetching && suggestions.length === 0 && currentTrack && (
          <div className='p-8 text-center text-theme-subtext'>No recommendations found.</div>
        )}

        {!isFetching && suggestions.map((track, i) => (
           <div 
             key={`${track.youtubeId}-${i}`}
             className='group flex items-center gap-4 rounded-xl p-2 transition-all hover:bg-white/5'
           >
             <div className='relative h-14 w-14 overflow-hidden rounded-md bg-stone-800 shadow-md'>
               {track.thumbnailUrl ? (
                 <img src={track.thumbnailUrl} className='h-full w-full object-cover' alt={track.title} onError={(e) => handleImgError(e)} />
               ) : (
                 <div className='flex h-full w-full items-center justify-center bg-stone-800 text-xs text-stone-500'>No Img</div>
               )}
               <button
                 onClick={() => playTrackNow(track)}
                 className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'
               >
                 <Play className='h-6 w-6 text-white' fill='currentColor' />
               </button>
             </div>
             <div className='flex flex-col flex-1 min-w-0'>
               <span className='truncate font-medium text-white/90'>{track.title}</span>
               <span className='truncate text-sm text-theme-subtext'>{track.artist || 'Unknown'}</span>
             </div>
             
             <button
               onClick={() => addToQueue(track)}
               className='mr-4 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white p-2 rounded-full hover:bg-white/10'
               title="Add to Queue"
             >
               <Plus className='h-5 w-5' />
             </button>
           </div>
        ))}
      </div>
    </div>
  )
}
