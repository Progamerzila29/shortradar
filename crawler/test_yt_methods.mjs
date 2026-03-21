import { Innertube, UniversalCache } from 'youtubei.js';

async function mapYT() {
  const yt = await Innertube.create({ generate_session_locally: true });
  console.log("Keys of yt:", Object.keys(yt));
  // Let's also see if memory has something for shorts
  
  // Try to parse a specific short video
  try {
      const info = await yt.getInfo("_OBlgSz8sSM");
      console.log("Got info for _OBlgSz8sSM");
      
      // Look for next feed or sequence
      const watchNext = info.watch_next_feed;
      if (watchNext) {
          console.log("Watch Next Feed Keys:", Object.keys(watchNext));
      }
      
      // Let's just find any 'getShorts' equivalent. 
      // Sometimes it is yt.resolveURL or yt.actions
  } catch(e) { console.log(e); }
  
  process.exit();
}

mapYT();
