import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

const CACHE_DIR = path.join(app.getPath('userData'), 'cache')
const DOWNLOADS_DIR = path.join(app.getPath('userData'), 'downloads')
const MAX_CACHE_BYTES = 500 * 1024 * 1024 // 500 MB

/** Ensure cache and downloads directories exist */
export function ensureOfflineDirs(): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
}

export function getCacheDir(): string { return CACHE_DIR }
export function getDownloadsDir(): string { return DOWNLOADS_DIR }

/** Check if a cached file exists for a video ID */
export function getCachedPath(youtubeId: string): string | null {
  // Check downloads first (permanent), then cache (LRU-managed)
  const dlPath = path.join(DOWNLOADS_DIR, `${youtubeId}.webm`)
  if (fs.existsSync(dlPath)) return dlPath

  const dlPathM4a = path.join(DOWNLOADS_DIR, `${youtubeId}.m4a`)
  if (fs.existsSync(dlPathM4a)) return dlPathM4a

  const cachePath = path.join(CACHE_DIR, `${youtubeId}.webm`)
  if (fs.existsSync(cachePath)) return cachePath

  const cachePathM4a = path.join(CACHE_DIR, `${youtubeId}.m4a`)
  if (fs.existsSync(cachePathM4a)) return cachePathM4a

  return null
}

/** Get the MIME type for a local file based on extension */
export function getMimeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.webm': 'audio/webm',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.opus': 'audio/ogg',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
  }
  return map[ext] ?? 'audio/mp4'
}

/** Save a stream to the cache directory while simultaneously piping it to the client.
 *  Returns a new ReadableStream that can be used as the Response body. */
export function teeStreamToCache(
  youtubeId: string,
  inputStream: ReadableStream<Uint8Array>,
  ext: string = '.webm'
): ReadableStream<Uint8Array> {
  const cachePath = path.join(CACHE_DIR, `${youtubeId}${ext}`)
  const fileStream = fs.createWriteStream(cachePath)
  let aborted = false

  const reader = inputStream.getReader()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          if (!aborted) fileStream.end()
          return
        }
        controller.enqueue(value)
        if (!aborted) {
          fileStream.write(value)
        }
      } catch (err) {
        aborted = true
        fileStream.destroy()
        controller.error(err)
      }
    },
    cancel() {
      aborted = true
      reader.cancel().catch(() => {})
      fileStream.destroy()
      // Remove incomplete cache file
      try { fs.unlinkSync(cachePath) } catch { /* ignore */ }
    }
  })
}

/** Evict least-recently-modified cache files until under the size limit */
export function evictLRUCache(): void {
  try {
    const files = fs.readdirSync(CACHE_DIR)
      .map(name => {
        const full = path.join(CACHE_DIR, name)
        try {
          const stat = fs.statSync(full)
          return { path: full, size: stat.size, mtime: stat.mtimeMs }
        } catch {
          return null
        }
      })
      .filter(Boolean) as { path: string; size: number; mtime: number }[]

    let totalSize = files.reduce((sum, f) => sum + f.size, 0)

    if (totalSize <= MAX_CACHE_BYTES) return

    // Sort oldest first
    files.sort((a, b) => a.mtime - b.mtime)

    for (const file of files) {
      if (totalSize <= MAX_CACHE_BYTES) break
      try {
        fs.unlinkSync(file.path)
        totalSize -= file.size
        console.log(`[cache] Evicted ${path.basename(file.path)} (${(file.size / 1024 / 1024).toFixed(1)} MB)`)
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('[cache] LRU eviction error:', err)
  }
}
