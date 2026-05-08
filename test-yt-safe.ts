import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  const search = await yt.music.search('S3rl Hentai');
  const contents = search.contents || [];
  for (const section of contents) {
    for (const item of (section.contents || [])) {
      const vid = item?.id || item?.video_id || item?.endpoint?.payload?.videoId;
      if (vid) {
        try {
          const info = await yt.getBasicInfo(vid);
          console.log(`- ID: ${vid}, Title: ${item.title?.text || item.title || item.name}, Safe: ${info.basic_info.is_family_safe}`);
        } catch(e) {
           console.log(`- ID: ${vid}, Failed`);
        }
      }
    }
  }
}

main().catch(console.error);
