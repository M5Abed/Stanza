import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  const q = 'S3rl Hentai';
  console.log(`\nSearching for song: "${q}"`);
  const search = await yt.music.search(q, { type: 'song' });
  const contents = search.contents || [];
  for (const section of contents) {
    for (const item of (section.contents || [])) {
      console.log(` - ID: ${item?.id || item?.video_id}, Title: ${item.title?.text || item.title || item.name}`);
      console.log(`   Album ID from song: ${item.album?.id || item.album?.endpoint?.payload?.browseId || 'None'}`);
      console.log(`   Album Name: ${item.album?.name || 'None'}`);
    }
  }
}

main().catch(console.error);
