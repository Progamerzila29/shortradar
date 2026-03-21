const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';

fetch('https://www.youtube.com/youtubei/v1/next?key=' + API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://www.youtube.com' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, videoId: 'S_CUEOBZ0P4' })
})
.then(r => r.json())
.then(j => {
    let found = false;
    function f(obj, seen = new Set()) {
        if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
        seen.add(obj);

        if (Array.isArray(obj)) { obj.forEach(v => f(v, seen)); return; }

        for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'string' && (k.toLowerCase().includes('date') || k === 'simpleText' || k === 'publishedTimeText')) {
                if (v.includes('ago') || v.match(/\d{4}/)) {
                    console.log('Found string:', k, v);
                    found = true;
                }
            } else if (v && v.simpleText) {
                if (k.toLowerCase().includes('date')) {
                    console.log('Found object:', k, v.simpleText);
                    found = true;
                }
            } else if (k === 'publishedTimeText') {
                console.log('Found publishedTimeText:', JSON.stringify(v));
                found = true;
            }
            if (v && typeof v === 'object') f(v, seen);
        }
    }
    f(j);
    if(!found) console.log('No dates found in /next for S_CUEOBZ0P4.');
})
.catch(e => console.log('Error:', e));
