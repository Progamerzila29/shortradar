import { Innertube, UniversalCache } from 'youtubei.js';

async function runFleetInstance(targetShorts = 1000) {
  console.log(`\n  🚀 SHORT RADAR — V5 CLOUD ARMY INITIATED (NODEJS)\n`);
  console.log(`[🧠] Booting InnerTube Engine...`);
  
  // Create Innertube client with cache Disabled to avoid state buildup across fleet instances
  const yt = await Innertube.create({ generate_session_locally: true });
  
  let shortsProcessed = 0;
  
  try {
    // getShorts() automatically bootstraps the reel_item_watch feed sequence!
    let feed = await yt.getShorts();
    
    while (feed.has_continuation && shortsProcessed < targetShorts) {
      const vids = feed.videos;
      if (!vids || vids.length === 0) break;
      
      console.log(`\n[📺] Extracted Next Sequence Payload: ${vids.length} Algorithmic Shorts`);
      
      for (const short of vids) {
        shortsProcessed++;
        
        // short object usually has id, title, view_count, channel
        const vid = short.id;
        // In youtubei.js, the channel handle might be nested under `short.author`
        const channel = short.author ? short.author.name : "Unknown";
        
        // Print some info
        process.stdout.write(`✅ Found ${vid} | `);
      }
      
      console.log(`\n\n[🔎] Total Extracted in this Run: ${shortsProcessed}/${targetShorts}`);
      
      // Get the next algorithmic batch!
      feed = await feed.getContinuation();
    }
    
    console.log(`\n[✅] INSTANCE COMPLETE. Discovered ${shortsProcessed} Shorts.`);
    
  } catch (err) {
    console.error(`\n[💥] Fatal Error:`, err);
  }
}

runFleetInstance(100);
