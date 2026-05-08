import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  const q = 'Hentai';
  console.log(`\nSearching for album: "${q}"`);
  const search = await yt.music.search(q, { type: 'album' });
  const contents = search.contents || [];
  for (const section of contents) {
    for (const item of (section.contents || [])) {
      const artist = (item.author?.name || item.artists?.map((a: any) => a.name).join(', '));
      console.log(` - ID: ${item?.endpoint?.payload?.browseId || item?.id}, Title: ${item.title?.text || item.title || item.name}, Artist: ${artist}`);
    }
  }
}

main().catch(console.error);
