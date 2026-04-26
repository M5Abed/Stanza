import { PlayerAudioBridge } from '@/components/player/PlayerAudioBridge'
import { ThumbarManager } from '@/components/ThumbarManager'
import { PlayerBar } from '@/components/player/PlayerBar'
import { QueuePanel } from '@/components/queue/QueuePanel'
import { SearchView } from '@/components/search/SearchView'
import { HomeView } from '@/components/home/HomeView'
import { PlaylistView } from '@/components/playlists/PlaylistView'
import { Sidebar } from '@/components/layout/Sidebar'
import { useUIStore } from '@/stores/useUIStore'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function BrowserFallback() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-zinc-300'>
      <h1 className='mb-2 text-2xl font-bold text-white'>zGrN</h1>
      <p className='max-w-md text-sm leading-relaxed'>
        This UI needs the <strong className='text-theme-cyan'>Electron</strong> app. Run{' '}
        <code className='rounded bg-white/10 px-1.5 py-0.5 text-white/80'>npm run dev</code> or double-click{' '}
        <code className='rounded bg-white/10 px-1.5 py-0.5 text-white/80'>Open-VibeStream.cmd</code>, then use the
        desktop window — not this browser tab.
      </p>
    </div>
  )
}

import { RadioView } from '@/components/radio/RadioView'
import { ArtistView } from '@/components/artist/ArtistView'
import { ArtistAllSongsView } from '@/components/artist/ArtistAllSongsView'
import { AlbumView } from '@/components/album/AlbumView'

function MainContent() {
  const activeView = useUIStore((s) => s.activeView)
  if (activeView === 'home') return <HomeView />
  if (activeView === 'search') return <SearchView />
  if (activeView === 'radio') return <RadioView />
  if (activeView.startsWith('artist-songs-')) return <ArtistAllSongsView artistId={activeView.replace('artist-songs-', '')} />
  if (activeView.startsWith('artist-')) return <ArtistView artistId={activeView.replace('artist-', '')} />
  if (activeView.startsWith('album-')) return <AlbumView albumId={activeView.replace('album-', '')} />
  return <PlaylistView playlistId={activeView.replace('playlist-', '')} />
}

export default function App() {
  const isElectron = typeof window !== 'undefined' && !!window.vibestream

  if (!isElectron) {
    return <BrowserFallback />
  }

  return (
    <div className='flex h-screen max-h-screen flex-col overflow-hidden bg-transparent text-theme-text relative'>
      {/* Custom Window Header */}
      <header 
        className='absolute top-0 left-0 right-0 z-50 flex h-[38px] shrink-0 items-center px-4 w-full select-none' 
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className='flex items-center gap-2 drop-shadow-md'>
           <div className='h-4 w-4 bg-gradient-to-tr from-theme-accent to-pink-500 rounded-full shadow-[0_0_10px_rgba(212,0,33,0.8)]' />
           <span className='text-[11px] font-black uppercase tracking-[0.2em] text-[#a7a7a7] mt-0.5'>Stanza</span>
        </div>
      </header>

      <PlayerAudioBridge />
      <ThumbarManager />
      
      {/* Top Section: Sidebar + Main Content */}
      <div className='flex min-h-0 flex-1 p-3 gap-3 pt-10'>
        <Sidebar />
        
        {/* Main Content Area */}
        <main className='flex flex-1 flex-col overflow-y-auto rounded-3xl bg-theme-surface/70 backdrop-blur-2xl shadow-xl border border-white/5'>
          <header className='sticky top-0 z-10 flex shrink-0 items-center justify-between rounded-t-3xl bg-theme-elevated/40 px-8 py-5 backdrop-blur-md border-b border-white/5'>
            <div className='flex items-center gap-3'>
              {/* Back / Forward navigation */}
              <div className='flex items-center gap-1'>
                <button
                  onClick={() => useUIStore.getState().goBack()}
                  disabled={!useUIStore.getState().canGoBack()}
                  className='flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-all disabled:opacity-30 disabled:cursor-default'
                  title='Go back'
                >
                  <ChevronLeft className='h-5 w-5' />
                </button>
                <button
                  onClick={() => useUIStore.getState().goForward()}
                  disabled={!useUIStore.getState().canGoForward()}
                  className='flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-all disabled:opacity-30 disabled:cursor-default'
                  title='Go forward'
                >
                  <ChevronRight className='h-5 w-5' />
                </button>
              </div>
              <h1 className='text-2xl font-bold tracking-tight text-white drop-shadow-md'>
                Stanza
              </h1>
            </div>
            {/* Can add User Profile or specific search input here later */}
          </header>

          <div className='flex-1 p-6'>
            <MainContent />
            {/* The Queue Panel */}
            <div className='mt-8'>
              <QueuePanel />
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Section: PlayerBar */}
      <PlayerBar />
    </div>
  )
}
