const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';

async function fetchJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Origin': 'https://www.youtube.com'
        },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

async function testAbout() {
    const aboutData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: 'UCWKT9BJiHYE1578jbIZMh2w', params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D'
    });
    
    let joined = null;
    function findJoined(obj) {
        if (Array.isArray(obj)) { for (const i of obj) findJoined(i); return; }
        if (!obj || typeof obj !== 'object') return;
        
        // Search for strings containing "Joined"
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && (v.includes('Joined ') || v.includes('Inscrit le'))) {
                console.log("Found joined text:", v, "at key:", k);
                joined = v;
            } else if (v && typeof v === 'object' && v.content && typeof v.content === 'string' && v.content.includes('Joined')) {
                console.log("Found joined text content:", v.content);
                joined = v.content;
            }
        }
        for (const v of Object.values(obj)) findJoined(v);
    }
    findJoined(aboutData);
    if (!joined) console.log("Could not find Joined Date in aboutData!");
}
testAbout();
