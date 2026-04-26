import { z } from 'zod'

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(500),
})

export const SpotifySearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(50).optional(),
})

export const YoutubeIdSchema = z.object({
  youtubeId: z
    .string()
    .min(8)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid YouTube id'),
})

export const SongUpsertSchema = z.object({
  youtubeId: z.string().min(8).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().min(1).max(500),
  artist: z.string().max(500).optional().nullable(),
  album: z.string().max(500).optional().nullable(),
  thumbnailUrl: z.string().url().max(2000).optional().nullable(),
  durationSeconds: z.number().int().nonnegative().max(24 * 3600).optional().nullable(),
})

export const ManualLyricsSaveSchema = z.object({
  youtubeId: z.string().min(8).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  lrcRaw: z.string().max(512_000),
})

export const CleaningTermUpsertSchema = z.object({
  id: z.string().cuid().optional(),
  term: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
})

export const CleaningTermDeleteSchema = z.object({
  id: z.string().cuid(),
})

export const LyricsGetSchema = z.object({
  youtubeId: z.string().min(8).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().min(1).max(500),
  artist: z.string().max(500).optional().nullable(),
})

export const PlaylistCreateSchema = z.object({
  name: z.string().min(1).max(100),
})

export const PlaylistAddTrackSchema = z.object({
  playlistId: z.string().cuid(),
  youtubeId: z.string().min(8).max(32).regex(/^[a-zA-Z0-9_-]+$/),
})

export const PlaylistRemoveTrackSchema = z.object({
  playlistId: z.string().cuid(),
  youtubeId: z.string().min(8).max(32).regex(/^[a-zA-Z0-9_-]+$/),
})

export const PlaylistRenameSchema = z.object({
  playlistId: z.string().cuid(),
  name: z.string().min(1).max(100),
})

export const RadioRecommendationsSchema = z.object({
  youtubeId: z.string().min(8).max(32).regex(/^[a-zA-Z0-9_-]+$/),
})

export const ArtistDetailsSchema = z.object({
  artistId: z.string().min(1).max(100),
})
