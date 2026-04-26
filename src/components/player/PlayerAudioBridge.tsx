import { useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useRadioStore } from '@/stores/useRadioStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { getDominantColor } from '@/utils/color'

/**
 * Owns Howl lifecycle; keeps Zustand in sync with audio clock.
 */
export function PlayerAudioBridge() {
  const howlRef = useRef<Howl | null>(null)
  const rafRef = useRef<number>(0)

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

  useEffect(() => {
    const stopTick = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }

    const tick = () => {
      const h = howlRef.current
      if (h?.playing()) {
        syncProgress(h.seek() as number, h.duration() as number)
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
      setLoading(true)
      setError(null)
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
            if (d > 0) setDurationFromMeta(d)
          },
          onloaderror: (_id, err) => {
            if (cancelled) return
            console.error('[howl] load', err)
            setError('Could not load audio stream.')
            setLoading(false)
          },
          onplayerror: (_id, err) => {
            console.error('[howl] play', err)
            setError('Playback failed.')
            setLoading(false)
          },
          onend: () => {
            if (cancelled) return
            const mode = usePlayerStore.getState().repeat
            if (mode === 'one') {
              howl.seek(0)
              howl.play()
              return
            }
            playNext()
          },
        })
        howlRef.current = howl
        setLoading(false)

        if (usePlayerStore.getState().isPlaying) {
          howl.play()
        }
        stopTick()
        rafRef.current = requestAnimationFrame(tick)
      } catch (e) {
        if (!cancelled) {
          const errorMessage = e instanceof Error ? e.message : 'Playback error'
          console.error('[PlayerAudioBridge] Failed to get playback URL:', errorMessage)
          setError(errorMessage.includes('Unable to resolve audio stream') 
            ? 'Could not load audio stream. This may be due to age restrictions, regional blocks, or YouTube API changes.'
            : errorMessage)
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      stopTick()
      howlRef.current?.unload()
      howlRef.current = null
    }
  }, [currentTrack?.youtubeId, playNext, setDurationFromMeta, setError, setLoading, syncProgress])

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

  useEffect(() => {
    if (currentTrack?.youtubeId) {
      useRadioStore.getState().fetchRecommendations(currentTrack.youtubeId).catch(console.error)
    }
  }, [currentTrack?.youtubeId])

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
