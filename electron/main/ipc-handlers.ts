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

      let section = (ytResults.contents as any[])?.[0]
      let songs: any[] = section?.contents ?? []

      // Independent artists often upload Music Videos without registering 'Song' metadata schemas with Google
      if (songs.length === 0) {
        const fallback = await yt.music.search(query, { type: 'video' })
        section = (fallback.contents as any[])?.[0]
        songs = section?.contents ?? []
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
    } catch (err) {
      console.error('[vs:search:music]', err)
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

    // Strategy 1: getRelated() — returns genre-similar songs (best quality)
    try {
      const yt = await getInnertube()
      const related = await yt.music.getRelated(youtubeId)
      const sections = (related as any)?.contents ?? (related as any)?.sections ?? []
      let allTracks: any[] = []
      for (const section of (Array.isArray(sections) ? sections : [])) {
        const items = section?.contents ?? section?.items ?? []
        allTracks.push(...extractTracks(items))
      }
      
      if (allTracks.length > 0) {
        let isRelevant = true
        if (seedArtist && seedArtist !== 'unknown') {
          const hasArtistMatch = allTracks.some(t => {
            if (!t.artist) return false
            const tArtist = t.artist.toLowerCase()
            return tArtist.includes(seedArtist) || seedArtist.includes(tArtist)
          })
          if (!hasArtistMatch) {
             console.warn(`[vs:radio] getRelated tracks did not match seed artist "${seedArtist}". Deeming generic.`)
             isRelevant = false
          }
        }
        if (isRelevant) {
          addTracks(allTracks)
          if (finalTracks.length >= 15) return enrichWithSpotifyCovers(finalTracks.slice(0, 15))
        }
      }
    } catch (err) {
      console.warn('[vs:radio] getRelated failed or was generic:', err)
    }

    // Strategy 2: Artist Top Songs (better than generic getUpNext)
    try {
      if (songInfo && songInfo.artist) {
        const yt = await getInnertube()
        const search = await yt.music.search(songInfo.artist, { type: 'artist' })
        const contents = search.contents as any[]
        const artistId = contents?.[0]?.contents?.[0]?.id
        if (artistId) {
          const artist = await yt.music.getArtist(artistId)
          for (const section of artist.sections || []) {
            const sec = section as any
            const titleLo = (sec.title?.text || sec.header?.title?.text || '').toLowerCase()
            if (titleLo === 'top songs' || titleLo === 'songs') {
               const tracks = extractTracks(sec.contents || [])
               addTracks(tracks)
               if (finalTracks.length >= 15) return enrichWithSpotifyCovers(finalTracks.slice(0, 15))
            }
          }
        }
      }
    } catch (err) {
      console.warn('[vs:radio] Artist top songs fallback failed:', err)
    }

    // Strategy 2.5: Search songs by artist
    try {
      if (songInfo && songInfo.artist && finalTracks.length < 10) {
        const yt = await getInnertube()
        const searchRes = await yt.music.search(songInfo.artist, { type: 'song' })
        const contents = searchRes.contents as any[]
        const section = contents?.[0]
        const items = section?.contents ?? section?.items ?? []
        addTracks(extractTracks(items))
        if (finalTracks.length >= 15) return enrichWithSpotifyCovers(finalTracks.slice(0, 15))
      }
    } catch (err) {
       console.warn('[vs:radio] Artist search fallback failed:', err)
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
      const details = {
        artistId,
        name: artistName,
        thumbnailUrl: getBestYtThumbnail(headerObj?.thumbnails || (artist as any).thumbnails) || null,
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

      for (const section of artist.sections || []) {
        const sec = section as any
        const title = sec.title?.text || sec.header?.title?.text || ''
        const titleLo = title.toLowerCase()

        let items = sec.contents || []
        
        if (titleLo.includes('album') || titleLo.includes('single') || titleLo.includes('ep') || titleLo === 'top songs' || titleLo === 'songs') {
           const moreEndpoint = sec.header?.more_content?.endpoint || sec.bottom_text?.endpoint || sec.endpoint
           if (moreEndpoint) {
              try {
                const page = await moreEndpoint.call(yt.actions, { parse: true, client: 'YTMUSIC' })
                if (page?.contents_memo) {
                   const expandedItems = [...(page.contents_memo.get('MusicTwoRowItem') || []), ...(page.contents_memo.get('MusicResponsiveListItem') || [])]
                   if (expandedItems && expandedItems.length > 0) {
                      items = expandedItems
                   }
                }
              } catch(e) {
                 console.error('[vs:artist] Failed to expand section', title, e)
              }
           }
        }

        if (titleLo === 'top songs' || titleLo === 'songs') {
           for (const item of items) {
              const youtubeId = item.id || item.videoId || item.endpoint?.payload?.videoId
              if (!youtubeId) continue
              // views usually exist in flex_columns[2].title.text 
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
            type: 'album', // Endpoint requires playlist decoding 
            year: c.subtitle?.text || c.year || '',
            thumbnailUrl: getBestYtThumbnail(c.thumbnail?.contents || c.thumbnail || c.thumbnails) || null
          })))
        }
      }

      // Sort top songs specifically by view count highest to lowest
      topSongsRaw.sort((a, b) => b.views - a.views)
      
      details.topSongs = topSongsRaw.slice(0, 10)
      
      ;(details as any).albums = albums
      ;(details as any).singles = singles

      // Upgrade thumbnail with Spotify image if available
      try {
        const spImage = await spotifyImagePromise
        if (spImage) details.thumbnailUrl = spImage
      } catch { /* Spotify unavailable — keep YT thumbnail */ }
      
      return details
    } catch (err) {
      console.error('[vs:artist]', err)
      throw new Error('Failed to get artist details')
    }
  })

  ipcMain.handle(IpcChannels.albumGetDetails, async (_evt, raw: unknown) => {
    const { albumId: queryId } = raw as { albumId: string }
    try {
      const yt = await getInnertube()
      let albumId = queryId

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

        // Try with full query (artist + album)
        try {
          const search = await yt.music.search(queryId, { type: 'album' })
          browseId = extractBrowseId(search)
        } catch (e) {
          console.warn('[vs:album] search failed for:', queryId, e)
        }

        if (!browseId) {
          throw new Error(`Could not find an album matching "${queryId}"`)
        }
        albumId = browseId
      }

      const album = await yt.music.getAlbum(albumId)
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

      // Try Spotify for a high-res permanent cover
      let finalThumb = albumThumb
      try {
        const spCover = await spotifyFetchCoverUrl(albumTitle, albumArtist)
        if (spCover) finalThumb = spCover
      } catch { /* Spotify unavailable */ }

      return {
        id: albumId,
        title: albumTitle,
        artist: albumArtist,
        year: header?.subtitle?.text || header?.year || '',
        thumbnailUrl: finalThumb,
        tracks: (album.contents || []).map((tItem: any, i: number) => {
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
            thumbnailUrl: getBestYtThumbnail(tItem.thumbnail || tItem.thumbnails) || finalThumb,
            durationSeconds: tItem.duration?.seconds || null,
            isExplicit: Boolean(tItem.is_explicit),
          }
        }).filter((s: any) => s.youtubeId)
      }
    } catch (err) {
      console.error('[vs:album]', err)
      throw new Error('Failed to get album details')
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
    const db = getPrisma()
    await db.playlist.update({
      where: { id: playlistId },
      data: { offlineEnabled: enabled },
    })
    if (enabled) {
      // Download all tracks in the playlist that aren't downloaded yet
      const tracks = await db.playlistTrack.findMany({
        where: { playlistId },
        include: { song: true },
      })
      for (const t of tracks) {
        if (!isDownloaded(t.youtubeId)) {
          downloadSong(t.youtubeId, (pct) => {
            broadcastDownloadProgress(t.youtubeId, pct)
          }).then(filePath => {
            db.song.update({
              where: { youtubeId: t.youtubeId },
              data: { downloadPath: filePath, isDownloaded: true },
            }).catch(() => {})
          }).catch(err => {
            console.error(`[offline-sync] Failed to download ${t.youtubeId}:`, err)
          })
        }
      }
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
