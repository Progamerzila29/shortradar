async function test() {
    const res = await fetch("https://shortradar-scraper-api.shortradar.workers.dev?channel_id=UCWKT9BJiHYE1578jbIZMh2w&video_id=eWlcszvljcE");
    const data = await res.json();

    if (data.error) console.log("Error:", data.error);
    
    if (data.player_debug) {
        console.log("\nPlayer API response from Cloudflare:");
        console.log("Keys:", Object.keys(data.player_debug));
        if (data.player_debug.playabilityStatus) {
            console.log("Status:", data.player_debug.playabilityStatus.status);
            console.log("Reason:", data.player_debug.playabilityStatus.reason);
        }
        if (data.player_debug.microformat) {
            console.log("Microformat exists!");
        } else {
            console.log("No microformat found!");
        }
    }
}
test();
