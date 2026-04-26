import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import prismaPkg from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

const PrismaClientConstructor = prismaPkg.PrismaClient

let prisma: PrismaClient | null = null

function resolveExistingLegacyDbPath(targetDbPath: string): string | null {
  const appDataDir = app.getPath('appData')
  const executableDir = path.dirname(process.execPath)
  const appRoot = process.env.APP_ROOT ?? app.getAppPath()

  const candidates = [
    // Previous packaged DB name in current userData.
    path.join(path.dirname(targetDbPath), 'stanza.db'),
    // Potential historical app-name folders in roaming profile.
    path.join(appDataDir, 'stanza', 'stanza.db'),
    path.join(appDataDir, 'stanza', 'dev.db'),
    path.join(appDataDir, 'Stanza', 'stanza.db'),
    path.join(appDataDir, 'Stanza', 'dev.db'),
    path.join(appDataDir, 'VibeStream', 'stanza.db'),
    path.join(appDataDir, 'VibeStream', 'dev.db'),
    // Portable/development leftovers.
    path.join(executableDir, 'dev.db'),
    path.join(executableDir, 'stanza.db'),
    path.join(appRoot, 'dev.db'),
  ]

  for (const candidate of candidates) {
    if (candidate === targetDbPath) continue
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * SQLite: dev uses `dev.db` in the project root (same as Prisma CLI `.env`).
 * Packaged builds use userData. Prisma on Windows is finicky with `file:` URLs, so we use
 * `file:./dev.db` after `chdir` to the project root in development.
 */
export function configureDatabaseUrl(): void {
  const projectRoot = process.env.APP_ROOT ?? app.getAppPath()

  if (app.isPackaged) {
    const userDataDir = app.getPath('userData')
    try { fs.mkdirSync(userDataDir, { recursive: true }) } catch { /* already exists */ }
    const dbPath = path.join(userDataDir, 'vibestream.db')
    const legacyDbPath = resolveExistingLegacyDbPath(dbPath)
    if (!fs.existsSync(dbPath) && legacyDbPath) {
      try {
        fs.renameSync(legacyDbPath, dbPath)
      } catch {
        // Fallback for cross-device/permission edge cases: copy then unlink.
        try {
          fs.copyFileSync(legacyDbPath, dbPath)
          fs.unlinkSync(legacyDbPath)
        } catch {
          // Keep using the legacy file if migration fails.
          process.env.DATABASE_URL = `file:${legacyDbPath}`
          return
        }
      }
    }
    
    // Prisma absolute SQLite path for Windows (e.g. file:C:\Users\... or file:C:/Users/...)
    process.env.DATABASE_URL = `file:${dbPath}`
    return
  }

  try {
    process.chdir(projectRoot)
  } catch (err) {
    console.warn('[db] chdir to APP_ROOT failed', err)
  }
  const dbPath = path.join(projectRoot, 'dev.db')
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  } catch {
    /* ignore */
  }
  process.env.DATABASE_URL = 'file:./dev.db'
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClientConstructor({ log: process.env.VITE_DEV_SERVER_URL ? ['error', 'warn'] : ['error'] })
    
    // Auto-patch any previously saved protocol-relative thumbnails from older app versions
    prisma.$executeRawUnsafe(`UPDATE "Song" SET "thumbnailUrl" = 'https:' || "thumbnailUrl" WHERE "thumbnailUrl" LIKE '//%'`).catch(() => {})
  }
  return prisma
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
