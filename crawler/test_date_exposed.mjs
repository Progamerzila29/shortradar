import { Innertube } from 'youtubei.js';

async function checkDateExposed() {
    const yt = await Innertube.create({ generate_session_locally: true });
    
    // Using our dynamic seedless intercept technique to get a real payload
    console.log("Resolving base /shorts URL...");
    const endpoint = await yt.resolveURL("https://www.youtube.com/shorts");
    const rawRes = JSON.stringify(await endpoint.call(yt.actions, { parse: false }));
    
    const m = rawRes.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (!m) return;
    
    // Now get the real payload we use in the crawler
    const info = await yt.getShortsVideoInfo(m[1]);
    const feed = info.watch_next_feed || [];
    
    console.log("Analyzing first short in the block:");
    console.log(JSON.stringify(feed[0], null, 2).substring(0, 1500)); // Print first 1500 chars to find date strings
    
    // Search the raw feed string for Date-related terms
    const rawFeed = JSON.stringify(feed);
    const agoMatches = [...rawFeed.matchAll(/([0-9]+\s+[a-zA-Z]+\s+ago)/g)];
    const uniqueDates = [...new Set(agoMatches.map(m => m[1]))];
    console.log("\n[🔎] Extracted Relative Dates found in the payload:", uniqueDates.slice(0, 10));
}

checkDateExposed();
