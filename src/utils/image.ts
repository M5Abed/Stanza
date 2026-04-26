/**
 * Normalise and optionally upscale a thumbnail URL.
 *
 * Safety rules:
 *  - YouTube (i.ytimg.com) and Spotify (i.scdn.co) CDNs serve token-bound
 *    images. Any modification causes 403/404.  → pass-through unchanged.
 *  - Google Cloud (lh3.googleusercontent.com, yt3.ggpht.com) allows dynamic
 *    sizing via `=w<N>-h<N>` **at the very end** of the URL path.
 *    We only touch that trailing segment.
 */
export function getHighResUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let res = url;

  // Fix protocol-relative URLs
  if (res.startsWith('//')) res = 'https:' + res;

  // Pass-through: YouTube image servers
  if (res.includes('i.ytimg.com')) return res;

  // Pass-through: Spotify image servers
  if (res.includes('i.scdn.co')) return res;

  // Only resize on known Google image hosts
  if (res.includes('lh3.googleusercontent.com') || res.includes('ggpht.com')) {
    // Replace trailing size parameters safely. The = acts as a unique delimiter for modifications on Google CDNs.
    // We intentionally don't capture the rest of the string so we preserve things like -l90-rj
    res = res.replace(/=w\d+-h\d+/i, '=w544-h544');
    res = res.replace(/=s\d+/i, '=s544');
  }

  return res;
}

/**
 * Get a permanent YouTube thumbnail URL for a video ID.
 * Note: only works for regular YouTube videos, NOT YouTube Music-only content.
 */
export function getYtThumbnailUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/sddefault.jpg`;
}

export function handleImgError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.target as HTMLImageElement;
  
  // 1st fallback: Try the original uploaded resolution (=s0)
  if (img.src.includes('=w544-h544')) {
    img.src = img.src.replace('=w544-h544', '=s0');
    return;
  }
  if (img.src.includes('=s544')) {
    img.src = img.src.replace('=s544', '=s0');
    return;
  }

  // 2nd fallback: If original resolution also fails, try the standard low-res YouTube thumbnail
  if (img.src.includes('=s0')) {
    img.src = img.src.replace('=s0', '=w120-h120');
    return;
  }

  img.style.display = 'none';
  img.style.opacity = '0';
}

