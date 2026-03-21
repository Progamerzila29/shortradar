import { Innertube } from 'youtubei.js';

const WORKER_API = "https://shortradar-scraper-api.shortradar.workers.dev";


function dispatchToWorker(vid, channelId, publishDate) {
    if (!channelId) return;
    fetch(`${WORKER_API}?channel_id=${channelId}&video_id=${vid}&first_short_date=${publishDate}`).then(res => res.json()).then(data => {
        if (data.status === "success" && data.data && data.data.channel) {
            console.log(`\n\x1b[42m\x1b[1m CLOUDFLARE INSERT SUCCESS \x1b[0m ${channelId} -> ${data.data.channel.handle}`);
        } else if (data.status === "ignored") {
            console.log(`\n\x1b[43m\x1b[1m CLOUDFLARE DROPPED \x1b[0m ${channelId} -> ${data.reason}`);
        }
    }).catch(() => {});
}

async function loopFeed() {
  console.log(`\n  🚀 SHORT RADAR — TRUE ALGORITHMIC SHORTS FEED\n`);
  console.log(`[🎯] Engine: native yt.getShortsVideoInfo() (Mobile Algorithmic Stream)`);
  console.log(`[🔇] Parser warnings suppressed\n`);

  // Suppress all [YOUTUBEJS] internal parser noise
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn  = (...a) => { if (!String(a[0]).includes('YOUTUBEJS')) originalWarn(...a); };
  console.error = (...a) => { if (!String(a[0]).includes('YOUTUBEJS')) originalError(...a); };

  process.on('uncaughtException', () => {});
  
  const yt = await Innertube.create({ generate_session_locally: true });

  // [STAGE 1: MICRO-FILTER] Validate the Upload Date by scraping raw HTML meta tag
  // (The /youtubei/v1/player endpoint stopped returning microformat data — HTML scrape is the proven fix)
  async function verifyAndDispatch(vid) {
    try {
      const res = await fetch(`https://www.youtube.com/shorts/${vid}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const html = await res.text();

      // Extract the datePublished meta tag: <meta itemprop="datePublished" content="2025-03-15">
      const dateMatch = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
      const publishDate = dateMatch ? dateMatch[1] : null;

      // Extract channelId from the HTML
      const channelMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
      const channelId = channelMatch ? channelMatch[1] : null;

      // Strict date comparator — if unknown, assume Too New and let Cloudflare Worker decide
      if (!publishDate) {
        // Can't determine date — pass it to the Worker as a potential new Short
        if (channelId) {
          process.stdout.write(`\n\x1b[33m⚠️ [${vid} Date unknown — dispatching to Worker for deeper check]\x1b[0m`);
          dispatchToWorker(vid, channelId, null);
        }
        return;
      }

      if (publishDate < "2025-01-01") {
        process.stdout.write(`\n\x1b[31m❌ [${vid} Old: ${publishDate}]\x1b[0m`);
        return;
      }

      // It survived! Send this brand new Short to the Cloudflare Worker!
      process.stdout.write(`\n\x1b[32m✅ [${vid} New: ${publishDate}]\x1b[0m`);
      dispatchToWorker(vid, channelId, publishDate);

    } catch (err) {
      // If the fetch fails completely, quietly ignore it
    }
  }

  const target    = 30000;
  let processed   = 0;
  let currentVid  = "kZyTCtV_bqY"; // Safe fallback
  
  try {
      console.log(`[🧠] Discovering pure global master seed natively...`);
      const endpoint = await yt.resolveURL("https://www.youtube.com/shorts");
      // Use parse: false to prevent [YOUTUBEJS] from throwing a node structure mismatch error on the raw payload
      const res = await endpoint.call(yt.actions, { parse: false });
      const rawRes = typeof res === 'string' ? res : JSON.stringify(res);
      const m = rawRes.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
      if (m) currentVid = m[1];
      console.log(`[🎯] Dynamic Master Seed Locked: ${currentVid}\n`);
  } catch(e) {
      console.log(`[⚠] Dynamic seeder fallback triggered: ${currentVid}\n`);
  }
  
  const seen = new Set([currentVid]);

  while (processed < target) {
    try {
      // The holy grail: natively fetches the `reel_watch_sequence` directly from YouTube Mobile
      const info = await yt.getShortsVideoInfo(currentVid);

      if (!info) { 
          console.log("[🛑] No API info returned. Cooling down..."); 
          await new Promise(r => setTimeout(r, 2000));
          continue; 
      }

      const feed = info.watch_next_feed || [];
      
      let shortsThisBlock = 0;
      let nextSeed = null;

      // Extract raw JSON string at the top level of the feed to sweep all videoIDs effortlessly
      const rawBlock = JSON.stringify(feed);
      const matches = [...rawBlock.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
      
      // Deduplicate internally for this block
      const vids = [...new Set(matches.map(m => m[1]))];

      for (const vid of vids) {
          if (seen.has(vid)) continue;
          
          seen.add(vid);
          processed++;
          shortsThisBlock++;
          
          // Fire the Stage-1 Micro-Filter concurrently (DO NOT AWAIT, let it run in the background!)
          verifyAndDispatch(vid);

          nextSeed = vid;
          
          if (processed >= target) break;
      }

      console.log(`\n\n[📺] Pure Algorithm Payload: \x1b[32m${shortsThisBlock} New Shorts Extracted\x1b[0m`);
      console.log(`[🔎] Total Shorts Crawled: \x1b[1m${processed}/${target}\x1b[0m\n`);

      if (!nextSeed) {
        console.log("[🔃] Block exhausted — seeding randomly from previously discovered Shorts to maintain algorithm flow.");
        const seenArr = [...seen];
        currentVid = seenArr[Math.floor(Math.random() * seenArr.length)];
        continue;
      }

      // Loop eternally deeper into the swipe algorithm
      currentVid = nextSeed;

      // [ANTI-BOT JITTER] Wait randomly between 200ms and 1200ms like a real human swiping
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 200));

    } catch (e) {
      console.log(`\n[💥] Intercepted Disconnect (${e.message}). Re-engaging algorithm in 5 seconds...`);
      // Fallback/Retry logic: Wait 5 seconds, pick a new random seed, and continue the loop!
      await new Promise(r => setTimeout(r, 5000));
      const seenArr = [...seen];
      currentVid = seenArr[Math.floor(Math.random() * seenArr.length)];
    }
  }

  console.log(`\n\x1b[42m\x1b[1m ✅ ARMY INSTANCE COMPLETE \x1b[0m Successfully logged ${processed} unadulterated Shorts.`);
}

loopFeed();
