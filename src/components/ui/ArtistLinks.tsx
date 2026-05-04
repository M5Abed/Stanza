import { useUIStore } from '@/stores/useUIStore'

/**
 * Split an artist string like "Artist1, Artist2 & Artist3" or "Artist1 feat. Artist2"
 * into individual clickable names that navigate to each artist's page.
 */

const SPLIT_PATTERN = /\s*(?:,\s*&?\s*|,\s*|\s+&\s+|\s+and\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+×\s+)\s*/i

export function splitArtists(artistStr: string): string[] {
  return artistStr.split(SPLIT_PATTERN).map(s => s.trim()).filter(Boolean)
}

interface ArtistLinksProps {
  artist: string
  className?: string
  /** Extra classes for each individual link */
  linkClassName?: string
  /** Extra classes for the separator */
  separatorClassName?: string
}

export function ArtistLinks({
  artist,
  className = '',
  linkClassName = '',
  separatorClassName = '',
}: ArtistLinksProps) {
  const setActiveView = useUIStore(s => s.setActiveView)
  const names = splitArtists(artist)

  if (names.length === 0) return null

  return (
    <span className={className}>
      {names.map((name, i) => (
        <span key={`${name}-${i}`}>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              setActiveView(`artist-${name}` as any)
            }}
            className={`hover:underline hover:text-white cursor-pointer transition-colors ${linkClassName}`}
            title={`Go to artist: ${name}`}
          >
            {name}
          </button>
          {i < names.length - 1 && (
            <span className={separatorClassName}>, </span>
          )}
        </span>
      ))}
    </span>
  )
}
