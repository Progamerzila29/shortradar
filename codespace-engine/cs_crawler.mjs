import pkg from 'pg';
const { Pool } = pkg;

// ================================================================
// SHORTRADAR V6.5 — MULTI-NICHE SEARCH-SEEDED ENGINE
// ✅ Zero Cloudflare | ✅ Direct CockroachDB | ✅ /search seeding
// ✅ 20+ genre queries → 400+ diverse seeds → zero echo chamber
// ✅ Re-seeds every 60s to escape recommendation bubbles
// ================================================================

const DATABASE_URL = 'postgresql://muataz:0L27YGOK_Eircx-52BD2Ig@shortradar-db-13409.jxf.gcp-europe-west3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';
const pool = new Pool({ connectionString: DATABASE_URL, max: 10, ssl: { rejectUnauthorized: false } });

const API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

// ── Gates ─────────────────────────────────────────────────────
const CUTOFF   = new Date('2025-12-01');
const MAX_SUBS = 100_000;
const MIN_AVG  = 10_000;
const THREADS  = 20;

// ── 30 diverse niche queries for search seeding ──────────────
const NICHE_QUERIES = [
  "shorts funny moments", "shorts cooking recipe", "shorts workout gym",
  "shorts scary story", "shorts car race", "shorts travel vlog",
  "shorts makeup tutorial", "shorts gaming clips", "shorts soccer goals",
  "shorts guitar music", "shorts street food", "shorts prank gone wrong",
  "shorts life hack", "shorts satisfying video", "shorts motivational speech",
  "shorts dance trend", "shorts cat dog pet", "shorts magic trick",
  "shorts drawing art", "shorts science experiment", "shorts fashion outfit",
  "shorts basketball dunk", "shorts nature wildlife", "shorts comedy skit",
  "shorts singing voice", "shorts cleaning asmr", "shorts drone footage",
  "shorts boxing fight", "shorts baking cake", "shorts fishing catch"
];

// ── Hardcoded diverse fallback seeds (NOT kids content) ──────
const FALLBACK_SEEDS = [
  // Comedy/funny
  "2bGuEYJpCkA", "Tt7bzxurJ1I", "lPcR5RVXHMg",
  // Fitness/gym
  "gey73pgMuMM", "ml6cT4AZdqI",
  // Cooking
  "1ahpSTf_Duw", "GKI_ij_breU",
  // Music  
  "L_jWHffIx5E", "pt8VYOfr8To",
  // Gaming
  "MP8ISaoKaBo", "LCVKSxIGmaU",
  // Cars
  "cEvUBFN3b_4", "vVXIK1xFNgU"
];

// ── Stats ─────────────────────────────────────────────────────
let crawled=0, processed=0, inserted=0;
const gates = { noChannel:0, dupChannel:0, subs:0, longLive:0, fewShorts:0, traction:0, tooOld:0, noDate:0, dbErr:0 };
const seeds = [];
const seenVid = new Set();
const seenCh  = new Set();
const t0 = Date.now();
const GL = ["US","GB","FR"];

setInterval(() => {
  const m = ((Date.now()-t0)/60000).toFixed(1);
  const r = Math.round(crawled/Math.max(1,(Date.now()-t0)/60000));
  console.log(`\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
  console.log(`⏱ ${m}min | 🔎 ${crawled.toLocaleString()} crawled | ✅ ${processed} checked | 💚 ${inserted} inserted | 📈 ${r}/min`);
  console.log(`🚫 Drops → noChId:${gates.noChannel} | dupCh:${gates.dupChannel} | subs:${gates.subs} | long/live:${gates.longLive} | fewShorts:${gates.fewShorts} | lowViews:${gates.traction} | tooOld:${gates.tooOld} | noDate:${gates.noDate} | db:${gates.dbErr}`);
  console.log(`🌱 Seed pool: ${seeds.length} | Seen vids: ${seenVid.size} | Seen channels: ${seenCh.size}`);
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

// ── YouTube API callers ───────────────────────────────────────
async function ytMweb(endpoint, body) {
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36' },
      body: JSON.stringify({ context:{client:{clientName:"MWEB",clientVersion:"2.20231207.01.00",hl:"en",gl:"US"}}, ...body })
    });
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

async function ytWeb(endpoint, body) {
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${API_KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      body: JSON.stringify({ context:{client:{clientName:"WEB",clientVersion:"2.20240314.07.00",hl:"en",gl:"US"}}, ...body })
    });
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

function grabIds(data) {
  if (!data) return [];
  const s = JSON.stringify(data);
  const r = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
  const out = new Set(); let m;
  while ((m = r.exec(s)) !== null) out.add(m[1]);
  return [...out];
}

function grabChannelId(str) {
  const m = str.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
  return m ? m[1] : null;
}

// ── Search-Based Seed Generator ──────────────────────────────
// Calls /search with a niche query to get ~20 diverse video IDs
async function searchSeeds(query) {
  try {
    // EgIQAQ== is the base64 for "Shorts" filter (type=video, duration=short)
    const data = await ytMweb('search', { query, params: "EgIQAQ%3D%3D" });
    return grabIds(data);
  } catch(e) { return []; }
}

// ── Multi-niche seeding on boot ──────────────────────────────
async function loadAllSeeds() {
  console.log(`[🌱] Seeding from ${NICHE_QUERIES.length} diverse niche queries...`);
  
  // Run 5 search queries at a time to avoid overwhelming
  for (let i = 0; i < NICHE_QUERIES.length; i += 5) {
    const batch = NICHE_QUERIES.slice(i, i + 5);
    const results = await Promise.all(batch.map(q => searchSeeds(q)));
    for (const ids of results) {
      for (const id of ids) {
        if (!seeds.includes(id)) seeds.push(id);
      }
    }
    console.log(`  [🌱] Batch ${Math.floor(i/5)+1}/${Math.ceil(NICHE_QUERIES.length/5)} → Pool: ${seeds.length} seeds`);
    await sleep(300);
  }

  if (seeds.length < 10) {
    console.log(`[🌱] Search seeding returned too few (${seeds.length}). Adding fallback seeds...`);
    FALLBACK_SEEDS.forEach(s => { if (!seeds.includes(s)) seeds.push(s); });
  }

  console.log(`[🌱] ✅ Total seed pool: ${seeds.length} videos across ${NICHE_QUERIES.length} niches`);
}

// ── Periodic re-seeding (every 60s, pick a random niche query) ──
async function reseederLoop() {
  while (true) {
    await sleep(60000);
    const query = pick(NICHE_QUERIES);
    const fresh = await searchSeeds(query);
    let added = 0;
    for (const id of fresh) {
      if (!seeds.includes(id)) { seeds.push(id); added++; }
    }
    if (seeds.length > 2000) seeds.splice(0, seeds.length - 2000); // Cap pool size
    if (added > 0) console.log(`\x1b[33m[🔄 Reseed] "${query}" → +${added} new seeds (pool: ${seeds.length})\x1b[0m`);
  }
}

// ── The Ghost Filter ──────────────────────────────────────────
async function processOne(vid) {
  if (seenVid.has(vid)) return;
  seenVid.add(vid);

  const nextData = await ytMweb('next', { videoId: vid });
  if (!nextData) { gates.noChannel++; return; }

  const nextStr = JSON.stringify(nextData);
  const chId = grabChannelId(nextStr);
  if (!chId) { gates.noChannel++; return; }
  if (seenCh.has(chId)) { gates.dupChannel++; return; }
  seenCh.add(chId);
  processed++;

  let thisVideoDate = null;
  const dm = nextStr.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  if (dm) thisVideoDate = dm[1];

  const id = chId.substring(2);

  const [shorts, about, nLong, nLive] = await Promise.all([
    ytWeb('browse', { browseId:chId, params:'EgZzaG9ydHO4AQCSAwDyBgUKA5oBAA%3D%3D' }),
    ytWeb('browse', { browseId:chId, params:'EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D' }),
    (async () => { const d = await ytWeb('browse', { browseId:`VLUULF${id}` }); if (!d) return 0; const t=JSON.stringify(d); const m=t.match(/"numVideosText".*?"([0-9,]+)"/); return m ? parseInt(m[1].replace(/,/g,''),10)||0 : 0; })(),
    (async () => { const d = await ytWeb('browse', { browseId:`VLUULV${id}` }); if (!d) return 0; const t=JSON.stringify(d); const m=t.match(/"numVideosText".*?"([0-9,]+)"/); return m ? parseInt(m[1].replace(/,/g,''),10)||0 : 0; })(),
  ]);

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

  if (subs > MAX_SUBS) { console.log(`  \x1b[31m[G1 SUBS] ${chName} → ${subsTxt} > 100k\x1b[0m`); gates.subs++; return; }
  if (nLong > 0 || nLive > 0) { console.log(`  \x1b[31m[G2 LONG] ${chName} → long:${nLong} live:${nLive}\x1b[0m`); gates.longLive++; return; }

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

  if (rs.length < 3) { gates.fewShorts++; return; }

  const avg = Math.floor(rs.reduce((s,v)=>s+v.views,0)/rs.length);
  if (avg < MIN_AVG) { console.log(`  \x1b[31m[G4 LOW] ${chName} → ${avg.toLocaleString()} avg views\x1b[0m`); gates.traction++; return; }

  // Age gate
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
  if (!firstDate) { gates.noDate++; return; }
  if (new Date(firstDate) < CUTOFF) { console.log(`  \x1b[31m[G3 OLD] ${chName} → ${firstDate}\x1b[0m`); gates.tooOld++; return; }

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
    console.log(`\x1b[42m\x1b[1m 💚 INSERTED \x1b[0m ${chName} | ${subs.toLocaleString()} subs | ${avg.toLocaleString()} avg | ${ageDays}d old`);
    if (!seeds.includes(vid)) { seeds.push(vid); if (seeds.length>2000) seeds.shift(); }
  } catch(e) {
    console.error(`  \x1b[31m[DB ERR] ${chName}: ${e.message}\x1b[0m`);
    gates.dbErr++;
  } finally { cl.release(); }
}

// ═══════════════════════════════════════════════════════════════
// THREADS — Random walk via /next, seeded from diverse /search
// ═══════════════════════════════════════════════════════════════
async function thread(id) {
  const gl = GL[id % GL.length];
  console.log(`\x1b[32m[🟢 Thread #${id}]\x1b[0m Online. Country: ${gl}`);

  let seed = pick(seeds);

  while (true) {
    try {
      const data = await ytMweb('next', { videoId:seed, params:"8gEAmgMDCNkI", context:{client:{clientName:"MWEB",clientVersion:"2.20231207.01.00",hl:"en",gl}} });
      const ids = grabIds(data);

      if (ids.length === 0) {
        seed = pick(seeds); // Jump to a completely different niche
        await sleep(2000);
        continue;
      }

      crawled += ids.length;
      const picks = ids.sort(()=>Math.random()-.5).slice(0,3);
      for (const v of picks) await processOne(v);

      seed = pick(ids);
      await sleep(200 + Math.random()*300);
    } catch(e) {
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
  console.log(`\x1b[35m║  🚀 SHORTRADAR V6.5 — MULTI-NICHE ENGINE        ║\x1b[0m`);
  console.log(`\x1b[35m║  ${THREADS} threads | /search seeding | Direct DB    ║\x1b[0m`);
  console.log(`\x1b[35m╚══════════════════════════════════════════════════╝\x1b[0m\n`);

  console.log(`[🔑] Gates: <100k subs | 0 long vids | >Dec 2025 | >10k avg views`);

  try {
    const c = await pool.connect();
    c.release();
    console.log(`[🔌] CockroachDB: Connected ✅\n`);
  } catch(e) { console.error(`[❌] DB ERROR:`, e.message); process.exit(1); }

  // ── Seed from 30 diverse niche queries ──
  await loadAllSeeds();

  if (seeds.length === 0) {
    console.error(`[💀] Zero seeds found. Exiting.`);
    process.exit(1);
  }

  // Sanity check
  console.log(`\n[🧪] Testing /next with a random seed...`);
  const testData = await ytMweb('next', { videoId: pick(seeds), params:"8gEAmgMDCNkI" });
  const testIds = grabIds(testData);
  console.log(`[🧪] /next → ${testIds.length} video IDs ${testIds.length > 0 ? '✅' : '❌'}`);
  if (testIds.length === 0) { console.error(`[💀] /next broken. Exiting.`); process.exit(1); }

  console.log(`\n[🔥] Launching ${THREADS} threads + reseeder...\n`);

  // Launch reseeder (background loop that adds fresh seeds every 60s)
  reseederLoop();

  // Launch crawling threads
  for (let i = 1; i <= THREADS; i++) setTimeout(() => thread(i), (i-1)*150);
})();
