import { create } from 'zustand'

export interface SavedYtmPlaylist {
  playlistId: string
  title: string
  author: string
  thumbnailUrl: string | null
  trackCount: number | null
  type?: 'album' | 'playlist'
  savedAt: number
}

const STORAGE_KEY = 'stanza:saved-ytm-playlists'

function loadFromStorage(): SavedYtmPlaylist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(playlists: SavedYtmPlaylist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists))
}

interface SavedPlaylistsState {
  savedPlaylists: SavedYtmPlaylist[]
  savePlaylist: (pl: Omit<SavedYtmPlaylist, 'savedAt'>) => void
  removePlaylist: (playlistId: string) => void
  isSaved: (playlistId: string) => boolean
}

export const useSavedPlaylistsStore = create<SavedPlaylistsState>((set, get) => ({
  savedPlaylists: loadFromStorage(),

  savePlaylist: (pl) => {
    const existing = get().savedPlaylists
    if (existing.some(p => p.playlistId === pl.playlistId)) return
    const updated = [...existing, { ...pl, savedAt: Date.now() }]
    saveToStorage(updated)
    set({ savedPlaylists: updated })
  },

  removePlaylist: (playlistId) => {
    const updated = get().savedPlaylists.filter(p => p.playlistId !== playlistId)
    saveToStorage(updated)
    set({ savedPlaylists: updated })
  },

  isSaved: (playlistId) => {
    return get().savedPlaylists.some(p => p.playlistId === playlistId)
  },
}))
