// Dumps the About page JSON to find all language-related keys
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

function fetchJson(url, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request(url, { method: 'POST', agent, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate, br', 'Origin': 'https://www.youtube.com', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());
            const chunks = [];
            stream.on('data', c => chunks.push(c));
            stream.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        url: 'https://www.youtube.com/@FrankoEnDetente'
    });
    const channelId = idRes?.endpoint?.browseEndpoint?.browseId;
    const aboutData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: channelId, params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D'
    });
    fs.writeFileSync('dump_about.json', JSON.stringify(aboutData, null, 2));
    
    // Find all keys containing "lang" or "language"
    const raw = JSON.stringify(aboutData);
    const matches = [...raw.matchAll(/"([^"]*(?:lang|locale|country|hl)[^"]*)":\s*"([^"]+)"/gi)];
    const unique = [...new Set(matches.map(m => `${m[1]}: ${m[2]}`))];
    console.log('Language-related fields found:');
    unique.slice(0, 30).forEach(l => console.log(' ', l));
}

main();
