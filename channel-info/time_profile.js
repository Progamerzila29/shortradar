const https = require('https');
const zlib = require('zlib');

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const agent = new https.Agent({ keepAlive: true, maxSockets: 100 });

function fetchJson(url, payload, label) {
    const t = Date.now();
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request(url, { method: 'POST', agent, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Encoding': 'gzip, deflate, br', 'Origin': 'https://www.youtube.com', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());
            const chunks = [];
            stream.on('data', c => chunks.push(c));
            stream.on('end', () => {
                console.log(`  [${label}] ${Date.now() - t}ms`);
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); } catch { resolve(null); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    const START = Date.now();
    const handle = 'FrankoEnDetente';
    console.log('Timing each HTTP call:');
    
    const t1 = Date.now();
    const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        url: `https://www.youtube.com/@${handle}`
    }, 'resolve_url');
    const channelId = idRes?.endpoint?.browseEndpoint?.browseId;
    const id = channelId.substring(2);

    const t2 = Date.now();
    const [aboutData, shortsData] = await Promise.all([
        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, browseId: channelId, params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D'
        }, 'about'),
        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, browseId: channelId, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D'
        }, 'shorts')
    ]);
    const t3 = Date.now();

    // Check if oldestToken is present
    let oldestToken = null;
    function scan(obj) {
        if (Array.isArray(obj)) { for (const i of obj) scan(i); return; }
        if (!obj || typeof obj !== 'object') return;
        if (!oldestToken && obj.chipViewModel?.text === 'Oldest') {
            try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch {}
        }
        for (const v of Object.values(obj)) scan(v);
    }
    scan(shortsData);
    console.log(`\nresolve_url: ${t2 - t1}ms`);
    console.log(`about+shorts parallel: ${t3 - t2}ms`);
    console.log(`oldestToken found: ${!!oldestToken}`);

    if (oldestToken) {
        const t4 = Date.now();
        const oldestData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, continuation: decodeURIComponent(oldestToken)
        }, 'oldest_browse');
        const t5 = Date.now();
        console.log(`oldest_browse: ${t5 - t4}ms`);

        let firstShortId = null;
        function findShort(obj) {
            if (firstShortId) return;
            if (Array.isArray(obj)) { for (const i of obj) findShort(i); return; }
            if (!obj || typeof obj !== 'object') return;
            if (obj.shortsLockupViewModel?.entityId) firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-','');
            else if (obj.videoId?.length === 11) firstShortId = obj.videoId;
            for (const v of Object.values(obj)) findShort(v);
        }
        findShort(oldestData);
        
        if (firstShortId) {
            const t6 = Date.now();
            const playerRes = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
                context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, videoId: firstShortId
            }, 'player');
            console.log(`player: ${Date.now() - t6}ms`);
        }
    }

    console.log(`\nTOTAL: ${Date.now() - START}ms`);
}

main();
