import { describe, it, expect } from 'vitest'
import {
  SearchQuerySchema,
  YoutubeIdSchema,
  SongUpsertSchema,
  PlaylistCreateSchema,
  PlaylistRenameSchema,
} from '@shared/ipc-schemas'

describe('IPC Schemas Validation', () => {
  describe('SearchQuerySchema', () => {
    it('should validate valid queries', () => {
      const result = SearchQuerySchema.safeParse({ query: 'Amr Diab' })
      expect(result.success).toBe(true)
    })

    it('should reject empty query', () => {
      const result = SearchQuerySchema.safeParse({ query: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('YoutubeIdSchema', () => {
    it('should accept valid 11-char YouTube ID', () => {
      const result = YoutubeIdSchema.safeParse({ youtubeId: 'dQw4w9WgXcQ' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid YouTube ID with special characters', () => {
      const result = YoutubeIdSchema.safeParse({ youtubeId: 'invalid!id@' })
      expect(result.success).toBe(false)
    })

    it('should reject short YouTube ID', () => {
      const result = YoutubeIdSchema.safeParse({ youtubeId: 'abc' })
      expect(result.success).toBe(false)
    })
  })

  describe('SongUpsertSchema', () => {
    it('should accept valid song metadata', () => {
      const result = SongUpsertSchema.safeParse({
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        durationSeconds: 213,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('PlaylistCreateSchema', () => {
    it('should accept valid playlist name', () => {
      const result = PlaylistCreateSchema.safeParse({ name: 'Chill Vibes' })
      expect(result.success).toBe(true)
    })

    it('should reject empty playlist name', () => {
      const result = PlaylistCreateSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('PlaylistRenameSchema', () => {
    it('should accept valid cuid and new name', () => {
      const result = PlaylistRenameSchema.safeParse({
        playlistId: 'clh1234567890abcdefghijkl',
        name: 'Workout Mix',
      })
      expect(result.success).toBe(true)
    })
  })
})
