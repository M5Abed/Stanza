import { Innertube, Platform } from 'youtubei.js';
(Platform.shim as any).eval = (data: any, env: any) => { const keys = Object.keys(env); const values = keys.map((k:any) => env[k]); return new Function(...keys, data?.script || data)(...values); };

async function test() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: false });
  const album = await yt.music.getAlbum('MPREb_Mi4yevLTgaE');
  const tracks = (album.contents || []).map((tItem: any, i: number) => {
      let yid = tItem.videoId || tItem.id || tItem.endpoint?.payload?.videoId || tItem.play_endpoint?.payload?.videoId;
      if (!yid && tItem.flex_columns?.[0]?.title?.runs?.[0]?.endpoint?.payload?.videoId) {
        yid = tItem.flex_columns[0].title.runs[0].endpoint.payload.videoId;
      }
      if (!yid && tItem.title?.endpoint?.payload?.videoId) {
        yid = tItem.title.endpoint.payload.videoId;
      }

      return {
        youtubeId: yid,
        title: tItem.title?.text || tItem.title || 'Unknown',
        durationSeconds: tItem.duration?.seconds || null,
      }
  }).filter((s: any) => s.youtubeId)
  
  console.log(`Found ${tracks.length} tracks.`);
  if (tracks.length > 0) {
    console.log(tracks[0]);
  }
}
test();
