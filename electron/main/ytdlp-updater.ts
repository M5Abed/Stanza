import { app } from 'electron'
import { execFile } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const LAST_CHECK_FILE = path.join(app.getPath('userData'), '.ytdlp-last-update')
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getYtDlpPath(): string {
  const isWin = process.platform === 'win32'
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp_macos'
  return app.isPackaged
    ? path.join(process.resourcesPath, binName)
    : path.join(app.getAppPath(), 'resources', binName)
}

/** Check if we should update (max once per 24h) and run yt-dlp -U in background */
export function scheduleYtDlpUpdate(): void {
  // Wait 30s after startup to avoid slowing boot
  setTimeout(() => {
    try {
      if (fs.existsSync(LAST_CHECK_FILE)) {
        const lastCheck = parseInt(fs.readFileSync(LAST_CHECK_FILE, 'utf8'), 10)
        if (Date.now() - lastCheck < CHECK_INTERVAL_MS) {
          console.log('[yt-dlp-update] Skipping — last checked recently')
          return
        }
      }
    } catch { /* continue to update */ }

    const bin = getYtDlpPath()
    console.log('[yt-dlp-update] Checking for updates...')

    execFile(bin, ['-U'], { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn('[yt-dlp-update] Update check failed:', err.message)
        return
      }
      const output = (stdout || '') + (stderr || '')
      console.log('[yt-dlp-update]', output.trim())

      // Record timestamp
      try {
        fs.writeFileSync(LAST_CHECK_FILE, String(Date.now()))
      } catch { /* non-fatal */ }
    })
  }, 30_000)
}
