import { Client } from 'pg';

const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';
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

export default {
    async scheduled(event, env, ctx) {
        if (!env.DATABASE_URL) return;

        const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();

            // 1. Fetch the 50 oldest updated channels
            const { rows } = await client.query('SELECT channel_id, channel_age_days FROM channels ORDER BY scraped_at ASC LIMIT 50');
            if (!rows.length) { await client.end(); return; }

            // 2. Refresh each channel concurrently
            await Promise.all(rows.map(async (row) => {
                const channelId = row.channel_id;

                try {
                    const [aboutData, shortsData] = await Promise.all([
                        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: channelId, params: 'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D' }),
                        fetchJson(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, { ...CTX, browseId: channelId, params: 'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D' })
                    ]);

                    // Extract Subscribers
                    let subscribers = 0;
                    let totalViews = 0;
                    function extractHeader(obj) {
                        if (Array.isArray(obj)) { for (const i of obj) extractHeader(i); return; }
                        if (!obj || typeof obj !== 'object') return;
                        if (subscribers === 0) {
                            const st = obj.subscriberCountText?.simpleText;
                            if (st) subscribers = parseViews(st);
                            const ct = typeof obj.content === 'string' && /^\d[\d.,KMB]*\s+(subscribers|abonn[eé]s)$/i.test(obj.content) ? obj.content : null;
                            if (ct && subscribers === 0) subscribers = parseViews(ct);
                        }
                        if (totalViews === 0 && obj.viewCountText && typeof obj.viewCountText === 'string') totalViews = parseInt(obj.viewCountText.replace(/[^0-9]/g, ''), 10) || 0;
                        for (const v of Object.values(obj)) extractHeader(v);
                    }
                    extractHeader(aboutData);

                    // Extract Recent Shorts Views
                    const recentShorts = [];
                    function parseShortsTab(obj) {
                        if (Array.isArray(obj)) { for (const i of obj) parseShortsTab(i); return; }
                        if (!obj || typeof obj !== 'object') return;
                        if (recentShorts.length < 5 && obj.shortsLockupViewModel?.entityId) {
                            const viewsStr = obj.shortsLockupViewModel.overlayMetadata?.secondaryText?.content;
                            if (viewsStr) recentShorts.push({ views: parseViews(viewsStr) });
                        }
                        for (const v of Object.values(obj)) parseShortsTab(v);
                    }
                    parseShortsTab(shortsData);

                    // Recompute Metrics
                    const avgViews = recentShorts.length ? Math.floor(recentShorts.reduce((s, v) => s + v.views, 0) / recentShorts.length) : 0;
                    const viewsToSub = subscribers > 0 ? (avgViews / subscribers).toFixed(2) : 0;
                    const growthScore = row.channel_age_days > 0 ? (avgViews / row.channel_age_days).toFixed(2) : avgViews;
                    const isMonetized = subscribers >= 1000 && avgViews > 10000;

                    if (subscribers > 0) {
                        await client.query(`
                            UPDATE channels 
                            SET subscribers = $1, total_views = $2, average_views_last5 = $3, 
                                views_to_sub_ratio = $4, growth_score = $5, is_monetized = $6, scraped_at = NOW()
                            WHERE channel_id = $7
                        `, [subscribers, totalViews, avgViews, viewsToSub, growthScore, isMonetized, channelId]);
                    } else {
                        // Mark as scraped even if extraction failed to prevent infinite retry loops on dead channels
                        await client.query(`UPDATE channels SET scraped_at = NOW() WHERE channel_id = $1`, [channelId]);
                    }

                } catch (e) {
                    console.error('Update failed for', channelId, e.message);
                }
            }));

            await client.end();
        } catch (dbErr) {
            console.error('DB Sync Error:', dbErr.message);
        }
    }
};
