const https = require('https');
const zlib = require('zlib');

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

async function getPlaylistCount(plId) {
    const res = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: `VL${plId}`
    });
    if (!res) return 0;
    try {
        const text = res.header.playlistHeaderRenderer.numVideosText.runs[0].text;
        return parseInt(text.replace(/,/g, ''), 10) || 0;
    } catch(e) {}
    try {
        const runs = res.header.playlistHeaderRenderer.byline[0].playlistBylineRenderer.text.runs;
        return parseInt(runs[0].text.replace(/,/g, ''), 10) || 0;
    } catch(e) {}
    return 0;
}

function extractFromJSON(obj, targetKey, targetValueCallback) {
    let result = null;
    function search(o) {
        if (result) return;
        if (Array.isArray(o)) {
            for (const item of o) search(item);
        } else if (typeof o === 'object' && o !== null) {
            for (const [k, v] of Object.entries(o)) {
                if (k === targetKey && (!targetValueCallback || targetValueCallback(v))) {
                    result = o;
                }
                search(v);
            }
        }
    }
    search(obj);
    return result;
}

async function main() {
    const start = Date.now();
    const handle = process.argv[2];
    if (!handle) {
        console.error("Usage: node script.js <channel_handle>");
        process.exit(1);
    }

    // Step 1: Resolve main channel instantly to get ID and browse params for about/shorts
    const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        url: `https://www.youtube.com/@${handle}`
    });
    
    const channelId = idRes?.endpoint?.browseEndpoint?.browseId;
    if (!channelId) {
        console.error("Channel ID not found!");
        process.exit(1);
    }
    const id = channelId.substring(2);

    // Hardcoded known parameter blobs for sub-tabs to avoid 2 extra resolve_url HTTP requests!
    // base64 param values are mostly static for About and Shorts tabs across all channels globally
    // EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D -> About
    // EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D -> Shorts
    const aboutParams = "EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D";
    const shortsParams = "EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D";

    // Step 2: Fetch all components perfectly in parallel! (Playlists, About page, Shorts page)
    const browsePromises = [
        getPlaylistCount(`UULF${id}`),
        getPlaylistCount(`UUSH${id}`),
        getPlaylistCount(`UULV${id}`),
        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
            browseId: channelId,
            params: aboutParams
        }),
        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
            browseId: channelId,
            params: shortsParams
        })
    ];

    const [exactLong, exactShorts, exactLive, aboutData, shortsData] = await Promise.all(browsePromises);

    let joinedDate = "Unknown";
    let popupTotalVideos = null;

    if (aboutData) {
        const joinedDateObj = extractFromJSON(aboutData, 'joinedDateText');
        if (joinedDateObj && joinedDateObj.joinedDateText) {
            joinedDate = joinedDateObj.joinedDateText.content.replace('Joined ', '');
        }

        const videoCountObj = extractFromJSON(aboutData, 'videoCountText');
        if (videoCountObj && typeof videoCountObj.videoCountText === 'string') {
            popupTotalVideos = parseInt(videoCountObj.videoCountText.replace(/,/g, '').replace(' videos', '').trim(), 10) || null;
        }
    }

    const exactTotalSum = exactLong + exactShorts + exactLive;
    let actualTotal = popupTotalVideos !== null ? popupTotalVideos : exactTotalSum;
    let missingRecent = actualTotal - exactTotalSum;
    if (missingRecent < 0) missingRecent = 0;

    // Shorts parsing
    let oldestToken = null;
    if (shortsData) {
        function findOldest(obj) {
            if (oldestToken) return;
            if (Array.isArray(obj)) {
                for (const i of obj) findOldest(i);
            } else if (typeof obj === 'object' && obj !== null) {
                if (obj.chipViewModel && obj.chipViewModel.text === 'Oldest') {
                    try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch(e){}
                }
                if (obj.text === 'Oldest' && obj.tapCommand) {
                    try { oldestToken = obj.tapCommand.innertubeCommand.continuationCommand.token; } catch(e){}
                }
                for (const v of Object.values(obj)) findOldest(v);
            }
        }
        findOldest(shortsData);
    }

    let firstShortDate = "No shorts published";
    let firstShortTitle = "N/A";
    let channelTrueAge = "N/A";

    if (oldestToken) {
        // Fetch oldest short token
        const oldestShortsData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
            continuation: decodeURIComponent(oldestToken)
        });

        let firstShortId = null;
        function findShort(obj) {
            if (firstShortId) return;
            if (Array.isArray(obj)) {
                for (const i of obj) findShort(i);
            } else if (typeof obj === 'object' && obj !== null) {
                if (obj.shortsLockupViewModel && obj.shortsLockupViewModel.entityId) {
                    firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
                } else if (obj.videoId && typeof obj.videoId === 'string' && obj.videoId.length === 11) {
                    firstShortId = obj.videoId;
                }
                for (const v of Object.values(obj)) findShort(v);
            }
        }
        findShort(oldestShortsData);

        if (firstShortId) {
            const playerRes = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
                context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
                videoId: firstShortId
            });
            
            if (playerRes?.microformat?.playerMicroformatRenderer) {
                const micro = playerRes.microformat.playerMicroformatRenderer;
                firstShortDate = micro.publishDate;
                firstShortTitle = micro.title?.simpleText || firstShortId;
                
                const today = new Date();
                const firstDate = new Date(firstShortDate);
                const ageMs = today - firstDate;
                const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
                const ageYears = (ageDays / 365.25).toFixed(2);
                
                channelTrueAge = `${ageDays} days (approx ${ageYears} years)`;
            }
        }
    }

    const end = Date.now();
    const timeMs = end - start;

    console.log("=========================================");
    console.log(`Channel:       @${handle}`);
    console.log(`Channel ID:    ${channelId}`);
    console.log(`Creation Date (YouTube API): ${joinedDate}`);
    console.log("-----------------------------------------");
    console.log(`Exact Total Published Videos: ${actualTotal}`);
    console.log(`  - Exact Long Form Videos:   ${exactLong}`);
    console.log(`  - Exact Short Form Videos:  ${exactShorts}`);
    console.log(`  - Exact Live Streams:       ${exactLive}`);
    if (missingRecent > 0) {
        console.log(`  - Recent/Uncategorized Videos (Uploaded <24h ago): ${missingRecent}`);
    }
    console.log("-----------------------------------------");
    console.log(`First Shorts Upload Date: ${firstShortDate}`);
    if (firstShortTitle !== "N/A") console.log(`First Shorts Title:       ${firstShortTitle}`);
    console.log(`True Age of Channel (Today - First Short): ${channelTrueAge}`);
    console.log("=========================================");
    console.log(`Execution time: ${timeMs}ms`);
}

main();
