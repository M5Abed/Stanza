import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  try {
    const info = await yt.getBasicInfo('YgJIQ2MaELA');
    const sd = info.streaming_data;
    console.log(`Has streaming data: ${!!sd}`);
    if (!sd) {
      console.log('Playability status:', info.playability_status?.status, info.playability_status?.reason);
    }
  } catch (e) {
    console.error('Failed YgJIQ2MaELA:', e);
  }
}

main().catch(console.error);
