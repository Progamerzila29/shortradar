const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';

async function fetchJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://www.youtube.com' },
        body: JSON.stringify(payload)
    });
    return await res.json();
}

const videoId = process.argv[2] || 'FMRDJnUfYHc'; // Oldest short from UCj-l4qsg
console.log('Testing date extraction for video:', videoId);

// Method 1: /next endpoint
console.log('\n--- Method 1: /next endpoint ---');
const nextData = await fetchJson(`https://www.youtube.com/youtubei/v1/next?key=${API_KEY}`, {
    context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
    videoId
});

function findDatePublished(obj, depth = 0) {
    if (depth > 15) return null;
    if (Array.isArray(obj)) { for (const i of obj) { const r = findDatePublished(i, depth+1); if (r) return r; } return null; }
    if (!obj || typeof obj !== 'object') return null;
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && (k === 'publishDate' || k === 'dateText' || k === 'publishedTimeText') && v.match(/\d{4}/)) return { key: k, value: v };
        if (v && typeof v === 'object') { const r = findDatePublished(v, depth+1); if (r) return r; }
    }
    return null;
}

const found = findDatePublished(nextData);
if (found) console.log('Found date in /next:', found);
else console.log('No date in /next. Top-level keys:', Object.keys(nextData).slice(0, 10));

// Method 2: /browse with videoId (watch page)
console.log('\n--- Method 2: browsing as Shorts player ---');
const playerData = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
    context: { client: { clientName: 'IOS', clientVersion: '19.09.3', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '17.5.1,21F90', hl: 'en', gl: 'US' } },
    videoId, contentCheckOk: true, racyCheckOk: true
});
console.log('iOS Player status:', playerData?.playabilityStatus?.status);
const publishDate = playerData?.microformat?.playerMicroformatRenderer?.publishDate;
console.log('iOS Player publishDate:', publishDate || 'NOT FOUND');
console.log('Top-level keys:', Object.keys(playerData || {}).slice(0, 10));

// Method 3: ANDROID client
console.log('\n--- Method 3: Android client ---');
const androidData = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
    context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, hl: 'en', gl: 'US' } },
    videoId, contentCheckOk: true, racyCheckOk: true
});
console.log('Android Player status:', androidData?.playabilityStatus?.status);
const androidDate = androidData?.microformat?.playerMicroformatRenderer?.publishDate;
console.log('Android Player publishDate:', androidDate || 'NOT FOUND');
