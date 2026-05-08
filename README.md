# Stanza

Stanza is a modern, lightweight, and incredibly fast desktop music player powered by Electron and React. It harmonizes the vast library of **YouTube Music** with the high-fidelity metadata of **Spotify** to deliver a premium, uninterrupted audio streaming experience right to your desktop.

![Stanza Interface](https://img.shields.io/badge/App-Stanza-blueviolet?style=for-the-badge)

## 🚀 Features
- **Seamless Streaming:** Stream high-quality audio seamlessly from YouTube Music.
- **Spotify-Enhanced Metadata:** All search results, covers, and artist profiles are enriched with high-fidelity Spotify metadata.
- **Smart Cover Resolution:** Stanza automatically resolves and caches high-resolution Spotify album covers, falling back to YouTube only when necessary.
- **Dynamic Auto-Play Radio:** Get endless, highly-relevant recommendations perfectly matched to your listening session.
- **Lyrics Integration:** View synchronized lyrics on the fly, and manually edit or sync custom `.lrc` lyrics right in the app.
- **Playlists & Persistent Queue:** Fully functional queue management and custom playlists saved natively to your local machine.
- **Discord Rich Presence:** Show off what you're listening to natively on your Discord profile.
- **Top Songs & Advanced Discographies:** Deep pagination fetches over 50+ albums/singles gracefully, missing absolutely nothing.
- **Song Story (AI):** Get behind-the-scenes facts, hidden meanings, and trivia about any song — powered by Google Gemini with Search Grounding.
- **Offline Downloads:** Download songs and entire playlists for offline listening via yt-dlp.
- **Modern UI:** Designed with Framer Motion and TailwindCSS for a high-end, dynamic user experience.
- **Persistent Database:** Uses Prisma to cache player data and save your preferences securely.

---

## 📝 Update Logs

### Version 2.2
- **Library Album Management:** Enabled "Save to Library" functionality for all album types, complete with updated Sidebar UI to clearly distinguish between saved Albums and Playlists.
- **Audio Performance & Stability:** Eliminated audio playback stuttering by applying OS-level Chromium background flags, optimizing stream-caching pipelines, and proactively prefetching upcoming queue items.
- **AI Integration:** Replaced the experimental AI DJ with the new "Song Story" feature, powered by Google Gemini, providing behind-the-scenes facts, hidden meanings, and trivia about any song.
- **Offline Download Fixes:** Resolved a bug where the "Download All" button in the Liked Songs playlist failed to correctly queue all tracks for offline downloading.

### Version 2.1
- **Performance & Optimization:** Significantly improved app performance and reduced background power consumption.
- **Floating Lyrics Engine:** Introduced a new detachable, floating lyrics window with top-pinning and resize capabilities.
- **YouTube Music Playlists:** Added native support for searching, viewing, and saving external YouTube Music playlists directly to your local library.
- **Enhanced Artist Resolution:** Resolved bugs causing duplicate artist profiles and fixed routing issues within featured artist sections.
- **Offline Mode Improvements:** Fixed the "Download All" track queue logic for local playlists, ensuring reliable batch downloading.
- **Playback Stability:** Refactored and stabilized the shuffle/random playback functionality for queue management.
- **UI & UX Refinements:** Reorganized the lyrics editor by moving the import/export controls to the edit screen, swapping the icons for clarity.
- **Mascot Integration:** Added the Pink Panther as a subtle watermark background to the main app interface.

---

## 🔌 APIs & External Services

Stanza integrates with multiple external APIs to deliver a rich, full-featured music experience. Below is a breakdown of every service the app talks to, what it does, and how the data flows.

### 1. YouTube Music / Innertube API
| | |
|---|---|
| **Library** | [`youtubei.js`](https://github.com/LuanRT/YouTube.js) (Innertube client) |
| **Auth** | None — uses an anonymous Innertube session |
| **Used For** | Music search, artist pages, album details, playlist browsing, radio/auto-play recommendations, and streaming audio |

**How it works:**
- On app launch, Stanza creates a lazy singleton `Innertube` instance configured with `lang: en`, `location: US`, and `retrieve_player: true` (needed for URL deciphering).
- **Search** → `yt.music.search(query, { type: 'song' | 'artist' | 'playlist' | 'album' })` returns results which are normalized into Stanza's internal track/artist format.
- **Artist Details** → `yt.music.getArtist(artistId)` fetches top songs, albums, and singles with deep pagination via section endpoint expansion.
- **Album Details** → `yt.music.getAlbum(albumId)` or `yt.music.getPlaylist(playlistId)` for YT playlists.
- **Radio (Auto-Play)** → `yt.music.getUpNext(youtubeId)` generates a native radio mix based on the current song.
- **Audio Streaming** → `info.download()` streams audio directly through Innertube's internal HTTP client, which handles User-Agent/auth matching. Falls back to multiple client types (`IOS` → `ANDROID` → `TV` → `default`) if one fails.
- **Track Views** → `yt.getBasicInfo(youtubeId)` fetches the view count for display.

---

### 2. Spotify Web API
| | |
|---|---|
| **Endpoint** | `https://api.spotify.com/v1/` |
| **Auth** | OAuth 2.0 Client Credentials (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`) |
| **Used For** | High-fidelity metadata enrichment — album art, artist images, track details |

**How it works:**
- Stanza authenticates via `POST https://accounts.spotify.com/api/token` with `grant_type=client_credentials` and caches the token until it expires (minus a 60-second buffer).
- **Search Enrichment** → After every YouTube Music search, Stanza runs a parallel Spotify search (`GET /v1/search?type=track,artist`) and fuzzy-matches results by normalized title + artist to upgrade thumbnail URLs to permanent, high-resolution `i.scdn.co` album art.
- **Cover Resolution** → `spotifyFetchCoverUrl(title, artist)` does a focused `GET /v1/search?type=track&limit=1` to find the best album cover for a specific song. Results are cached in-memory (500 entries, 1-hour TTL).
- **Artist Images** → `spotifyFetchArtistImage(artistName)` searches for the artist and returns their highest-resolution profile image from Spotify.

> **Note:** Spotify is used for metadata only — no audio is ever streamed from Spotify. Playback always uses YouTube.

---

### 3. Lyrics APIs (Multi-Source Aggregator)

Stanza uses a **3-level lyrics aggregation pipeline** to find the best available lyrics for any track. The aggregator is in [`lyrics-aggregator.ts`](electron/main/lyrics-aggregator.ts) and sources are tried in priority order:

#### Level 1: Local (ManualLyrics) — SQLite Database
| | |
|---|---|
| **Source** | Prisma `ManualLyrics` table |
| **Priority** | **Highest** — always wins |

- If the user has manually edited or imported lyrics for a song, those are stored in the local SQLite database keyed by `youtubeId`.
- Manual lyrics always take precedence and evict any cached remote results.
- Users can **import** `.lrc` / `.txt` files and **export** their edits back to disk.

#### Level 2: LRCLIB — Synchronized Lyrics
| | |
|---|---|
| **Endpoint** | `https://lrclib.net/api/get` |
| **Auth** | None — public API |
| **Returns** | Synced LRC lyrics (timestamped) or plain-text lyrics |

**How it works:**
1. The track title is first **cleaned** using configurable "Title Cleaning Terms" stored in the database (strips tags like `(Official Video)`, `[Lyrics]`, etc.).
2. A request is made to `GET https://lrclib.net/api/get?artist_name=...&track_name=...`.
3. If the API returns `syncedLyrics` (timestamped `.lrc` format), those are used — enabling karaoke-style line-by-line highlighting.
4. If only `plainLyrics` are available, they're cleaned and returned as unsynced text.
5. Results are cached in-memory (500 entries) keyed by `youtubeId` so re-opening lyrics is instant.

#### Level 3: Genius — Scraped Lyrics
| | |
|---|---|
| **Endpoint** | `https://api.genius.com/search` + page scraping |
| **Auth** | OAuth 2.0 Client Credentials (`GENIUS_CLIENT_ID` + `GENIUS_CLIENT_SECRET`) |
| **Returns** | Plain-text lyrics scraped from the Genius song page |

**How it works:**
1. Stanza authenticates with `POST https://api.genius.com/oauth/token` using Client Credentials and caches the token.
2. A search is made to `GET https://api.genius.com/search?q={title} {artist}` with the Bearer token.
3. Results are **filtered for artist match** — the Genius artist name must contain (or be contained by) the searched artist, avoiding wrong matches.
4. The best hit (preferring `lyrics_state: 'complete'`) is selected, and its song page URL is fetched.
5. The page HTML is scraped using a **full Chrome User-Agent** (Genius requires this to return server-rendered lyrics instead of a JS-only shell).
6. Lyrics are extracted from `<div data-lyrics-container="true">` elements using a custom HTML parser that handles nested divs, then cleaned of HTML tags and entities.
7. Results are cached in-memory alongside LRCLIB results.

#### Aggregation Flow Diagram
```
User opens lyrics for a track
        │
        ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │ ManualLyrics │───Yes────▶ │ Return (local)  │
  │  (SQLite)    │            └─────────────────┘
  └──────┬──────┘
         │ No
         ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │ In-Memory   │───Yes────▶ │ Return (cached) │
  │   Cache     │            └─────────────────┘
  └──────┬──────┘
         │ No
         ▼
    Clean title with
    TitleCleaningTerms
         │
         ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │   LRCLIB    │───Yes────▶ │ Cache & Return  │
  │ (lrclib.net)│            │   (lrclib)      │
  └──────┬──────┘            └─────────────────┘
         │ No
         ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │   Genius    │───Yes────▶ │ Cache & Return  │
  │  (scraper)  │            │   (genius)      │
  └──────┬──────┘            └─────────────────┘
         │ No
         ▼
  ┌─────────────────┐
  │ Cache & Return  │
  │   (none)        │
  └─────────────────┘
```

---

### 4. yt-dlp (Audio Extraction & Downloads)
| | |
|---|---|
| **Binary** | Bundled `yt-dlp.exe` (Windows) / `yt-dlp_macos` |
| **Auth** | None |
| **Used For** | Resolving direct audio stream URLs and downloading songs for offline playback |

**How it works:**
- **URL Resolution** → `yt-dlp --get-url --print %(ext)s -f bestaudio` extracts the best audio stream URL. Results are cached for 5 minutes to avoid re-invoking the CLI on seeks.
- **Downloads** → `yt-dlp -f bestaudio -o {outputTemplate} --no-playlist` downloads the full audio file. Progress is parsed from stdout/stderr and broadcast to all renderer windows via IPC.
- **Age-Restriction Fallback** → If yt-dlp hits an age restriction, Stanza searches YouTube Music for a safe alternative video of the same song.

---

### 5. Last.fm API
| | |
|---|---|
| **Endpoint** | `http://ws.audioscrobbler.com/2.0/` |
| **Auth** | API Key (`LASTFM_API_KEY`) |
| **Used For** | Supplementary radio recommendations via `track.getSimilar` |

**How it works:**
- When YouTube Music's native `getUpNext` radio doesn't return enough tracks (< 10), Stanza falls back to Last.fm's `track.getSimilar` method.
- Each similar track returned by Last.fm is then searched on YouTube Music to find a playable video ID.
- This provides genre-aware, cross-platform music discovery beyond YouTube's recommendation bubble.

---

### 6. Google Gemini AI (Song Story)
| | |
|---|---|
| **Library** | [`@google/genai`](https://www.npmjs.com/package/@google/genai) |
| **Auth** | API Key (`GEMINI_API_KEY`) |
| **Model** | `gemini-2.5-flash` with Search Grounding |
| **Used For** | Generating "Song Story" — behind-the-scenes facts, hidden meanings, and trivia about any song |

**How it works:**
- When the user requests a Song Story, the app sends the song title and artist to Gemini with a specialized system prompt and **Google Search grounding** enabled.
- Gemini uses real-time Google Search to find rare, behind-the-scenes facts about the song.
- The response is returned as structured JSON with three fields: `story` (backstory), `meaning` (hidden message), and `trivia` (fun fact).
- The output is written in Egyptian Arabic (Ammiya) as a storytelling experience.

---

### 7. Discord RPC (Rich Presence)
| | |
|---|---|
| **Library** | [`discord-rpc`](https://github.com/discordjs/RPC) |
| **Auth** | Application Client ID (`1497599851595038750`) |
| **Used For** | Showing currently playing track on your Discord profile |

**How it works:**
- On app launch, Stanza connects to the local Discord client via IPC transport.
- Every time the playing track changes, `setActivity()` is called with the track title, artist, timestamps (for elapsed/remaining time display), and the album art thumbnail.
- When playback is paused or stopped, the activity is set to "Idle".

---

### 8. Custom `vibestream://` Protocol (Audio Streaming)
| | |
|---|---|
| **Scheme** | `vibestream://audio/{youtubeId}` |
| **Used For** | Internal audio streaming with automatic caching |

**How it works:**
- Stanza registers a custom Electron protocol (`vibestream://`) that acts as a local audio CDN.
- When Howler.js requests audio from `vibestream://audio/{id}`, the protocol handler:
  1. **Checks local cache** first (downloaded or auto-cached files) — serves instantly with Range support.
  2. If not cached, **streams from YouTube** via yt-dlp/Innertube and simultaneously **tees the stream to a local cache file** for future plays.
- The cache is LRU-managed with a 500 MB cap, automatically evicting the oldest files when full.

---

## 🔑 Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Required — Prisma database path
DATABASE_URL="file:./dev.db"

# Spotify — metadata only (Client Credentials flow)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Genius — lyrics scraping (Client Credentials flow)
GENIUS_CLIENT_ID=your_genius_client_id
GENIUS_CLIENT_SECRET=your_genius_client_secret

# Google Gemini — Song Story AI feature
GEMINI_API_KEY=your_gemini_api_key

# Last.fm — supplementary radio recommendations (optional)
LASTFM_API_KEY=your_lastfm_api_key
```

| Variable | Required | Source |
|---|---|---|
| `DATABASE_URL` | ✅ | Local SQLite path for Prisma |
| `SPOTIFY_CLIENT_ID` | ✅ | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | ✅ | Spotify Developer Dashboard |
| `GENIUS_CLIENT_ID` | ✅ | [Genius API Clients](https://genius.com/api-clients) |
| `GENIUS_CLIENT_SECRET` | ✅ | Genius API Clients |
| `GEMINI_API_KEY` | Optional | [Google AI Studio](https://aistudio.google.com/apikey) |
| `LASTFM_API_KEY` | Optional | [Last.fm API](https://www.last.fm/api/account/create) |

---

## 💻 Tech Stack & Dependencies
Stanza is built using the latest web technologies compiled efficiently for desktop:

### Core Frameworks
- **[Electron](https://www.electronjs.org/)** - Desktop environment framework.
- **[React](https://react.dev/) / [Vite](https://vitejs.dev/)** - Lightning-fast UI rendering and bundling.
- **[TypeScript](https://www.typescriptlang.org/)** - End-to-end type safety.

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework.
- **[Framer Motion](https://www.framer.com/motion/)** - Beautiful, smooth micro-animations.
- **[Lucide React](https://lucide.dev/)** - Pixel-perfect iconography.

### Data & State
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Fast, un-opinionated state management.
- **[Prisma](https://www.prisma.io/)** - Next-generation ORM for reliable local caching.
- **[Zod](https://zod.dev/)** - Runtime schema validation for all IPC messages.

<<<<<<< HEAD
### Audio & APIs
- **[Spotify Web API](https://developer.spotify.com/documentation/web-api/)** - Primary source for high-fidelity track metadata and artist imagery.
- **[Howler.js](https://howlerjs.com/)** - Robust audio library for modern web.
- **[youtubei.js](https://github.com/LuanRT/YouTube.js)** - Unofficial Innertube API for YouTube Music search, streaming, and metadata.
- **[@distube/ytdl-core](https://github.com/distubejs/ytdl-core)** - Fallback media extraction.
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - Bundled binary for audio URL resolution and offline downloads.
- **[LRCLIB](https://lrclib.net/)** - Open-source synchronized lyrics API.
- **[Genius API](https://genius.com/developers)** - Song lyrics via search + page scraping.
- **[Last.fm API](https://www.last.fm/api)** - Similar track recommendations for radio.
- **[Google Gemini](https://ai.google.dev/)** - AI-powered Song Story generation with Search Grounding.
- **[discord-rpc](https://github.com/discordjs/RPC)** - Native Discord integrations.
- **[electron-updater](https://www.electron.build/auto-update)** - Seamless auto-update system.
=======

## 🔌 APIs & External Services

Stanza integrates with multiple external APIs to deliver a rich, full-featured music experience. Below is a breakdown of every service the app talks to, what it does, and how the data flows.

### 1. YouTube Music / Innertube API
| | |
|---|---|
| **Library** | [`youtubei.js`](https://github.com/LuanRT/YouTube.js) (Innertube client) |
| **Auth** | None — uses an anonymous Innertube session |
| **Used For** | Music search, artist pages, album details, playlist browsing, radio/auto-play recommendations, and streaming audio |

**How it works:**
- On app launch, Stanza creates a lazy singleton `Innertube` instance configured with `lang: en`, `location: US`, and `retrieve_player: true` (needed for URL deciphering).
- **Search** → `yt.music.search(query, { type: 'song' | 'artist' | 'playlist' | 'album' })` returns results which are normalized into Stanza's internal track/artist format.
- **Artist Details** → `yt.music.getArtist(artistId)` fetches top songs, albums, and singles with deep pagination via section endpoint expansion.
- **Album Details** → `yt.music.getAlbum(albumId)` or `yt.music.getPlaylist(playlistId)` for YT playlists.
- **Radio (Auto-Play)** → `yt.music.getUpNext(youtubeId)` generates a native radio mix based on the current song.
- **Audio Streaming** → `info.download()` streams audio directly through Innertube's internal HTTP client, which handles User-Agent/auth matching. Falls back to multiple client types (`IOS` → `ANDROID` → `TV` → `default`) if one fails.
- **Track Views** → `yt.getBasicInfo(youtubeId)` fetches the view count for display.

---

### 2. Spotify Web API
| | |
|---|---|
| **Endpoint** | `https://api.spotify.com/v1/` |
| **Auth** | OAuth 2.0 Client Credentials (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`) |
| **Used For** | High-fidelity metadata enrichment — album art, artist images, track details |

**How it works:**
- Stanza authenticates via `POST https://accounts.spotify.com/api/token` with `grant_type=client_credentials` and caches the token until it expires (minus a 60-second buffer).
- **Search Enrichment** → After every YouTube Music search, Stanza runs a parallel Spotify search (`GET /v1/search?type=track,artist`) and fuzzy-matches results by normalized title + artist to upgrade thumbnail URLs to permanent, high-resolution `i.scdn.co` album art.
- **Cover Resolution** → `spotifyFetchCoverUrl(title, artist)` does a focused `GET /v1/search?type=track&limit=1` to find the best album cover for a specific song. Results are cached in-memory (500 entries, 1-hour TTL).
- **Artist Images** → `spotifyFetchArtistImage(artistName)` searches for the artist and returns their highest-resolution profile image from Spotify.

> **Note:** Spotify is used for metadata only — no audio is ever streamed from Spotify. Playback always uses YouTube.

---

### 3. Lyrics APIs (Multi-Source Aggregator)

Stanza uses a **3-level lyrics aggregation pipeline** to find the best available lyrics for any track. The aggregator is in [`lyrics-aggregator.ts`](electron/main/lyrics-aggregator.ts) and sources are tried in priority order:

#### Level 1: Local (ManualLyrics) — SQLite Database
| | |
|---|---|
| **Source** | Prisma `ManualLyrics` table |
| **Priority** | **Highest** — always wins |

- If the user has manually edited or imported lyrics for a song, those are stored in the local SQLite database keyed by `youtubeId`.
- Manual lyrics always take precedence and evict any cached remote results.
- Users can **import** `.lrc` / `.txt` files and **export** their edits back to disk.

#### Level 2: LRCLIB — Synchronized Lyrics
| | |
|---|---|
| **Endpoint** | `https://lrclib.net/api/get` |
| **Auth** | None — public API |
| **Returns** | Synced LRC lyrics (timestamped) or plain-text lyrics |

**How it works:**
1. The track title is first **cleaned** using configurable "Title Cleaning Terms" stored in the database (strips tags like `(Official Video)`, `[Lyrics]`, etc.).
2. A request is made to `GET https://lrclib.net/api/get?artist_name=...&track_name=...`.
3. If the API returns `syncedLyrics` (timestamped `.lrc` format), those are used — enabling karaoke-style line-by-line highlighting.
4. If only `plainLyrics` are available, they're cleaned and returned as unsynced text.
5. Results are cached in-memory (500 entries) keyed by `youtubeId` so re-opening lyrics is instant.

#### Level 3: Genius — Scraped Lyrics
| | |
|---|---|
| **Endpoint** | `https://api.genius.com/search` + page scraping |
| **Auth** | OAuth 2.0 Client Credentials (`GENIUS_CLIENT_ID` + `GENIUS_CLIENT_SECRET`) |
| **Returns** | Plain-text lyrics scraped from the Genius song page |

**How it works:**
1. Stanza authenticates with `POST https://api.genius.com/oauth/token` using Client Credentials and caches the token.
2. A search is made to `GET https://api.genius.com/search?q={title} {artist}` with the Bearer token.
3. Results are **filtered for artist match** — the Genius artist name must contain (or be contained by) the searched artist, avoiding wrong matches.
4. The best hit (preferring `lyrics_state: 'complete'`) is selected, and its song page URL is fetched.
5. The page HTML is scraped using a **full Chrome User-Agent** (Genius requires this to return server-rendered lyrics instead of a JS-only shell).
6. Lyrics are extracted from `<div data-lyrics-container="true">` elements using a custom HTML parser that handles nested divs, then cleaned of HTML tags and entities.
7. Results are cached in-memory alongside LRCLIB results.

#### Aggregation Flow Diagram
```
User opens lyrics for a track
        │
        ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │ ManualLyrics │───Yes────▶ │ Return (local)  │
  │  (SQLite)    │            └─────────────────┘
  └──────┬──────┘
         │ No
         ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │ In-Memory   │───Yes────▶ │ Return (cached) │
  │   Cache     │            └─────────────────┘
  └──────┬──────┘
         │ No
         ▼
    Clean title with
    TitleCleaningTerms
         │
         ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │   LRCLIB    │───Yes────▶ │ Cache & Return  │
  │ (lrclib.net)│            │   (lrclib)      │
  └──────┬──────┘            └─────────────────┘
         │ No
         ▼
  ┌─────────────┐   Found?   ┌─────────────────┐
  │   Genius    │───Yes────▶ │ Cache & Return  │
  │  (scraper)  │            │   (genius)      │
  └──────┬──────┘            └─────────────────┘
         │ No
         ▼
  ┌─────────────────┐
  │ Cache & Return  │
  │   (none)        │
  └─────────────────┘
```

---

### 4. yt-dlp (Audio Extraction & Downloads)
| | |
|---|---|
| **Binary** | Bundled `yt-dlp.exe` (Windows) / `yt-dlp_macos` |
| **Auth** | None |
| **Used For** | Resolving direct audio stream URLs and downloading songs for offline playback |

**How it works:**
- **URL Resolution** → `yt-dlp --get-url --print %(ext)s -f bestaudio` extracts the best audio stream URL. Results are cached for 5 minutes to avoid re-invoking the CLI on seeks.
- **Downloads** → `yt-dlp -f bestaudio -o {outputTemplate} --no-playlist` downloads the full audio file. Progress is parsed from stdout/stderr and broadcast to all renderer windows via IPC.
- **Age-Restriction Fallback** → If yt-dlp hits an age restriction, Stanza searches YouTube Music for a safe alternative video of the same song.

---

### 5. Last.fm API
| | |
|---|---|
| **Endpoint** | `http://ws.audioscrobbler.com/2.0/` |
| **Auth** | API Key (`LASTFM_API_KEY`) |
| **Used For** | Supplementary radio recommendations via `track.getSimilar` |

**How it works:**
- When YouTube Music's native `getUpNext` radio doesn't return enough tracks (< 10), Stanza falls back to Last.fm's `track.getSimilar` method.
- Each similar track returned by Last.fm is then searched on YouTube Music to find a playable video ID.
- This provides genre-aware, cross-platform music discovery beyond YouTube's recommendation bubble.

---

### 6. Google Gemini AI (Song Story)
| | |
|---|---|
| **Library** | [`@google/genai`](https://www.npmjs.com/package/@google/genai) |
| **Auth** | API Key (`GEMINI_API_KEY`) |
| **Model** | `gemini-2.5-flash` with Search Grounding |
| **Used For** | Generating "Song Story" — behind-the-scenes facts, hidden meanings, and trivia about any song |

**How it works:**
- When the user requests a Song Story, the app sends the song title and artist to Gemini with a specialized system prompt and **Google Search grounding** enabled.
- Gemini uses real-time Google Search to find rare, behind-the-scenes facts about the song.
- The response is returned as structured JSON with three fields: `story` (backstory), `meaning` (hidden message), and `trivia` (fun fact).
- The output is written in Egyptian Arabic (Ammiya) as a storytelling experience.

---

### 7. Discord RPC (Rich Presence)
| | |
|---|---|
| **Library** | [`discord-rpc`](https://github.com/discordjs/RPC) |
| **Auth** | Application Client ID (`1497599851595038750`) |
| **Used For** | Showing currently playing track on your Discord profile |

**How it works:**
- On app launch, Stanza connects to the local Discord client via IPC transport.
- Every time the playing track changes, `setActivity()` is called with the track title, artist, timestamps (for elapsed/remaining time display), and the album art thumbnail.
- When playback is paused or stopped, the activity is set to "Idle".

---

### 8. Custom `vibestream://` Protocol (Audio Streaming)
| | |
|---|---|
| **Scheme** | `vibestream://audio/{youtubeId}` |
| **Used For** | Internal audio streaming with automatic caching |

**How it works:**
- Stanza registers a custom Electron protocol (`vibestream://`) that acts as a local audio CDN.
- When Howler.js requests audio from `vibestream://audio/{id}`, the protocol handler:
  1. **Checks local cache** first (downloaded or auto-cached files) — serves instantly with Range support.
  2. If not cached, **streams from YouTube** via yt-dlp/Innertube and simultaneously **tees the stream to a local cache file** for future plays.
- The cache is LRU-managed with a 500 MB cap, automatically evicting the oldest files when full.

---

>>>>>>> 9444dff44026d98cf7d190acbaba8164e7a47f1a

---

## 📥 Installation

Because Stanza is packaged securely, you **do not** need to be a developer, and you don't need to install Node.js to use it!

### Requirements
- **OS:** Windows 10 or Windows 11 (64-bit)
- **Network:** An active internet connection (to stream music & fetch metadata).
- **Disk Space:** ~300MB of free space for the installation.

### Steps to Install
1. **Download the Installer:**
   Locate the official pre-compiled installer: `stanza_0.1.0.exe` (or the latest version provided).
2. **Run the Executable:**
   Double-click the `.exe` file.
   *(Note: If Windows SmartScreen displays an "Unrecognized app" prompt, click "More info" -> "Run anyway" since this app operates independently without a signed certificate).*
3. **Enjoy:**
   Stanza will unpack itself automatically. Once finished, the app will launch, and a shortcut will be added directly to your Desktop.

---

## 🛠️ For Developers (Manual Build)
If you wish to compile Stanza locally rather than using the `.exe`:

1. Clone the repository and navigate into the folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate the Prisma database client:
   ```bash
   npm run postinstall
   ```
4. Copy `.env.example` to `.env` and fill in your API credentials:
   ```bash
   cp .env.example .env
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```
6. *(Optional)* Compile to a strict `.exe` locally:
   ```bash
   npm run release
   ```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
