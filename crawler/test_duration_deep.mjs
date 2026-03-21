import { Innertube } from 'youtubei.js';

async function testDurationDeep() {
  const yt = await Innertube.create({ generate_session_locally: true });
  let info = await yt.getInfo("_OBlgSz8sSM");
  const feed = info.watch_next_feed || [];
  
  if (feed.length > 0) {
      console.log(JSON.stringify(feed[0], null, 2));
  }
}

testDurationDeep();
