import { Trash2, Play } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore, type QueueTrack } from '@/stores/usePlayerStore'
import { useRadioStore } from '@/stores/useRadioStore'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { useContextMenuStore } from '@/stores/useContextMenuStore'

export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const playQueueIndex = usePlayerStore((s) => s.playQueueIndex)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)
  const openMenu = useContextMenuStore(s => s.openMenu)
  const clearQueue = usePlayerStore((s) => s.clearQueue)
  const reorderQueue = usePlayerStore((s) => s.reorderQueue)
  const repeat = usePlayerStore((s) => s.repeat)
  const playTrackNow = usePlayerStore((s) => s.playTrackNow)

  const isRadioEnabled = useRadioStore((s) => s.isRadioEnabled)
  const suggestions = useRadioStore((s) => s.suggestions)

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  if (queue.length === 0) return null

  return (
    <aside className='flex w-full flex-col'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-2xl font-bold tracking-tight text-white'>
          Next in queue
        </h2>
        <button
          type='button'
          onClick={clearQueue}
          className='text-[13px] font-bold text-[#a7a7a7] hover:text-white transition-colors'
          title='Clear queue'
        >
          Clear
        </button>
      </div>

      <div className='flex flex-col gap-4'>
        <ul className='space-y-0'>
          <AnimatePresence initial={false}>
            {(() => {
              let displayQueue = queue.map((t, i) => ({ t, i }))
              if (repeat === 'one') {
                displayQueue = displayQueue.filter(({ i }) => i === currentIndex)
              } else if (repeat === 'all') {
                displayQueue = [
                  ...displayQueue.slice(currentIndex),
                  ...displayQueue.slice(0, currentIndex)
                ]
              } else {
                displayQueue = displayQueue.slice(currentIndex)
              }

              return displayQueue.map(({ t, i }, visualIndex) => {
                const isPlaying = i === currentIndex

                return (
                  <motion.li
                    key={`${t.youtubeId}-${i}-${visualIndex}`}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    draggable
                    onDragStart={(e: any) => {
                      setDraggedIdx(i)
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                      setDragOverIdx(i)
                    }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (draggedIdx !== null && draggedIdx !== i) {
                        reorderQueue(draggedIdx, i)
                      }
                      setDraggedIdx(null)
                      setDragOverIdx(null)
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null)
                      setDragOverIdx(null)
                    }}
                    className={`group relative flex items-center justify-between rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10 cursor-grab active:cursor-grabbing ${
                      isPlaying ? 'bg-white/10' : ''
                    } ${dragOverIdx === i ? 'ring-2 ring-theme-accent' : ''} ${draggedIdx === i ? 'opacity-50' : ''}`}
                    onContextMenu={(e) => openMenu(e, t)}
                  >
                    <div className='flex items-center gap-4 flex-1 min-w-0'>
                      <div className='relative h-[40px] w-[40px] shrink-0 overflow-hidden shadow bg-[#282828]'>
                        {t.thumbnailUrl ? (
                           <img src={getHighResUrl(t.thumbnailUrl)} alt='' className='h-full w-full object-cover' onError={(e) => handleImgError(e)} />
                        ) : null}
                        <button 
                          onClick={() => playQueueIndex(i)}
                          className='absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100'
                        >
                          <Play className='h-5 w-5 text-white fill-current ml-0.5' />
                        </button>
                      </div>
                      
                      <button type='button' onClick={() => playQueueIndex(i)} className='flex flex-col min-w-0 flex-1 text-left justify-center cursor-default'>
                        <span className={`truncate text-[16px] font-normal cursor-pointer transition-colors group-hover:text-white ${isPlaying ? 'text-theme-accent font-bold drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]' : 'text-white/90'}`}>
                          {t.title}
                        </span>
                        <span className='truncate text-[14px] text-[#a7a7a7] hover:underline cursor-pointer group-hover:text-white transition-colors'>
                          {t.artist ?? 'Unknown artist'}
                        </span>
                      </button>
                    </div>

                    <button
                      type='button'
                      onClick={() => removeFromQueue(i)}
                      className='shrink-0 rounded p-1 text-[#a7a7a7] opacity-0 hover:text-white group-hover:opacity-100 transition-colors'
                      title='Remove'
                    >
                      <Trash2 className='h-5 w-5' />
                    </button>
                  </motion.li>
                )
              })
            })()}
          </AnimatePresence>
        </ul>
      </div>

      {/* Auto Play Suggestions */}
      {isRadioEnabled && suggestions.length > 0 && (
        <div className='mt-8 flex flex-col gap-4 animate-in fade-in'>
          <div className='flex items-center gap-4'>
            <div className='h-px flex-1 bg-white/10' />
            <h3 className='text-xs font-bold uppercase tracking-widest text-theme-accent drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]'>Auto Play</h3>
            <div className='h-px flex-1 bg-white/10' />
          </div>
          <ul className='space-y-0'>
            {suggestions.map((t, i) => (
              <li
                key={`radio-${t.youtubeId}-${i}`}
                className='group relative flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/5 opacity-70 hover:opacity-100 cursor-pointer'
                onContextMenu={(e) => openMenu(e, t)}
              >
                <div className='flex items-center gap-4 flex-1 min-w-0'>
                  <div className='relative h-[40px] w-[40px] shrink-0 overflow-hidden shadow bg-[#282828]'>
                    {t.thumbnailUrl ? (
                        <img src={getHighResUrl(t.thumbnailUrl)} alt='' className='h-full w-full object-cover' onError={(e) => handleImgError(e)} />
                    ) : null}
                    <button 
                      onClick={() => playTrackNow(t)}
                      className='absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100'
                    >
                      <Play className='h-5 w-5 text-white fill-current ml-0.5' />
                    </button>
                  </div>
                  
                  <button type='button' onClick={() => playTrackNow(t)} className='flex flex-col min-w-0 flex-1 text-left justify-center cursor-default'>
                    <span className='truncate text-[16px] font-normal cursor-pointer transition-colors group-hover:text-white text-white/70'>
                      {t.title}
                    </span>
                    <span className='truncate text-[14px] text-[#a7a7a7] hover:underline cursor-pointer group-hover:text-white transition-colors'>
                      {t.artist ?? 'Unknown artist'}
                    </span>
                  </button>
                </div>

                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation()
                    useRadioStore.getState().removeSuggestion(i)
                  }}
                  className='shrink-0 rounded p-1 text-[#a7a7a7] opacity-0 hover:text-red-400 group-hover:opacity-100 transition-colors z-10'
                  title='Remove from Auto Play'
                >
                  <Trash2 className='h-5 w-5' />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
