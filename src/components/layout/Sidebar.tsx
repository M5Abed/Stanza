import { Home, Search, Library, Plus, Heart } from 'lucide-react'
import { useEffect } from 'react'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore } from '@/stores/useUIStore'

export function Sidebar() {
  const { playlists, createPlaylist, fetchPlaylists } = usePlaylistsStore()
  const { activeView, setActiveView } = useUIStore()

  useEffect(() => {
    fetchPlaylists()
  }, [fetchPlaylists])

  const handleCreatePlaylist = () => {
    const listCount = playlists.filter(p => p.name !== 'Liked Songs').length
    createPlaylist(`My Playlist #${listCount + 1}`)
  }

  return (
    <aside className='flex w-64 flex-col gap-4 bg-theme-surface/70 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/5 p-4 mt-1 mb-1'>
      {/* Top Navigation */}
      <div className='flex flex-col gap-2'>
        <button 
          onClick={() => setActiveView('home')}
          className={`group flex items-center gap-4 py-3 px-4 rounded-2xl font-semibold transition-all hover:bg-white/5 hover:text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] ${activeView === 'home' ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'text-theme-subtext'}`}
        >
          <Home className='h-6 w-6 transition-transform group-hover:scale-110' />
          <span>Home</span>
        </button>
        <button 
          onClick={() => setActiveView('search')}
          className={`group flex items-center gap-4 py-3 px-4 rounded-2xl font-semibold transition-all hover:bg-white/5 hover:text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] ${activeView === 'search' ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'text-theme-subtext'}`}
        >
          <Search className='h-6 w-6 transition-transform group-hover:scale-110' />
          <span>Search</span>
        </button>
        <button 
          onClick={() => setActiveView('radio')}
          className={`group flex items-center gap-4 py-3 px-4 rounded-2xl font-semibold transition-all hover:bg-white/5 hover:text-white hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] ${activeView === 'radio' ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(236,72,153,0.2)]' : 'text-theme-subtext'}`}
        >
          <svg className='h-6 w-6 transition-transform group-hover:scale-110' fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <span>Suggestions</span>
        </button>
      </div>

      <div className='h-px w-full bg-white/10 my-2 rounded-full' />

      {/* Library Section */}
      <div className='flex min-h-0 flex-1 flex-col'>
        <div className='flex items-center justify-between px-4 pb-4'>
          <button className='group flex items-center gap-3 font-semibold text-theme-subtext transition-colors hover:text-white'>
            <Library className='h-6 w-6 transition-transform group-hover:scale-110' />
            <span>Your Library</span>
          </button>
          <button 
            onClick={handleCreatePlaylist}
            className='flex h-8 w-8 items-center justify-center rounded-full text-theme-subtext transition-all hover:bg-white/10 hover:text-theme-accent'
          >
            <Plus className='h-5 w-5' />
          </button>
        </div>

        {/* Playlists / Items container */}
        <div className='flex-1 overflow-y-auto px-1 py-2 space-y-1'>
          {playlists.map((playlist) => {
            const isActive = activeView === `playlist-${playlist.id}`
            return (
            <button
              key={playlist.id}
              onClick={() => setActiveView(`playlist-${playlist.id}`)}
              className={`flex w-full items-center gap-4 rounded-2xl p-2 text-left text-sm transition-all hover:bg-white/5 hover:text-white ${isActive ? 'bg-white/10 text-white' : 'text-theme-subtext'}`}
            >
              <div className='h-12 w-12 shrink-0 rounded-xl bg-theme-elevated flex items-center justify-center shadow-inner overflow-hidden'>
                 {playlist.name === 'Liked Songs' ? (
                   <div className='h-full w-full bg-black flex items-center justify-center shadow-lg text-theme-accent font-bold'>
                     <Heart className='h-6 w-6' fill='currentColor' />
                   </div>
                 ) : (
                   <>
                     <div className='h-6 w-6 rounded-full bg-theme-accent/20 blur-sm absolute' />
                     ♪
                   </>
                 )}
              </div>
              <div className='flex flex-col truncate relative z-10'>
                <span className='truncate font-medium text-white/90'>{playlist.name}</span>
                <span className='truncate text-xs text-theme-subtext/70 mt-0.5'>Playlist • {playlist.tracks.length} songs</span>
              </div>
            </button>
          )})}
        </div>
      </div>
    </aside>
  )
}

