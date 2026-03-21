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

const CHANNEL_ID = process.argv[2] || 'UCj-l4qsg_yb4rnbLpjOFFFg';
console.log('Channel:', CHANNEL_ID);

// Step 1: get shorts tab and oldest chip token
const shortsData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
    context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
    browseId: CHANNEL_ID, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D'
});

let oldestToken = null;
function findChips(obj) {
    if (Array.isArray(obj)) { for (const i of obj) findChips(i); return; }
    if (!obj || typeof obj !== 'object') return;
    if (!oldestToken && obj.chipViewModel?.text === 'Oldest') {
        try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch {}
    }
    for (const v of Object.values(obj)) findChips(v);
}
findChips(shortsData);
console.log('Oldest token:', oldestToken ? 'FOUND' : 'NOT FOUND');

if (oldestToken) {
    // Step 2: Fetch oldest - NO decodeURIComponent!
    const oldestData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        continuation: oldestToken  // RAW - no decodeURIComponent!
    });

    // Find ALL strings in this response
    let firstShortId = null;
    function findFirstShort(obj) {
        if (firstShortId) return;
        if (Array.isArray(obj)) { for (const i of obj) findFirstShort(i); return; }
        if (!obj || typeof obj !== 'object') return;
        if (obj.shortsLockupViewModel?.entityId) firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
        for (const v of Object.values(obj)) findFirstShort(v);
    }
    findFirstShort(oldestData);
    console.log('First short ID:', firstShortId);

    // Look for any date-like strings in oldestData
    function findDates(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach((v, i) => findDates(v, `${path}[${i}]`)); return; }
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && (v.match(/\d{4}-\d{2}-\d{2}/) || (v.length > 5 && v.length < 50 && v.match(/\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)))) {
                console.log(`Date found at ${path}.${k} = "${v}"`);
            }
            if (v && typeof v === 'object') findDates(v, `${path}.${k}`);
        }
    }
    console.log('\nSearching for dates in oldestData...');
    findDates(oldestData);
    
    // Also look at shortsLockupViewModel properties
    function findShortsModel(obj) {
        if (Array.isArray(obj)) { for (const i of obj) findShortsModel(i); return; }
        if (!obj || typeof obj !== 'object') return;
        if (obj.shortsLockupViewModel) {
            console.log('\nShortsLockupViewModel keys:', Object.keys(obj.shortsLockupViewModel));
            console.log('Overlay metadata:', JSON.stringify(obj.shortsLockupViewModel.overlayMetadata, null, 2));
            return; // Only show first one
        }
        for (const v of Object.values(obj)) findShortsModel(v);
    }
    findShortsModel(oldestData);
}
