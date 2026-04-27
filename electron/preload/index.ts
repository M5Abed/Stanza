import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload)
}

type SpotifySearchResponse =
  | { configured: false; tracks: []; artists: [] }
  | {
      configured: true
      tracks: {
        spotifyId: string
        name: string
        artists: string
        album: string | null
        imageUrl: string | null
        durationMs: number
        explicit: boolean
        previewUrl: string | null
      }[]
      artists: {
        spotifyId: string
        name: string
        imageUrl: string | null
        followers: number | null
        genres: string[]
      }[]
      error?: string
    }

/** Used by the legacy auto-updater UI (`components/update`). Prefer `window.vibestream` for new code. */
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...evtArgs) => listener(event, ...evtArgs))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('vibestream', {
  searchMusic: (query: string) => invoke(IpcChannels.searchMusic, { query }),
  searchArtists: (query: string) => invoke(IpcChannels.searchArtists, { query }),
  getPlaybackUrl: (youtubeId: string) => invoke<{ playbackUrl: string }>(IpcChannels.getPlaybackUrl, { youtubeId }),
  songUpsert: (payload: unknown) => invoke(IpcChannels.songUpsert, payload),
  saveManualLyrics: (youtubeId: string, lrcRaw: string) =>
    invoke(IpcChannels.manualLyricsSave, { youtubeId, lrcRaw }),
  getManualLyrics: (youtubeId: string) => invoke(IpcChannels.manualLyricsGet, { youtubeId }),
  listCleaningTerms: () => invoke(IpcChannels.cleaningTermsList),
  upsertCleaningTerm: (payload: unknown) => invoke(IpcChannels.cleaningTermsUpsert, payload),
  deleteCleaningTerm: (id: string) => invoke(IpcChannels.cleaningTermsDelete, { id }),
  getLyrics: (payload: { youtubeId: string; title: string; artist?: string | null }) =>
    invoke<{ source: 'local' | 'lrclib' | 'genius' | 'none'; lrcRaw: string | null }>(IpcChannels.lyricsGet, payload),
  spotifySearch: (query: string, limit?: number) =>
    invoke<SpotifySearchResponse>(IpcChannels.spotifySearch, { query, limit }),
  getPlaylists: () => invoke<any>(IpcChannels.playlistsGet),
  createPlaylist: (name: string) => invoke<any>(IpcChannels.playlistsCreate, { name }),
  addTrackToPlaylist: (playlistId: string, youtubeId: string) =>
    invoke<any>(IpcChannels.playlistsAddTrack, { playlistId, youtubeId }),
  removeTrackFromPlaylist: (playlistId: string, youtubeId: string) =>
    invoke<any>(IpcChannels.playlistsRemoveTrack, { playlistId, youtubeId }),
  renamePlaylist: (playlistId: string, name: string) =>
    invoke<any>(IpcChannels.playlistsRename, { playlistId, name }),
  setFullscreen: (isFullscreen: boolean) =>
    invoke<void>(IpcChannels.windowSetFullscreen, isFullscreen),
  registerThumbarIcons: (icons: Record<string, string>) => 
    ipcRenderer.send(IpcChannels.thumbarRegisterIcons, icons),
  updateThumbar: (state: { isPlaying: boolean }) => 
    ipcRenderer.send(IpcChannels.thumbarUpdate, state),
  onThumbarAction: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action)
    ipcRenderer.on(IpcChannels.thumbarAction, handler)
    return () => { ipcRenderer.off(IpcChannels.thumbarAction, handler) }
  },
  updateRpc: (payload: { title?: string, artist?: string, duration?: number, currentTime?: number, isPlaying?: boolean, thumbnailUrl?: string }) => {
    ipcRenderer.send('update-rpc', payload)
  },
  getRadioRecommendations: (youtubeId: string) => invoke<any[]>(IpcChannels.radioGetRecommendations, { youtubeId }),
  getArtistDetails: (artistId: string) => invoke<any>(IpcChannels.artistGetDetails, { artistId }),
  getAlbumDetails: (albumId: string) => invoke<any>(IpcChannels.albumGetDetails, { albumId }),
  // Downloads & Offline
  downloadSong: (youtubeId: string) => invoke<{ ok: boolean; path: string }>(IpcChannels.downloadSong, { youtubeId }),
  deleteSong: (youtubeId: string) => invoke<{ ok: boolean }>(IpcChannels.deleteSong, { youtubeId }),
  isDownloaded: (youtubeId: string) => invoke<{ downloaded: boolean }>(IpcChannels.isDownloaded, { youtubeId }),
  setPlaylistOffline: (playlistId: string, enabled: boolean) =>
    invoke<{ ok: boolean }>(IpcChannels.playlistSetOffline, { playlistId, enabled }),
  onDownloadProgress: (callback: (data: { youtubeId: string; progress: number }) => void) => {
    const handler = (_event: any, data: { youtubeId: string; progress: number }) => callback(data)
    ipcRenderer.on(IpcChannels.downloadProgress, handler)
    return () => { ipcRenderer.off(IpcChannels.downloadProgress, handler) }
  },
  // Mini-player
  setMiniPlayer: (enabled: boolean) => invoke<void>(IpcChannels.setMiniPlayer, enabled),
  // Lyrics sharing
  exportLyrics: (lrcRaw: string, suggestedName: string) =>
    invoke<{ ok: boolean; path?: string }>(IpcChannels.lyricsExport, { lrcRaw, suggestedName }),
  importLyrics: () =>
    invoke<{ ok: boolean; lrcRaw: string | null }>(IpcChannels.lyricsImport),
})
