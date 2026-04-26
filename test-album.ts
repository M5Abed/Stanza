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
  const album = await yt.music.getAlbum('MPREb_Mi4yevLTgaE');
  console.log('Album title:', album.title);
  console.log('Track count:', album.contents.length);
  if (album.contents.length > 0) {
     const t = album.contents[0];
     console.log('First track id:', t.id);
     console.log('First track title:', t.title);
     console.log('First track duration:', t.duration?.seconds);
     console.log('First track authors:', t.authors);
  }
}
test();
