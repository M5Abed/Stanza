import { Innertube, Platform } from 'youtubei.js';

;(Platform.shim).eval = (data, env) => {
  const script = typeof data === 'string' ? data : data?.output ?? data?.script ?? ''
  const keys = Object.keys(env)
  const values = keys.map((k) => env[k])
  if (!script.trim()) return undefined

  try {
    const bodyFn = new Function(...keys, `"use strict";\n${script}`)
    return bodyFn(...values)
  } catch {
    const exprFn = new Function(...keys, `return (${script});`)
    return exprFn(...values)
  }
}

async function run() {
  const yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true });
  try {
    const info = await yt.music.getInfo('4B3YO6XtCvk');
    const streamingInfo = await info.getStreamingInfo();
    
    const audioSets = streamingInfo.audio_sets;
    if (audioSets && audioSets.length > 0) {
      const rep = audioSets[0].representations[0];
      const url = rep.deciphered_url || rep.url || rep.segment_info?.base_url;
      
      console.log('Testing WITH Range header bytes=0-1048575 AND raw fetch...');
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-1048575'
        }
      });
      
      console.log('Status with fetch:', res.status);
    }
  } catch (e) {
    console.error(e);
  }
}
run();