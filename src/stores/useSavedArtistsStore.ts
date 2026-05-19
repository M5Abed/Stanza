import { create } from 'zustand'

export interface SavedArtist {
  artistId: string
  name: string
  thumbnailUrl: string | null
  savedAt: number
}

const STORAGE_KEY = 'stanza:saved-artists'

function loadFromStorage(): SavedArtist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(artists: SavedArtist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(artists))
}

interface SavedArtistsState {
  savedArtists: SavedArtist[]
  saveArtist: (artist: Omit<SavedArtist, 'savedAt'>) => void
  removeArtist: (artistId: string) => void
  isSaved: (artistId: string) => boolean
}

export const useSavedArtistsStore = create<SavedArtistsState>((set, get) => ({
  savedArtists: loadFromStorage(),

  saveArtist: (artist) => {
    const existing = get().savedArtists
    if (existing.some(a => a.artistId === artist.artistId)) return
    const updated = [...existing, { ...artist, savedAt: Date.now() }]
    saveToStorage(updated)
    set({ savedArtists: updated })
  },

  removeArtist: (artistId) => {
    const updated = get().savedArtists.filter(a => a.artistId !== artistId)
    saveToStorage(updated)
    set({ savedArtists: updated })
  },

  isSaved: (artistId) => {
    return get().savedArtists.some(a => a.artistId === artistId)
  },
}))
