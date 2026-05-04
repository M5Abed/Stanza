/**
 * Spotify Web API — Client Credentials only (metadata). Playback stays on YouTube IDs.
 */

type TokenCache = { accessToken: string; expiresAtMs: number }

let tokenCache: TokenCache | null = null

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim()
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials()
  if (!creds) return null

  const now = Date.now()
  if (tokenCache && now < tokenCache.expiresAtMs - 60_000) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    console.error('[spotify] token error', res.status, await res.text().catch(() => ''))
    return null
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: json.access_token,
    expiresAtMs: now + json.expires_in * 1000,
  }
  return json.access_token
}

function bestImageUrl(images: { url: string; height?: number | null }[] | undefined): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
  return sorted[0]?.url ?? null
}

export interface SpotifyMetadataTrack {
  spotifyId: string
  name: string
  artists: string
  album: string | null
  imageUrl: string | null
  durationMs: number
  explicit: boolean
  previewUrl: string | null
}

export interface SpotifyMetadataArtist {
  spotifyId: string
  name: string
  imageUrl: string | null
  followers: number | null
  genres: string[]
}

export type SpotifySearchResult =
  | {
      configured: false
      tracks: []
      artists: []
    }
  | {
      configured: true
      tracks: SpotifyMetadataTrack[]
      artists: SpotifyMetadataArtist[]
      error?: string
    }

export async function spotifySearchMetadata(query: string, limit: number): Promise<SpotifySearchResult> {
  const creds = getCredentials()
  if (!creds) {
    return { configured: false, tracks: [], artists: [] }
  }

  const token = await getAccessToken()
  if (!token) {
    return { configured: true, tracks: [], artists: [], error: 'token_failed' }
  }

  const capped = Math.min(Math.max(limit, 1), 50)
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'track,artist')
  url.searchParams.set('limit', String(capped))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[spotify] search', res.status, body)
    return { configured: true, tracks: [], artists: [], error: `http_${res.status}` }
  }

  const data = (await res.json()) as {
    tracks?: {
      items?: {
        id: string
        name: string
        artists?: { name: string }[]
        album?: { name: string; images?: { url: string; height?: number | null }[] }
        duration_ms: number
        explicit: boolean
        preview_url: string | null
      }[]
    }
    artists?: {
      items?: {
        id: string
        name: string
        images?: { url: string; height?: number | null }[]
        followers?: { total: number }
        genres?: string[]
      }[]
    }
  }

  const tracks: SpotifyMetadataTrack[] = (data.tracks?.items ?? [])
    .filter((t) => t?.id && t?.name)
    .map((t) => ({
      spotifyId: t.id,
      name: t.name,
      artists: (t.artists ?? []).map((a) => a.name).filter(Boolean).join(', ') || 'Unknown',
      album: t.album?.name ?? null,
      imageUrl: bestImageUrl(t.album?.images),
      durationMs: t.duration_ms ?? 0,
      explicit: Boolean(t.explicit),
      previewUrl: t.preview_url,
    }))

  const artists: SpotifyMetadataArtist[] = (data.artists?.items ?? [])
    .filter((a) => a?.id && a?.name)
    .map((a) => ({
      spotifyId: a.id,
      name: a.name,
      imageUrl: bestImageUrl(a.images),
      followers: a.followers?.total ?? null,
      genres: a.genres ?? [],
    }))

  return { configured: true, tracks, artists }
}

/**
 * Quick single-track cover lookup via Spotify — with in-memory cache.
 * Returns the best album art URL (i.scdn.co, permanent, high-res) or null.
 */
const coverCache = new Map<string, { url: string | null; ts: number }>()
const COVER_CACHE_TTL = 60 * 60 * 1000 // 1 hour
const COVER_CACHE_MAX = 500

export async function spotifyFetchCoverUrl(title: string, artist: string): Promise<string | null> {
  const cacheKey = `${title.toLowerCase()}|${artist.toLowerCase()}`

  // Check cache
  const cached = coverCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < COVER_CACHE_TTL) {
    return cached.url
  }

  try {
    const creds = getCredentials()
    if (!creds) return null

    const token = await getAccessToken()
    if (!token) return null

    const q = `track:${title}${artist ? ` artist:${artist}` : ''}`
    const url = new URL('https://api.spotify.com/v1/search')
    url.searchParams.set('q', q)
    url.searchParams.set('type', 'track')
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      tracks?: { items?: { album?: { images?: { url: string; height?: number | null }[] } }[] }
    }

    const images = data.tracks?.items?.[0]?.album?.images
    const result = bestImageUrl(images)

    // Evict oldest entries if cache is full
    if (coverCache.size >= COVER_CACHE_MAX) {
      const oldest = coverCache.keys().next().value
      if (oldest) coverCache.delete(oldest)
    }
    coverCache.set(cacheKey, { url: result, ts: Date.now() })

    return result
  } catch {
    return null
  }
}

/**
 * Fetch a high-res artist profile image from Spotify.
 * Returns the best image URL (i.scdn.co, permanent, high-res) or null.
 */
export async function spotifyFetchArtistImage(artistName: string): Promise<string | null> {
  try {
    const creds = getCredentials()
    if (!creds) return null

    const token = await getAccessToken()
    if (!token) return null

    const url = new URL('https://api.spotify.com/v1/search')
    url.searchParams.set('q', artistName)
    url.searchParams.set('type', 'artist')
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      artists?: { items?: { name: string; images?: { url: string; height?: number | null }[] }[] }
    }

    const artist = data.artists?.items?.[0]
    if (!artist) return null
    return bestImageUrl(artist.images)
  } catch {
    return null
  }
}
