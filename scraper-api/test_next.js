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

const videoId = process.argv[2] || 'FMRDJnUfYHc';
console.log('Testing /next microformat for video:', videoId);

const nextData = await fetchJson(`https://www.youtube.com/youtubei/v1/next?key=${API_KEY}`, {
    context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
    videoId
});

// Check microformat
const mf = nextData?.microformat;
if (mf) {
    console.log('Microformat keys:', Object.keys(mf));
    console.log('Microformat:', JSON.stringify(mf, null, 2).substring(0, 1000));
} else {
    console.log('No microformat in /next response');
}

// Also check engagementPanels for date info
function searchForDate(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach((v, i) => searchForDate(v, `${path}[${i}]`)); return; }
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/)) {
            console.log(`Found date at ${path}.${k} = ${v}`);
        }
        if (v && typeof v === 'object') searchForDate(v, `${path}.${k}`);
    }
}

console.log('\nSearching all date strings in /next response...');
searchForDate(nextData);
