import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  const queries = ['S3rl', 'Hentai'];
  for (const q of queries) {
    console.log(`\nSearching for album: "${q}"`);
    const search = await yt.music.search(q, { type: 'album' });
    const contents = search.contents || [];
    for (const section of contents) {
      for (const item of (section.contents || [])) {
        console.log(` - ID: ${item?.endpoint?.payload?.browseId || item?.id}, Title: ${item.title?.text || item.title || item.name}, Type: ${item.type}`);
      }
    }
  }
}

main().catch(console.error);
