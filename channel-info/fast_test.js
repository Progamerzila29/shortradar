const zlib = require('zlib');
const https = require('https');

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00'; // recent client version

function fetchJson(url, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Encoding': 'gzip, deflate, br',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (res.headers['content-encoding'] === 'br') {
                stream = res.pipe(zlib.createBrotliDecompress());
            }

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

function fetchText(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        }, (res) => {
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (res.headers['content-encoding'] === 'br') {
                stream = res.pipe(zlib.createBrotliDecompress());
            }

            let chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        });
        req.on('error', reject);
    });
}

async function test() {
    console.time("Test");
    // Get channel ID
    console.time("Fetch HTML");
    const html = await fetchText('https://www.youtube.com/@mkbhd');
    console.timeEnd("Fetch HTML");

    const channelId = html.match(/"channelId":"(UC.*?)"/)?.[1];
    console.log("Channel ID:", channelId);

    // Fetch playlist API
    console.time("Fetch Playlist");
    const plRes = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: `VL` + `UULFBJycsmduvYEL83R_U4JriQ`
    });
    console.timeEnd("Fetch Playlist");
    
    // Look for video count
    try {
        const stats = plRes.header.playlistHeaderRenderer.byline[0].playlistBylineRenderer.text.runs;
        console.log("Playlist Count from API:", stats);
    } catch(e) {}
    try {
        const numVideos = plRes.header.playlistHeaderRenderer.numVideosText.runs[0].text;
        console.log("Playlist Count numVideos:", numVideos);
    } catch(e) {}
    
    // Test player API
    console.time("Fetch Player");
    const playerRes = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        videoId: 'Y5iif7YskU4'
    });
    console.timeEnd("Fetch Player");
    console.log("Player upload Date:", playerRes?.microformat?.playerMicroformatRenderer?.publishDate);

    console.timeEnd("Test");
}
test();
