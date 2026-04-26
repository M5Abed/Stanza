import { Innertube, Platform } from 'youtubei.js';
import fs from 'fs';

(Platform.shim as any).eval = (data: any, env: any) => {
  const script = typeof data === 'string' ? data : data?.script ?? '';
  const keys = Object.keys(env);
  const values = keys.map((k) => env[k]);
  const fn = new Function(...keys, script);
  return fn(...values);
};

async function test() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: false });
  // search Marwan Pablo to get his artist ID
  const search = await yt.music.search('Marwan Pablo', { type: 'artist' });
  const artistItem = (search.contents as any[])?.[0]?.contents?.[0];
  const artistId = artistItem?.id;
  console.log('Fetching artist:', artistId);
  
  if (artistId) {
    const artist = await yt.music.getArtist(artistId);
    for (const section of artist.sections || []) {
      const sec = section as any;
      const title = sec.title?.text || sec.header?.title?.text || '';
      console.log('Section:', title);
      console.log('Section header endpoint:', sec.header?.endpoint?.payload?.browseId || sec.endpoint?.payload?.browseId);
      const items = (section as any).contents || [];
      if (items.length > 0) {
         console.log(`  Items: ${items.length}, First item ID:`, items[0].id, 'Type:', items[0].type);
         console.log(`  First item views:`, items[0].views);
         console.log(`  First item thumbnail:`, JSON.stringify(items[0].thumbnail || items[0].thumbnails, null, 2).slice(0, 300));
         if (title.toLowerCase() === 'top songs') {
           fs.writeFileSync('top_songs_debug.json', JSON.stringify({
             views: items[0].views,
             thumbnail: items[0].thumbnail || items[0].thumbnails,
             item: items[0]
           }, null, 2));
         }
         if (title.toLowerCase() === 'albums' || title.toLowerCase() === 'singles') {
           console.log(`  First item title:`, items[0].title?.text || items[0].title);
           console.log(`  First item endpoint:`, items[0].endpoint?.payload?.browseId);
         }
      }
    }
  }
}
test();
