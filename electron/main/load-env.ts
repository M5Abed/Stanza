import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const dir = path.dirname(fileURLToPath(import.meta.url))

// Try multiple candidate paths for the .env file.
// In dev: ../../.env relative to dist-electron/main/
// In production (asar): same path resolves into the asar root.
// Fallback: next to the executable, or in process.resourcesPath.
const candidates = [
  path.resolve(dir, '../../.env'),             // asar root / project root (dev)
  path.resolve(process.resourcesPath ?? dir, '.env'),  // extraResources
  path.resolve(process.execPath, '..', '.env'),        // next to .exe
]

let loaded = false
for (const candidate of candidates) {
  try {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate })
      console.log(`[env] Loaded .env from: ${candidate}`)
      loaded = true
      break
    }
  } catch {
    // fs.existsSync may throw on certain asar paths — try dotenv directly
    const result = dotenv.config({ path: candidate })
    if (!result.error) {
      console.log(`[env] Loaded .env from: ${candidate}`)
      loaded = true
      break
    }
  }
}

if (!loaded) {
  console.warn('[env] No .env file found. API features (Spotify, Genius, Last.fm) will be unavailable.')
}
