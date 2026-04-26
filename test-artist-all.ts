import { Innertube, Platform } from 'youtubei.js';

(Platform.shim as any).eval = (data: any, env: any) => {
  const script = typeof data === 'string' ? data : data?.script ?? '';
  const keys = Object.keys(env);
  const values = keys.map((k) => env[k]);
  const fn = new Function(...keys, script);
  return fn(...values);
};

async function test() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: false });
  const search = await yt.music.search('Marwan Pablo', { type: 'artist' });
  const artistItem = (search.contents as any[])?.[0]?.contents?.[0];
  const artistId = artistItem?.id;
  
  if (artistId) {
    const artist = await yt.music.getArtist(artistId);
    console.log('getAllAlbums function exists?', typeof artist.getAllAlbums === 'function')
    console.log('getAllSingles function exists?', typeof artist.getAllSingles === 'function')
    
    if (typeof artist.getAllAlbums === 'function') {
      const allAlbums = await artist.getAllAlbums();
      console.log('All albums length:', allAlbums.contents?.length || 0)
    }
  }
}
test();
