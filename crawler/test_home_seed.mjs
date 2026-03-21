import { Innertube } from 'youtubei.js';

async function testHomeSeed() {
  console.log("Initializing Innertube...");
  const yt = await Innertube.create({ generate_session_locally: true });
  
  console.log("Fetching Global Home Feed...");
  const home = await yt.getHomeFeed();
  
  // The home feed contains various node types: RichGrid, RichSection, Shelf, etc.
  // Let's sweep the entire raw JSON for any Shorts identifiers!
  const raw = JSON.stringify(home);
  // Look for reelItemRenderer (which represents Shorts in feeds)
  const matches = [...raw.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"(?:[^}]*"isShort"\s*:\s*true)?/g)];
  
  let dynamicSeed = null;
  // Let's find an explicit Short from the home feed
  // Usually Shorts on home feed are inside RichShelfs with isShort: true or similar
  const shortMatches = [...raw.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"[^}]*"defaultText"\s*:\s*"Shorts"/gi)];
  
  if (shortMatches.length > 0) {
      dynamicSeed = shortMatches[0][1];
      console.log("✅ Extracted explicit Short from Home Feed:", dynamicSeed);
  } else {
      // Fallback: Just grab any random video from the home feed
      console.log("No explicit Shorts shelf found. Extracting first valid video ID.");
      const vids = [...new Set(matches.map(m => m[1]))];
      if (vids.length > 0) {
          dynamicSeed = vids[Math.floor(Math.random() * vids.length)];
      }
  }
  
  console.log("Chosen Dynamic Seed:", dynamicSeed);
}

testHomeSeed();
