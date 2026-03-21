import { Innertube } from 'youtubei.js';

async function testSecondShort() {
    const yt = await Innertube.create({ generate_session_locally: true });
    
    console.log("Resolving base /shorts URL...");
    const endpoint = await yt.resolveURL("https://www.youtube.com/shorts");
    const rawRes = JSON.stringify(await endpoint.call(yt.actions, { parse: false }));
    const m = rawRes.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (!m) return;
    
    console.log("Fetching Short sequence...");
    const info = await yt.getShortsVideoInfo(m[1]);
    const feed = info.watch_next_feed || [];
    
    if (feed.length > 1) {
        console.log("\n--- Full JSON of Short #2 ---");
        console.log(JSON.stringify(feed[1], null, 2));
    }
}

testSecondShort();
