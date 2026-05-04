import { useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useRadioStore } from '@/stores/useRadioStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { useAppVisibilityStore } from '@/stores/useAppVisibilityStore'
import { getDominantColor } from '@/utils/color'

/**
 * Owns Howl lifecycle; keeps Zustand in sync with audio clock.
 */
export function PlayerAudioBridge() {
  const howlRef = useRef<Howl | null>(null)
  const rafRef = useRef<number>(0)
  const lastTickRef = useRef<number>(0)

  const currentTrack = usePlayerStore((s) => (s.currentIndex >= 0 && s.currentIndex < s.queue.length ? s.queue[s.currentIndex] : null))
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const pendingSeekSec = usePlayerStore((s) => s.pendingSeekSec)

  const playNext = usePlayerStore((s) => s.next)
  const setLoading = usePlayerStore((s) => s.setLoading)
  const setError = usePlayerStore((s) => s.setError)
  const syncProgress = usePlayerStore((s) => s.syncProgress)
  const clearPendingSeek = usePlayerStore((s) => s.clearPendingSeek)
  const setDurationFromMeta = usePlayerStore((s) => s.setDurationFromMeta)

  // Stable refs for callbacks to avoid re-creating Howl instances when function references change
  const playNextRef = useRef(playNext)
  playNextRef.current = playNext
  const syncProgressRef = useRef(syncProgress)
  syncProgressRef.current = syncProgress
  const setLoadingRef = useRef(setLoading)
  setLoadingRef.current = setLoading
  const setErrorRef = useRef(setError)
  setErrorRef.current = setError
  const setDurationFromMetaRef = useRef(setDurationFromMeta)
  setDurationFromMetaRef.current = setDurationFromMeta

  // Prefetch the next track's playback URL to eliminate gap between tracks
  const prefetchedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const state = usePlayerStore.getState()
    const nextIdx = state.currentIndex + 1
    if (nextIdx >= 0 && nextIdx < state.queue.length) {
      const nextTrack = state.queue[nextIdx]
      if (nextTrack && !prefetchedRef.current.has(nextTrack.youtubeId)) {
        prefetchedRef.current.add(nextTrack.youtubeId)
        // Fire-and-forget: resolves the vibestream:// URL which triggers yt-dlp resolution + caching
        window.vibestream?.getPlaybackUrl(nextTrack.youtubeId).catch(() => {})
      }
    }
    // Limit set size to avoid memory leak
    if (prefetchedRef.current.size > 20) {
      const entries = [...prefetchedRef.current]
      prefetchedRef.current = new Set(entries.slice(-10))
    }
  }, [currentTrack?.youtubeId])

  useEffect(() => {
    const stopTick = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    const tick = () => {
      const h = howlRef.current
      if (h?.playing()) {
        const now = performance.now()
        // When minimized, throttle to ~0.5 updates/sec (just enough for Discord RPC / media session)
        // When visible, update at ~30fps for smooth progress bars
        const interval = useAppVisibilityStore.getState().visible ? 33 : 2000
        if (now - lastTickRef.current >= interval) {
          lastTickRef.current = now
          syncProgressRef.current(h.seek() as number, h.duration() as number)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    if (!currentTrack) {
      howlRef.current?.unload()
      howlRef.current = null
      stopTick()
      return
    }

    let cancelled = false
    const youtubeId = currentTrack.youtubeId

    ;(async () => {
      setLoadingRef.current(true)
      setErrorRef.current(null)
      try {
        const vs = window.vibestream
        if (!vs) return
        const { playbackUrl } = await vs.getPlaybackUrl(youtubeId)
        if (cancelled) return

        howlRef.current?.unload()
        const howl = new Howl({
          src: [playbackUrl],
          html5: true,
          format: ['webm', 'opus', 'mp4', 'mp3'],
          volume: Math.pow(volume, 2.5), // Psychoacoustic exponential curve
          onload: () => {
            if (cancelled) return
            const d = howl.duration() || 0
            if (d > 0) setDurationFromMetaRef.current(d)
          },
          onloaderror: (_id, err) => {
            if (cancelled) return
            console.error('[howl] load', err)
            setErrorRef.current('Could not load audio stream.')
            setLoadingRef.current(false)
          },
          onplayerror: (_id, err) => {
            console.error('[howl] play', err)
            setErrorRef.current('Playback failed.')
            setLoadingRef.current(false)
          },
          onend: () => {
            if (cancelled) return
            const mode = usePlayerStore.getState().repeat
            if (mode === 'one') {
              howl.seek(0)
              howl.play()
              return
            }
            playNextRef.current()
          },
        })
        howlRef.current = howl
        setLoadingRef.current(false)

        if (usePlayerStore.getState().isPlaying) {
          howl.play()
        }
        stopTick()
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        if (!cancelled) {
          const errorMessage = e instanceof Error ? e.message : 'Playback error'
          console.error('[PlayerAudioBridge] Failed to get playback URL:', errorMessage)
          setErrorRef.current(errorMessage.includes('Unable to resolve audio stream') 
            ? 'Could not load audio stream. This may be due to age restrictions, regional blocks, or YouTube API changes.'
            : errorMessage)
          setLoadingRef.current(false)
        }
      }
    })()

    return () => {
      cancelled = true
      stopTick()
      howlRef.current?.unload()
      howlRef.current = null
    }
  // Only re-create the Howl when the actual track changes — callback refs keep this stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.youtubeId])

  useEffect(() => {
    const h = howlRef.current
    if (!h) return
    h.volume(Math.pow(volume, 2.5))
  }, [volume])

  useEffect(() => {
    const h = howlRef.current
    if (!h || pendingSeekSec === null) return
    const t = pendingSeekSec
    clearPendingSeek()
    try {
      h.seek(t)
      syncProgress(t, h.duration() || usePlayerStore.getState().durationSec)
    } catch {
      /* ignore */
    }
  }, [pendingSeekSec, clearPendingSeek, syncProgress])

  useEffect(() => {
    const h = howlRef.current
    if (!h) return
    if (isPlaying) {
      if (!h.playing()) h.play()
    } else {
      h.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (!window.vibestream || !window.vibestream.updateRpc) return

    if (!isPlaying || !currentTrack) {
      window.vibestream.updateRpc({ isPlaying: false })
      return
    }

    const h = howlRef.current
    
    window.vibestream.updateRpc({
      title: currentTrack?.title || undefined,
      artist: currentTrack?.artist || undefined,
      duration: h?.duration() || usePlayerStore.getState().durationSec || undefined,
      currentTime: (typeof h?.seek() === 'number' ? h.seek() : undefined) as number | undefined,
      isPlaying,
      thumbnailUrl: currentTrack?.thumbnailUrl || undefined
    })
  }, [isPlaying, currentTrack?.youtubeId])

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.getState().toggle()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.getState().toggle()
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().previous()
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().next()
      })
    }
  }, [])

  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Unknown',
        artist: currentTrack.artist || 'Unknown',
        album: currentTrack.album || '',
        artwork: currentTrack.thumbnailUrl ? [
          { src: currentTrack.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      })
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }
  }, [currentTrack, isPlaying])

  const isRadioEnabled = useRadioStore((s) => s.isRadioEnabled)

  useEffect(() => {
    if (currentTrack?.youtubeId && isRadioEnabled) {
      const radioState = useRadioStore.getState()
      if (radioState.suggestions.length === 0) {
        // Initial fetch: gets ~20 tracks
        radioState.fetchRecommendations(currentTrack.youtubeId, false).catch(console.error)
      } else {
        // Incrementally append 1 unique track per song played
        radioState.fetchRecommendations(currentTrack.youtubeId, true, true).catch(console.error)
      }
    }
  }, [currentTrack?.youtubeId, isRadioEnabled])

  // Ambient UI: extract dominant color from album art
  useEffect(() => {
    if (currentTrack?.thumbnailUrl) {
      getDominantColor(currentTrack.thumbnailUrl).then(color => {
        useThemeStore.getState().setColors(color)
      }).catch(() => {})
    }
  }, [currentTrack?.thumbnailUrl])

  return null
}
