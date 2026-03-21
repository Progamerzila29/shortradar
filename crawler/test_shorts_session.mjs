import { Innertube } from 'youtubei.js';

async function testShortsSessionRedirect() {
    const yt = await Innertube.create({ generate_session_locally: true });
    
    try {
        console.log("Fetching https://www.youtube.com/shorts via Authenticated Session...");
        
        // This will automatically follow redirects using the authorized session cookies
        const res = await yt.session.http.fetch("https://www.youtube.com/shorts");
        console.log("Final URL resolved to:", res.url);
        
        const text = await res.text();
        const rawMatches = [...text.matchAll(/"[a-zA-Z0-9_-]{11}"/g)];
        console.log("Did we get HTML?", text.substring(0, 100));
        
        // the URL should be something like https://www.youtube.com/shorts/RANDOM_ID
        const urlMatch = res.url.match(/shorts\/([a-zA-Z0-9_-]{11})/);
        
        if (urlMatch) {
            console.log("\n✅ THE ULTIMATE DYNAMIC SEED IS:", urlMatch[1]);
        } else {
            console.log("❌ The redirect did not land on a Short ID.");
        }
    } catch(e) {
        console.log("Failed:", e.message);
    }
}

testShortsSessionRedirect();
