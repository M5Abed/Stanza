import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  const album = await yt.music.getAlbum('MPREb_uzLxLgzYIk8');
  console.log('Original Album Tracks:');
  for (const track of album.contents || []) {
    let yid = track.videoId || track.id || track.endpoint?.payload?.videoId || track.play_endpoint?.payload?.videoId;
    if (!yid && track.flex_columns?.[0]?.title?.runs?.[0]?.endpoint?.payload?.videoId) {
      yid = track.flex_columns[0].title.runs[0].endpoint.payload.videoId;
    }
    console.log(` - Title: ${track.title?.text || track.title}, Original ID: ${yid}`);
  }
}

main().catch(console.error);
