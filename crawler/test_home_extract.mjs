import { Innertube } from 'youtubei.js';

function extractRandomVideoId(obj, ids = new Set()) {
    if (!obj) return ids;
    if (typeof obj === 'string') {
        const match = obj.match(/^[a-zA-Z0-9_-]{11}$/);
        if (match) ids.add(match[0]);
        return ids;
    }
    if (Array.isArray(obj)) {
        for (const item of obj) extractRandomVideoId(item, ids);
        return ids;
    }
    if (typeof obj === 'object') {
        if (obj.video_id) ids.add(obj.video_id);
        if (obj.videoId) ids.add(obj.videoId);
        for (const key in obj) {
            extractRandomVideoId(obj[key], ids);
        }
    }
    return ids;
}

async function testHomeExtract() {
  console.log("Initializing Innertube...");
  const yt = await Innertube.create({ generate_session_locally: true });
  
  console.log("Fetching Global Home Feed...");
  const home = await yt.getHomeFeed();
  
  const allIds = Array.from(extractRandomVideoId(home.contents));
  console.log(`Extracted ${allIds.length} unique raw IDs from Home Feed.`);
  
  if (allIds.length > 0) {
      // Pick a random seed
      const seed = allIds[Math.floor(Math.random() * allIds.length)];
      console.log("✅ Chosen Dynamic Home Seed:", seed);
  } else {
      console.log("❌ Failed to extract any IDs");
  }
}

testHomeExtract();
