-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "coverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "offlineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Playlist" ("coverUrl", "createdAt", "id", "name", "sortOrder", "updatedAt") SELECT "coverUrl", "createdAt", "id", "name", "sortOrder", "updatedAt" FROM "Playlist";
DROP TABLE "Playlist";
ALTER TABLE "new_Playlist" RENAME TO "Playlist";
CREATE TABLE "new_Song" (
    "youtubeId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "album" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "downloadPath" TEXT,
    "isDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "cachePath" TEXT,
    "lastPlayedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Song" ("album", "artist", "createdAt", "durationSeconds", "thumbnailUrl", "title", "updatedAt", "youtubeId") SELECT "album", "artist", "createdAt", "durationSeconds", "thumbnailUrl", "title", "updatedAt", "youtubeId" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
