import { Client } from 'pg';
import { POLICY, REASON, passesFirstShortAge } from '../../lib/crawl-policy.mjs';

const API_KEY        = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
const CTX            = { context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } } };

// ── Max golden seeds stored in KV
const MAX_GOLDEN_SEEDS = 500;

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

// Uses /next endpoint (works from Cloudflare IPs) to get publishDate
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
                if ((k === 'publishDate' || k === 'dateText') && v && v.simpleText) { foundDate = v.simpleText; return; }
                if (v && typeof v === 'object') findDateObj(v);
            }
        }
        findDateObj(data);
        if (foundDate) {
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
    return subscribers >= 1000 && avgViews > POLICY.MIN_AVG_VIEWS;
}

// ── Append video_id to golden seeds in KV ────────────────────
async function appendGoldenSeed(env, videoId) {
    if (!videoId) return;
    try {
        const raw   = await env.SHORT_RADAR_CACHE.get('GOLDEN_SEEDS');
        const seeds = raw ? JSON.parse(raw) : [];
        if (!seeds.includes(videoId)) {
            seeds.push(videoId);
            if (seeds.length > MAX_GOLDEN_SEEDS) seeds.shift();
            await env.SHORT_RADAR_CACHE.put('GOLDEN_SEEDS', JSON.stringify(seeds));
        }
    } catch (_) {}
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // ── GET /seeds — Return golden seeds for the multiplier engine ──
        if (request.method === 'GET' && url.pathname === '/seeds') {
            const raw = await env.SHORT_RADAR_CACHE.get('GOLDEN_SEEDS');
            return Response.json(raw ? JSON.parse(raw) : []);
        }

        if (request.method !== 'POST' && request.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        let handle = url.searchParams.get('handle') || url.searchParams.get('channel_id');
        const crawlerVideoId    = url.searchParams.get('video_id');
        const crawlerFirstDate  = url.searchParams.get('first_short_date');

        if (request.method === 'POST') {
            try {
                const body = await request.json();
                handle = handle || body.handle || body.channel_id;
            } catch {}
        }

        // ── Resolve channel_id from video_id when crawler can't extract it ──
        if (!handle && crawlerVideoId) {
            try {
                const playerRes = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
                    ...CTX, videoId: crawlerVideoId
                });
                handle = playerRes?.videoDetails?.channelId || null;
            } catch {}
        }

        if (!handle) return Response.json({ error: 'Missing handle or channel_id' }, { status: 400 });

        // ── KV FAST CHECK ──────────────────────────────────────────────
        const cacheKey = handle.toLowerCase().replace('@', '');
        const cached   = await env.SHORT_RADAR_CACHE.get(cacheKey);
        if (cached) return Response.json({ status: 'ignored', reason: 'Already in cache', data: JSON.parse(cached) });

        try {
            // ── STEP 1: Resolve channel ID ─────────────────────────────
            let channelId = handle.startsWith('UC') ? handle : null;
            if (!channelId) {
                const idRes = await fetchJson(`https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${API_KEY}`, {
                    ...CTX, url: `https://www.youtube.com/@${handle.replace('@', '')}`
                });
                channelId = idRes?.endpoint?.browseEndpoint?.browseId;
                if (!channelId) return Response.json({ error: 'Channel not found' }, { status: 404 });
            }

            const id = channelId.substring(2);

            // ── STEP 2: Fetch all channel data in parallel ──────────────
            const [shortsData, aboutData, exactLong, exactShorts, exactLive] = await Promise.all([
                fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: channelId, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D' }),
                fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: channelId, params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D' }),
                withTimeout(getPlaylistCount(`UULF${id}`), 2000),
                withTimeout(getPlaylistCount(`UUSH${id}`), 2000),
                withTimeout(getPlaylistCount(`UULV${id}`), 2000),
            ]);

            // ── STEP 3: Parse Shorts Tab ────────────────────────────────
            const recentShorts = [];
            let oldestToken = null;

            function parseShortsTab(obj) {
                if (Array.isArray(obj)) { for (const i of obj) parseShortsTab(i); return; }
                if (!obj || typeof obj !== 'object') return;
                if (recentShorts.length < 5 && obj.shortsLockupViewModel?.entityId) {
                    const vid      = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
                    const title    = obj.shortsLockupViewModel.overlayMetadata?.primaryText?.content;
                    const viewsStr = obj.shortsLockupViewModel.overlayMetadata?.secondaryText?.content;
                    const thumb    = obj.shortsLockupViewModel.thumbnail?.sources?.[0]?.url || obj.shortsLockupViewModel.thumbnailViewModel?.image?.sources?.[0]?.url || '';
                    if (vid && title) recentShorts.push({ video_id: vid, title, views: parseViews(viewsStr), thumbnail: thumb });
                }
                if (!oldestToken && obj.chipViewModel?.text === 'Oldest') {
                    try { oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token; } catch {}
                }
                for (const v of Object.values(obj)) parseShortsTab(v);
            }
            parseShortsTab(shortsData);

            // ── STEP 4: Compute avg views ───────────────────────────────
            const avgViews = recentShorts.length
                ? Math.floor(recentShorts.reduce((s, v) => s + v.views, 0) / recentShorts.length)
                : 0;

            // ── Extract subscriber count ────────────────────────────────
            let subscribers = 0, subscribersText = 'Unknown';
            function extractSubs(obj) {
                if (subscribers > 0) return;
                if (Array.isArray(obj)) { for (const i of obj) extractSubs(i); return; }
                if (!obj || typeof obj !== 'object') return;
                const st = obj.subscriberCountText?.simpleText;
                if (st) { subscribersText = st; subscribers = parseViews(st); return; }
                for (const v of Object.values(obj)) extractSubs(v);
            }
            extractSubs(aboutData);

            // ══════════════════════════════════════════════════════════
            // 4 STRICT GATES — ordered cheapest-first
            // ══════════════════════════════════════════════════════════

            // Gate 1: Sub cap (free — already fetched)
            if (subscribers > POLICY.MAX_SUBS) {
                console.log(`[GATE 1 REJECT] @${handle} | Subs: ${subscribers} > ${POLICY.MAX_SUBS}`);
                await env.SHORT_RADAR_CACHE.put(cacheKey, JSON.stringify({ status: 'ignored', reason: 'Too many subs' }), { expirationTtl: 2592000 });
                return Response.json({ status: 'rejected', reason: `Sub cap: ${subscribers.toLocaleString()}`, reason_code: REASON.SUBS_OVER_LIMIT });
            }

            // Gate 2: Shorts-only (free — already fetched)
            if (exactLong > POLICY.MAX_LONG || exactLive > POLICY.MAX_LIVE) {
                console.log(`[GATE 2 REJECT] @${handle} | Long: ${exactLong}, Live: ${exactLive}`);
                await env.SHORT_RADAR_CACHE.put(cacheKey, JSON.stringify({ status: 'ignored', reason: 'Has long/live videos' }), { expirationTtl: 2592000 });
                return Response.json({ status: 'rejected', reason: `Has ${exactLong} long + ${exactLive} live videos`, reason_code: REASON.HAS_LONG_OR_LIVE });
            }

            if (exactShorts < POLICY.MIN_SHORTS) {
                console.log(`[GATE 2.1 REJECT] @${handle} | Shorts: ${exactShorts} < ${POLICY.MIN_SHORTS}`);
                return Response.json({ status: 'rejected', reason: 'Too few shorts', reason_code: REASON.TOO_FEW_SHORTS });
            }

            // Gate 4: Traction (free — already computed) — checked BEFORE gate 3 to skip expensive date call
            if (avgViews < POLICY.MIN_AVG_VIEWS) {
                console.log(`[GATE 4 REJECT] @${handle} | Avg Views: ${avgViews} < ${POLICY.MIN_AVG_VIEWS}`);
                // Don't cache — channel might grow later
                return Response.json({ status: 'rejected', reason: `Low traction: ${avgViews.toLocaleString()} avg views`, reason_code: REASON.LOW_TRACTION });
            }

            // Gate 3: Age gate — MOST EXPENSIVE (1 API call), do last
            let firstShortDateRaw = crawlerFirstDate || null;
            let firstShortId      = null;

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
            }

            if (!firstShortDateRaw) {
                console.log(`[GATE 3 REJECT] @${handle} | first_short_date unknown`);
                return Response.json({ status: 'rejected', reason: 'first_short_date unknown', reason_code: REASON.DATE_UNKNOWN });
            }

            const ageCheck = passesFirstShortAge(firstShortDateRaw);
            if (!ageCheck.ok) {
                console.log(`[GATE 3 REJECT] @${handle} | Date: ${firstShortDateRaw} | ${ageCheck.reason}`);
                if (ageCheck.reason === REASON.FIRST_SHORT_TOO_OLD) {
                    await env.SHORT_RADAR_CACHE.put(cacheKey, JSON.stringify({ status: 'ignored', reason: 'Too Old' }), { expirationTtl: 2592000 });
                }
                return Response.json({
                    status: 'rejected',
                    reason: ageCheck.reason === REASON.FIRST_SHORT_TOO_OLD ? `Too old: first short ${firstShortDateRaw}` : 'first_short_date unknown',
                    reason_code: ageCheck.reason,
                });
            }

            const firstShortDate = new Date(firstShortDateRaw);
            const channelAgeDays = Math.max(1, Math.floor((Date.now() - firstShortDate) / 86_400_000));
            
            console.log(`[🎯 GATE PASSED!] @${handle} | Subs: ${subscribers} | Avg Views: ${avgViews} | Age: ${channelAgeDays} days`);

            // ══════════════════════════════════════════════════════════
            // ALL GATES PASSED — extract metadata and save
            // ══════════════════════════════════════════════════════════

            let channelName = 'Unknown', avatarUrl = '', description = '', location = 'Unknown', language = 'Unknown', totalViews = 0;

            function extractHeader(obj) {
                if (Array.isArray(obj)) { for (const i of obj) extractHeader(i); return; }
                if (!obj || typeof obj !== 'object') return;
                if (!channelName || channelName === 'Unknown' || channelName === 'Home') {
                    if (obj.channelMetadataRenderer?.title) channelName = obj.channelMetadataRenderer.title;
                    else if (obj.microformatDataRenderer?.pageTitle) channelName = obj.microformatDataRenderer.pageTitle.replace(' - YouTube', '');
                }
                if (!description && obj.description && typeof obj.description === 'string' && obj.description.length > 3) description = obj.description;
                if (!avatarUrl && obj.avatar?.thumbnails?.[0]?.url) avatarUrl = obj.avatar.thumbnails[0].url;
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

            const exactTotalSum = exactLong + exactShorts + exactLive;
            const viewsToSub    = subscribers > 0 ? (avgViews / subscribers).toFixed(2) : 0;
            const growthScore   = channelAgeDays > 0 ? (avgViews / channelAgeDays).toFixed(2) : avgViews;

            const payload = {
                channel: {
                    channel_id:             channelId,
                    handle:                 handle.startsWith('@') ? handle : '@' + handle,
                    channel_name:           channelName,
                    description:            description.substring(0, 500),
                    avatar_url:             avatarUrl,
                    channel_url:            `https://youtube.com/@${handle.replace('@', '')}`,
                    location,
                    language,
                    subscribers,
                    subscribers_text:       subscribersText,
                    total_views:            totalViews,
                    total_videos:           exactTotalSum,
                    videos_shorts:          exactShorts,
                    videos_long:            exactLong,
                    videos_live:            exactLive,
                    is_monetized:           isLikelyMonetized(subscribers, avgViews),
                    first_short_date:       firstShortDateRaw.split('T')[0],
                    channel_age_days:       channelAgeDays,
                    channel_age_weeks:      parseFloat((channelAgeDays / 7).toFixed(1)),
                    channel_age_months:     parseFloat((channelAgeDays / 30.44).toFixed(1)),
                    channel_age_years:      parseFloat((channelAgeDays / 365.25).toFixed(2)),
                    average_views_last5:    avgViews,
                    views_to_sub_ratio:     parseFloat(viewsToSub),
                    growth_score:           parseFloat(growthScore)
                },
                shorts: recentShorts.map(s => ({
                    video_id:   s.video_id, title: s.title, thumbnail: s.thumbnail, views: s.views,
                    video_url:  `https://www.youtube.com/shorts/${s.video_id}`,
                    embed_url:  `https://www.youtube.com/embed/${s.video_id}`
                }))
            };

            // Save to KV + DB + golden seeds
            ctx.waitUntil((async () => {
                await env.SHORT_RADAR_CACHE.put(cacheKey, JSON.stringify({ status: 'stored', payload }), { expirationTtl: 86400 });

                // Add this channel's video to golden seeds for the multiplier engine
                if (crawlerVideoId) await appendGoldenSeed(env, crawlerVideoId);

                if (env.DATABASE_URL) {
                    const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
                    try {
                        await client.connect();
                        const c = payload.channel;
                        await client.query(`
                            UPSERT INTO channels (channel_id, handle, channel_name, description, avatar_url, channel_url,
                                subscribers, total_videos, is_monetized, first_short_date, channel_age_days,
                                average_views_last5, views_to_sub_ratio, growth_score, videos_shorts, videos_long)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                        `, [c.channel_id, c.handle, c.channel_name, c.description, c.avatar_url, c.channel_url,
                            c.subscribers, c.total_videos, c.is_monetized, c.first_short_date, c.channel_age_days,
                            c.average_views_last5, c.views_to_sub_ratio, c.growth_score, c.videos_shorts, c.videos_long]);
                        for (const s of payload.shorts) {
                            await client.query(
                                `UPSERT INTO shorts (video_id, channel_id, title, thumbnail, views, video_url) VALUES ($1,$2,$3,$4,$5,$6)`,
                                [s.video_id, c.channel_id, s.title, s.thumbnail, s.views, s.video_url]
                            );
                        }
                        await client.end();
                    } catch (dbErr) {
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
