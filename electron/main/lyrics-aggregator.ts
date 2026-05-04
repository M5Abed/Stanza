import type { PrismaClient } from '@prisma/client'
import { fetchGeniusLyrics } from './genius-lyrics'

export type LyricsSource = 'local' | 'lrclib' | 'genius' | 'none'

export interface LyricsResult {
  source: LyricsSource
  lrcRaw: string | null
}

/**
 * In-memory lyrics cache — avoids re-fetching from LRCLIB/Genius every time
 * the user opens lyrics for the same song. Keyed by youtubeId.
 * ManualLyrics (user edits) always take priority and evict cached entries.
 */
const lyricsCache = new Map<string, LyricsResult>()
const LYRICS_CACHE_MAX = 500

function cacheSet(key: string, value: LyricsResult): void {
  // Evict oldest entry if cache is full
  if (lyricsCache.size >= LYRICS_CACHE_MAX) {
    const oldest = lyricsCache.keys().next().value
    if (oldest) lyricsCache.delete(oldest)
  }
  lyricsCache.set(key, value)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function loadCleaningTerms(db: PrismaClient): Promise<string[]> {
  const rows = await db.titleCleaningTerm.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' },
    select: { term: true },
  })
  return rows.map((r) => r.term)
}

export function cleanTitleForMatch(title: string, terms: string[]): string {
  let t = title
  for (const term of terms) {
    if (!term.trim()) continue
    t = t.replace(new RegExp(escapeRegExp(term), 'gi'), ' ')
  }
  return t.replace(/\s+/g, ' ').trim()
}

async function fetchLrclibLrc(artist: string, track: string): Promise<string | null> {
  try {
    const url = new URL('https://lrclib.net/api/get')
    url.searchParams.set('artist_name', artist)
    url.searchParams.set('track_name', track)

    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) return null

    const data = (await res.json()) as { syncedLyrics?: string | null; plainLyrics?: string | null }
    if (data.syncedLyrics && data.syncedLyrics.trim()) return data.syncedLyrics

    if (data.plainLyrics && data.plainLyrics.trim()) {
      return data.plainLyrics
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
    }
  } catch (e) {
    console.error('[lyrics:lrclib]', e)
  }

  return null
}

/**
 * Level 1: ManualLyrics in SQLite.
 * Level 2: LRCLIB (synced preferred).
 * Level 3: Genius (scraped from page).
 *
 * Results from Level 2/3 are cached in-memory so re-opening lyrics is instant.
 */
export async function aggregateLyrics(
  db: PrismaClient,
  params: { youtubeId: string; title: string; artist: string | null },
): Promise<LyricsResult> {
  // Level 1: Local manual lyrics (always wins, evicts any stale cache)
  const local = await db.manualLyrics.findUnique({ where: { youtubeId: params.youtubeId } })
  if (local?.lrcRaw?.trim()) {
    // Evict any cached remote result so user edits take priority
    lyricsCache.delete(params.youtubeId)
    return { source: 'local', lrcRaw: local.lrcRaw }
  }

  // Check in-memory cache before making any remote calls
  const cached = lyricsCache.get(params.youtubeId)
  if (cached) {
    return cached
  }

  const terms = await loadCleaningTerms(db)
  const track = cleanTitleForMatch(params.title, terms)
  const artist = (params.artist ?? 'Unknown Artist').trim() || 'Unknown Artist'

  // Level 2: LRCLIB
  const remote = await fetchLrclibLrc(artist, track)
  if (remote) {
    const result: LyricsResult = { source: 'lrclib', lrcRaw: remote }
    cacheSet(params.youtubeId, result)
    return result
  }

  // Level 3: Genius
  try {
    const genius = await fetchGeniusLyrics(track, artist)
    if (genius) {
      const result: LyricsResult = { source: 'genius', lrcRaw: genius }
      cacheSet(params.youtubeId, result)
      return result
    }
  } catch (e) {
    console.error('[lyrics:genius]', e)
  }

  // Cache the "none" result too to avoid repeated failed lookups
  const noneResult: LyricsResult = { source: 'none', lrcRaw: null }
  cacheSet(params.youtubeId, noneResult)
  return noneResult
}

