import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  try {
    const info = await yt.getBasicInfo('cNgyuHtBBW8');
    const sd = info.streaming_data;
    console.log(`Original ID cNgyuHtBBW8 has streaming data: ${!!sd}`);
    if (!sd) {
      console.log('Playability status:', info.playability_status?.status, info.playability_status?.reason);
    }
  } catch (e) {
    console.error('Failed', e);
  }
}

main().catch(console.error);
