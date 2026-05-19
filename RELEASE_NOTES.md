# Stanza v2.3 - Release Notes

**Date:** May 19, 2026

---

## Music Video Discovery

Songs uploaded as music videos (not registered as "songs" in YouTube Music's catalog) are now fully discoverable across the app. This fixes visibility for many independent and regional artists like Marwan Moussa, Wegz, and others whose tracks only exist as YouTube videos.

### Search

- YouTube Music song and video searches now run in parallel, merging results with deduplication. Previously, video-type results were only shown as a last-resort fallback.
- When Spotify is the primary search source, YouTube-only tracks are now merged into results. Songs not on Spotify but available on YouTube Music will appear at the bottom of results.
- YouTube Music playlists (like Top Egypt, Trending) now appear in search results even when Spotify search is active. Previously, playlist search was completely skipped when Spotify worked.

### Artist Page

- The "Videos" section from YouTube Music artist pages is now parsed and included. Videos are merged into the Top Songs list and also exposed separately.
- The Discography button now appears when an artist has videos, even if they have no registered albums or singles.

### Discography View

- Added a "Videos" tab alongside Albums and Singles & EPs.
- Video cards use landscape (16:9) thumbnails and show artist name instead of year.
- Clicking a video plays it directly (loads all videos as a playlist).
- Videos support right-click context menu for queue/playlist actions.

---

## Cover Art Fix

- Fixed a regression where search results were showing landscape YouTube video frame thumbnails instead of square album art. The getBestYtThumbnail function was being incorrectly called with a video ID parameter, forcing it to use hqdefault.jpg. Now properly uses API-provided square album art with Spotify upgrade when available.

---

## Home Page - YouTube Music Explore

- The home page now shows curated YouTube Music playlists from the Explore page, including charts like Top Egypt, Trending, New Releases, and more.
- Playlists are displayed in card grids organized by section, with cover art and subtitles.
- Clicking a playlist opens its full track listing in the album/playlist view.
- The "Moods & genres" section is filtered out (contains navigation buttons, not playable playlists).

---

## Liked Songs on Artist Profile

- Artist pages now have a "Liked" tab alongside Top Songs.
- Shows all songs from your Liked Songs playlist that match the current artist.
- Displays a count badge on the tab when liked songs exist.
- The Play All button plays from whichever tab is active.
- Shows a friendly empty state when no liked songs match.

---

## Previous Button Behavior

Reworked the Previous button to match standard music player behavior (Spotify, Apple Music):

| Condition | Action |
|---|---|
| Song is past 3 seconds | Restarts the current song from the beginning |
| Song is within first 3 seconds | Goes to the actual previous track |
| No previous track in queue | Restarts the current song (previously stopped playback) |

---

## Files Changed

| Area | Files |
|---|---|
| Backend | electron/main/ipc-handlers.ts |
| IPC Channels | shared/ipc-channels.ts |
| Preload Bridge | electron/preload/index.ts |
| Type Definitions | src/type/vibestream-preload.d.ts |
| Home Page | src/components/home/HomeView.tsx |
| Search | src/components/search/SearchView.tsx |
| Artist Page | src/components/artist/ArtistView.tsx |
| Discography | src/components/artist/ArtistAllSongsView.tsx |
| Player Store | src/stores/usePlayerStore.ts |
