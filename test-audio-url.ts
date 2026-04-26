import { resolveYoutubeAudioStream } from './electron/main/audio-url';

async function test() {
  try {
    const res = await resolveYoutubeAudioStream('dQw4w9WgXcQ');
    console.log("SUCCESS:", res);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

test();
