import { Innertube } from 'youtubei.js';

function searchForPrecisionDates(obj, path = "$", results = []) {
    if (!obj) return results;
    if (typeof obj === 'string') {
        const lower = obj.toLowerCase();
        if (lower.includes('202') || lower.includes('date') || lower.includes('publish') || lower.includes('time') || /^\d{10}$/.test(obj) || /^\d{13}$/.test(obj)) {
            if (obj.length < 50) results.push({ path, value: obj }); // Exclude massive strings
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((val, i) => searchForPrecisionDates(val, `${path}[${i}]`, results));
    } else if (typeof obj === 'object') {
        for (const [key, val] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('date') || lowerKey.includes('time') || lowerKey.includes('publish')) {
                if (typeof val === 'string' || typeof val === 'number') {
                    results.push({ path: `${path}.${key}`, value: val });
                }
            }
            searchForPrecisionDates(val, `${path}.${key}`, results);
        }
    }
    return results;
}

async function testDeepDate() {
    const yt = await Innertube.create({ generate_session_locally: true });
    
    console.log("Resolving base /shorts URL...");
    const endpoint = await yt.resolveURL("https://www.youtube.com/shorts");
    const rawRes = JSON.stringify(await endpoint.call(yt.actions, { parse: false }));
    const m = rawRes.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (!m) return;
    
    console.log("Fetching Short sequence...");
    const info = await yt.getShortsVideoInfo(m[1]);
    const feed = info.watch_next_feed || [];
    
    for (let i = 0; i < Math.min(3, feed.length); i++) {
        console.log(`\n--- Short #${i + 1} ---`);
        const item = feed[i];
        
        // Print relative date if present
        const agoMatch = JSON.stringify(item).match(/([0-9]+\s+[a-zA-Z]+\s+ago)/);
        console.log("Relative Text:", agoMatch ? agoMatch[1] : "None");
        
        // Deep search for precision keys
        const precise = searchForPrecisionDates(item);
        console.log(`Found ${precise.length} potential date fields:`);
        precise.slice(0, 15).forEach(p => console.log(`  ${p.path}: ${p.value}`));
    }
}

testDeepDate();
