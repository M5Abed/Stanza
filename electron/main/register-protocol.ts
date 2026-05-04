import { app, protocol } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { getCachedPath, getMimeForPath, teeStreamToCache } from './audio-cache'
import { getInnertube } from './innertube'

const execFileAsync = promisify(execFile)

/** Resolve bundled yt-dlp binary — works cross-platform in dev and packaged mode. */
function getYtDlpPath(): string {
  const isWin = process.platform === 'win32'
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp_macos'

  const binPath = app.isPackaged
    ? path.join(process.resourcesPath, binName)
    : path.join(app.getAppPath(), 'resources', binName)

  // On macOS/Linux, ensure the binary is executable (extraFiles can lose +x)
  if (!isWin) {
    try {
      fs.chmodSync(binPath, 0o755)
    } catch {
      // May fail if already set or read-only — non-fatal
    }
  }

  return binPath
}

const SCHEME = 'vibestream'

export function registerPrivilegedVibestreamScheme(): void {
  try {
    protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        secure: true,
        standard: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true,
      },
    },
  ])
  } catch (err) {
    console.warn('[vibestream] registerSchemesAsPrivileged', err)
  }
}

function parseYoutubeIdFromRequestUrl(requestUrl: string): string | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }

  if (url.protocol !== `${SCHEME}:`) return null

  if (url.hostname === 'audio') {
    const id = url.pathname.replace(/^\//, '').split('/')[0]
    return id || null
  }

  return null
}

function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,16}$/.test(id)
}

// Cache resolved yt-dlp URLs so seeking doesn't re-invoke the CLI (5 min TTL)
const urlCache = new Map<string, { url: string; mimeType: string; ext: string; ts: number }>()
const URL_CACHE_TTL = 5 * 60 * 1000

async function getAudioUrlViaYtDlp(videoId: string, allowFallback = true): Promise<{ url: string; mimeType: string; ext: string }> {
  const cached = urlCache.get(videoId)
  if (cached && Date.now() - cached.ts < URL_CACHE_TTL) {
    return { url: cached.url, mimeType: cached.mimeType, ext: cached.ext }
  }

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`
  const ytDlpBin = getYtDlpPath()
  
  let stdout: string
  try {
    const result = await execFileAsync(ytDlpBin, [
      '--get-url',
      '--print', '%(ext)s',
      '-f', 'bestaudio',
      '--no-playlist',
      '--no-warnings',
      ytUrl,
    ], { timeout: 15_000 })
    stdout = result.stdout
  } catch (err: any) {
    const errorOutput = err.stderr || err.message || ''
    if (allowFallback && errorOutput.includes('Sign in to confirm your age')) {
      console.warn(`[vibestream] Age restriction hit for ${videoId}. Searching for safe fallback...`)
      try {
        const yt = await getInnertube()
        const info = await yt.getBasicInfo(videoId)
        const title = info.basic_info.title
        const author = info.basic_info.author
        
        if (title && author) {
          const search = await yt.music.search(`${title} ${author}`, { type: 'song' })
          for (const section of (search.contents as any[]) || []) {
            for (const item of section.contents || []) {
              const fallbackVid = item.id || item.video_id
              if (fallbackVid && fallbackVid !== videoId) {
                try {
                  const fallbackInfo = await yt.getBasicInfo(fallbackVid)
                  if (fallbackInfo.basic_info.is_family_safe !== false) {
                    console.log(`[vibestream] Found safe fallback video: ${fallbackVid} (Title: ${item.title?.text || item.title})`)
                    // Attempt to resolve the safe fallback (prevent recursive fallback)
                    return await getAudioUrlViaYtDlp(fallbackVid, false)
                  }
                } catch (e) {
                  // Ignore info fetch errors for fallbacks
                }
              }
            }
          }
        }
      } catch (fallbackErr) {
        console.error(`[vibestream] Fallback search failed for ${videoId}:`, fallbackErr)
      }
      throw new Error('Video is age restricted and no safe fallback could be found')
    }
    throw err
  }

  const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    throw new Error('yt-dlp returned no URL')
  }

  // --get-url and --print %(ext)s output order can vary by yt-dlp version
  const url = lines.find(l => l.startsWith('http'))
  const ext = lines.find(l => !l.startsWith('http')) ?? 'webm'

  if (!url) {
    throw new Error(`yt-dlp returned no valid URL: ${lines.join(' | ')}`)
  }

  const mimeMap: Record<string, string> = {
    webm: 'audio/webm',
    opus: 'audio/ogg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
  }

  const result = { url, mimeType: mimeMap[ext] ?? 'audio/mp4', ext }
  urlCache.set(videoId, { ...result, ts: Date.now() })
  return result
}

const YT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Serve a local file with Range support */
function serveLocalFile(filePath: string, rangeHeader: string | null): Response {
  const stat = fs.statSync(filePath)
  const totalSize = stat.size
  const mime = getMimeForPath(filePath)

  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
    if (match) {
      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
      const chunkSize = end - start + 1

      const nodeStream = fs.createReadStream(filePath, { start, end })
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

      const headers = new Headers()
      headers.set('Content-Type', mime)
      headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`)
      headers.set('Content-Length', String(chunkSize))
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'no-store')

      return new Response(webStream, { status: 206, headers })
    }
  }

  const nodeStream = fs.createReadStream(filePath)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

  const headers = new Headers()
  headers.set('Content-Type', mime)
  headers.set('Content-Length', String(totalSize))
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'no-store')

  return new Response(webStream, { status: 200, headers })
}

export function registerVibestreamProtocolHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    const videoId = parseYoutubeIdFromRequestUrl(request.url)
    if (!videoId || !isValidVideoId(videoId)) {
      return new Response('Invalid video id', { status: 400 })
    }

    const rangeHeader = request.headers.get('Range')

    // 1. Check for local file (downloaded or cached) — instant, works offline
    const localPath = getCachedPath(videoId)
    if (localPath) {
      try {
        return serveLocalFile(localPath, rangeHeader)
      } catch (err) {
        console.warn('[vibestream] Local file failed, falling through to remote:', err)
      }
    }

    // 2. Stream from remote via yt-dlp and auto-cache
    try {
      const { url, mimeType, ext } = await getAudioUrlViaYtDlp(videoId)

      const fetchHeaders: Record<string, string> = { 'User-Agent': YT_UA }
      // Only pass Range for remote when NOT the initial request (we need the full stream for caching)
      // Sending 'bytes=0-' to YouTube often causes them to chunk the response to 2MB and drop the connection,
      // which causes audio cuts/glitches. Ignoring it ensures a continuous 200 OK stream.
      if (rangeHeader && rangeHeader !== 'bytes=0-') {
        fetchHeaders['Range'] = rangeHeader
      }

      const upstream = await fetch(url, { headers: fetchHeaders })

      if (!upstream.ok || !upstream.body) {
        if (upstream.status === 403) {
          urlCache.delete(videoId)
          const fresh = await getAudioUrlViaYtDlp(videoId)
          const retry = await fetch(fresh.url, { headers: fetchHeaders })
          if (!retry.ok || !retry.body) {
            return new Response('Upstream fetch failed', { status: 502 })
          }
          const rh = new Headers()
          rh.set('Content-Type', fresh.mimeType)
          rh.set('Accept-Ranges', 'bytes')
          rh.set('Cache-Control', 'no-store')
          const rcl = retry.headers.get('Content-Length')
          if (rcl) rh.set('Content-Length', rcl)
          const rcr = retry.headers.get('Content-Range')
          if (rcr) rh.set('Content-Range', rcr)
          return new Response(retry.body, {
            status: retry.status === 206 ? 206 : 200,
            headers: rh,
          })
        }
        return new Response('Upstream fetch failed', { status: 502 })
      }

      // Auto-cache: tee the full stream to a local file
      // Howler HTML5 audio tag sends 'bytes=0-' initially, which we can safely cache as it represents the full stream
      let responseBody: any = upstream.body
      if (!rangeHeader || rangeHeader === 'bytes=0-') {
        responseBody = teeStreamToCache(videoId, upstream.body as any, `.${ext}`)
      }

      const headers = new Headers()
      headers.set('Content-Type', mimeType)
      headers.set('Accept-Ranges', 'bytes')
      headers.set('Cache-Control', 'no-store')

      const cl = upstream.headers.get('Content-Length')
      if (cl) headers.set('Content-Length', cl)

      const cr = upstream.headers.get('Content-Range')
      if (cr) headers.set('Content-Range', cr)

      return new Response(responseBody, {
        status: upstream.status === 206 ? 206 : 200,
        headers,
      })
    } catch (err) {
      console.error('[vibestream protocol]', err)
      return new Response('Stream error', { status: 502 })
    }
  })
}

export function playbackUrlForYoutubeId(youtubeId: string): string {
  return `${SCHEME}://audio/${youtubeId}`
}

