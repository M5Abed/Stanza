/** Allowlisted IPC channel names (renderer invokes only via preload bridge). */
export const IpcChannels = {
  searchMusic: 'vs:search:music',
  searchArtists: 'vs:search:artists',
  searchPlaylists: 'vs:search:playlists',
  getPlaybackUrl: 'vs:audio:playback-url',
  songUpsert: 'vs:db:song:upsert',
  manualLyricsSave: 'vs:db:manual-lyrics:save',
  manualLyricsGet: 'vs:db:manual-lyrics:get',
  cleaningTermsList: 'vs:db:cleaning-terms:list',
  cleaningTermsUpsert: 'vs:db:cleaning-terms:upsert',
  cleaningTermsDelete: 'vs:db:cleaning-terms:delete',
  lyricsGet: 'vs:lyrics:get',
  playlistsGet: 'vs:db:playlists:get',
  playlistsCreate: 'vs:db:playlists:create',
  playlistsAddTrack: 'vs:db:playlists:add-track',
  playlistsRemoveTrack: 'vs:db:playlists:remove-track',
  playlistsRename: 'vs:db:playlists:rename',
  playlistsDelete: 'vs:db:playlists:delete',
  windowSetFullscreen: 'vs:window:set-fullscreen',
  thumbarRegisterIcons: 'vs:thumbar:register-icons',
  thumbarUpdate: 'vs:thumbar:update',
  thumbarAction: 'vs:thumbar:action',
  /** Spotify Web API (client credentials) — tracks + artists for UI metadata. */
  spotifySearch: 'vs:metadata:spotify-search',
  radioGetRecommendations: 'vs:radio:get-recommendations',
  artistGetDetails: 'vs:artist:get-details',
  albumGetDetails: 'vs:album:get-details',
  /** Downloads & offline */
  downloadSong: 'vs:download:song',
  deleteSong: 'vs:download:delete',
  isDownloaded: 'vs:download:check',
  playlistSetOffline: 'vs:playlist:set-offline',
  downloadProgress: 'vs:download:progress',


  /** Lyrics editor */
  openLyricsEditor: 'vs:lyrics:open-editor',
  /** Lyrics sharing / file I/O */
  lyricsExport: 'vs:lyrics:export',
  lyricsImport: 'vs:lyrics:import',
  /** App visibility (minimize/restore) */
  appVisibilityChange: 'vs:app:visibility-change',
  /** Floating lyrics window */
  floatingLyricsOpen: 'vs:floating-lyrics:open',
  floatingLyricsClose: 'vs:floating-lyrics:close',
  floatingLyricsTogglePin: 'vs:floating-lyrics:toggle-pin',
  floatingLyricsState: 'vs:floating-lyrics:state',
  floatingLyricsClosed: 'vs:floating-lyrics:closed',
  updateRpc: 'vs:rpc:update',
  /** Gemini AI */

  geminiSongStory: 'vs:gemini:song-story',
  getTrackViews: 'vs:track:get-views',
} as const
