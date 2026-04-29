import { useState, useRef, useEffect } from 'react'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useUIStore } from '@/stores/useUIStore'
import { Play, Edit2, Check, X, Clock, Music2, Trash2, Heart, Download, WifiOff } from 'lucide-react'
import { getHighResUrl, handleImgError } from '@/utils/image'

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const { playlists, renamePlaylist, removeTrack, deletePlaylist } = usePlaylistsStore()
  const playlist = playlists.find((p) => p.id === playlistId)
  const [offlineEnabled, setOfflineEnabled] = useState(playlist?.offlineEnabled ?? false)
  
  const current = usePlayerStore((s) => s.queue[s.currentIndex])
  const loadPlaylist = usePlayerStore((s) => s.loadPlaylist)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  if (!playlist) return <div className='p-6 text-theme-subtext font-medium'>Playlist not found.</div>

  const isLikedSongs = playlist.name === 'Liked Songs'

  const handleSaveRename = () => {
    if (editName.trim() && editName !== playlist.name) {
      renamePlaylist(playlist.id, editName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRename()
    if (e.key === 'Escape') setIsEditing(false)
  }

  // Calculate total duration
  const totalSec = playlist.tracks.reduce((acc, t) => acc + (t.song.durationSeconds ?? 0), 0)
  const totalMin = Math.floor(totalSec / 60)

  return (
    <div className='flex flex-col h-full animate-in fade-in'>
      {/* Header */}
      <div className='flex flex-col md:flex-row items-end gap-8 p-8 border-b border-white/5 bg-gradient-to-b from-theme-elevated/80 to-transparent'>
        <div className='h-48 w-48 shrink-0 shadow-[0_15px_40px_rgba(0,0,0,0.5)] rounded-2xl flex items-center justify-center bg-[#111] overflow-hidden relative'>
           {isLikedSongs ? (
             <div className='absolute inset-0 bg-gradient-to-tr from-theme-accent to-pink-600' />
           ) : playlist.tracks.length > 0 && playlist.tracks[0].song.thumbnailUrl ? (
             <img src={getHighResUrl(playlist.tracks[0].song.thumbnailUrl)} className='h-full w-full object-cover opacity-90' onError={(e) => handleImgError(e)} />
           ) : (
             <div className='absolute inset-0 bg-theme-surface' />
           )}
           {isLikedSongs && <Heart className='h-20 w-20 text-white drop-shadow-2xl z-10' fill='currentColor' />}
           {!isLikedSongs && (!playlist.tracks.length || !playlist.tracks[0].song.thumbnailUrl) && <Music2 className='h-16 w-16 text-theme-subtext/50 z-10' />}
        </div>
        
        <div className='flex flex-col gap-3 min-w-0'>
          <span className='text-xs font-bold uppercase tracking-widest text-theme-subtext drop-shadow-sm'>Playlist</span>
          
          <div className='group flex items-center gap-4'>
            {isEditing && !isLikedSongs ? (
              <div className='flex items-center gap-3'>
                <input
                  ref={inputRef}
                  type='text'
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className='bg-white/10 px-4 py-2 rounded-xl text-3xl md:text-5xl font-black text-white outline-none focus:ring-2 focus:ring-theme-accent w-full max-w-xl'
                />
                <button onClick={handleSaveRename} className='p-3 bg-theme-accent rounded-full text-white shadow-xl hover:scale-110 transition-transform'>
                  <Check className='h-6 w-6' />
                </button>
                <button onClick={() => setIsEditing(false)} className='p-3 bg-white/10 rounded-full text-white shadow-xl hover:bg-white/20 transition-colors'>
                  <X className='h-6 w-6' />
                </button>
              </div>
            ) : (
              <>
                <h1 className='text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md truncate max-w-3xl'>
                  {playlist.name}
                </h1>
                {!isLikedSongs && playlist.name !== 'Downloaded Songs' && (
                  <>
                    <button 
                      onClick={() => { setEditName(playlist.name); setIsEditing(true) }}
                      className='opacity-0 group-hover:opacity-100 transition-opacity p-2.5 rounded-full hover:bg-white/10 text-theme-subtext hover:text-white'
                      title='Rename Playlist'
                    >
                      <Edit2 className='h-5 w-5' />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete the playlist "${playlist.name}"?`)) {
                          deletePlaylist(playlist.id)
                          useUIStore.getState().setActiveView('home')
                        }
                      }}
                      className='opacity-0 group-hover:opacity-100 transition-opacity p-2.5 rounded-full hover:bg-red-600/20 text-theme-subtext hover:text-red-400'
                      title='Delete Playlist'
                    >
                      <Trash2 className='h-5 w-5' />
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className='text-sm font-medium text-theme-subtext mt-2 flex items-center gap-2'>
            <span className='text-white'>{playlist.tracks.length} songs</span>
            <span>•</span>
            <span>{totalMin} min</span>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className='p-6 flex items-center gap-6 border-b border-white/5'>
        <button
          onClick={() => {
            if (playlist.tracks.length > 0) {
              const tracks = playlist.tracks.map((t) => t.song)
              loadPlaylist(tracks, 0)
            }
          }}
          disabled={playlist.tracks.length === 0}
          className='flex h-14 w-14 items-center justify-center rounded-full bg-theme-accent text-white shadow-[0_0_20px_rgba(212,0,33,0.3)] hover:scale-105 hover:bg-red-600 disabled:opacity-50 disabled:hover:scale-100 transition-all cursor-pointer'
        >
          <Play className='h-6 w-6 ml-1 fill-current' />
        </button>
        {/* Offline Toggle */}
        <button
          onClick={async () => {
            const next = !offlineEnabled
            setOfflineEnabled(next)
            await window.vibestream?.setPlaylistOffline(playlist.id, next)
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${offlineEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-theme-subtext hover:text-white hover:bg-white/10 border border-white/10'}`}
          title={offlineEnabled ? 'Offline mode enabled' : 'Enable offline mode'}
        >
          {offlineEnabled ? <Check className='h-4 w-4' /> : <Download className='h-4 w-4' />}
          {offlineEnabled ? 'Available Offline' : 'Download All'}
        </button>
      </div>

      {/* Track List */}
      <div className='flex-1 overflow-y-auto px-6 pb-[200px]'>
        <div className='grid grid-cols-[20px_1fr_minmax(120px,200px)_60px_40px] items-center gap-6 px-4 py-3 text-xs font-bold uppercase tracking-wider text-theme-subtext border-b border-white/5 sticky top-0 bg-theme-surface/90 backdrop-blur z-10'>
          <span className='text-center'>#</span>
          <span>Title</span>
          <span>Album</span>
          <span><Clock className='h-4 w-4 mx-auto' /></span>
          <span></span>
        </div>

        <div className='mt-2 flex flex-col gap-1'>
          {playlist.tracks.map((t, idx) => {
            const track = t.song
            const isPlayingThis = current?.youtubeId === track.youtubeId
            
            return (
              <div 
                key={track.youtubeId + idx}
                className={`group grid grid-cols-[20px_1fr_minmax(120px,200px)_60px_40px] items-center gap-6 rounded-xl px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer ${isPlayingThis ? 'bg-white/10 shadow-sm' : ''}`}
                onDoubleClick={() => loadPlaylist(playlist.tracks.map(p => p.song), idx)}
              >
                <div className='flex items-center justify-center relative w-6 h-6 mx-auto'>
                  <span className='text-sm font-medium text-theme-subtext text-center absolute inset-0 group-hover:opacity-0 transition-opacity flex items-center justify-center'>{idx + 1}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); loadPlaylist(playlist.tracks.map(p => p.song), idx) }}
                    className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white hover:text-theme-accent transition-all hover:scale-110'
                    title='Play Track'
                  >
                    <Play className='h-4 w-4 fill-current' />
                  </button>
                </div>
                
                <div className='flex items-center gap-4 min-w-0'>
                  <div className='h-10 w-10 shrink-0 overflow-hidden rounded bg-[#111] shadow'>
                    {track.thumbnailUrl ? (
                      <img src={getHighResUrl(track.thumbnailUrl)} className='h-full w-full object-cover opacity-90' onError={(e) => handleImgError(e)} />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center'>
                         <Music2 className='h-4 w-4 text-[#a7a7a7]' />
                      </div>
                    )}
                  </div>
                  <div className='flex flex-col truncate'>
                    <span className={`truncate font-semibold ${isPlayingThis ? 'text-theme-accent' : 'text-white/95'}`}>{track.title}</span>
                    {track.artist && <span className='truncate text-xs text-theme-subtext mt-0.5'>{track.artist}</span>}
                  </div>
                </div>

                <div className='truncate text-sm font-medium text-theme-subtext/80'>{track.album || ''}</div>
                <div className='text-sm font-medium text-theme-subtext/80 text-center'>{track.durationSeconds ? `${Math.floor(track.durationSeconds/60)}:${(track.durationSeconds%60).toString().padStart(2,'0')}` : '--:--'}</div>
                
                <div className='flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity'>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTrack(playlist.id, track.youtubeId) }}
                    className='text-theme-subtext hover:text-white p-2 rounded-full hover:bg-red-600 transition-colors'
                    title='Remove from Playlist'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              </div>
            )
          })}
          {playlist.tracks.length === 0 && (
            <div className='py-20 flex flex-col items-center justify-center text-theme-subtext'>
              <Music2 className='h-12 w-12 mb-4 opacity-50' />
              <span className='font-medium'>This playlist is currently empty.</span>
              <span className='text-sm mt-1'>Add tracks from the library to get started.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
