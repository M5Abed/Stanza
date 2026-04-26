import { Innertube, Platform } from 'youtubei.js';
(Platform.shim as any).eval = (data: any, env: any) => { const keys = Object.keys(env); const values = keys.map(k => env[k]); return new Function(...keys, data?.script || data)(...values); };
async function test() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: false });
  const album = await yt.music.getAlbum('MPREb_Mi4yevLTgaE');
  console.log(JSON.stringify(album.contents[0], null, 2).slice(0, 1500));
}
test();
