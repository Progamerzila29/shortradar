import express from 'express';
import { isVideoPublishRecentEnough } from '../lib/crawl-policy.mjs';
import { extractShortsVideoIds } from '../lib/innertube-shorts.mjs';

const WORKER_API = "https://shortradar-scraper-api.shortradar.workers.dev";
const PARALLEL_THREADS = 20;
const TARGET_PER_THREAD = 15000;

// ─── Hardcoded InnerTube Client ──────────────────────────────────────────────
// These are the exact same values that youtubei.js uses internally.
// By hardcoding them we bypass the Innertube.create() network call entirely.
const API_KEY   = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const CONTEXT   = {
    client: {
        clientName: "MWEB",
        clientVersion: "2.20231207.01.00",
        hl: "en",
        gl: "US",
    }
};
const HEADERS   = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://m.youtube.com",
    "Referer": "https://m.youtube.com/",
};

// ─── InnerTube: Get next Shorts in the swipe feed ───────────────────────────
async function getNextShortsFromFeed(videoId) {
    const url = `https://www.youtube.com/youtubei/v1/next?key=${API_KEY}&prettyPrint=false`;
    const res  = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
            videoId,
            context: CONTEXT,
            // This param tells InnerTube to return the Shorts reel watch sequence
            params: "8gEAmgMDCNkI",
        }),
    });
    const data  = await res.json();
    const str   = JSON.stringify(data);
    const hits  = [...str.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
    return [...new Set(hits.map(m => m[1]))];
}

// ─── InnerTube: Bootstrap a global seed from the Shorts shelf ───────────────
async function getGlobalSeed() {
    try {
        const url = `https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}&prettyPrint=false`;
        const res = await fetch(url, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({ browseId: "FEshorts", context: CONTEXT }),
        });
        const data = await res.json();
        const str  = JSON.stringify(data);
        const m    = str.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        if (m) return m[1];
    } catch(e) {}
    return "kZyTCtV_bqY"; // permanent fallback
}

// ─── Stage 1: HTML Micro-Filter ─────────────────────────────────────────────
async function verifyAndDispatch(vid) {
    try {
        const res = await fetch(`https://www.youtube.com/shorts/${vid}`, { headers: HEADERS });
        const html = await res.text();
        const dateMatch    = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
        const channelMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
        const publishDate  = dateMatch    ? dateMatch[1]    : null;
        const channelId    = channelMatch ? channelMatch[1] : null;

        if (!publishDate) {
            if (channelId) {
                process.stdout.write(`\n\x1b[33m⚠️  [${vid} — Unknown Date → Dispatching]\x1b[0m`);
                dispatchToWorker(vid, channelId, null);
            }
            return;
        }
        const recent = isVideoPublishRecentEnough(publishDate);
        if (!recent.ok) return;
        process.stdout.write(`\n\x1b[32m✅ [${vid} — ${publishDate}]\x1b[0m`);
        dispatchToWorker(vid, channelId, publishDate);
    } catch(_) {}
}

// ─── Fire to Cloudflare ──────────────────────────────────────────────────────
function dispatchToWorker(vid, channelId, publishDate) {
    if (!channelId) return;
    fetch(`${WORKER_API}?channel_id=${channelId}&video_id=${vid}&first_short_date=${publishDate}`)
        .then(r => r.json())
        .then(data => {
            if (data.status === "success" && data.data?.channel) {
                console.log(`\n\x1b[42m\x1b[1m INSERTED \x1b[0m ${channelId} → ${data.data.channel.handle}`);
            }
        }).catch(() => {});
}

// ─── One Crawler Thread ──────────────────────────────────────────────────────
async function startMinerThread(threadId, seed) {
    console.log(`[🟢] Agent #${threadId} online.`);
    let currentVid = seed;
    const seen     = new Set([seed]);
    let processed  = 0;

    while (processed < TARGET_PER_THREAD) {
        try {
            const vids = await getNextShortsFromFeed(currentVid);

            let nextSeed = null;
            for (const vid of vids) {
                if (seen.has(vid)) continue;
                seen.add(vid);
                processed++;
                verifyAndDispatch(vid); // fire-and-forget
                nextSeed = vid;
                if (processed >= TARGET_PER_THREAD) break;
            }

            if (!nextSeed) {
                const arr = [...seen];
                currentVid = arr[Math.floor(Math.random() * arr.length)];
                continue;
            }
            currentVid = nextSeed;
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 600) + 100));
        } catch(e) {
            console.log(`[Agent #${threadId}] Error: ${e.message} — Cooling 5s`);
            await new Promise(r => setTimeout(r, 5000));
            const arr = [...seen];
            currentVid = arr[Math.floor(Math.random() * arr.length)];
        }
    }
    
    console.log(`[🔃] Agent #${threadId} hit target. Rebooting...`);
    startMinerThread(threadId, currentVid);
}

// ─── Express Health Server (required by Hugging Face) ───────────────────────
const app = express();

app.get("/", (req, res) => {
    res.send(`
        <html><body style="background:#000;color:#0f0;font-family:monospace;padding:40px">
        <h2>🚀 SHORTRADAR ENGINE — ACTIVE</h2>
        <p>Status: <strong>OPERATIONAL</strong></p>
        <p>Active Agents: ${PARALLEL_THREADS}</p>
        <p>Firing into CockroachDB via Cloudflare Edge</p>
        </body></html>
    `);
});

const PORT = process.env.PORT || 7860;
app.listen(PORT, async () => {
    console.log(`\n🚀 SERVER BIND SUCCESSFUL ON PORT ${PORT}\n`);

    // Suppress youtubei noise (not used anymore but keep for safety)
    process.on("uncaughtException", (e) => {
        if (!e.message?.includes("fetch")) console.error("[CRITICAL]", e.message);
    });

    console.log(`[⏳] Bootstrapping global seed from YouTube Shorts shelf...`);
    const seed = await getGlobalSeed();
    console.log(`[🎯] Global Seed Locked: ${seed}`);
    console.log(`[🔥] Launching ${PARALLEL_THREADS} parallel extraction agents...`);

    for (let i = 0; i < PARALLEL_THREADS; i++) {
        setTimeout(() => startMinerThread(i + 1, seed), i * 300);
    }
});
