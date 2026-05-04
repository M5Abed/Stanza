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

  // Queue to buffer chunks. This drains the YouTube connection as fast as possible 
  // so YouTube doesn't drop the connection due to backpressure/idleness.
  // Cap at 64 chunks (~10-16 MB) to prevent unbounded memory growth that could
  // trigger GC pauses and cause audio stuttering.
  const MAX_QUEUE_SIZE = 64
  const queue: Uint8Array[] = []
  let queueBytes = 0
  let streamError: any = null
  let streamDone = false
  let resolvePull: (() => void) | null = null
  let resolveBackpressure: (() => void) | null = null

  // Continuously read in the background
  ;(async () => {
    try {
      while (true) {
        // Backpressure: wait if consumer is too slow and queue is full
        while (queue.length >= MAX_QUEUE_SIZE && !aborted) {
          await new Promise<void>(resolve => { resolveBackpressure = resolve })
        }
        if (aborted) break

        const { done, value } = await reader.read()
        if (done) {
          streamDone = true
          if (!aborted) fileStream.end()
          ;(resolvePull as any)?.()
          break
        }
        if (!aborted && value) {
          fileStream.write(value)
          queue.push(value)
          queueBytes += value.byteLength
          ;(resolvePull as any)?.()
        }
      }
    } catch (err) {
      streamError = err
      ;(resolvePull as any)?.()
      if (!aborted) {
        fileStream.destroy()
        try { fs.unlinkSync(cachePath) } catch {}
      }
    }
  })()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (queue.length > 0) {
        const chunk = queue.shift()!
        queueBytes -= chunk.byteLength
        controller.enqueue(chunk)
        // Release backpressure so the background reader can continue
        if (resolveBackpressure) {
          const r = resolveBackpressure
          resolveBackpressure = null
          r()
        }
        return
      }
      if (streamError) {
        controller.error(streamError)
        return
      }
      if (streamDone) {
        controller.close()
        return
      }
      // Wait for more data to arrive
      await new Promise<void>(resolve => {
        resolvePull = () => {
          resolvePull = null
          resolve()
        }
      })
      
      if (queue.length > 0) {
        const chunk = queue.shift()!
        queueBytes -= chunk.byteLength
        controller.enqueue(chunk)
        if (resolveBackpressure) {
          const r = resolveBackpressure
          resolveBackpressure = null
          r()
        }
      } else if (streamError) {
        controller.error(streamError)
      } else if (streamDone) {
        controller.close()
      }
    },
    cancel() {
      aborted = true
      // Release any blocked background reader
      if (resolveBackpressure) {
        const r = resolveBackpressure
        resolveBackpressure = null
        r()
      }
      reader.cancel().catch(() => {})
      fileStream.destroy()
      try { fs.unlinkSync(cachePath) } catch {}
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
