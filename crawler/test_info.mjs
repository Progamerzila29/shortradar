import { Innertube } from 'youtubei.js';

async function test() {
  const yt = await Innertube.create();
  try {
    const info = await yt.getInfo('kZyTCtV_bqY');
    console.log("DATE:", info.primary_info?.published?.text);
    console.log("CHANNEL:", info.basic_info.channel_id);
  } catch(e) {
    console.log("ERROR:", e.message);
  }
}
test();
