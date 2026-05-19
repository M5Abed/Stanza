import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, ListPlus, Download, User, Disc, PlaySquare, Music2, Share2 } from 'lucide-react'
import { useContextMenuStore } from '@/stores/useContextMenuStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore } from '@/stores/useUIStore'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { splitArtists } from '@/components/ui/ArtistLinks'

export function ContextMenu() {
  const { isOpen, x, y, track, closeMenu } = useContextMenuStore()
  const [downloading, setDownloading] = useState(false)
  const [view, setView] = useState<'main' | 'playlists'>('main')
  
  const menuRef = useRef<HTMLDivElement>(null)
  
  const addToQueue = usePlayerStore(s => s.addToQueue)
  const playNext = usePlayerStore(s => s.playNext)
  const isLiked = usePlaylistsStore(s => s.isLiked)
  const toggleLiked = usePlaylistsStore(s => s.toggleLiked)
  const setActiveView = useUIStore(s => s.setActiveView)

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    
    // Listen for scroll to close the menu
    const handleScroll = () => {
      if (isOpen) closeMenu()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', handleScroll, true) // capture phase for any scroll
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, closeMenu])

  // Reset view when menu opens or track changes
  useEffect(() => {
    if (isOpen) setView('main')
  }, [isOpen, track])

  const { playlists, addTrack } = usePlaylistsStore()
  
  if (!isOpen || !track) return null

  // Calculate adjusted position to prevent clipping
  const menuWidth = 240
  const menuHeight = 350 // rough estimate
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x
  const adjustedY = y + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 10 : y

  const userPlaylists = playlists.filter(p => p.name !== 'Liked Songs' && p.name !== 'Downloaded Songs')

  const liked = isLiked(track.youtubeId)

  const handleDownload = async () => {
    if (!window.vibestream) return
    setDownloading(true)
    try {
      await window.vibestream.downloadSong(track.youtubeId)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
      closeMenu()
    }
  }

  const handleGoToArtist = (name: string) => {
    setActiveView(`artist-${name}` as any)
    closeMenu()
  }

  const handleGoToAlbum = () => {
    if (!track.album) return
    const query = track.artist ? `${track.artist} ${track.album}` : track.album
    setActiveView(`album-${query}` as any)
    closeMenu()
  }

  const handleAddToPlaylist = async (playlistId: string) => {
    if (track) {
      await addTrack(playlistId, track)
    }
    closeMenu()
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1, ease: 'easeOut' }}
        className='fixed z-[10000] w-60 rounded-xl bg-[#282828] border border-white/10 shadow-2xl overflow-hidden py-2 flex flex-col backdrop-blur-xl'
        style={{ top: adjustedY, left: adjustedX }}
      >
        {/* Header - Track Info */}
        <div className='flex items-center gap-3 px-4 py-2 border-b border-white/5 mb-1 select-none'>
          <div className='h-10 w-10 shrink-0 bg-[#121212] rounded overflow-hidden shadow'>
            {track.thumbnailUrl ? (
              <img src={getHighResUrl(track.thumbnailUrl)} className='h-full w-full object-cover' onError={handleImgError} />
            ) : (
              <div className='flex h-full w-full items-center justify-center text-white/30'><Music2 className='h-5 w-5' /></div>
            )}
          </div>
          <div className='flex flex-col min-w-0'>
            <span className='text-sm font-bold text-white truncate'>{track.title}</span>
            <span className='text-xs text-[#a7a7a7] truncate'>{track.artist || 'Unknown Artist'}</span>
          </div>
        </div>

        {/* Actions or Playlists Submenu */}
        {view === 'main' ? (
          <>
            <div className='flex flex-col px-2 gap-0.5'>
              <button 
                onClick={() => { playNext(track); closeMenu() }}
                className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors'
              >
                <PlaySquare className='h-4 w-4' /> Play Next
              </button>
              
              <button 
                onClick={() => { addToQueue(track); closeMenu() }}
                className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors'
              >
                <ListPlus className='h-4 w-4' /> Add to Queue
              </button>

              <button 
                onClick={() => setView('playlists')}
                className='flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors'
              >
                <div className='flex items-center gap-3'>
                  <ListPlus className='h-4 w-4' /> Add to Playlist
                </div>
                <span className='text-white/50 text-xs'>▶</span>
              </button>
              
              <button 
                onClick={() => { toggleLiked(track); closeMenu() }}
                className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors'
              >
                <Heart className={`h-4 w-4 ${liked ? 'fill-theme-accent text-theme-accent drop-shadow-[0_0_8px_rgba(212,0,33,0.5)]' : ''}`} /> 
                {liked ? 'Remove from Liked' : 'Save to Liked Songs'}
              </button>

              <button 
                onClick={handleDownload}
                disabled={downloading}
                className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors disabled:opacity-50'
              >
                <Download className={`h-4 w-4 ${downloading ? 'animate-bounce' : ''}`} /> 
                {downloading ? 'Downloading...' : 'Download Offline'}
              </button>
            </div>

            {/* Navigation Actions */}
            {(track.artist || track.album) && (
              <>
                <div className='h-[1px] bg-white/5 my-1.5 mx-3' />
                <div className='flex flex-col px-2 gap-0.5'>
                  {track.artist && splitArtists(track.artist).map((name) => (
                    <button
                      key={name}
                      onClick={() => handleGoToArtist(name)}
                      className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors'
                    >
                      <User className='h-4 w-4' /> Go to {name}
                    </button>
                  ))}
                  {track.album && (
                    <button 
                      onClick={handleGoToAlbum}
                      className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors'
                    >
                      <Disc className='h-4 w-4' /> Go to Album
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className='flex flex-col'>
            <div className='flex items-center gap-2 px-3 py-2 border-b border-white/5 mb-1'>
              <button onClick={() => setView('main')} className='p-1 hover:bg-white/10 rounded-md transition-colors'>
                <span className='text-white/70 text-xs'>◀</span>
              </button>
              <span className='text-sm font-bold text-white'>Add to Playlist</span>
            </div>
            <div className='flex flex-col max-h-60 overflow-y-auto px-2 gap-0.5 custom-scrollbar'>
              {userPlaylists.length > 0 ? (
                userPlaylists.map(playlist => (
                  <button
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist.id)}
                    className='flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/10 text-sm font-medium text-white/90 transition-colors text-left truncate'
                  >
                    <span className='truncate'>{playlist.name}</span>
                  </button>
                ))
              ) : (
                <div className='px-3 py-4 text-center text-sm text-theme-subtext'>
                  No playlists yet
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
