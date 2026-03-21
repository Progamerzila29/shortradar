import { Innertube } from 'youtubei.js';

async function testResolveCall() {
  const yt = await Innertube.create();
  
  // 1. Resolve the Shorts URL to an Endpoint
  const endpoint = await yt.resolveURL("https://www.youtube.com/shorts/_OBlgSz8sSM");
  
  // 2. Call the Endpoint using Innertube's internal actions
  try {
      const res = await endpoint.call(yt.actions);
      console.log("Called Endpoint!");
      
      // Look at the returned object structure
      console.log("Keys of response:", Object.keys(res));
      
      // In youtubei.js, ReelWatchSequence or similar often has a continuation or entries
      // Let's dump the JSON to see what we actually got
      const dump = JSON.stringify(res, null, 2).substring(0, 1500);
      console.log("JSON DUMP:");
      console.log(dump);
      
      // Let's look for "video_id"
      const matches = dump.match(/"video_id":\s*"([^"]+)"/g);
      console.log("Video IDs found:", matches);
      
  } catch(e) {
      console.error(e);
  }
}

testResolveCall();
