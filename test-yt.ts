import { Innertube, Platform } from 'youtubei.js';

(Platform.shim as any).eval = (data, env) => {
  const script = typeof data === 'string' ? data : data?.script ?? '';
  const keys = Object.keys(env);
  const values = keys.map((k) => env[k]);
  const fn = new Function(...keys, script);
  return fn(...values);
};

async function test() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true });

  console.log('--- getUpNext ---');
  try {
    const next = await yt.music.getUpNext('dQw4w9WgXcQ');
    console.log(next.contents?.slice(0, 2).map((item: any) => ({
      videoId: item.video_id,
      title: item.title?.text || item.title,
      artists: item.artists,
    })));
  } catch(e) { console.error('next error', e); }

  console.log('--- getArtist ---');
  try {
    const search = await yt.music.search('Marwan Moussa', { type: 'artist' });
    const artistId = (search.contents[0] as any).contents[0].id;
    console.log('Artist ID:', artistId);
    
    const artistInfo = await yt.music.getArtist(artistId);
    const songsSection = artistInfo.sections.find((s: any) => s.title?.text?.toLowerCase() === 'songs' || s.title?.toLowerCase() === 'songs');
    if (songsSection) {
      console.log('First song ID:', songsSection.contents[0].id, songsSection.contents[0].video_id);
      console.log('First song title:', songsSection.contents[0].title?.text || songsSection.contents[0].title);
    }
  } catch(e) { console.error('artist error', e); }
}

test();
