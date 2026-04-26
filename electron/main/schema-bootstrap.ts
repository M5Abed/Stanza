import type { PrismaClient } from '@prisma/client'

const BOOTSTRAP_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "Song" (
    "youtubeId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "album" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "downloadPath" TEXT,
    "isDownloaded" BOOLEAN NOT NULL DEFAULT 0,
    "cachePath" TEXT,
    "lastPlayedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ManualLyrics" (
    "youtubeId" TEXT NOT NULL PRIMARY KEY,
    "lrcRaw" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManualLyrics_youtubeId_fkey" FOREIGN KEY ("youtubeId") REFERENCES "Song" ("youtubeId") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "coverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "offlineEnabled" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "PlaylistTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaylistTrack_youtubeId_fkey" FOREIGN KEY ("youtubeId") REFERENCES "Song" ("youtubeId") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleCleaningTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "PlaylistTrack_playlistId_idx" ON "PlaylistTrack"("playlistId")`,
  `CREATE INDEX IF NOT EXISTS "PlaylistTrack_youtubeId_idx" ON "PlaylistTrack"("youtubeId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PlaylistTrack_playlistId_position_key" ON "PlaylistTrack"("playlistId", "position")`,
]

const MIGRATIONS_SQL: string[] = [
  `ALTER TABLE "Song" ADD COLUMN "downloadPath" TEXT`,
  `ALTER TABLE "Song" ADD COLUMN "isDownloaded" BOOLEAN NOT NULL DEFAULT 0`,
  `ALTER TABLE "Song" ADD COLUMN "cachePath" TEXT`,
  `ALTER TABLE "Song" ADD COLUMN "lastPlayedAt" DATETIME`,
  `ALTER TABLE "Playlist" ADD COLUMN "offlineEnabled" BOOLEAN NOT NULL DEFAULT 0`,
]

export async function ensureBaseSchema(prisma: PrismaClient): Promise<void> {
  for (const sql of BOOTSTRAP_SQL) {
    await prisma.$executeRawUnsafe(sql)
  }
  for (const sql of MIGRATIONS_SQL) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch {
      // Ignore errors if the column already exists
    }
  }
}

