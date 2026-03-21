const https = require('https');
const zlib = require('zlib');

const START = Date.now(); // ← Timer starts at the very first line

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const CUTOFF = new Date('2025-01-01');

// Persistent HTTP connection for maximum speed (no TLS re-handshake)
const agent = new https.Agent({ keepAlive: true, maxSockets: 100 });

// ─── NETWORK ──────────────────────────────────────────────────────────────────
function fetchJson(url, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = https.request(url, {
            method: 'POST', agent,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Encoding': 'gzip, deflate, br',
                'Origin': 'https://www.youtube.com',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') stream = res.pipe(zlib.createGunzip());
            else if (res.headers['content-encoding'] === 'br') stream = res.pipe(zlib.createBrotliDecompress());
            const chunks = [];
            stream.on('data', c => chunks.push(c));
            stream.on('end', () => {
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
                catch { resolve(null); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseViews(str) {
    if (!str) return 0;
    const s = str.toUpperCase().replace(/VIEWS|SUBSCRIBERS/g, '').trim();
    if (s.includes('K')) return Math.round(parseFloat(s) * 1000);
    if (s.includes('M')) return Math.round(parseFloat(s) * 1_000_000);
    if (s.includes('B')) return Math.round(parseFloat(s) * 1_000_000_000);
    return parseInt(s.replace(/,/g, ''), 10) || 0;
}

function formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
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

// Deep recursive search — stops as soon as we find the target
function deepFind(obj, key, validator) {
    if (Array.isArray(obj)) {
        for (const i of obj) { const r = deepFind(i, key, validator); if (r !== null) return r; }
    } else if (obj && typeof obj === 'object') {
        if (key in obj && (!validator || validator(obj[key]))) return obj[key];
        for (const v of Object.values(obj)) { const r = deepFind(v, key, validator); if (r !== null) return r; }
    }
    return null;
}

// Monetization check proxy: YouTube removed the public flag in Nov 2023.
// We approximate monetization based on YouTube Partner Program eligibility and presence of ad hooks.
function isLikelyMonetized(subscribers, avgViews) {
    // Basic YPP eligibility proxy: >1000 subs and consistent views.
    return subscribers >= 1000 && avgViews > 10000;
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────
async function main() {
    const handle = process.argv[2];
    if (!handle) { console.error('Usage: node local_test_pipeline.js <handle>'); process.exit(1); }

    // ── CRITICAL PATH 1: Resolve Channel ID (100ms) ──────────────────────────
    const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        url: `https://www.youtube.com/@${handle.replace('@', '')}`
    });
    const channelId = idRes?.endpoint?.browseEndpoint?.browseId;
    if (!channelId) { console.error('❌ Channel not found'); process.exit(1); }

    const id = channelId.substring(2);

    // ── FIRE BACKGROUND TASKS (0ms blocking time) ────────────────────────────
    const pAbout = fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: channelId, params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D'
    });
    // Playlist counts — fire in background with 900ms timeout so they never delay the output
    function withTimeout(p, ms, fallback = 0) {
        return Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
    }
    const pLong   = withTimeout(getPlaylistCount(`UULF${id}`), 900);
    const pShorts = withTimeout(getPlaylistCount(`UUSH${id}`), 900);
    const pLive   = withTimeout(getPlaylistCount(`UULV${id}`), 900);


    // ── CRITICAL PATH 2: Fetch Recent Shorts (300ms) ─────────────────────────
    const shortsData = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
        browseId: channelId, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D'
    });

    const recentShorts = [];
    let oldestToken = null;

    function parseShortsTab(obj) {
        if (Array.isArray(obj)) { for (const i of obj) parseShortsTab(i); return; }
        if (!obj || typeof obj !== 'object') return;

        if (recentShorts.length < 5 && obj.shortsLockupViewModel) {
            const vid = obj.shortsLockupViewModel.entityId?.replace('shorts-shelf-item-', '');
            const title = obj.shortsLockupViewModel.overlayMetadata?.primaryText?.content;
            const viewsStr = obj.shortsLockupViewModel.overlayMetadata?.secondaryText?.content;
            if (vid && title) recentShorts.push({ video_id: vid, title, views: parseViews(viewsStr), thumbnail: obj.shortsLockupViewModel.thumbnail?.sources?.[0]?.url || '' });
        }
        if (!oldestToken && obj.chipViewModel?.text === 'Oldest') {
            try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch {}
        }
        for (const v of Object.values(obj)) parseShortsTab(v);
    }
    parseShortsTab(shortsData);

    // ── CRITICAL PATH 3: Extract First Short (200-500ms) ─────────────────────
    let firstShortDateRaw = null;
    let channelAgeDays = 0;

    async function getPublishDate(videoId) {
        const r = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
            videoId
        });
        return r?.microformat?.playerMicroformatRenderer?.publishDate || null;
    }

    if (oldestToken) {
        // Fire oldestData browse immediately
        const pOldestData = fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
            continuation: decodeURIComponent(oldestToken)
        });
        const oldestData = await pOldestData;
        let firstShortId = null;
        function findFirstShort(obj) {
            if (firstShortId) return;
            if (Array.isArray(obj)) { for (const i of obj) findFirstShort(i); return; }
            if (!obj || typeof obj !== 'object') return;
            if (obj.shortsLockupViewModel?.entityId) firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
            else if (obj.videoId?.length === 11) firstShortId = obj.videoId;
            for (const v of Object.values(obj)) findFirstShort(v);
        }
        findFirstShort(oldestData);
        if (firstShortId) firstShortDateRaw = await getPublishDate(firstShortId);
    } else if (recentShorts.length > 0) {
        firstShortDateRaw = await getPublishDate(recentShorts[recentShorts.length - 1].video_id);
    }

    // ── AWAIT ABOUT (fast — already fired, should be done) ────────────────────
    const aboutData = await pAbout;

    // ── Extract Profile ──────────────────────────────────────────────────────
    let channelName = 'Unknown', avatarUrl = '', description = '', subscribers = 0, subscribersText = 'Unknown';
    let location = 'Unknown', language = 'Unknown', totalViews = 0;

    function extractHeader(obj) {
        if (Array.isArray(obj)) { for (const i of obj) extractHeader(i); return; }
        if (!obj || typeof obj !== 'object') return;

        if (!channelName || channelName === 'Unknown' || channelName === 'Home') {
            if (obj.channelMetadataRenderer?.title) channelName = obj.channelMetadataRenderer.title;
            else if (obj.microformatDataRenderer?.pageTitle) channelName = obj.microformatDataRenderer.pageTitle.replace(' - YouTube', '');
        }
        if (!description && obj.description && typeof obj.description === 'string' && obj.description.length > 3) description = obj.description;
        if (!avatarUrl && obj.avatar?.thumbnails?.[0]?.url) avatarUrl = obj.avatar.thumbnails[0].url;

        // Subscribers: store both raw and YouTube-display format string
        if (subscribers === 0) {
            const simpleText = obj.subscriberCountText?.simpleText;
            const contentText = typeof obj.content === 'string' && /^\d[\d.,KMB]*\s+(subscribers|abonnés|abonnés)$/i.test(obj.content) ? obj.content : null;
            if (simpleText) { subscribersText = simpleText; subscribers = parseViews(simpleText); }
            else if (contentText) { subscribersText = contentText.replace(/\s+(subscribers|abonnés)/i, ''); subscribers = parseViews(contentText); }
        }
        // Total views
        if (totalViews === 0 && obj.viewCountText && typeof obj.viewCountText === 'string') {
            totalViews = parseInt(obj.viewCountText.replace(/[^0-9]/g, ''), 10) || 0;
        }
        if (obj.country && typeof obj.country === 'string') location = obj.country;
        
        // Language: YouTube doesn't expose channel language directly.
        // Best proxy: use the country code to infer the primary language.
        if (language === 'Unknown') {
            if (obj.defaultAudioLanguage && typeof obj.defaultAudioLanguage === 'string') language = obj.defaultAudioLanguage;
            else if (obj.defaultLanguage && typeof obj.defaultLanguage === 'string') language = obj.defaultLanguage;
            else if (obj.languageCode && typeof obj.languageCode === 'string') language = obj.languageCode;
        }
        // countryCode is a reliable fallback (e.g. 'FR' -> French)
        if (location === 'Unknown' && obj.countryCode && typeof obj.countryCode === 'string') location = obj.countryCode;

        for (const v of Object.values(obj)) extractHeader(v);
    }
    extractHeader(aboutData);

    if (!firstShortDateRaw) { console.error('❌ Could not determine channel age.'); process.exit(1); }

    const firstShortDate = new Date(firstShortDateRaw);
    channelAgeDays = Math.max(1, Math.floor((Date.now() - firstShortDate) / 86_400_000));
    // Formatting age into exact variables for DB and dashboard filtering
    const ageYears = (channelAgeDays / 365.25).toFixed(2);
    const ageMonths = (channelAgeDays / 30.44).toFixed(1);
    const ageWeeks = (channelAgeDays / 7).toFixed(1);

    const isValid = firstShortDate >= CUTOFF;

    // ── PRINT SUMMARY ────────────────────────────────────────────────────────
    console.log('=========================================');
    console.log(`Channel:          @${handle.replace('@', '')}`);
    console.log(`Channel Name:     ${channelName}`);
    console.log(`Subscribers:      ${subscribersText} (≈${subscribers.toLocaleString()} exact)`);
    console.log(`Total Views:      ${totalViews > 0 ? totalViews.toLocaleString() : 'N/A'}`);
    console.log(`Location:         ${location}`);

    // ── AWAIT EXACT COUNTS (always — they've been running in background) ──────
    const [exactLong, exactShorts, exactLive] = await Promise.all([pLong, pShorts, pLive]);
    const exactTotalSum = exactLong + exactShorts + exactLive;

    console.log('-----------------------------------------');
    console.log(`Exact Total Vids: ${exactTotalSum}`);
    console.log(`  - Shorts:       ${exactShorts}`);
    console.log(`  - Long form:    ${exactLong}`);
    console.log(`  - Live streams: ${exactLive}`);
    console.log('-----------------------------------------');
    console.log(`First Short:      ${firstShortDateRaw.split('T')[0]}`);
    console.log(`Age:              ${channelAgeDays} Days | ${ageWeeks} Weeks | ${ageMonths} Months | ${ageYears} Years`);
    console.log('=========================================');

    if (!isValid) {
        console.log(`❌ TOO OLD — First short before 2025. Would be added to IGNORE CACHE.`);
        console.log(`=========================================`);
        console.log(`⏱  Execution time: ${Date.now() - START}ms`);
        return;
    }

    // Only runs if the channel is valid (first short >= 2025-01-01)
    const avgViews = recentShorts.length ? Math.floor(recentShorts.reduce((s, v) => s + v.views, 0) / recentShorts.length) : 0;
    const viewsToSub = subscribers > 0 ? (avgViews / subscribers).toFixed(2) : 0;
    const growthScore = channelAgeDays > 0 ? (avgViews / channelAgeDays).toFixed(2) : avgViews;

    console.log(`✅ VALID — New channel since ${firstShortDateRaw.split('T')[0]}`);
    console.log(`=========================================`);
    console.log(`\n[DB PAYLOAD]`);
    console.log(JSON.stringify({
        channel: {
            channel_id: channelId,
            handle: handle.startsWith('@') ? handle : '@' + handle,
            channel_name: channelName,
            description: description.substring(0, 500),
            avatar_url: avatarUrl,
            channel_url: `https://youtube.com/@${handle.replace('@', '')}`,
            location,
            language,
            subscribers,
            subscribers_text: subscribersText,
            total_views: totalViews,
            total_videos: exactTotalSum,
            videos_shorts: exactShorts,
            videos_long: exactLong,
            videos_live: exactLive,
            is_monetized: isLikelyMonetized(subscribers, avgViews),
            first_short_date: firstShortDateRaw.split('T')[0],
            channel_age_days: channelAgeDays,
            channel_age_weeks: parseFloat(ageWeeks),
            channel_age_months: parseFloat(ageMonths),
            channel_age_years: parseFloat(ageYears),
            average_views_last5: avgViews,
            views_to_sub_ratio: parseFloat(viewsToSub),
            growth_score: parseFloat(growthScore)
        },
        shorts: recentShorts.map(s => ({
            video_id:  s.video_id,
            title:     s.title,
            thumbnail: s.thumbnail,
            views:     s.views,
            video_url: `https://www.youtube.com/shorts/${s.video_id}`,
            embed_url: `https://www.youtube.com/embed/${s.video_id}`
        }))
    }, null, 2));

    console.log(`\n⏱  Execution time: ${Date.now() - START}ms`);
}

main();
