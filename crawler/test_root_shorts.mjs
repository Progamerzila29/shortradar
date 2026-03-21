import { Innertube } from 'youtubei.js';

async function testRootShorts() {
    const yt = await Innertube.create({ generate_session_locally: true });
    try {
        console.log("Resolving base /shorts URL...");
        const endpoint = await yt.resolveURL("https://www.youtube.com/shorts");
        console.log("Endpoint properties:", JSON.stringify(endpoint, null, 2));
        
        // If it returns a reelWatchEndpoint without a videoId but WITH a sequenceParams
        if (endpoint.payload && endpoint.payload.videoId) {
            console.log("✅ THE ULTIMATE DYNAMIC SEED IS:", endpoint.payload.videoId);
        } else if (endpoint.payload && endpoint.payload.sequenceParams) {
            console.log("✅ Got sequence params instead! Calling it...");
            const res = await endpoint.call(yt.actions);
            console.log("Response:", Object.keys(res));
        } else {
            console.log("❌ No Short ID generated.");
        }
    } catch(e) {
        console.log("Failed:", e);
    }
}

testRootShorts();
