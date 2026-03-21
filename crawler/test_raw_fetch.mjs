async function testRawFetch() {
    try {
        console.log("Fetching raw youtube homepage...");
        // Use standard global fetch
        const res = await fetch("https://www.youtube.com/", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            }
        });
        const text = await res.text();
        
        // Find every videoId mentioned in the raw initial data HTML dump
        const matches = [...text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
        const ids = [...new Set(matches.map(m => m[1]))];
        
        console.log(`Found ${ids.length} unique raw IDs on the homepage.`);
        console.log("First 10 IDs:", ids.slice(0, 10));
    } catch(e) {
        console.log("Failed:", e);
    }
}
testRawFetch();
