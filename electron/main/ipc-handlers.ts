import { ipcMain, BrowserWindow, nativeImage, app, dialog } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import {
  CleaningTermDeleteSchema,
  CleaningTermUpsertSchema,
  LyricsGetSchema,
  ManualLyricsSaveSchema,
  SearchQuerySchema,
  SongUpsertSchema,
  SpotifySearchSchema,
  YoutubeIdSchema,
  PlaylistCreateSchema,
  PlaylistAddTrackSchema,
  PlaylistRemoveTrackSchema,
  PlaylistRenameSchema,
  PlaylistDeleteSchema,
} from '../../shared/ipc-schemas'
import { getPrisma } from './database'
import { getInnertube, resetInnertube } from './innertube'
import { aggregateLyrics } from './lyrics-aggregator'
import { spotifySearchMetadata, spotifyFetchCoverUrl, spotifyFetchArtistImage } from './spotify-metadata'
import { playbackUrlForYoutubeId } from './register-protocol'
import { downloadSong, deleteDownload, isDownloaded, broadcastDownloadProgress } from './download-manager'
function getArtistName(tItem: any): string {
  if (!tItem) return 'Unknown'
  if (Array.isArray(tItem.artists) && tItem.artists.length > 0) return tItem.artists.map((a: any) => a.name).join(', ')
  if (tItem.author?.name) return tItem.author.name
  if (typeof tItem.author === 'string' && tItem.author) return tItem.author
  if (Array.isArray(tItem.authors) && tItem.authors.length > 0) return tItem.authors.map((a: any) => a.name).join(', ')
  if (typeof tItem.artists === 'string' && tItem.artists) return tItem.artists
  if (tItem.strapline_text_one?.text) return tItem.strapline_text_one.text
  
  if (tItem.subtitle?.text) return tItem.subtitle.text
  if (typeof tItem.subtitle === 'string' && tItem.subtitle) return tItem.subtitle
  
  if (tItem.short_byline_text?.runs?.length > 0) return tItem.short_byline_text.runs[0].text
  if (tItem.long_byline_text?.runs?.length > 0) return tItem.long_byline_text.runs[0].text
  
  if (Array.isArray(tItem.flex_columns) && tItem.flex_columns[1]?.title?.runs?.length > 0) {
    return tItem.flex_columns[1].title.runs[0].text
  }
  
  if (tItem.flex_columns?.[1]?.title?.text) return tItem.flex_columns[1].title.text

  return 'Unknown'
}

/** Normalize a string for fuzzy matching (lowercase, strip parens/brackets, trim) */
function normalize(s: string | null | undefined): string {
  if (!s) return ''
  return s.toLowerCase().replace(/[\(\)\[\]]/g, '').replace(/\s+/g, ' ').trim()
}

export function registerIpcHandlers(): void {
  ipcMain.removeHandler(IpcChannels.searchMusic)
  ipcMain.removeHandler(IpcChannels.searchArtists)
  ipcMain.removeHandler(IpcChannels.searchPlaylists)
  ipcMain.removeHandler(IpcChannels.getPlaybackUrl)
  ipcMain.removeHandler(IpcChannels.songUpsert)
  ipcMain.removeHandler(IpcChannels.manualLyricsSave)
  ipcMain.removeHandler(IpcChannels.manualLyricsGet)
  ipcMain.removeHandler(IpcChannels.cleaningTermsList)
  ipcMain.removeHandler(IpcChannels.cleaningTermsUpsert)
  ipcMain.removeHandler(IpcChannels.cleaningTermsDelete)
  ipcMain.removeHandler(IpcChannels.lyricsGet)
  ipcMain.removeHandler(IpcChannels.spotifySearch)
  ipcMain.removeHandler(IpcChannels.playlistsGet)
  ipcMain.removeHandler(IpcChannels.playlistsCreate)
  ipcMain.removeHandler(IpcChannels.playlistsAddTrack)
  ipcMain.removeHandler(IpcChannels.playlistsRemoveTrack)
  ipcMain.removeHandler(IpcChannels.playlistsRename)
  ipcMain.removeHandler(IpcChannels.playlistsDelete)
  ipcMain.removeHandler(IpcChannels.downloadSong)
  ipcMain.removeHandler(IpcChannels.deleteSong)
  ipcMain.removeHandler(IpcChannels.isDownloaded)
  ipcMain.removeHandler(IpcChannels.playlistSetOffline)
  ipcMain.removeHandler(IpcChannels.lyricsExport)
  ipcMain.removeHandler(IpcChannels.lyricsImport)

  function upscaleGoogleUrl(url: string | null | undefined): string | null {
    if (!url) return null
    let res = url
    if (res.startsWith('//')) res = 'https:' + res

    // Pass-through: YouTube and Spotify CDN images have token-bound sizes
    if (res.includes('i.ytimg.com') || res.includes('i.scdn.co')) return res

    // Only resize on known Google image hosts
    if (res.includes('lh3.googleusercontent.com') || res.includes('ggpht.com')) {
      res = res.replace(/=w\d+-h\d+/i, '=w544-h544')
      res = res.replace(/=s\d+/i, '=s544')
    }

    return res
  }

  function getBestYtThumbnail(thumbnails: any, videoId?: string): string | null {
    // Prefer permanent i.ytimg.com URLs — they never expire
    if (videoId) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }
    // Fallback to API-provided thumbnails (may expire)
    let arr = thumbnails
    if (thumbnails && !Array.isArray(thumbnails) && Array.isArray(thumbnails.contents)) {
      arr = thumbnails.contents
    }
    if (!Array.isArray(arr) || arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
    return upscaleGoogleUrl(sorted[0]?.url)
  }

  ipcMain.handle(IpcChannels.searchMusic, async (_evt, raw: unknown) => {
    const { query } = SearchQuerySchema.parse(raw)
    try {
      const yt = await getInnertube()

      // Run YouTube + Spotify searches in parallel for speed
      const ytResults = await yt.music.search(query, { type: 'song' })

      // Helper function to extract items from all sections, ignoring spelling corrections
      const extractSongs = (res: any) => {
        let items: any[] = []
        const allSections = (res.contents as any[]) ?? []
        for (const sec of allSections) {
          const contents = sec?.contents ?? []
          for (const item of contents) {
            if (item?.type === 'DidYouMean' || item?.type === 'ShowingResultsFor') continue
            if (item?.id || item?.video_id || item?.endpoint?.payload?.videoId) {
              items.push(item)
            }
          }
        }
        return items
      }

      let songs = extractSongs(ytResults)

      // Independent artists often upload Music Videos without registering 'Song' metadata schemas with Google
      if (songs.length === 0) {
        const fallback = await yt.music.search(query, { type: 'video' })
        songs = extractSongs(fallback)
      }

      const mapped = songs
        .filter((s: any) => s?.id)
        .slice(0, 30)
        .map((s: any) => ({
          youtubeId: s.id,
          title: s.title ?? s.name ?? 'Unknown',
          artist: Array.isArray(s.artists) ? s.artists.map((a: any) => a.name).join(', ') : (s.artists?.name ?? null),
          album: s.album?.name ?? null,
          // Use YT Music API thumbnail (square album art) as initial source
          thumbnailUrl: getBestYtThumbnail(s.thumbnails),
          durationSeconds: s.duration?.seconds ?? null,
          isExplicit: Boolean(s.is_explicit),
        }))

      // Try to upgrade covers to Spotify (permanent, high-res, square)
      try {
        const spResult = await spotifySearchMetadata(query, 30)
        if (spResult && 'tracks' in spResult && spResult.tracks.length > 0) {
          const spTracks = spResult.tracks.filter(t => t.imageUrl)

          for (let i = 0; i < mapped.length; i++) {
            const ytTitle = normalize(mapped[i].title)
            const ytArtist = normalize(mapped[i].artist)

            const match = spTracks.find(sp => {
              const spTitle = normalize(sp.name)
              const spArtist = normalize(sp.artists)
              const titleMatch = ytTitle.includes(spTitle) || spTitle.includes(ytTitle)
              const artistMatch = !ytArtist || !spArtist || ytArtist.includes(spArtist) || spArtist.includes(ytArtist)
              return titleMatch && artistMatch
            })

            if (match?.imageUrl) {
              mapped[i].thumbnailUrl = match.imageUrl
            }
          }
        }
      } catch {
        // Spotify unavailable — YT Music covers still work
      }

      return mapped
    } catch (err: any) {
      console.error('[vs:search:music]', err)
      try {
        const fs = require('node:fs')
        const path = require('node:path')
        const os = require('node:os')
        fs.appendFileSync(path.join(os.homedir(), 'Desktop', 'stanza-search-error.log'), `[Search Error] ${err?.stack || err}\n`)
      } catch (e) {}
      resetInnertube()
      return []
    }
  })

  ipcMain.handle(IpcChannels.searchArtists, async (_evt, raw: unknown) => {
    const { query } = SearchQuerySchema.parse(raw)
    try {
      const yt = await getInnertube()
      const results = await yt.music.search(query, { type: 'artist' })
      // Artists are nested: results.contents[0].contents
      const section = (results.contents as any[])?.[0]
      const artists: any[] = section?.contents ?? []

      return artists
        .filter((a: any) => a?.id)
        .slice(0, 12)
        .map((a: any) => ({
          artistId: a.id,
          name: a.name ?? 'Unknown',
          thumbnailUrl: getBestYtThumbnail(a.thumbnails),
          subscribers: a.subscribers ?? null,
        }))
    } catch (err) {
      console.error('[vs:search:artists]', err)
      resetInnertube()
      return []
    }
  })

  ipcMain.handle(IpcChannels.searchPlaylists, async (_evt, raw: unknown) => {
    const { query } = SearchQuerySchema.parse(raw)
    try {
      const yt = await getInnertube()
      const results = await yt.music.search(query, { type: 'playlist' })
      const section = (results.contents as any[])?.[0]
      const playlists: any[] = section?.contents ?? []

      return playlists
        .filter((p: any) => p?.id || p?.playlist_id)
        .slice(0, 12)
        .map((p: any) => ({
          playlistId: p.id ?? p.playlist_id ?? '',
          title: p.title ?? p.name ?? 'Unknown Playlist',
          author: getArtistName(p),
          thumbnailUrl: getBestYtThumbnail(p.thumbnails),
          trackCount: p.item_count ?? p.song_count ?? p.total_items ?? null,
        }))
    } catch (err) {
      console.error('[vs:search:playlists]', err)
      resetInnertube()
      return []
    }
  })

  ipcMain.handle(IpcChannels.getPlaybackUrl, async (_evt, raw: unknown) => {
    const { youtubeId } = YoutubeIdSchema.parse(raw)
    try {
      return { playbackUrl: playbackUrlForYoutubeId(youtubeId) }
    } catch (error) {
      console.error(`[ipc] Failed to get playback URL for ${youtubeId}:`, error)
      // Reset Innertube client on failure
      resetInnertube()
      throw error
    }
  })

  ipcMain.handle(IpcChannels.songUpsert, async (_evt, raw: unknown) => {
    const payload = SongUpsertSchema.parse(raw)
    const db = getPrisma()

    // Try to get a permanent Spotify cover before saving
    let bestThumb = payload.thumbnailUrl ?? null
    if (!bestThumb?.includes('i.scdn.co')) {
      try {
        const spCover = await spotifyFetchCoverUrl(payload.title ?? '', payload.artist ?? '')
        if (spCover) bestThumb = spCover
      } catch {
        // Spotify unavailable — use whatever URL we have
      }
    }

    return db.song.upsert({
      where: { youtubeId: payload.youtubeId },
      update: {
        title: payload.title,
        artist: payload.artist ?? null,
        album: payload.album ?? null,
        thumbnailUrl: bestThumb,
        durationSeconds: payload.durationSeconds ?? null,
      },
      create: {
        youtubeId: payload.youtubeId,
        title: payload.title,
        artist: payload.artist ?? null,
        album: payload.album ?? null,
        thumbnailUrl: bestThumb,
        durationSeconds: payload.durationSeconds ?? null,
      },
    })
  })

  ipcMain.handle(IpcChannels.manualLyricsSave, async (_evt, raw: unknown) => {
    const { youtubeId, lrcRaw } = ManualLyricsSaveSchema.parse(raw)
    const db = getPrisma()
    return db.manualLyrics.upsert({
      where: { youtubeId },
      update: { lrcRaw },
      create: { youtubeId, lrcRaw },
    })
  })

  ipcMain.handle(IpcChannels.manualLyricsGet, async (_evt, raw: unknown) => {
    const { youtubeId } = YoutubeIdSchema.parse(raw)
    const db = getPrisma()
    return db.manualLyrics.findUnique({ where: { youtubeId } })
  })

  ipcMain.handle(IpcChannels.cleaningTermsList, async () => {
    const db = getPrisma()
    return db.titleCleaningTerm.findMany({ orderBy: { sortOrder: 'asc' } })
  })

  ipcMain.handle(IpcChannels.cleaningTermsUpsert, async (_evt, raw: unknown) => {
    const payload = CleaningTermUpsertSchema.parse(raw)
    const db = getPrisma()
    if (payload.id) {
      return db.titleCleaningTerm.update({
        where: { id: payload.id },
        data: {
          term: payload.term,
          ...(payload.sortOrder !== undefined ? { sortOrder: payload.sortOrder } : {}),
          ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
        },
      })
    }
    const max = await db.titleCleaningTerm.aggregate({ _max: { sortOrder: true } })
    const next = (max._max.sortOrder ?? -1) + 1
    return db.titleCleaningTerm.create({
      data: {
        term: payload.term,
        sortOrder: payload.sortOrder ?? next,
        enabled: payload.enabled ?? true,
      },
    })
  })

  ipcMain.handle(IpcChannels.cleaningTermsDelete, async (_evt, raw: unknown) => {
    const { id } = CleaningTermDeleteSchema.parse(raw)
    const db = getPrisma()
    await db.titleCleaningTerm.delete({ where: { id } })
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.lyricsGet, async (_evt, raw: unknown) => {
    const payload = LyricsGetSchema.parse(raw)
    const db = getPrisma()
    return aggregateLyrics(db, {
      youtubeId: payload.youtubeId,
      title: payload.title,
      artist: payload.artist ?? null,
    })
  })

  ipcMain.handle(IpcChannels.spotifySearch, async (_evt, raw: unknown) => {
    const { query, limit } = SpotifySearchSchema.parse(raw)
    return spotifySearchMetadata(query, limit ?? 20)
  })

  // === Playlists & Liked Songs ===

  ipcMain.handle(IpcChannels.playlistsGet, async () => {
    const db = getPrisma()
    // Ensure "Liked Songs" exists
    let liked = await db.playlist.findFirst({ where: { name: 'Liked Songs' } })
    if (!liked) {
      liked = await db.playlist.create({ data: { name: 'Liked Songs', sortOrder: -1 } })
    }
    const lists = await db.playlist.findMany({
      include: {
        tracks: {
          include: {
            song: true,
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const mappedLists = lists.map(p => ({
      ...p,
      tracks: p.tracks.map(t => ({
        ...t,
        song: {
          ...t.song,
          thumbnailUrl: upscaleGoogleUrl(t.song.thumbnailUrl)
        }
      }))
    }))

    const downloadedSongs = await db.song.findMany({
      where: { isDownloaded: true }
    });

    const downloadedPlaylist = {
      id: 'downloaded-songs',
      name: 'Downloaded Songs',
      sortOrder: -2,
      isOffline: true,
      tracks: downloadedSongs.map((song, i) => ({
        id: `dl-${song.youtubeId}`,
        playlistId: 'downloaded-songs',
        youtubeId: song.youtubeId,
        position: i,
        createdAt: new Date(),
        song: {
          ...song,
          thumbnailUrl: upscaleGoogleUrl(song.thumbnailUrl)
        }
      }))
    };

    return [downloadedPlaylist, ...mappedLists]
  })

  ipcMain.handle(IpcChannels.playlistsCreate, async (_evt, raw: unknown) => {
    const { name } = PlaylistCreateSchema.parse(raw)
    const db = getPrisma()
    const max = await db.playlist.aggregate({ _max: { sortOrder: true } })
    return db.playlist.create({
      data: {
        name,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
      include: { tracks: { include: { song: true } } }
    })
  })

  ipcMain.handle(IpcChannels.playlistsRename, async (_evt, raw: unknown) => {
    const { playlistId, name } = PlaylistRenameSchema.parse(raw)
    const db = getPrisma()
    return db.playlist.update({
      where: { id: playlistId },
      data: { name },
      include: { tracks: { include: { song: true } } }
    })
  })

  ipcMain.handle(IpcChannels.playlistsDelete, async (_evt, raw: unknown) => {
    const { playlistId } = PlaylistDeleteSchema.parse(raw)
    const db = getPrisma()
    // First, remove all tracks associated with the playlist
    await db.playlistTrack.deleteMany({ where: { playlistId } })
    // Then delete the playlist itself
    await db.playlist.delete({ where: { id: playlistId } })
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.playlistsAddTrack, async (_evt, raw: unknown) => {
    const { playlistId, youtubeId } = PlaylistAddTrackSchema.parse(raw)
    const db = getPrisma()
    
    // Check if song exists, throw if not
    const song = await db.song.findUnique({ where: { youtubeId } })
    if (!song) throw new Error('Cannot add track to playlist: Song does not exist in DB yet.')

    // Check if already in playlist
    const existing = await db.playlistTrack.findFirst({
      where: { playlistId, youtubeId }
    })
    if (existing) return existing

    const max = await db.playlistTrack.aggregate({
      where: { playlistId },
      _max: { position: true },
    })
    
    return db.playlistTrack.create({
      data: {
        playlistId,
        youtubeId,
        position: (max._max.position ?? -1) + 1,
      },
    })
  })

  ipcMain.handle(IpcChannels.playlistsRemoveTrack, async (_evt, raw: unknown) => {
    const { playlistId, youtubeId } = PlaylistRemoveTrackSchema.parse(raw)
    const db = getPrisma()
    await db.playlistTrack.deleteMany({
      where: { playlistId, youtubeId }
    })
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.windowSetFullscreen, (event, isFullscreen: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setFullScreen(isFullscreen)
    }
  })

  // ---- Thumbar Controls ---- //
  let thumbarIcons: Record<string, Electron.NativeImage> | null = null

  ipcMain.on(IpcChannels.thumbarRegisterIcons, (event, iconsData: Record<string, string>) => {
    thumbarIcons = {
      play: nativeImage.createFromDataURL(iconsData.play),
      pause: nativeImage.createFromDataURL(iconsData.pause),
      prev: nativeImage.createFromDataURL(iconsData.prev),
      next: nativeImage.createFromDataURL(iconsData.next),
    }
  })

  ipcMain.on(IpcChannels.thumbarUpdate, (event, { isPlaying }) => {
    if (!thumbarIcons) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    win.setThumbarButtons([
      {
        tooltip: 'Previous',
        icon: thumbarIcons.prev,
        click() { win.webContents.send(IpcChannels.thumbarAction, 'prev') }
      },
      {
        tooltip: isPlaying ? 'Pause' : 'Play',
        icon: isPlaying ? thumbarIcons.pause : thumbarIcons.play,
        click() { win.webContents.send(IpcChannels.thumbarAction, 'togglePlay') }
      },
      {
        tooltip: 'Next',
        icon: thumbarIcons.next,
        click() { win.webContents.send(IpcChannels.thumbarAction, 'next') }
      }
    ])
  })
  ipcMain.handle(IpcChannels.radioGetRecommendations, async (_evt, raw: unknown) => {
    const { youtubeId } = raw as { youtubeId: string }

    async function enrichWithSpotifyCovers(tracks: any[]): Promise<any[]> {
      await Promise.allSettled(tracks.map(async (t) => {
        try {
          const spCover = await spotifyFetchCoverUrl(t.title, t.artist || '')
          if (spCover) t.thumbnailUrl = spCover
        } catch {}
      }))
      return tracks
    }

    function extractTracks(items: any[]): any[] {
      const results: any[] = []
      for (const item of items) {
        if (!item) continue
        const tItem = item as any
        const vid = tItem.video_id || tItem.id
        if (!vid || vid === youtubeId) continue
        results.push({
          youtubeId: vid,
          title: tItem.title?.text || tItem.title || 'Unknown',
          artist: getArtistName(tItem),
          album: tItem.album?.name || null,
          thumbnailUrl: getBestYtThumbnail(tItem.thumbnail || tItem.thumbnails),
          durationSeconds: tItem.duration?.seconds || null,
          isExplicit: Boolean(tItem.is_explicit),
        })
      }
      return results
    }

    const db = getPrisma()
    const songInfo = await db.song.findUnique({ where: { youtubeId } })
    const seedArtist = songInfo?.artist?.toLowerCase() || ''

    const finalTracks: any[] = []
    const seenIds = new Set<string>([youtubeId])

    function addTracks(tracks: any[]) {
      for (const t of tracks) {
        if (!seenIds.has(t.youtubeId)) {
          finalTracks.push(t)
          seenIds.add(t.youtubeId)
        }
      }
    }

    // Strategy 1: YouTube Music Native Radio Mix (getUpNext)
    // This is the most accurate engine as it uses the exact song ID and avoids generic artist name collisions.
    try {
      const yt = await getInnertube()
      const upNext = await yt.music.getUpNext(youtubeId)
      const tracks = extractTracks((upNext as any).contents || (upNext as any).items || [])
      addTracks(tracks)
      if (finalTracks.length > 0) return enrichWithSpotifyCovers(finalTracks.slice(0, 15))
    } catch (err) {
      console.warn('[vs:radio] Native getUpNext mix failed:', err)
    }

    // Strategy 3: Last.fm similar tracks → search on YT Music (genre-aware)
    try {
      if (finalTracks.length < 10) {
        const apiKey = process.env.LASTFM_API_KEY
        if (apiKey && songInfo && songInfo.artist && songInfo.title) {
          const lfUrl = `http://ws.audioscrobbler.com/2.0/?method=track.getSimilar&artist=${encodeURIComponent(songInfo.artist)}&track=${encodeURIComponent(songInfo.title)}&api_key=${apiKey}&format=json&limit=8`
          const res = await fetch(lfUrl)
          const json = await res.json() as any
          const simTracks = json.similartracks?.track || []

          const recommendations: any[] = []
          const yt = await getInnertube()
          
          for (const t of simTracks) {
            const s = await yt.music.search(`${t.name} ${t.artist.name}`, { type: 'song' })
            const section = (s.contents as any[])?.[0]
            const songs: any[] = section?.contents ?? []
            if (!songs.length) continue
            const tItem = songs[0] as any
            if (!tItem.id || tItem.id === youtubeId) continue
            
            recommendations.push({
              youtubeId: tItem.id,
              title: tItem.title ?? tItem.name ?? 'Unknown',
              artist: getArtistName(tItem),
              album: tItem.album?.name ?? null,
              thumbnailUrl: getBestYtThumbnail(tItem.thumbnail || tItem.thumbnails),
              durationSeconds: tItem.duration?.seconds ?? null,
              isExplicit: Boolean(tItem.is_explicit),
            })
            if (recommendations.length >= 8) break
          }
          addTracks(recommendations)
        }
      }
    } catch (eFallback) {
       console.error('[vs:radio] LastFM strategies failed', eFallback)
    }

    return enrichWithSpotifyCovers(finalTracks.slice(0, 15))
  })

  ipcMain.handle(IpcChannels.artistGetDetails, async (_evt, raw: unknown) => {
    const { artistId: queryId } = raw as { artistId: string }
    try {
      const yt = await getInnertube()
      let artistId = queryId
      if (!artistId.startsWith('UC')) {
         const search = await yt.music.search(queryId, { type: 'artist' })
         const contents = search.contents as any[]
         const artistItem = contents?.[0]?.contents?.[0]
         if (artistItem?.id) artistId = artistItem.id
      }
      const artist = await yt.music.getArtist(artistId)
      
      const headerObj = (artist as any).header as any
      const artistName = headerObj?.title?.text || (artist as any).name || 'Unknown'
      
      const ytThumbnails = headerObj?.foreground?.thumbnails || 
                           headerObj?.thumbnail || 
                           headerObj?.thumbnails || 
                           (artist as any).thumbnails
                           
      const details = {
        artistId,
        name: artistName,
        thumbnailUrl: getBestYtThumbnail(ytThumbnails) || null,
        subscribers: headerObj?.subscribers?.text || null,
        topSongs: [] as any[],
        allSongsEndpoint: null as any,
      }

      // Try to get a high-res artist image from Spotify (non-blocking)
      const spotifyImagePromise = spotifyFetchArtistImage(artistName)

      // Instead of generic search, extract "Top songs" and "Albums"/"Singles" from official artist sections
      const topSongsRaw: any[] = []
      const albums: any[] = []
      const singles: any[] = []

      const parseViews = (viewsText: string): number => {
        if (!viewsText) return 0
        const match = viewsText.match(/([\d.]+)([KMB]?)/i)
        if (!match) return 0
        let num = parseFloat(match[1])
        const suffix = match[2]?.toUpperCase()
        if (suffix === 'K') num *= 1000
        else if (suffix === 'M') num *= 1000000
        else if (suffix === 'B') num *= 1000000000
        return num
      }

      // Collect section expansion promises for parallelism
      const sectionExpansions: { sec: any; titleLo: string; promise: Promise<any> }[] = []

      for (const section of artist.sections || []) {
        const sec = section as any
        const title = sec.title?.text || sec.header?.title?.text || ''
        const titleLo = title.toLowerCase()

        if (titleLo.includes('album') || titleLo.includes('single') || titleLo.includes('ep') || titleLo === 'top songs' || titleLo === 'songs') {
           const moreEndpoint = sec.header?.more_content?.endpoint || sec.bottom_text?.endpoint || sec.endpoint
           if (moreEndpoint) {
              sectionExpansions.push({
                sec,
                titleLo,
                promise: moreEndpoint.call(yt.actions, { parse: true, client: 'YTMUSIC' }).catch((e: any) => {
                  console.error('[vs:artist] Failed to expand section', title, e)
                  return null
                })
              })
           } else {
             sectionExpansions.push({ sec, titleLo, promise: Promise.resolve(null) })
           }
        } else {
          sectionExpansions.push({ sec, titleLo, promise: Promise.resolve(null) })
        }
      }

      // Await all section expansions in parallel
      const expandedPages = await Promise.all(sectionExpansions.map(s => s.promise))

      for (let si = 0; si < sectionExpansions.length; si++) {
        const { sec, titleLo } = sectionExpansions[si]
        const page = expandedPages[si]
        
        let items = sec.contents || []
        if (page?.contents_memo) {
          const expandedItems = [...(page.contents_memo.get('MusicTwoRowItem') || []), ...(page.contents_memo.get('MusicResponsiveListItem') || [])]
          if (expandedItems && expandedItems.length > 0) {
            items = expandedItems
          }
        }

        if (titleLo === 'top songs' || titleLo === 'songs') {
           for (const item of items) {
              const youtubeId = item.id || item.videoId || item.endpoint?.payload?.videoId
              if (!youtubeId) continue
              let viewsCount = 0
              if (item.flex_columns && item.flex_columns[2]) {
                 const viewsText = item.flex_columns[2].title?.text || ''
                 viewsCount = parseViews(viewsText)
              } else if (item.views) {
                 viewsCount = parseViews(item.views)
              }

              topSongsRaw.push({
                youtubeId,
                title: item.title?.text || item.title || 'Unknown',
                artist: details.name,
                album: item.album?.name || null,
                thumbnailUrl: getBestYtThumbnail(item.thumbnail || item.thumbnails) || null,
                durationSeconds: item.duration?.seconds || null,
                isExplicit: Boolean(item.is_explicit),
                views: viewsCount
              })
           }
        }
        else if (titleLo === 'albums') {
          albums.push(...items.map((c: any) => ({
            youtubeId: c.endpoint?.payload?.browseId || c.id,
            title: c.title?.text || c.title || 'Unknown',
            type: 'album',
            year: c.subtitle?.text || c.year || '',
            thumbnailUrl: getBestYtThumbnail(c.thumbnail?.contents || c.thumbnail || c.thumbnails) || null
          })))
        }
        else if (titleLo === 'singles' || titleLo === 'singles & eps') {
          singles.push(...items.map((c: any) => ({
            youtubeId: c.endpoint?.payload?.browseId || c.id,
            title: c.title?.text || c.title || 'Unknown',
            type: 'album',
            year: c.subtitle?.text || c.year || '',
            thumbnailUrl: getBestYtThumbnail(c.thumbnail?.contents || c.thumbnail || c.thumbnails) || null
          })))
        }
      }

      // Sort top songs specifically by view count highest to lowest
      topSongsRaw.sort((a, b) => b.views - a.views)
      
      details.topSongs = topSongsRaw
      
      ;(details as any).albums = albums
      ;(details as any).singles = singles

      // Upgrade thumbnail with Spotify image if available
      try {
        const spImage = await spotifyImagePromise
        if (spImage) details.thumbnailUrl = spImage
      } catch { /* Spotify unavailable — keep YT thumbnail */ }

      // Enrich top song thumbnails with Spotify high-res covers (cap at 15 to avoid API spam)
      try {
        const songsToEnrich = details.topSongs.slice(0, 15)
        await Promise.allSettled(songsToEnrich.map(async (song: any) => {
          try {
            const spCover = await spotifyFetchCoverUrl(song.title, song.artist || '')
            if (spCover) song.thumbnailUrl = spCover
          } catch { /* Spotify unavailable — keep YT thumbnail */ }
        }))
      } catch { /* non-fatal */ }
      
      return details
    } catch (err) {
      console.error('[vs:artist]', err)
      throw new Error('Failed to get artist details')
    }
  })

  ipcMain.handle(IpcChannels.albumGetDetails, async (_evt, raw: unknown) => {
    const { albumId: queryId } = raw as { albumId: string }
    console.log(`[vs:album] Request for album: "${queryId}"`)
    try {
      let yt = await getInnertube()
      let albumId = queryId

      // ── YouTube Music Playlist (VL… or OLAK5uy_…) ──
      // These are user playlists / community playlists, not albums. Use getPlaylist instead.
      const isPlaylist = albumId.startsWith('VL') || albumId.startsWith('OLAK5uy_')
      if (isPlaylist) {
        // getPlaylist expects the raw playlist ID without the VL prefix
        const playlistId = albumId.startsWith('VL') ? albumId.slice(2) : albumId
        let playlist: any
        try {
          playlist = await yt.music.getPlaylist(playlistId)
        } catch (firstErr) {
          console.warn(`[vs:album] getPlaylist(${playlistId}) failed, retrying…`, firstErr)
          resetInnertube()
          yt = await getInnertube()
          playlist = await yt.music.getPlaylist(playlistId)
        }

        const plHeader = (playlist as any).header
        const plTitle = plHeader?.title?.text || (playlist as any).title || 'Unknown Playlist'
        const plAuthor = plHeader?.subtitle?.text || getArtistName(plHeader || playlist)
        const plThumb =
          getBestYtThumbnail(plHeader?.thumbnail?.contents) ||
          getBestYtThumbnail(plHeader?.thumbnail) ||
          getBestYtThumbnail(plHeader?.thumbnails) ||
          getBestYtThumbnail((playlist as any).background?.thumbnails) ||
          null

        console.log(`[vs:album] Resolved playlist: "${plTitle}" by "${plAuthor}"`)

        const plTracks = (playlist.contents || []).map((tItem: any, i: number) => {
          let yid = tItem.videoId || tItem.id || tItem.endpoint?.payload?.videoId || tItem.play_endpoint?.payload?.videoId
          if (!yid && tItem.flex_columns?.[0]?.title?.runs?.[0]?.endpoint?.payload?.videoId) {
            yid = tItem.flex_columns[0].title.runs[0].endpoint.payload.videoId
          }
          if (!yid && tItem.title?.endpoint?.payload?.videoId) {
            yid = tItem.title.endpoint.payload.videoId
          }

          return {
            youtubeId: yid,
            title: tItem.title?.text || tItem.title || `Track ${i + 1}`,
            artist: getArtistName(tItem),
            album: plTitle,
            thumbnailUrl: getBestYtThumbnail(tItem.thumbnail || tItem.thumbnails) || plThumb,
            durationSeconds: tItem.duration?.seconds || null,
            isExplicit: Boolean(tItem.is_explicit),
          }
        }).filter((s: any) => s.youtubeId)

        return {
          albumId: queryId,
          title: plTitle,
          artist: plAuthor,
          thumbnailUrl: plThumb,
          year: null,
          trackCount: plTracks.length,
          tracks: plTracks,
        }
      }

      // If not a YT Music browse ID, resolve by searching
      if (!albumId.startsWith('MPRE')) {
        let browseId: string | null = null

        // Helper to extract browse ID from search results
        const extractBrowseId = (search: any): string | null => {
          const contents = search.contents as any[]
          if (!contents) return null
          for (const section of contents) {
            const items = section.contents || []
            for (const item of items) {
              const id = item?.endpoint?.payload?.browseId || item?.id
              if (id && typeof id === 'string' && id.startsWith('MPRE')) return id
            }
          }
          return null
        }

        // Helper to extract an album ID from a song search result
        const extractAlbumFromSongSearch = (search: any): string | null => {
          const contents = search.contents as any[]
          if (!contents) return null
          for (const section of contents) {
            const items = section.contents || []
            for (const item of items) {
              const albumId = item?.album?.id || item?.album?.endpoint?.payload?.browseId
              if (albumId && typeof albumId === 'string' && albumId.startsWith('MPRE')) return albumId
            }
          }
          return null
        }

        // Strategy 1: Search with type: 'album'
        try {
          const search = await yt.music.search(queryId, { type: 'album' })
          browseId = extractBrowseId(search)
          console.log(`[vs:album] Searched "${queryId}" (type:album) → browseId: ${browseId}`)
        } catch (e) {
          console.warn('[vs:album] album-type search failed for:', queryId, e)
        }

        // Strategy 2: Search with type: 'song' and extract its parent album (Highly reliable for singles like S3RL)
        if (!browseId) {
          try {
            const search = await yt.music.search(queryId, { type: 'song' })
            browseId = extractAlbumFromSongSearch(search)
            console.log(`[vs:album] Searched "${queryId}" (type:song) → browseId: ${browseId}`)
          } catch (e) {
            console.warn('[vs:album] song-type search failed for:', queryId, e)
          }
        }

        // Strategy 3: Generic search (no type filter) — broader results may contain the album
        if (!browseId) {
          try {
            const search = await yt.music.search(queryId)
            browseId = extractBrowseId(search)
            console.log(`[vs:album] Searched "${queryId}" (generic) → browseId: ${browseId}`)
          } catch (e) {
            console.warn('[vs:album] generic search failed for:', queryId, e)
          }
        }

        // Strategy 4: Try with just the first meaningful part of the query (e.g. album name without artist)
        if (!browseId && queryId.includes(' ')) {
          try {
            // Split on common separators and try the longer half
            const parts = queryId.split(/\s*[-–—|•]\s*/)
            for (const part of parts) {
              if (part.trim().length < 3) continue
              const search = await yt.music.search(part.trim(), { type: 'album' })
              browseId = extractBrowseId(search)
              if (browseId) {
                console.log(`[vs:album] Searched partial "${part.trim()}" → browseId: ${browseId}`)
                break
              }
            }
          } catch (e) {
            console.warn('[vs:album] partial search failed for:', queryId, e)
          }
        }

        if (!browseId) {
          throw new Error(`Could not find an album matching "${queryId}"`)
        }
        albumId = browseId
      }

      // Fetch album details with one retry on failure (Innertube session can go stale)
      let album: any
      try {
        album = await yt.music.getAlbum(albumId)
      } catch (firstErr) {
        console.warn(`[vs:album] getAlbum(${albumId}) failed, retrying with fresh client...`, firstErr)
        resetInnertube()
        yt = await getInnertube()
        album = await yt.music.getAlbum(albumId)
      }

      const header = (album as any).header

      // Try multiple paths for album artwork
      const albumThumb =
        getBestYtThumbnail(header?.thumbnail?.contents) ||
        getBestYtThumbnail(header?.thumbnail) ||
        getBestYtThumbnail(header?.thumbnails) ||
        getBestYtThumbnail((album as any).background?.thumbnails) ||
        getBestYtThumbnail((album as any).thumbnails) ||
        null

      const albumTitle = header?.title?.text || (album as any).title || 'Unknown Album'
      const albumArtist = getArtistName(header || album)
      console.log(`[vs:album] Resolved album: "${albumTitle}" by "${albumArtist}" (${albumId})`)

      // Try Spotify for a high-res permanent cover
      let finalThumb = albumThumb
      try {
        const spCover = await spotifyFetchCoverUrl(albumTitle, albumArtist)
        if (spCover) finalThumb = spCover
      } catch { /* Spotify unavailable */ }

      const tracks = (album.contents || []).map((tItem: any, i: number) => {
          let yid = tItem.videoId || tItem.id || tItem.endpoint?.payload?.videoId || tItem.play_endpoint?.payload?.videoId;
          if (!yid && tItem.flex_columns?.[0]?.title?.runs?.[0]?.endpoint?.payload?.videoId) {
            yid = tItem.flex_columns[0].title.runs[0].endpoint.payload.videoId;
          }
          if (!yid && tItem.title?.endpoint?.payload?.videoId) {
            yid = tItem.title.endpoint.payload.videoId;
          }

          return {
            youtubeId: yid,
            title: tItem.title?.text || tItem.title || 'Unknown',
            artist: getArtistName(tItem) !== 'Unknown' ? getArtistName(tItem) : albumArtist,
            album: albumTitle,
            thumbnailUrl: finalThumb || getBestYtThumbnail(tItem.thumbnail || tItem.thumbnails),
            durationSeconds: tItem.duration?.seconds || null,
            isExplicit: Boolean(tItem.is_explicit),
          }
        }).filter((s: any) => s.youtubeId)

      // Re-resolve album Art Track IDs → Song IDs for better audio quality.
      // Art Tracks (from getAlbum) have lower-quality audio than Song uploads.
      // STRICT matching: exact normalized title + artist match + duration within 5s.
      // Never fall back to an unmatched result.
      try {
        let upgradedCount = 0
        await Promise.allSettled(tracks.map(async (track: any) => {
          try {
            const searchQuery = `${track.title} ${track.artist || albumArtist}`
            const searchRes = await yt.music.search(searchQuery, { type: 'song' })
            
            // Collect songs from all sections — skip DidYouMean/ShowingResultsFor
            let songs: any[] = []
            const allSections = (searchRes.contents as any[]) ?? []
            for (const sec of allSections) {
              const items = sec?.contents ?? []
              for (const item of items) {
                // Skip non-song items (DidYouMean, ShowingResultsFor, etc.)
                if (item?.type === 'DidYouMean' || item?.type === 'ShowingResultsFor') continue
                if (item?.id || item?.video_id || item?.endpoint?.payload?.videoId) {
                  songs.push(item)
                }
              }
            }
            if (songs.length === 0) return

            const trackTitle = normalize(track.title)
            const trackArtist = normalize(track.artist || albumArtist)

            const match = songs.find((s: any) => {
              const sTitle = normalize(s.title?.text ?? s.title ?? s.name ?? s.flex_columns?.[0]?.title?.runs?.[0]?.text ?? '')
              const sArtist = normalize(
                Array.isArray(s.artists) ? s.artists.map((a: any) => a.name).join(', ')
                : s.artists?.name ?? s.author?.name ?? s.flex_columns?.[1]?.title?.runs?.[0]?.text ?? ''
              )

              // 1. Title must match closely (containment handles transliteration/suffix variants)
              const titleMatch = sTitle === trackTitle || sTitle.includes(trackTitle) || trackTitle.includes(sTitle)
              if (!titleMatch) return false

              // 2. Require minimum title overlap length to avoid very short matches (e.g. "May")
              const shorter = Math.min(sTitle.length, trackTitle.length)
              if (shorter < 3) return false

              // 3. Artist must match
              if (!trackArtist || !sArtist) return false
              const artistMatch = sArtist.includes(trackArtist) || trackArtist.includes(sArtist)
              if (!artistMatch) return false

              return true
            })

            // Extract ID from match — may be in .id, .video_id, or endpoint
            const matchId = match?.id ?? match?.video_id ?? match?.endpoint?.payload?.videoId

            if (matchId && matchId !== track.youtubeId) {
              console.log(`[vs:album] Upgraded "${track.title}": ${track.youtubeId} → ${matchId}`)
              track.youtubeId = matchId
              upgradedCount++
            } else if (!match) {
              // Debug: dump first result's keys to understand shape
              const first = songs[0]
              const rawInfo = first ? { keys: Object.keys(first).join(','), id: first.id, video_id: first.video_id, title: first.title, titleText: first.title?.text, type: first.type } : 'NO RESULTS'
              console.log(`[vs:album] NO MATCH for "${track.title}" (normalized: "${trackTitle}"). First result raw:`, JSON.stringify(rawInfo))
            }
          } catch (e) {
            // Non-fatal — keep original Art Track ID
          }
        }))
        console.log(`[vs:album] Upgraded ${upgradedCount}/${tracks.length} tracks to Song IDs`)
      } catch (e) {
        console.warn('[vs:album] Re-resolution batch failed:', e)
      }

      console.log(`[vs:album] Returning ${tracks.length} tracks. First 3:`, tracks.slice(0, 3).map((t: any) => `${t.title} (${t.youtubeId})`))

      return {
        id: albumId,
        title: albumTitle,
        artist: albumArtist,
        year: header?.subtitle?.text || header?.year || '',
        thumbnailUrl: finalThumb,
        tracks,
      }
    } catch (err) {
      console.error('[vs:album]', err)
      throw new Error(`Failed to get album details for "${queryId}": ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // === Downloads & Offline ===

  ipcMain.handle(IpcChannels.downloadSong, async (_evt, raw: unknown) => {
    const { youtubeId } = raw as { youtubeId: string }
    try {
      const filePath = await downloadSong(youtubeId, (pct) => {
        broadcastDownloadProgress(youtubeId, pct)
      })
      // Update DB
      const db = getPrisma()
      await db.song.update({
        where: { youtubeId },
        data: { downloadPath: filePath, isDownloaded: true },
      }).catch(() => {
        // Song might not be in DB yet — that's ok, cache is file-based
      })
      broadcastDownloadProgress(youtubeId, 100)
      return { ok: true, path: filePath }
    } catch (err) {
      console.error('[download]', err)
      throw err
    }
  })

  ipcMain.handle(IpcChannels.deleteSong, async (_evt, raw: unknown) => {
    const { youtubeId } = raw as { youtubeId: string }
    deleteDownload(youtubeId)
    const db = getPrisma()
    await db.song.update({
      where: { youtubeId },
      data: { downloadPath: null, isDownloaded: false },
    }).catch(() => {})
    return { ok: true }
  })

  ipcMain.handle(IpcChannels.isDownloaded, async (_evt, raw: unknown) => {
    const { youtubeId } = raw as { youtubeId: string }
    return { downloaded: isDownloaded(youtubeId) }
  })

  ipcMain.handle(IpcChannels.playlistSetOffline, async (_evt, raw: unknown) => {
    const { playlistId, enabled } = raw as { playlistId: string; enabled: boolean }
    console.log(`[offline] setPlaylistOffline: playlistId=${playlistId}, enabled=${enabled}`)
    const db = getPrisma()
    try {
      await db.playlist.update({
        where: { id: playlistId },
        data: { offlineEnabled: enabled },
      })
    } catch (err) {
      console.error('[offline] Failed to update playlist offlineEnabled:', err)
    }
    if (enabled) {
      // Download all tracks in the playlist that aren't downloaded yet
      const tracks = await db.playlistTrack.findMany({
        where: { playlistId },
        include: { song: true },
      })
      const toDownload = tracks.filter(t => !isDownloaded(t.youtubeId))
      console.log(`[offline] Found ${tracks.length} tracks in playlist, ${toDownload.length} need downloading`)

      // Download sequentially (one at a time) to avoid overwhelming yt-dlp / YouTube
      // This runs in the background — we return { ok: true } immediately.
      ;(async () => {
        for (let i = 0; i < toDownload.length; i++) {
          const t = toDownload[i]
          console.log(`[offline] Downloading ${i + 1}/${toDownload.length}: ${t.youtubeId}`)
          try {
            const filePath = await downloadSong(t.youtubeId, (pct) => {
              broadcastDownloadProgress(t.youtubeId, pct)
            })
            console.log(`[offline] Downloaded ${t.youtubeId} → ${filePath}`)
            broadcastDownloadProgress(t.youtubeId, 100)
            await db.song.update({
              where: { youtubeId: t.youtubeId },
              data: { downloadPath: filePath, isDownloaded: true },
            }).catch(() => {})
          } catch (err) {
            console.error(`[offline-sync] Failed to download ${t.youtubeId}:`, err)
          }
        }
        console.log(`[offline] Batch download complete: ${toDownload.length} songs processed`)
      })()
    }
    return { ok: true }
  })


  // === Lyrics Export / Import ===

  ipcMain.handle(IpcChannels.lyricsExport, async (_evt, raw: unknown) => {
    const { lrcRaw, suggestedName } = raw as { lrcRaw: string; suggestedName: string }
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const result = await dialog.showSaveDialog({
      ...(win ? { window: win } : {}),
      title: 'Export Lyrics',
      defaultPath: suggestedName,
      filters: [
        { name: 'LRC Lyrics', extensions: ['lrc'] },
        { name: 'Text File', extensions: ['txt'] },
      ],
    } as any)
    if (result.canceled || !result.filePath) return { ok: false }
    const fs = await import('node:fs')
    fs.writeFileSync(result.filePath, lrcRaw, 'utf-8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle(IpcChannels.lyricsImport, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const result = await dialog.showOpenDialog({
      ...(win ? { window: win } : {}),
      title: 'Import Lyrics',
      filters: [
        { name: 'LRC Lyrics', extensions: ['lrc'] },
        { name: 'Text File', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    } as any)
    if (result.canceled || result.filePaths.length === 0) return { ok: false, lrcRaw: null }
    const fs = await import('node:fs')
    const lrcRaw = fs.readFileSync(result.filePaths[0], 'utf-8')
    return { ok: true, lrcRaw }
  })
}
