/**
 * Genius API lyrics fetcher.
 * Uses Client Credentials for search, then scrapes lyrics from the song page.
 * IMPORTANT: Genius requires a full Chrome-like User-Agent to return server-rendered lyrics.
 */

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let _accessToken: string | null = null

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GENIUS_CLIENT_ID?.trim()
  const clientSecret = process.env.GENIUS_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

async function getAccessToken(): Promise<string | null> {
  if (_accessToken) return _accessToken

  const creds = getCredentials()
  if (!creds) return null

  try {
    const res = await fetch('https://api.genius.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    })

    if (!res.ok) {
      console.error('[genius] token error', res.status)
      return null
    }

    const json = (await res.json()) as { access_token: string }
    _accessToken = json.access_token
    return _accessToken
  } catch (e) {
    console.error('[genius] token fetch failed', e)
    return null
  }
}

interface GeniusHit {
  result: {
    id: number
    title: string
    url: string
    primary_artist: { name: string }
    lyrics_state: string
  }
}

/**
 * Search Genius for a song and scrape lyrics from the page.
 */
export async function fetchGeniusLyrics(title: string, artist: string): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null

  try {
    // Search for the song
    const query = `${title} ${artist}`
    const searchUrl = new URL('https://api.genius.com/search')
    searchUrl.searchParams.set('q', query)

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!searchRes.ok) {
      console.error('[genius] search error', searchRes.status)
      if (searchRes.status === 401 || searchRes.status === 403) {
        _accessToken = null
      }
      return null
    }

    const searchData = (await searchRes.json()) as {
      response: { hits: GeniusHit[] }
    }

    const hits = searchData.response?.hits ?? []
    if (hits.length === 0) return null

    // Improve match accuracy by heavily preferring hits where the artist matches
    const safeArtist = artist.toLowerCase().trim()
    const validHits = hits.filter((h) => {
      const geniusArtist = h.result.primary_artist.name.toLowerCase()
      // If the searched artist is in the Genius artist name, or vice-versa
      return geniusArtist.includes(safeArtist) || safeArtist.includes(geniusArtist)
    })

    const candidateHits = validHits.length > 0 ? validHits : hits

    // Pick the best match from candidate hits (prefer complete lyrics)
    const complete = candidateHits.find((h) => h.result.lyrics_state === 'complete')
    const best = complete ?? candidateHits[0]

    return await scrapeLyricsFromPage(best.result.url)
  } catch (e) {
    console.error('[genius] search failed', e)
    return null
  }
}

/**
 * Scrape lyrics from a Genius song page.
 * Genius requires a full Chrome User-Agent to return server-rendered content
 * (otherwise it returns a minimal JS-only shell with no lyrics).
 */
async function scrapeLyricsFromPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': CHROME_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) return null

    const html = await res.text()

    // Genius wraps lyrics in <div data-lyrics-container="true"> elements
    const containers: string[] = []
    let searchIdx = 0
    const marker = 'data-lyrics-container="true"'
    
    while (true) {
      const startIdx = html.indexOf(marker, searchIdx)
      if (startIdx === -1) break
      
      const openTagEnd = html.indexOf('>', startIdx)
      if (openTagEnd === -1) break
      
      let currentIdx = openTagEnd + 1
      let depth = 1
      
      while (depth > 0 && currentIdx < html.length) {
        const nextOpen = html.indexOf('<div', currentIdx)
        const nextClose = html.indexOf('</div', currentIdx)
        
        if (nextClose === -1) break
        
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++
          currentIdx = nextOpen + 4
        } else {
          depth--
          if (depth === 0) {
            containers.push(html.substring(openTagEnd + 1, nextClose))
            searchIdx = nextClose + 6
          } else {
            currentIdx = nextClose + 5
          }
        }
      }
      
      if (depth > 0) break // Malformed HTML fallback
    }

    if (containers.length === 0) {
      console.warn('[genius] No lyrics containers found on page:', url)
      return null
    }

    // Clean HTML tags and decode entities
    const raw = containers.join('\n')
    const cleaned = raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return cleaned || null
  } catch (e) {
    console.error('[genius] scrape failed', e)
    return null
  }
}
