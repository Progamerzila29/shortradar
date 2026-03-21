import { Client } from 'pg';

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const CUTOFF = new Date('2025-01-01');
const CTX = { context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } } };

async function fetchJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Origin': 'https://www.youtube.com' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return await res.json();
}

function parseViews(str) {
    if (!str) return 0;
    const s = str.toUpperCase().replace(/VIEWS|SUBSCRIBERS/g, '').trim();
    if (s.includes('K')) return Math.round(parseFloat(s) * 1000);
    if (s.includes('M')) return Math.round(parseFloat(s) * 1_000_000);
    if (s.includes('B')) return Math.round(parseFloat(s) * 1_000_000_000);
    return parseInt(s.replace(/,/g, ''), 10) || 0;
}

async function getPlaylistCount(plId) {
    const res = await fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: `VL${plId}` });
    if (!res) return 0;
    try { return parseInt(res.header.playlistHeaderRenderer.numVideosText.runs[0].text.replace(/,/g, ''), 10) || 0; } catch {}
    try { return parseInt(res.header.playlistHeaderRenderer.byline[0].playlistBylineRenderer.text.runs[0].text.replace(/,/g, ''), 10) || 0; } catch {}
    return 0;
}

// Cloudflare-safe date extraction: /next endpoint exposes publishDate deep within engagement panels
async function getPublishDateSafe(videoId) {
    try {
        const data = await fetchJson(`https://www.youtube.com/youtubei/v1/next?key=${API_KEY}`, { ...CTX, videoId });
        
        let foundDate = null;
        let seen = new Set();
        
        function findDateObj(obj) {
            if (foundDate) return;
            if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
            seen.add(obj);
            
            if (Array.isArray(obj)) { for (const i of obj) findDateObj(i); return; }
            
            for (const [k, v] of Object.entries(obj)) {
                if ((k === 'publishDate' || k === 'dateText') && v && v.simpleText) {
                    foundDate = v.simpleText;
                    return;
                }
                if (v && typeof v === 'object') findDateObj(v);
            }
        }
        findDateObj(data);
        
        if (foundDate) {
            // Convert "Apr 6, 2025" to standard ISO YYYY-MM-DD
            const d = new Date(foundDate);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
    } catch (e) { console.error('Date error', e.message); }
    return null;
}

function withTimeout(p, ms, fallback = 0) {
    return Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
}

function isLikelyMonetized(subscribers, avgViews) {
    return subscribers >= 1000 && avgViews > 10000;
}

export default {
    async fetch(request, env, ctx) {
        if (request.method !== 'POST' && request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

        const url = new URL(request.url);
        let handle = url.searchParams.get('handle') || url.searchParams.get('channel_id');
        const crawlerVideoId = url.searchParams.get('video_id'); // Pre-validated by crawler
        const crawlerFirstDate = url.searchParams.get('first_short_date'); // Sent locally by Crawler for max speed

        if (request.method === 'POST') {
            try { 
                const body = await request.json(); 
                handle = handle || body.handle || body.channel_id; 
            } catch {}
        }

        if (!handle) return Response.json({ error: 'Missing handle or channel_id' }, { status: 400 });

        // ── KV FAST CHECK ─────────────────────────────────────────────────────────
        const cacheKey = handle.toLowerCase().replace('@', '');
        const cached = await env.SHORT_RADAR_CACHE.get(cacheKey);
        if (cached) return Response.json({ status: 'ignored', reason: 'Already in cache', data: JSON.parse(cached) });

        try {
            // ── STEP 1: Resolve Channel ID (only if not already a UC-id) ─────────
            let channelId = handle.startsWith('UC') ? handle : null;
            if (!channelId) {
                const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
                    ...CTX, url: `https://www.youtube.com/@${handle.replace('@', '')}`
                });
                channelId = idRes?.endpoint?.browseEndpoint?.browseId;
                if (!channelId) return Response.json({ error: 'Channel not found' }, { status: 404 });
            }

            const id = channelId.substring(2);

            // ── STEP 2: FIRE ALL REQUESTS IN PARALLEL ────────────────────────────
            // We fire every single network call at the same time so total time ≈ slowest one
            const [shortsData, aboutData, exactLong, exactShorts, exactLive] = await Promise.all([
                fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: channelId, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D' }),
                fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: channelId, params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D' }),
                withTimeout(getPlaylistCount(`UULF${id}`), 2000),
                withTimeout(getPlaylistCount(`UUSH${id}`), 2000),
                withTimeout(getPlaylistCount(`UULV${id}`), 2000),
            ]);

            // ── STEP 3: Parse Shorts Tab ──────────────────────────────────────────
            const recentShorts = [];
            let oldestToken = null;

            function parseShortsTab(obj) {
                if (Array.isArray(obj)) { for (const i of obj) parseShortsTab(i); return; }
                if (!obj || typeof obj !== 'object') return;
                if (recentShorts.length < 5 && obj.shortsLockupViewModel?.entityId) {
                    const vid = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
                    const title = obj.shortsLockupViewModel.overlayMetadata?.primaryText?.content;
                    const viewsStr = obj.shortsLockupViewModel.overlayMetadata?.secondaryText?.content;
                    const thumb = obj.shortsLockupViewModel.thumbnail?.sources?.[0]?.url || obj.shortsLockupViewModel.thumbnailViewModel?.image?.sources?.[0]?.url || '';
                    if (vid && title) recentShorts.push({ video_id: vid, title, views: parseViews(viewsStr), thumbnail: thumb });
                }
                if (!oldestToken && obj.chipViewModel?.text === 'Oldest') {
                    try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch {}
                }
                for (const v of Object.values(obj)) parseShortsTab(v);
            }
            parseShortsTab(shortsData);

            // ── STEP 4: Get Oldest Short ID + Date ────────────────────────────────
            let firstShortDateRaw = crawlerFirstDate || null; // If crawler provided the exact date, bypass everything instantly!
            let firstShortId = null;

            if (!firstShortDateRaw) {
                if (oldestToken) {
                    const [oldestData, crawlerFallbackDate] = await Promise.all([
                        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, continuation: oldestToken }),
                        crawlerVideoId ? getPublishDateSafe(crawlerVideoId) : Promise.resolve(null)
                    ]);

                    function findFirstShort(obj) {
                        if (firstShortId) return;
                        if (Array.isArray(obj)) { for (const i of obj) findFirstShort(i); return; }
                        if (!obj || typeof obj !== 'object') return;
                        if (obj.shortsLockupViewModel?.entityId) { firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', ''); return; }
                        if (obj.videoId?.length === 11 && !obj.playlistId) { firstShortId = obj.videoId; return; }
                        for (const v of Object.values(obj)) findFirstShort(v);
                    }
                    findFirstShort(oldestData);

                    if (firstShortId) firstShortDateRaw = await getPublishDateSafe(firstShortId);
                    if (!firstShortDateRaw) firstShortDateRaw = crawlerFallbackDate;
                }

                if (!firstShortDateRaw && crawlerVideoId) firstShortDateRaw = await getPublishDateSafe(crawlerVideoId);
                
                // Fallback Date - if mathematical extraction fails, default to 2000-01-01 to cleanly fail out
                if (!firstShortDateRaw) firstShortDateRaw = "2000-01-01";
            }

            // ── STEP 5: Age Gate ─────────────────────────────────────────────────
            const firstShortDate = new Date(firstShortDateRaw);
            const channelAgeDays = Math.max(1, Math.floor((Date.now() - firstShortDate) / 86_400_000));

            if (firstShortDate < CUTOFF) {
                // Ignore old channels quietly to save db space
                // Caching them prevents repeated checks
                if (channelAgeDays > 500) await env.SHORT_RADAR_CACHE.put(cacheKey, JSON.stringify({ status: 'ignored', reason: 'Too Old' }), { expirationTtl: 2592000 });
                return Response.json({ status: 'ignored', reason: 'Too Old', firstShortDate: firstShortDateRaw.split('T')[0], channelAgeDays });
            }

            // ── STEP 6: Extract Channel Metadata ─────────────────────────────────
            let channelName = 'Unknown', avatarUrl = '', description = '', subscribers = 0, subscribersText = 'Unknown', location = 'Unknown', language = 'Unknown', totalViews = 0;

            function extractHeader(obj) {
                if (Array.isArray(obj)) { for (const i of obj) extractHeader(i); return; }
                if (!obj || typeof obj !== 'object') return;
                if (!channelName || channelName === 'Unknown' || channelName === 'Home') {
                    if (obj.channelMetadataRenderer?.title) channelName = obj.channelMetadataRenderer.title;
                    else if (obj.microformatDataRenderer?.pageTitle) channelName = obj.microformatDataRenderer.pageTitle.replace(' - YouTube', '');
                }
                if (!description && obj.description && typeof obj.description === 'string' && obj.description.length > 3) description = obj.description;
                if (!avatarUrl && obj.avatar?.thumbnails?.[0]?.url) avatarUrl = obj.avatar.thumbnails[0].url;
                if (subscribers === 0) {
                    const st = obj.subscriberCountText?.simpleText;
                    if (st) { subscribersText = st; subscribers = parseViews(st); }
                    const ct = typeof obj.content === 'string' && /^\d[\d.,KMB]*\s+(subscribers|abonn[eé]s)$/i.test(obj.content) ? obj.content : null;
                    if (ct && subscribers === 0) { subscribersText = ct; subscribers = parseViews(ct); }
                }
                if (totalViews === 0 && obj.viewCountText && typeof obj.viewCountText === 'string') totalViews = parseInt(obj.viewCountText.replace(/[^0-9]/g, ''), 10) || 0;
                if (obj.country && typeof obj.country === 'string') location = obj.country;
                if (location === 'Unknown' && obj.countryCode && typeof obj.countryCode === 'string') location = obj.countryCode;
                if (language === 'Unknown') {
                    if (obj.defaultAudioLanguage && typeof obj.defaultAudioLanguage === 'string') language = obj.defaultAudioLanguage;
                    else if (obj.defaultLanguage && typeof obj.defaultLanguage === 'string') language = obj.defaultLanguage;
                    else if (obj.languageCode && typeof obj.languageCode === 'string') language = obj.languageCode;
                }
                for (const v of Object.values(obj)) extractHeader(v);
            }
            extractHeader(aboutData);

            // ── STEP 7: Build Payload ─────────────────────────────────────────────
            const exactTotalSum = exactLong + exactShorts + exactLive;
            const avgViews = recentShorts.length ? Math.floor(recentShorts.reduce((s, v) => s + v.views, 0) / recentShorts.length) : 0;
            const viewsToSub = subscribers > 0 ? (avgViews / subscribers).toFixed(2) : 0;
            const growthScore = channelAgeDays > 0 ? (avgViews / channelAgeDays).toFixed(2) : avgViews;

            const payload = {
                channel: {
                    channel_id: channelId,
                    handle: handle.startsWith('@') ? handle : '@' + handle,
                    channel_name: channelName,
                    description: description.substring(0, 500),
                    avatar_url: avatarUrl,
                    channel_url: `https://youtube.com/@${handle.replace('@', '')}`,
                    location,
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
                    channel_age_weeks: parseFloat((channelAgeDays / 7).toFixed(1)),
                    channel_age_months: parseFloat((channelAgeDays / 30.44).toFixed(1)),
                    channel_age_years: parseFloat((channelAgeDays / 365.25).toFixed(2)),
                    average_views_last5: avgViews,
                    views_to_sub_ratio: parseFloat(viewsToSub),
                    growth_score: parseFloat(growthScore)
                },
                shorts: recentShorts.map(s => ({
                    video_id: s.video_id, title: s.title, thumbnail: s.thumbnail, views: s.views,
                    video_url: `https://www.youtube.com/shorts/${s.video_id}`,
                    embed_url: `https://www.youtube.com/embed/${s.video_id}`
                }))
            };

            // ── STEP 8: Cache + DB ────────────────────────────────────────────────
            ctx.waitUntil((async () => {
                await env.SHORT_RADAR_CACHE.put(cacheKey, JSON.stringify({ status: 'stored', payload }), { expirationTtl: 86400 });

                if (env.DATABASE_URL) {
                    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
                    try {
                        await client.connect();
                        const c = payload.channel;
                        await client.query(`
                            UPSERT INTO channels (channel_id, handle, channel_name, description, avatar_url, channel_url,
                                subscribers, total_videos, is_monetized, first_short_date, channel_age_days,
                                average_views_last5, views_to_sub_ratio, growth_score)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                        `, [c.channel_id, c.handle, c.channel_name, c.description, c.avatar_url, c.channel_url,
                            c.subscribers, c.total_videos, c.is_monetized, c.first_short_date, c.channel_age_days,
                            c.average_views_last5, c.views_to_sub_ratio, c.growth_score]);
                        for (const s of payload.shorts) {
                            await client.query(`UPSERT INTO shorts (video_id, channel_id, title, thumbnail, views, video_url) VALUES ($1,$2,$3,$4,$5,$6)`,
                                [s.video_id, c.channel_id, s.title, s.thumbnail, s.views, s.video_url]);
                        }
                        await client.end();
                    } catch (dbErr) {
                        // Don't fail the request for DB errors - data is already cached in KV
                        console.error('DB error:', dbErr.message);
                    }
                }
            })());

            return Response.json({ status: 'success', data: payload });

        } catch (err) {
            return Response.json({ error: err.message }, { status: 500 });
        }
    }
};
