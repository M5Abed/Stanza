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
    const first = next.contents?.[0];
    console.log(first);
    if (first) {
      console.log('thumbnails:', (first as any).thumbnails);
      console.log('thumbnail:', (first as any).thumbnail?.contents || (first as any).thumbnail);
    }
  } catch(e) { console.error('next error', e); }
}

test();
