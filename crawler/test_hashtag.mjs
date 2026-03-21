import { Innertube } from 'youtubei.js';

async function testHashtag() {
  console.log("Initializing Innertube...");
  const yt = await Innertube.create({ generate_session_locally: true });
  
  console.log("Fetching #shorts hashtag feed...");
  try {
      const feed = await yt.getHashtag("shorts");
      const raw = JSON.stringify(feed);
      
      const shorts = [...raw.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
      const unique = [...new Set(shorts)];
      
      console.log(`Found ${unique.length} Shorts in the hashtag feed!`);
      if (unique.length > 0) {
          const seed = unique[Math.floor(Math.random() * Math.min(20, unique.length))];
          console.log("Chosen Dynamic Seed:", seed);
      }
  } catch(e) {
      console.error(e);
  }
}

testHashtag();
