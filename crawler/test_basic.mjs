import { Innertube } from 'youtubei.js';

async function test() {
  const yt = await Innertube.create();
  const basicInfo = await yt.getBasicInfo('kZyTCtV_bqY');
  console.log("DATE:", basicInfo.basic_info.start_timestamp || basicInfo.microformat?.publish_date || basicInfo.microformat?.upload_date);
  console.log("CHANNEL:", basicInfo.basic_info.channel_id);
}
test();
