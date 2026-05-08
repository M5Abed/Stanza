import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  
  const query = "S3rl Hentai";
  console.log(`Searching for album: "${query}"`);
  
  // 1. Try Album search
  const albumSearch = await yt.music.search(query, { type: 'album' });
  console.log("Album search results:");
  const albumContents = albumSearch.contents || [];
  for (const section of albumContents) {
    for (const item of (section.contents || [])) {
      console.log(` - ID: ${item?.endpoint?.payload?.browseId || item?.id}, Title: ${item.title?.text || item.title || item.name}, Type: ${item.type}`);
    }
  }

  // 2. Try generic search
  const genericSearch = await yt.music.search(query);
  console.log("\nGeneric search results:");
  const genericContents = genericSearch.contents || [];
  for (const section of genericContents) {
    for (const item of (section.contents || [])) {
       console.log(` - ID: ${item?.endpoint?.payload?.browseId || item?.id || item?.video_id}, Title: ${item.title?.text || item.title || item.name}, Type: ${item.type}`);
    }
  }

  // 3. Try Song search
  const songSearch = await yt.music.search(query, { type: 'song' });
  console.log("\nSong search results:");
  const songContents = songSearch.contents || [];
  for (const section of songContents) {
    for (const item of (section.contents || [])) {
       console.log(` - ID: ${item?.endpoint?.payload?.videoId || item?.video_id || item?.id}, Title: ${item.title?.text || item.title || item.name}, Type: ${item.type}`);
    }
  }
}

main().catch(console.error);
