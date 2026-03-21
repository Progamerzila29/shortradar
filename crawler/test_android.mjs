import { Innertube } from 'youtubei.js';

async function testAndroid() {
  // Mobile Android context!
  const yt = await Innertube.create({ clientType: 'ANDROID', generate_session_locally: true });
  
  try {
     const info = await yt.getInfo("_OBlgSz8sSM");
     console.log("Feed size:", info.watch_next_feed?.length || 0);
     if (info.watch_next_feed && info.watch_next_feed.length > 0) {
         console.log(JSON.stringify(info.watch_next_feed[0], null, 2));
     }
  } catch(e) {
     console.log("Error:", e.message);
  }
}

testAndroid();
