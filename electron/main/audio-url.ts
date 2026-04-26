import ytdl from '@distube/ytdl-core'
import { getInnertube } from './innertube'

type AudioStreamResult = { url: string; mimeType: string }

/**
 * Result from streamYoutubeAudio — returns a ReadableStream piped through
 * youtubei.js's own HTTP client (which handles auth, cookies, user-agent matching).
 */
export type AudioDownloadResult = {
  stream: ReadableStream<Uint8Array>
  mimeType: string
  contentLength?: number
}

const YT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const ATTEMPTS: Array<{
  playerClients: Array<'WEB_EMBEDDED' | 'TV' | 'IOS' | 'ANDROID' | 'WEB'>
}> = [
  { playerClients: ['IOS'] },
  { playerClients: ['ANDROID'] },
  { playerClients: ['TV'] },
  { playerClients: ['WEB_EMBEDDED'] },
  { playerClients: ['WEB'] },
]

function mimeTypeForSelectedFormat(selected: ytdl.videoFormat): string {
  const ext = (selected.container || selected.audioCodec || '').toLowerCase()
  const mimeMap: Record<string, string> = {
    webm: 'audio/webm',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
  }
  return mimeMap[ext] ?? 'audio/mp4'
}

function pickBestAudioFormat(formats: ytdl.videoFormat[]): ytdl.videoFormat | null {
  if (!formats.length) return null
  const sorted = [...formats].sort((a, b) => {
    const abrDiff = (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0)
    if (abrDiff !== 0) return abrDiff
    return (b.bitrate ?? 0) - (a.bitrate ?? 0)
  })
  return sorted[0] ?? null
}

function extractMimeType(raw: string | undefined): string {
  if (!raw) return 'audio/mp4'
  const cleaned = raw.split(';')[0]?.trim()
  return cleaned || 'audio/mp4'
}

/**
 * Stream audio using youtubei.js download() — this uses the library's internal
 * HTTP client which sends the correct User-Agent, cookies, and auth headers
 * that match the client type used to resolve the streaming data.
 * This avoids the 403 that occurs when we fetch the CDN URL ourselves.
 */
export async function streamYoutubeAudio(
  videoId: string,
  rangeStart?: number,
  rangeEnd?: number,
): Promise<AudioDownloadResult> {
  const yt = await getInnertube()

  // Client types to try — IOS & ANDROID don't require PO tokens
  const clientsToTry: Array<string | undefined> = ['IOS', 'ANDROID', 'TV', undefined]
  const errors: string[] = []

  for (const client of clientsToTry) {
    const label = client ?? 'default'
    try {
      console.log(`[audio-url] Trying download via Innertube client: ${label}`)

      const info = client
        ? await yt.getBasicInfo(videoId, { client } as any)
        : await yt.music.getInfo(videoId)

      const sd = info.streaming_data
      if (!sd) {
        console.warn(`[audio-url] No streaming_data from client ${label}`)
        continue
      }

      // Pick best audio format for metadata
      let format: any
      try {
        format = info.chooseFormat({ type: 'audio', quality: 'best', format: 'any' } as any)
      } catch {
        // chooseFormat may throw if no matching format — try manually
        const audioFormats = [...(sd.adaptive_formats ?? []), ...(sd.formats ?? [])]
          .filter((f: any) => f.has_audio && !f.has_video)
          .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
        if (!audioFormats.length) {
          console.warn(`[audio-url] No audio formats from client ${label}`)
          continue
        }
        format = audioFormats[0]
      }

      const mimeType = extractMimeType(format.mime_type)
      const contentLength = format.content_length

      // Use info.download() which uses the session's internal HTTP fetch
      // with proper auth headers matching the client type.
      const downloadOpts: any = {
        type: 'audio',
        quality: 'best',
        format: 'any',
      }

      if (rangeStart !== undefined) {
        downloadOpts.range = {
          start: rangeStart,
          end: rangeEnd ?? (rangeStart + 10 * 1048576 - 1),
        }
      }

      const stream = await info.download(downloadOpts)

      console.log(`[audio-url] Download stream obtained (${label}): ${mimeType}, contentLength: ${contentLength ?? 'unknown'}`)

      return { stream, mimeType, contentLength }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[audio-url] Innertube client ${label} download failed: ${msg}`)
      errors.push(`${label}: ${msg}`)
    }
  }

  throw new Error(`All Innertube download attempts failed: ${errors.join(' | ')}`)
}

// Keep the URL-based resolver as a fallback for ytdl-core
async function resolveFromInnertube(videoId: string): Promise<AudioStreamResult> {
  console.log(`[audio-url] Trying Innertube URL resolve for video ID: ${videoId}`)

  const yt = await getInnertube()

  const clientsToTry: Array<string | undefined> = ['IOS', 'ANDROID', 'TV', undefined]

  for (const client of clientsToTry) {
    const label = client ?? 'default'
    try {
      const info = client
        ? await yt.getBasicInfo(videoId, { client } as any)
        : await yt.music.getInfo(videoId)

      const sd = info.streaming_data
      if (!sd) continue

      const audioFormats = [...(sd.adaptive_formats ?? []), ...(sd.formats ?? [])]
        .filter((f: any) => f.has_audio && !f.has_video)

      if (!audioFormats.length) continue

      audioFormats.sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
      const best = audioFormats[0] as any

      const url: string = await best.decipher(yt.session.player)
      if (!url?.startsWith('http')) continue

      const mimeType = extractMimeType(best.mime_type)
      console.log(`[audio-url] Innertube URL success (${label}): ${mimeType}, bitrate: ${best.bitrate}`)

      return { url, mimeType }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[audio-url] Innertube client ${label} failed: ${msg}`)
    }
  }

  throw new Error('All Innertube client types failed to resolve audio URL')
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  maxRetries = 3, 
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries - 1) {
        throw lastError
      }
      
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`[audio-url] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`)
      await sleep(delay)
    }
  }
  
  throw lastError || new Error('Unknown error')
}

export async function resolveYoutubeAudioStream(videoId: string): Promise<AudioStreamResult> {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`
  const errors: string[] = []

  console.log(`[audio-url] Resolving audio stream for video ID: ${videoId}`)

  // Try Innertube first as it is much more reliable and handles deciphering properly
  try {
    const result = await retryWithBackoff(() => resolveFromInnertube(videoId), 2, 1500)
    console.log(`[audio-url] Successfully resolved using Innertube`)
    return result
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.warn(`[audio-url] Innertube failed after retries: ${errorMsg}`)
    errors.push(`innertube: ${errorMsg}`)
  }

  // Fallback to ytdl-core
  for (let i = 0; i < ATTEMPTS.length; i++) {
    const attempt = ATTEMPTS[i]
    console.log(`[audio-url] ytdl attempt ${i + 1}/${ATTEMPTS.length} with clients: ${attempt.playerClients.join(',')}`)
    
    try {
      const info = await ytdl.getInfo(ytUrl, {
        playerClients: attempt.playerClients,
        requestOptions: {
          headers: {
            'User-Agent': YT_USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com',
            'Cookie': '', 
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': '2.20240228.00.00',
          },
        },
      })
      
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
      console.log(`[audio-url] ytdl found ${audioFormats.length} audio formats`)
      
      const selected = pickBestAudioFormat(audioFormats)
      if (!selected) {
        throw new Error('No audio formats found')
      }
      
      let finalUrl = selected.url
      console.log(`[audio-url] ytdl selected format: ${selected.container || 'unknown'}, bitrate: ${selected.audioBitrate || 'unknown'}`)
      
      if (!finalUrl?.startsWith('http')) {
        throw new Error(`Invalid audio URL: ${finalUrl || 'no URL'}`)
      }
      
      console.log(`[audio-url] Successfully resolved using ytdl`)
      return {
        url: finalUrl,
        mimeType: mimeTypeForSelectedFormat(selected),
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[audio-url] ytdl attempt ${i + 1} failed: ${errorMsg}`)
      errors.push(`ytdl(${attempt.playerClients.join(',')}): ${errorMsg}`)
    }
  }

  const finalError = `Unable to resolve audio stream URL after ${ATTEMPTS.length} attempts (${errors.join(' | ')})`
  console.error(`[audio-url] ${finalError}`)
  throw new Error(finalError)
}
