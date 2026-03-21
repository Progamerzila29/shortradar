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

// MrBeast : UCX6OQ3DkcsbYNE6H8uQQuVA (old channel, should be rejected)
// Test channel: UCj-l4qsg_yb4rnbLpjOFFFg
const CHANNEL_ID = process.argv[2] || 'UCX6OQ3DkcsbYNE6H8uQQuVA';
console.log('Testing channel:', CHANNEL_ID);

const id = CHANNEL_ID.substring(2);

const shortsData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
    context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
    browseId: CHANNEL_ID, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D'
});

const recentShorts = [];
let oldestToken = null;
function parseShortsTab(obj) {
    if (Array.isArray(obj)) { for (const i of obj) parseShortsTab(i); return; }
    if (!obj || typeof obj !== 'object') return;
    if (recentShorts.length < 5 && obj.shortsLockupViewModel) {
        const vid = obj.shortsLockupViewModel.entityId?.replace('shorts-shelf-item-', '');
        if (vid) recentShorts.push(vid);
    }
    if (!oldestToken && obj.chipViewModel?.text === 'Oldest') {
        try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch {}
    }
    for (const v of Object.values(obj)) parseShortsTab(v);
}
parseShortsTab(shortsData);

console.log('Recent shorts found:', recentShorts);
console.log('Oldest token found:', oldestToken ? 'YES' : 'NO');

if (!oldestToken && recentShorts.length === 0) {
    console.log('ERROR: No shorts and no oldest token!');
    process.exit(1);
}

// Test HTML date extraction on the most recent short
const videoId = recentShorts[0] || 'eWlcszvljcE';
console.log('\nTesting HTML date fetch for video:', videoId);
const r = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
});
const html = await r.text();
const m = html.match(/"datePublished":"(.*?)"/);
if (m) console.log('Date from HTML:', m[1]);
else console.log('FAILED to extract date from HTML! Response code:', r.status, 'Length:', html.length);

if (oldestToken) {
    console.log('\nFetching oldest short...');
    const oldestData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        continuation: decodeURIComponent(oldestToken)
    });
    let firstShortId = null;
    function findFirstShort(obj) {
        if (firstShortId) return;
        if (Array.isArray(obj)) { for (const i of obj) findFirstShort(i); return; }
        if (!obj || typeof obj !== 'object') return;
        if (obj.shortsLockupViewModel?.entityId) firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
        else if (obj.videoId?.length === 11) firstShortId = obj.videoId;
        for (const v of Object.values(obj)) findFirstShort(v);
    }
    findFirstShort(oldestData);
    console.log('Oldest short ID:', firstShortId);
    if (firstShortId) {
        const r2 = await fetch(`https://www.youtube.com/shorts/${firstShortId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const html2 = await r2.text();
        const m2 = html2.match(/"datePublished":"(.*?)"/);
        if (m2) console.log('Oldest Short Date:', m2[1]);
        else console.log('FAILED oldest date. Status:', r2.status, 'Length:', html2.length);
    }
}
