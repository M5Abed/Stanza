import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { X, Sparkles, Loader2, BookOpen, Lightbulb, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getHighResUrl, handleImgError } from '@/utils/image'
import { useThemeStore } from '@/stores/useThemeStore'

interface StoryData {
  story: string
  meaning: string
  trivia: string
}

export function SongStory() {
  const current = usePlayerStore((s) =>
    s.currentIndex >= 0 && s.currentIndex < s.queue.length ? s.queue[s.currentIndex] : null,
  )
  const dominantColor = useThemeStore((s) => s.dominantColor)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<StoryData | null>(null)
  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null)
  const [trackViews, setTrackViews] = useState<number | null>(null)

  // Fetch track views to determine visibility
  useEffect(() => {
    if (!current || !window.vibestream) {
      setTrackViews(null)
      return
    }
    window.vibestream.getTrackViews(current.youtubeId)
      .then((views) => setTrackViews(views))
      .catch(() => setTrackViews(0))
  }, [current?.youtubeId])

  const handleOpen = useCallback(async () => {
    if (!current || !window.vibestream) return
    setOpen(true)

    // Only fetch if the song changed since last fetch
    if (lastFetchedId === current.youtubeId && data) return

    setLoading(true)
    setData(null)
    try {
      const result = await window.vibestream.getSongStory(
        current.title,
        current.artist || 'Unknown'
      )
      setData(result)
      setLastFetchedId(current.youtubeId)
    } catch {
      setData({
        story: 'مفيش معلومات كافية عن الأغنية دي دلوقتي، بس إن شاء الله هنجيبلك التفاصيل قريب.',
        meaning: 'الأغنية دي ليها معاني كتير ممكن كل واحد يحس بيها بشكل مختلف.',
        trivia: 'كل أغنية وراها قصة.. وقصة الأغنية دي لسه بنبحث فيها.',
      })
    } finally {
      setLoading(false)
    }
  }, [current, lastFetchedId, data])

  const sections = [
    { key: 'story', label: 'القصة', icon: BookOpen, color: 'amber', data: data?.story },
    { key: 'meaning', label: 'المعنى', icon: Lightbulb, color: 'emerald', data: data?.meaning },
    { key: 'trivia', label: 'هل تعلم؟', icon: Trophy, color: 'violet', data: data?.trivia },
  ] as const

  const colorMap = {
    amber: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', text: '#f59e0b', line: 'rgba(245,158,11,0.25)' },
    emerald: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)', text: '#34d399', line: 'rgba(52,211,153,0.25)' },
    violet: { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)', text: '#a78bfa', line: 'rgba(167,139,250,0.25)' },
  }

  // Hide button if views are below 2 million
  if (trackViews !== null && trackViews < 2000000) return null

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        disabled={!current || trackViews === null}
        className='transition-all hover:scale-110 text-theme-subtext hover:text-white disabled:opacity-30'
        title="Song's Story"
      >
        <Sparkles className='h-[18px] w-[18px]' />
      </button>

      {/* Story Popover via Portal to escape PlayerBar containing block */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {open && (
          <motion.div 
            key="song-story-popover" 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] pointer-events-none"
          >
            {/* Invisible backdrop for click-outside to close */}
            <div 
              className='absolute inset-0 pointer-events-auto' 
              onClick={() => setOpen(false)} 
            />

            {/* Floating Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className='absolute bottom-[100px] right-6 w-full max-w-[420px] rounded-[24px] border border-white/[0.08] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] pointer-events-auto'
              style={{
                background: 'linear-gradient(180deg, rgba(28,28,32,0.97) 0%, rgba(14,14,18,0.99) 100%)',
                backdropFilter: 'blur(40px)',
              }}
            >
              {/* Header with album art */}
              <div className='relative px-7 pt-7 pb-5'>
                {/* Ambient glow from dominant color */}
                <div
                  className='absolute top-0 left-0 right-0 h-40 opacity-20 pointer-events-none'
                  style={{ background: `radial-gradient(ellipse at 50% 0%, ${dominantColor}50 0%, transparent 70%)` }}
                />

                {/* Close button */}
                <button
                  onClick={() => setOpen(false)}
                  className='absolute top-5 right-5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.12] transition-all backdrop-blur-sm'
                >
                  <X className='h-4 w-4' />
                </button>

                {/* Song info row */}
                <div className='relative z-10 flex items-center gap-5'>
                  {current?.thumbnailUrl && (
                    <div className='shrink-0 relative'>
                      <img
                        src={getHighResUrl(current.thumbnailUrl)}
                        alt=''
                        className='h-20 w-20 rounded-2xl object-cover shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
                        onError={handleImgError}
                      />
                      {/* Sparkle badge */}
                      <div className='absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'>
                        <Sparkles className='h-3.5 w-3.5 text-black' />
                      </div>
                    </div>
                  )}
                  <div className='flex-1 min-w-0'>
                    <span
                      className='inline-block text-[10px] font-black uppercase tracking-[0.25em] text-amber-400/70 mb-2'
                      dir='rtl'
                    >
                      Song's Story
                    </span>
                    <h2 className='text-xl font-bold text-white leading-tight truncate'>
                      {current?.title}
                    </h2>
                    <p className='text-sm text-white/40 mt-1 truncate'>
                      {current?.artist}
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className='mx-7 h-px bg-white/[0.06]' />

              {/* Content */}
              <div
                className='overflow-y-auto px-7 py-6'
                style={{ maxHeight: 'calc(80vh - 170px)' }}
                dir='rtl'
                lang='ar'
              >
                {loading ? (
                  <div className='flex flex-col items-center justify-center py-20 gap-5'>
                    <div className='relative'>
                      <div className='absolute inset-0 rounded-full bg-amber-500/20 animate-ping' />
                      <div className='relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20'>
                        <Loader2 className='h-7 w-7 text-amber-400 animate-spin' />
                      </div>
                    </div>
                    <div className='text-center'>
                      <p className='text-sm font-semibold text-white/50'>بنجهز الحكاية...</p>
                      <p className='text-xs text-white/20 mt-1'>ثواني وهتكون جاهزة</p>
                    </div>
                  </div>
                ) : data ? (
                  <div className='space-y-5'>
                    {sections.map((section, i) => {
                      const colors = colorMap[section.color]
                      const Icon = section.icon
                      return (
                        <motion.div
                          key={section.key}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: i * 0.1 }}
                          className='rounded-2xl p-5 border'
                          style={{
                            background: colors.bg,
                            borderColor: colors.border,
                          }}
                        >
                          {/* Section header */}
                          <div className='flex items-center gap-3 mb-3'>
                            <div
                              className='flex h-8 w-8 items-center justify-center rounded-lg'
                              style={{ background: colors.border }}
                            >
                              <Icon className='h-4 w-4' style={{ color: colors.text }} />
                            </div>
                            <div className='flex items-center gap-3 flex-1'>
                              <h3
                                className='text-sm font-black'
                                style={{ color: colors.text }}
                              >
                                {section.label}
                              </h3>
                              <div
                                className='flex-1 h-px rounded-full'
                                style={{ background: colors.line }}
                              />
                            </div>
                          </div>

                          {/* Section body */}
                          <p className='text-[14.5px] leading-[2] text-white/80 font-medium pr-11'>
                            {section.data}
                          </p>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  )
}
