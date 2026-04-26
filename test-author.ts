import { Innertube, Platform } from 'youtubei.js';

(Platform.shim as any).eval = (data: any, env: any) => {
  const script = typeof data === 'string' ? data : data?.script ?? '';
  const keys = Object.keys(env);
  const values = keys.map((k) => env[k]);
  const fn = new Function(...keys, script);
  return fn(...values);
};

async function test() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true });
  const next = await yt.music.getUpNext('dQw4w9WgXcQ');
  const first = next.contents?.[0] as any;
  console.log('artists:', first.artists);
  console.log('authors:', first.authors);
  console.log('author:', first.author);
  // @ts-ignore
  console.log('author string:', first.author?.name || first.authors?.map(a => a.name).join(', '));
}
test();
