import { Trash2, Play } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore, type QueueTrack } from '@/stores/usePlayerStore'
import { getHighResUrl, handleImgError } from '@/utils/image'

export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const playQueueIndex = usePlayerStore((s) => s.playQueueIndex)
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue)
  const clearQueue = usePlayerStore((s) => s.clearQueue)
  const reorderQueue = usePlayerStore((s) => s.reorderQueue)
  const repeat = usePlayerStore((s) => s.repeat)

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
            {queue.map((t: QueueTrack, i: number) => {
              if (i < currentIndex) return null
              if (repeat === 'one' && i !== currentIndex) return null

              const isPlaying = i === currentIndex

              return (
                <motion.li
                  key={`${t.youtubeId}-${i}`}
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
            })}
          </AnimatePresence>
        </ul>
      </div>
    </aside>
  )
}
