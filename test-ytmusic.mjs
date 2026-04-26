import ytmusic from 'node-youtube-music';

async function run() {
  try {
    const songs = await ytmusic.searchMusics('ahmed saad');
    console.log(songs[0]);
  } catch (e) {
    console.error(e);
  }
}
run();