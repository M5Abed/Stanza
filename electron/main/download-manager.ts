import { app, BrowserWindow } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import { getDownloadsDir } from './audio-cache'

const execFileAsync = promisify(execFile)

function getYtDlpPath(): string {
  const isWin = process.platform === 'win32'
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp_macos'
  const binPath = app.isPackaged
    ? path.join(process.resourcesPath, binName)
    : path.join(app.getAppPath(), 'resources', binName)
  if (!isWin) {
    try { fs.chmodSync(binPath, 0o755) } catch { /* */ }
  }
  return binPath
}

/** Download a song permanently to the downloads directory.
 *  Sends progress events to all renderer windows. */
export async function downloadSong(
  youtubeId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const downloadsDir = getDownloadsDir()
  const outputTemplate = path.join(downloadsDir, `${youtubeId}.%(ext)s`)
  const ytDlp = getYtDlpPath()
  const ytUrl = `https://www.youtube.com/watch?v=${youtubeId}`

  return new Promise<string>((resolve, reject) => {
    const proc = execFile(ytDlp, [
      '-f', 'bestaudio',
      '-o', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      '--newline', // progress on new lines
      ytUrl,
    ], { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(err)
        return
      }

      // Find the actual downloaded file
      const files = fs.readdirSync(downloadsDir)
        .filter(f => f.startsWith(youtubeId))
        .map(f => path.join(downloadsDir, f))

      if (files.length === 0) {
        reject(new Error('Download completed but no file found'))
        return
      }

      resolve(files[0])
    })

    // Parse progress from yt-dlp output
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        const line = data.toString()
        const match = /(\d+\.?\d*)%/.exec(line)
        if (match && onProgress) {
          onProgress(parseFloat(match[1]))
        }
      })
    }
    if (proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        const line = data.toString()
        const match = /(\d+\.?\d*)%/.exec(line)
        if (match && onProgress) {
          onProgress(parseFloat(match[1]))
        }
      })
    }
  })
}

/** Delete a downloaded song */
export function deleteDownload(youtubeId: string): boolean {
  const downloadsDir = getDownloadsDir()
  const files = fs.readdirSync(downloadsDir).filter(f => f.startsWith(youtubeId))
  for (const f of files) {
    try { fs.unlinkSync(path.join(downloadsDir, f)) } catch { /* */ }
  }
  return files.length > 0
}

/** Check if a song is downloaded */
export function isDownloaded(youtubeId: string): boolean {
  const downloadsDir = getDownloadsDir()
  return fs.readdirSync(downloadsDir).some(f => f.startsWith(youtubeId))
}

/** Send download progress to all windows */
export function broadcastDownloadProgress(youtubeId: string, progress: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('vs:download:progress', { youtubeId, progress })
  }
}
