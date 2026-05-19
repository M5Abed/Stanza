export interface VibestreamPreload {
  searchMusic: (query: string) => Promise<
    {
      youtubeId: string
      title: string
      artist: string | null
      album: string | null
      thumbnailUrl: string | null
      durationSeconds: number | null
      isExplicit: boolean
    }[]
  >
  searchArtists: (query: string) => Promise<
    {
      artistId: string
      name: string
      thumbnailUrl: string | null
      subscribers: string | null
    }[]
  >
  searchPlaylists: (query: string) => Promise<
    {
      playlistId: string
      title: string
      author: string
      thumbnailUrl: string | null
      trackCount: number | null
    }[]
  >
  getPlaybackUrl: (youtubeId: string) => Promise<{ playbackUrl: string }>
  songUpsert: (payload: unknown) => Promise<unknown>
  saveManualLyrics: (youtubeId: string, lrcRaw: string) => Promise<unknown>
  getManualLyrics: (youtubeId: string) => Promise<{ youtubeId: string; lrcRaw: string; updatedAt: string } | null>
  listCleaningTerms: () => Promise<
    { id: string; term: string; sortOrder: number; enabled: boolean; createdAt: string }[]
  >
  upsertCleaningTerm: (payload: unknown) => Promise<unknown>
  deleteCleaningTerm: (id: string) => Promise<{ ok: true }>
  getLyrics: (payload: {
    youtubeId: string
    title: string
    artist?: string | null
  }) => Promise<{ source: 'local' | 'lrclib' | 'none'; lrcRaw: string | null }>
  spotifySearch: (
    query: string,
    limit?: number,
  ) => Promise<
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
  >
  getPlaylists: () => Promise<any[]>
  createPlaylist: (name: string) => Promise<any>
  renamePlaylist: (playlistId: string, name: string) => Promise<any>
  updatePlaylistCover: (playlistId: string) => Promise<{ coverUrl: string | null }>
  deletePlaylist: (playlistId: string) => Promise<any>
  addTrackToPlaylist: (playlistId: string, youtubeId: string) => Promise<any>
  removeTrackFromPlaylist: (playlistId: string, youtubeId: string) => Promise<any>
  setFullscreen: (isFullscreen: boolean) => Promise<void>
  registerThumbarIcons: (icons: Record<string, string>) => void
  updateThumbar: (state: { isPlaying: boolean }) => void
  onThumbarAction: (callback: (action: string) => void) => () => void
  updateRpc: (payload: { title?: string, artist?: string, duration?: number, currentTime?: number, isPlaying?: boolean, thumbnailUrl?: string }) => void
  getRadioRecommendations: (youtubeId: string) => Promise<any[]>
  getArtistDetails: (artistId: string) => Promise<any>
  getAlbumDetails: (albumId: string) => Promise<any>
  // Downloads & Offline
  downloadSong: (youtubeId: string) => Promise<{ ok: boolean; path: string }>
  deleteSong: (youtubeId: string) => Promise<{ ok: boolean }>
  isDownloaded: (youtubeId: string) => Promise<{ downloaded: boolean }>
  setPlaylistOffline: (playlistId: string, enabled: boolean) => Promise<{ ok: boolean }>
  onDownloadProgress: (callback: (data: { youtubeId: string; progress: number }) => void) => () => void


  // Lyrics sharing
  exportLyrics: (lrcRaw: string, suggestedName: string) => Promise<{ ok: boolean; path?: string }>
  importLyrics: () => Promise<{ ok: boolean; lrcRaw: string | null }>
  // App visibility
  onAppVisibilityChange: (callback: (data: { visible: boolean }) => void) => () => void
  // Floating lyrics window
  openFloatingLyrics: () => Promise<{ ok: boolean }>
  closeFloatingLyrics: () => Promise<{ ok: boolean }>
  toggleFloatingLyricsPin: () => Promise<{ pinned: boolean }>
  sendFloatingLyricsState: (data: any) => void
  onFloatingLyricsState: (callback: (data: any) => void) => () => void
  onFloatingLyricsClosed: (callback: () => void) => () => void
  // Gemini AI

  getSongStory: (title: string, artist: string) => Promise<{ story: string; meaning: string; trivia: string }>
  getTrackViews: (youtubeId: string) => Promise<number>
  // YouTube Music Explore
  getExplorePlaylists: () => Promise<{ title: string; playlists: { browseId: string; title: string; subtitle: string; thumbnailUrl: string | null }[] }[]>
}

export {}
