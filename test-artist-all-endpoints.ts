import { Innertube, Platform } from 'youtubei.js';
(Platform.shim as any).eval = (data: any, env: any) => { const keys = Object.keys(env); const values = keys.map((k:any) => env[k]); return new Function(...keys, data?.script || data)(...values); };

async function test() {
  try {
    const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: false });
    const artist = await yt.music.getArtist('UC0C-w0YjGpqDXGB8IHb662A');
    for (const section of artist.sections || []) {
        const sec = section as any;
        const title = sec.title?.text || sec.header?.title?.text || '';
        if (title.includes('Singles')) {
           if (sec.header?.more_content?.endpoint) {
              const page = await sec.header.more_content.endpoint.call(yt.actions, { parse: true, client: 'YTMUSIC' });
              if (page?.contents_memo) {
                 const keys = Array.from(page.contents_memo.keys());
                 console.log('Available types:', keys);
              }
           }
        }
    }
  } catch(e) {
    console.error(e);
  }
}
test();
