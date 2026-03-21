const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const agent = new https.Agent({ keepAlive: true });

function fetchJson(url, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request(url, {
            method: 'POST',
            agent,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Encoding': 'gzip, deflate, br',
                'Origin': 'https://www.youtube.com',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());

            let chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    // Resolve MrBeast channel
    const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        url: `https://www.youtube.com/@MrBeast`
    });
    
    const channelId = idRes?.endpoint?.browseEndpoint?.browseId;
    console.log("Channel ID:", channelId);

    const aboutParams = "EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D";
    const shortsParams = "EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D";

    const aboutData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: channelId,
        params: aboutParams
    });
    fs.writeFileSync('dump_about.json', JSON.stringify(aboutData, null, 2));
    
    const shortsData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: channelId,
        params: shortsParams
    });
    fs.writeFileSync('dump_shorts.json', JSON.stringify(shortsData, null, 2));

    console.log("Dumped about and shorts data.");
}

main();
