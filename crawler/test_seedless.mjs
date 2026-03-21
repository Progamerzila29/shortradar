import { Innertube } from 'youtubei.js';

async function testSeedlessEndpoint() {
    const yt = await Innertube.create({ generate_session_locally: true });
    try {
        console.log("Resolving base /shorts URL...");
        const endpoint = await yt.resolveURL("https://www.youtube.com/shorts");
        console.log("Endpoint type:", endpoint.payload.inputType); // SEEDLESS
        
        console.log("Calling endpoint...");
        const response = await endpoint.call(yt.actions, { parse: true });
        
        // This should return the ReelWatchSequence response
        // Let's dump the object to see where the 30 shorts are
        const raw = JSON.stringify(response);
        
        // Extract all exactly 11-char videoIDs from this response
        const matches = [...raw.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
        const ids = [...new Set(matches.map(m => m[1]))];
        
        console.log(`\n✅ MAGIC SEEDLESS SUCCESS: Extracted ${ids.length} Shorts!`);
        console.log("Sample IDs:", ids.slice(0, 5));
        
        // Pick one to be the dynamic seed for our v5_api_crawler
        if (ids.length > 0) {
            console.log("\nChosen dynamic seed to start crawler:", ids[0]);
        }
        
    } catch(e) {
        console.log("Failed:", e);
    }
}

testSeedlessEndpoint();
