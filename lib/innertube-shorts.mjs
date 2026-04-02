/**
 * Extract video IDs that are structurally Shorts/reel in an Innertube JSON tree.
 * Avoids blind global regex on the whole payload (reduces long-form leakage).
 */

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * @param {unknown} data Parsed JSON from /next or browse
 * @returns {string[]}
 */
export function extractShortsVideoIds(data) {
  const out = new Set();
  function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      for (const x of o) walk(x);
      return;
    }
    const reel = o.reelWatchEndpoint?.videoId;
    if (typeof reel === 'string' && ID_RE.test(reel)) out.add(reel);

    const ent = o.shortsLockupViewModel?.entityId;
    if (typeof ent === 'string') {
      const vid = ent.replace(/^shorts-shelf-item-/, '');
      if (ID_RE.test(vid)) out.add(vid);
    }

    for (const v of Object.values(o)) walk(v);
  }
  walk(data);
  return [...out];
}

/**
 * Purity stats for logging: shorts-structured IDs vs naive regex scrape.
 * @param {unknown} data
 */
export function compareShortsVsNaiveVideoIds(data) {
  const shorts = extractShortsVideoIds(data);
  if (!data) return { shorts: [], naive: [], purity: 1 };
  const s = JSON.stringify(data);
  const r = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
  const naive = new Set();
  let m;
  while ((m = r.exec(s)) !== null) naive.add(m[1]);
  const shortsSet = new Set(shorts);
  const denom = Math.max(1, naive.size);
  const inter = [...shortsSet].filter((id) => naive.has(id)).length;
  const purity = inter / denom;
  return { shorts, naive: [...naive], purity };
}
