import pkg from 'pg';
const { Pool } = pkg;

// ================================================================
// SHORTRADAR V6.3 — FINAL PRODUCTION ENGINE
// ✅ Zero Cloudflare | ✅ Direct CockroachDB | ✅ MWEB /next only
// ✅ channelId from /next (no blocked /player call)
// ✅ Verbose per-gate logs | ✅ Bounded concurrency
// ================================================================

const DATABASE_URL = 'postgresql://muataz:0L27YGOK_Eircx-52BD2Ig@shortradar-db-13409.jxf.gcp-europe-west3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';
const pool = new Pool({ connectionString: DATABASE_URL, max: 10, ssl: { rejectUnauthorized: false } });

const API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

// ── Gates ─────────────────────────────────────────────────────
const CUTOFF   = new Date('2025-12-01');
const MAX_SUBS = 100_000;
const MIN_AVG  = 10_000;
const THREADS  = 20;

// ── Seeds — Dynamically loaded from Database ─────────────────
const seeds = [];

// ── Stats ─────────────────────────────────────────────────────
let crawled=0, processed=0, inserted=0;
const gates = { noChannel:0, dupChannel:0, subs:0, longLive:0, fewShorts:0, traction:0, tooOld:0, noDate:0, dbErr:0 };
const seenVid = new Set();
const seenCh  = new Set();
const t0 = Date.now();
const GL = ["US","GB","FR"];

setInterval(() => {
  const m = ((Date.now()-t0)/60000).toFixed(1);
  const r = Math.round(crawled/Math.max(1,(Date.now()-t0)/60000));
  const dropped = Object.values(gates).reduce((a,b)=>a+b,0);
  console.log(`\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
  console.log(`⏱ ${m}min | 🔎 ${crawled.toLocaleString()} crawled | ✅ ${processed} checked | 💚 ${inserted} inserted | 📈 ${r}/min`);
  console.log(`🚫 Drops → noChId:${gates.noChannel} | dupCh:${gates.dupChannel} | subs:${gates.subs} | long/live:${gates.longLive} | fewShorts:${gates.fewShorts} | lowViews:${gates.traction} | tooOld:${gates.tooOld} | noDate:${gates.noDate} | db:${gates.dbErr}`);
  console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`);
}, 30000);

// ── Helpers ───────────────────────────────────────────────────
const pick  = a => a[Math.floor(Math.random()*a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pv    = s => {
  if (!s) return 0;
  const u = s.toUpperCase().replace(/VIEWS|SUBSCRIBERS/g,'').trim();
  if (u.includes('K')) return Math.round(parseFloat(u)*1e3);
  if (u.includes('M')) return Math.round(parseFloat(u)*1e6);
  if (u.includes('B')) return Math.round(parseFloat(u)*1e9);
  return parseInt(u.replace(/,/g,''),10)||0;
};

// ── Pure Random Anonymous Scraper (Incognito Simulation) ──────
// Hits the homepage with zero cookies to force YouTube to build a
// 100% fresh, random 'Shorts Shelf'. Rips the IDs directly from HTML.
async function getHomepageSeeds() {
  const gl = pick(["US", "GB", "FR", "CA", "AU"]);
  try {
    const res = await fetch(`https://www.youtube.com/?gl=${gl}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    const html = await res.text();
    // ytInitialData contains the "Shorts shelf" for anonymous users
    const match = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/);
    if (!match) return [];
    
    // We only care about Shorts, they have their own shelf renderer
    const ids = [];
    const re = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"|shorts\/([a-zA-Z0-9_-]{11})/g;
    let m;
    while ((m = re.exec(match[1])) !== null) {
      if (m[1]) ids.push(m[1]);
      if (m[2]) ids.push(m[2]);
    }
    return [...new Set(ids)];
  } catch(e) {
    return [];
  }
}

// Single YT poster — MWEB client (confirmed working from Codespace)
async function ytMweb(endpoint, body) {
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36' },
      body: JSON.stringify({ context:{client:{clientName:"MWEB",clientVersion:"2.20231207.01.00",hl:"en",gl:"US"}}, ...body })
    });
    if (!r.ok) { console.error(`  [HTTP ${r.status}] ${endpoint}`); return null; }
    return await r.json();
  } catch(e) { console.error(`  [FETCH ERR] ${endpoint}: ${e.message}`); return null; }
}

// WEB client for channel browse (confirmed working from Codespace)
async function ytWeb(endpoint, body) {
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      body: JSON.stringify({ context:{client:{clientName:"WEB",clientVersion:"2.20240314.07.00",hl:"en",gl:"US"}}, ...body })
    });
    if (!r.ok) { console.error(`  [HTTP ${r.status}] ${endpoint}`); return null; }
    return await r.json();
  } catch(e) { console.error(`  [FETCH ERR] ${endpoint}: ${e.message}`); return null; }
}

// Extract ALL video IDs from a raw YT response
function grabIds(data) {
  if (!data) return [];
  const s = JSON.stringify(data);
  const r = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
  const out = new Set(); let m;
  while ((m = r.exec(s)) !== null) out.add(m[1]);
  return [...out];
}

// Extract channelId from /next response — the INPUT video's channel
// appears near the start of the JSON as "channelId":"UC..." 
function grabChannelId(nextResponseStr) {
  const m = nextResponseStr.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
  return m ? m[1] : null;
}

// ── The Ghost Filter ──────────────────────────────────────────
async function processOne(vid) {
  if (seenVid.has(vid)) return;
  seenVid.add(vid);

  // === Step 1: Get channelId from /next (MWEB, no /player needed) ===
  const nextData = await ytMweb('next', { videoId: vid });
  if (!nextData) { gates.noChannel++; return; }

  const nextStr = JSON.stringify(nextData);
  const chId = grabChannelId(nextStr);
  if (!chId) { gates.noChannel++; return; }
  if (seenCh.has(chId)) { gates.dupChannel++; return; }
  seenCh.add(chId);
  processed++;

  // Extract publishDate of THIS video from the /next response (free!)
  let thisVideoDate = null;
  const dm = nextStr.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  if (dm) thisVideoDate = dm[1];

  const id = chId.substring(2);
  console.log(`\x1b[90m  [🔍 Checking] ${chId} | vid: ${vid}\x1b[0m`);

  // === Step 2: Fetch channel data in parallel ===
  async function plCount(plId) {
    const d = await ytWeb('browse', { browseId:`VL${plId}` });
    if (!d) return 0;
    const t = JSON.stringify(d);
    const m = t.match(/"numVideosText".*?"([0-9,]+)"/);
    if (m) return parseInt(m[1].replace(/,/g,''),10)||0;
    return 0;
  }

  const [shorts, about, nLong, nLive] = await Promise.all([
    ytWeb('browse', { browseId:chId, params:'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D' }),
    ytWeb('browse', { browseId:chId, params:'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D' }),
    Promise.race([plCount(`UULF${id}`), sleep(3000).then(()=>0)]),
    Promise.race([plCount(`UULV${id}`), sleep(3000).then(()=>0)]),
  ]);

  // Extract metadata
  let subs=0, subsTxt='?', chName='?', avatar='', desc='';
  function dig(o) {
    if (Array.isArray(o)){for(const i of o) dig(i); return;}
    if (!o||typeof o!=='object') return;
    if (o.channelMetadataRenderer?.title && chName==='?') chName=o.channelMetadataRenderer.title;
    if (!desc && typeof o.description==='string' && o.description.length>3) desc=o.description;
    if (!avatar && o.avatar?.thumbnails?.[0]?.url) avatar=o.avatar.thumbnails[0].url;
    if (subs===0 && o.subscriberCountText?.simpleText) { subsTxt=o.subscriberCountText.simpleText; subs=pv(subsTxt); }
    for (const v of Object.values(o)) dig(v);
  }
  dig(about); dig(shorts);

  // === GATE 1: Sub cap ===
  if (subs > MAX_SUBS) {
    console.log(`  \x1b[31m[G1 SUBS] ${chName} → ${subsTxt} > 100k\x1b[0m`);
    gates.subs++; return;
  }

  // === GATE 2: Shorts-only ===
  if (nLong > 0 || nLive > 0) {
    console.log(`  \x1b[31m[G2 LONG] ${chName} → long:${nLong} live:${nLive}\x1b[0m`);
    gates.longLive++; return;
  }

  // Parse recent Shorts for traction
  const rs = []; let oldTok = null;
  function ps(o) {
    if (Array.isArray(o)){for(const i of o) ps(i); return;}
    if (!o||typeof o!=='object') return;
    if (rs.length<5 && o.shortsLockupViewModel?.entityId) {
      const v=o.shortsLockupViewModel.entityId.replace('shorts-shelf-item-','');
      const t=o.shortsLockupViewModel.overlayMetadata?.primaryText?.content;
      const vw=o.shortsLockupViewModel.overlayMetadata?.secondaryText?.content;
      const th=o.shortsLockupViewModel.thumbnail?.sources?.[0]?.url||'';
      if (v&&t) rs.push({video_id:v,title:t,views:pv(vw),thumbnail:th});
    }
    if (!oldTok && o.chipViewModel?.text==='Oldest')
      try{oldTok=o.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token;}catch{}
    for (const v of Object.values(o)) ps(v);
  }
  ps(shorts);

  if (rs.length < 3) {
    console.log(`  \x1b[31m[G2.1 FEW] ${chName} → only ${rs.length} shorts visible\x1b[0m`);
    gates.fewShorts++; return;
  }

  const avg = Math.floor(rs.reduce((s,v)=>s+v.views,0)/rs.length);

  // === GATE 4: Traction ===
  if (avg < MIN_AVG) {
    console.log(`  \x1b[31m[G4 LOW] ${chName} → ${avg.toLocaleString()} avg views\x1b[0m`);
    gates.traction++; return;
  }

  // === GATE 3: Age (most expensive — last) ===
  let firstDate = null;

  async function getPubDate(vId) {
    const d = await ytMweb('next', { videoId:vId });
    if (!d) return null;
    const s = JSON.stringify(d);
    const m = s.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
    if (m) return m[1];
    const m2 = s.match(/"dateText"\s*:\s*\{"simpleText"\s*:\s*"([^"]+)"/);
    if (m2) { const dt=new Date(m2[1]); if(!isNaN(dt.getTime())) return dt.toISOString().split('T')[0]; }
    return null;
  }

  if (oldTok) {
    const od = await ytWeb('browse', { continuation:oldTok });
    let fId = null;
    function ff(o){if(fId)return;if(Array.isArray(o)){for(const i of o)ff(i);return;}if(!o||typeof o!=='object')return;if(o.shortsLockupViewModel?.entityId){fId=o.shortsLockupViewModel.entityId.replace('shorts-shelf-item-','');return;}if(o.videoId?.length===11&&!o.playlistId){fId=o.videoId;return;}for(const v of Object.values(o))ff(v);}
    ff(od);
    if (fId) firstDate = await getPubDate(fId);
  }
  if (!firstDate) firstDate = thisVideoDate || await getPubDate(vid);
  if (!firstDate) { gates.noDate++; console.log(`  \x1b[31m[G3 NODATE] ${chName}\x1b[0m`); return; }

  if (new Date(firstDate) < CUTOFF) {
    console.log(`  \x1b[31m[G3 OLD] ${chName} → first short: ${firstDate}\x1b[0m`);
    gates.tooOld++; return;
  }

  const ageDays = Math.max(1, Math.floor((Date.now()-new Date(firstDate))/86400000));

  // ═══ ALL GATES PASSED → DB INSERT ═══
  const cl = await pool.connect();
  try {
    await cl.query(`UPSERT INTO channels (channel_id,handle,channel_name,description,avatar_url,channel_url,subscribers,total_videos,is_monetized,first_short_date,channel_age_days,average_views_last5,views_to_sub_ratio,growth_score,videos_shorts,videos_long) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [chId,'@'+chName,chName,desc.substring(0,500),avatar,`https://youtube.com/channel/${chId}`,subs,rs.length,subs>=1000&&avg>10000,firstDate,ageDays,avg,subs>0?+(avg/subs).toFixed(2):0,+(avg/ageDays).toFixed(2),rs.length,nLong]);

    for (const s of rs)
      await cl.query(`UPSERT INTO shorts (video_id,channel_id,title,thumbnail,views,video_url) VALUES ($1,$2,$3,$4,$5,$6)`,
        [s.video_id,chId,s.title,s.thumbnail,s.views,`https://www.youtube.com/shorts/${s.video_id}`]);

    inserted++;
    console.log(`\x1b[42m\x1b[1m 💚 INSERTED \x1b[0m ${chName} | @${chId} | ${subs.toLocaleString()} subs | ${avg.toLocaleString()} avg | ${ageDays}d old | ${firstDate}`);

    // Add to Golden Seeds for exploration
    if (!seeds.includes(vid)) { seeds.push(vid); if (seeds.length>500) seeds.shift(); }
  } catch(e) {
    console.error(`  \x1b[31m[DB ERR] ${chName}: ${e.message}\x1b[0m`);
    gates.dbErr++;
  } finally { cl.release(); }
}

// ═══════════════════════════════════════════════════════════════
// THREADS — Random walk via /next (the ONLY working endpoint)
// Each thread: seed → /next → 60 vids → process 3 → new seed
// ═══════════════════════════════════════════════════════════════
async function thread(id) {
  const gl = GL[id % GL.length];
  console.log(`\x1b[32m[🟢 Thread #${id}]\x1b[0m Online. Country: ${gl}`);

  let seed = pick(seeds);

  while (true) {
    try {
      if (!seed) {
        // If we somehow run out of seeds, scrape a fresh batch from the homepage
        const fresh = await getHomepageSeeds();
        if (fresh.length > 0) fresh.forEach(f => { if(!seeds.includes(f)) seeds.push(f); });
        seed = pick(seeds) || "kZyTCtV_bqY"; // Fallback if entirely broken
      }

      const data = await ytMweb('next', { videoId:seed, params:"8gEAmgMDCNkI", context:{client:{clientName:"MWEB",clientVersion:"2.20231207.01.00",hl:"en",gl}} });
      const ids = grabIds(data);

      if (ids.length === 0) {
        seed = pick(seeds);
        await sleep(2000);
        continue;
      }

      crawled += ids.length;

      // Process 3 random videos sequentially (bounded concurrency)
      const picks = ids.sort(()=>Math.random()-.5).slice(0,3);
      for (const v of picks) await processOne(v);

      // Random walk: pick a new seed from results
      seed = pick(ids);
      await sleep(200 + Math.random()*300);
    } catch(e) {
      console.error(`\x1b[31m[Thread #${id}] ${e.message}\x1b[0m`);
      seed = pick(seeds);
      await sleep(5000);
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  process.on("uncaughtException", e => console.error("UNCAUGHT:", e.message));
  process.on("unhandledRejection", e => console.error("UNHANDLED:", e?.message || e));

  console.log(`\n\x1b[35m╔══════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[35m║   🚀 SHORTRADAR V6.4 — PURE RANDOM ENGINE       ║\x1b[0m`);
  console.log(`\x1b[35m║   ${THREADS} threads | Incognito Scraper | Direct DB ║\x1b[0m`);
  console.log(`\x1b[35m╚══════════════════════════════════════════════════╝\x1b[0m\n`);

  console.log(`[🔑] Gates: <100k subs | 0 long vids | >Dec 2025 | >10k avg views`);

  try {
    const c = await pool.connect();
    c.release();
    console.log(`[🔌] CockroachDB: Connected ✅`);
  } catch(e) { console.error(`[❌] DB ERROR:`, e.message); process.exit(1); }

  console.log(`[🌱] Scraping anonymous YouTube homepage for pure random seeds...`);
  // Try up to 3 times to get a thick starting batch
  for (let i = 0; i < 3; i++) {
    const fresh = await getHomepageSeeds();
    fresh.forEach(f => { if(!seeds.includes(f)) seeds.push(f); });
    await sleep(200);
  }
  
  if (seeds.length > 0) {
    console.log(`[🌱] Extracted ${seeds.length} pure random Shorts from anonymous HTML ✅`);
  } else {
    console.log(`[🌱] Scraping failed. Using absolute fallback seed.`);
    seeds.push("kZyTCtV_bqY");
  }

  // Sanity check /next
  console.log(`[🧪] Testing /next...`);
  const testData = await ytMweb('next', { videoId: seeds[0], params:"8gEAmgMDCNkI" });
  const testIds = grabIds(testData);
  const testChId = testData ? grabChannelId(JSON.stringify(testData)) : null;
  console.log(`[🧪] /next → ${testIds.length} video IDs | channelId: ${testChId || '❌ NOT FOUND'}`);
  if (testIds.length === 0) { console.error(`[💀] /next broken. Exiting.`); process.exit(1); }

  console.log(`\n[🔥] Launching ${THREADS} threads...\n`);
  for (let i = 1; i <= THREADS; i++) setTimeout(() => thread(i), (i-1)*150);
})();
