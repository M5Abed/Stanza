import { Innertube } from 'youtubei.js';

async function main() {
  const yt = await Innertube.create();
  try {
    const info = await yt.getBasicInfo('YgJIQ2MaELA');
    console.log(`Basic info success for YgJIQ2MaELA: ${info.basic_info.title}, is_family_safe: ${info.basic_info.is_family_safe}`);
  } catch (e) {
    console.error('Failed YgJIQ2MaELA:', e);
  }
}

main().catch(console.error);
