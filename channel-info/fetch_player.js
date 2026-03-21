const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const agent = new https.Agent({ keepAlive: true, maxSockets: 100 });

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
    // MrBeast Short: purAsH7pXTQ
    const playerRes = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        videoId: "purAsH7pXTQ"
    });
    
    fs.writeFileSync('dump_player.json', JSON.stringify(playerRes, null, 2));
    console.log('Saved dump_player.json');
}

main();
