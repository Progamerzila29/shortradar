// Quick check of what chips appear in the Shorts tab for a channel
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
console.log('Checking chips for channel:', CHANNEL_ID);

const shortsData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
    context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
    browseId: CHANNEL_ID, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D'
});

// Find ALL chipViewModels
const chips = [];
function findChips(obj) {
    if (Array.isArray(obj)) { for (const i of obj) findChips(i); return; }
    if (!obj || typeof obj !== 'object') return;
    if (obj.chipViewModel) {
        chips.push({ text: obj.chipViewModel.text, hasToken: !!obj.chipViewModel?.tapCommand?.innertubeCommand?.continuationCommand?.token });
    }
    for (const v of Object.values(obj)) findChips(v);
}
findChips(shortsData);
console.log('Chips found:', chips);

// Also check for any sortFilter or similar
function findSortTokens(obj, depth = 0) {
    if (depth > 8 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { for (const i of obj) findSortTokens(i, depth+1); return; }
    for (const [k, v] of Object.entries(obj)) {
        if (k === 'continuationCommand' && v?.token) {
            console.log('Continuation token found at depth', depth, '- first 50 chars:', v.token.substring(0, 50));
        }
        if (v && typeof v === 'object') findSortTokens(v, depth+1);
    }
}
