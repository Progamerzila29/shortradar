import { Innertube } from 'youtubei.js';

async function testGetShorts() {
  const yt = await Innertube.create();
  
  try {
     console.log("Requesting getShortsVideoInfo...");
     const info = await yt.getShortsVideoInfo("_OBlgSz8sSM");
     
     console.log("Keys available:", Object.keys(info));
     
     if (info.watch_next_feed) {
         console.log("Feed Size:", info.watch_next_feed.length);
         console.log("First item type:", info.watch_next_feed[0].type);
         
         const raw = JSON.stringify(info.watch_next_feed);
         
         const vids = [...raw.matchAll(/"videoId"\s*:\s*"([^"]{11})"/g)].map(x => x[1]);
         const unique = [...new Set(vids)];
         console.log("Unique Video IDs in feed:", unique.length);
         console.log(unique);
     }
     
  } catch(e) {
     console.log("Failed:", e);
  }
}

testGetShorts();
