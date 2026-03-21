import { Innertube } from 'youtubei.js';

async function testSeeder() {
  const yt = await Innertube.create({ generate_session_locally: true });
  console.log("Fetching home feed...");
  
  const home = await yt.getHomeFeed();
  
  // Serialize securely without blowing up memory (getHomeFeed is relatively small unlike Hashtags)
  const raw = JSON.stringify(home.page);
  
  // Exclusively look for the literal JSON key "videoId"
  const matches = [...raw.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
  const allIds = [...new Set(matches.map(m => m[1]))];
  
  console.log(`Extracted ${allIds.length} valid 11-char Video IDs.`);
  console.log("Sample:", allIds.slice(0, 5));
  
  if (allIds.length > 0) {
      const seed = allIds[Math.floor(Math.random() * allIds.length)];
      console.log("\n✅ THE PERFECT SEED:", seed);
  }
}

testSeeder();
