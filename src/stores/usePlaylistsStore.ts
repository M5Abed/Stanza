import { create } from 'zustand'
import { QueueTrack as Track } from './usePlayerStore'

type SavedSong = {
  youtubeId: string
  title: string
  artist: string | null
  album: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
}

export type PlaylistType = {
  id: string
  name: string
  coverUrl?: string | null
  sortOrder: number
  offlineEnabled?: boolean
  tracks: { position: number; song: SavedSong }[]
}

interface PlaylistsState {
  playlists: PlaylistType[]
  likedSongsPlaylistId: string | null
  isLoading: boolean
  error: string | null

  fetchPlaylists: () => Promise<void>
  createPlaylist: (name: string) => Promise<void>
  renamePlaylist: (playlistId: string, name: string) => Promise<void>
  updateCover: (playlistId: string) => Promise<void>
  deletePlaylist: (playlistId: string) => Promise<void>
  addTrack: (playlistId: string, track: Track) => Promise<void>
  removeTrack: (playlistId: string, youtubeId: string) => Promise<void>
  toggleLiked: (track: Track) => Promise<void>
  isLiked: (youtubeId: string) => boolean
}

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  playlists: [],
  likedSongsPlaylistId: null,
  isLoading: false,
  error: null,

  fetchPlaylists: async () => {
    if (!window.vibestream) return
    set({ isLoading: true, error: null })
    try {
      const data = await window.vibestream.getPlaylists()
      // Filter out duplicate 'Liked Songs' if database created multiples
      const uniquePlaylists = data.filter((p: PlaylistType, index: number, self: PlaylistType[]) =>
        index === self.findIndex((t) => (
          t.name === 'Liked Songs' ? t.name === p.name : t.id === p.id
        ))
      )
      
      const liked = uniquePlaylists.find((p: PlaylistType) => p.name === 'Liked Songs')
      set({ playlists: uniquePlaylists, likedSongsPlaylistId: liked?.id ?? null })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  createPlaylist: async (name: string) => {
    if (!window.vibestream) return
    try {
      await window.vibestream.createPlaylist(name)
      await get().fetchPlaylists() // reload everything
    } catch (err) {
      console.error('Failed to create playlist:', err)
    }
  },

  renamePlaylist: async (playlistId: string, name: string) => {
    if (!window.vibestream) return
    try {
      await window.vibestream.renamePlaylist(playlistId, name)
      await get().fetchPlaylists() // sync layout
    } catch (err) {
      console.error('Failed to rename playlist:', err)
    }
  },

  updateCover: async (playlistId: string) => {
    if (!window.vibestream) return
    try {
      const res = await window.vibestream.updatePlaylistCover(playlistId)
      if (res.coverUrl) {
        await get().fetchPlaylists()
      }
    } catch (err) {
      console.error('Failed to update playlist cover:', err)
    }
  },

  deletePlaylist: async (playlistId: string) => {
    if (!window.vibestream) return
    try {
      await window.vibestream.deletePlaylist(playlistId)
      await get().fetchPlaylists() // reload everything
    } catch (err) {
      console.error('Failed to delete playlist:', err)
    }
  },

  addTrack: async (playlistId: string, track: Track) => {
    if (!window.vibestream) return
    try {
      // Upsert the song first so DB integrity is maintained
      await window.vibestream.songUpsert({
        youtubeId: track.youtubeId,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.thumbnailUrl,
        durationSeconds: track.durationSeconds,
      })
      
      // Then add reference into playlist
      await window.vibestream.addTrackToPlaylist(playlistId, track.youtubeId)
      await get().fetchPlaylists()
    } catch (err) {
      console.error('Failed to add track:', err)
    }
  },

  removeTrack: async (playlistId: string, youtubeId: string) => {
    if (!window.vibestream) return
    try {
      await window.vibestream.removeTrackFromPlaylist(playlistId, youtubeId)
      await get().fetchPlaylists()
    } catch (err) {
      console.error('Failed to remove track:', err)
    }
  },

  toggleLiked: async (track: Track) => {
    const { likedSongsPlaylistId, isLiked, addTrack, removeTrack } = get()
    if (!likedSongsPlaylistId) return

    if (isLiked(track.youtubeId)) {
      await removeTrack(likedSongsPlaylistId, track.youtubeId)
    } else {
      await addTrack(likedSongsPlaylistId, track)
    }
  },

  isLiked: (youtubeId: string) => {
    const { playlists, likedSongsPlaylistId } = get()
    if (!likedSongsPlaylistId) return false
    const liked = playlists.find(p => p.id === likedSongsPlaylistId)
    if (!liked) return false
    return liked.tracks.some(t => t.song.youtubeId === youtubeId)
  }
}))
