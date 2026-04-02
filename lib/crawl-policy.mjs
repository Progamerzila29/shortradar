/**
 * Single source of truth for ShortRadar crawl gates (crawler + worker).
 * No Node-only APIs — safe for Cloudflare Workers.
 */

export const POLICY = {
  MAX_SUBS: 100_000,
  /** Reject if long uploads count exceeds this (0 = shorts-only). */
  MAX_LONG: 0,
  MAX_LIVE: 0,
  MIN_SHORTS: 3,
  MIN_AVG_VIEWS: 10_000,
  /** First Short on channel must be within this many days (rolling). */
  FIRST_SHORT_MAX_AGE_DAYS: 90,
};

export const REASON = {
  SUBS_OVER_LIMIT: 'subs_over_limit',
  HAS_LONG_OR_LIVE: 'has_long_or_live',
  TOO_FEW_SHORTS: 'too_few_shorts',
  LOW_TRACTION: 'low_traction',
  FIRST_SHORT_TOO_OLD: 'first_short_too_old',
  DATE_UNKNOWN: 'date_unknown',
};

/** @param {string | null | undefined} s */
export function parseISODateStartOfDayUTC(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  const dt = new Date(Date.UTC(y, mo, d));
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Minimum calendar date (UTC start-of-day) for first Short to pass age gate.
 * firstShortDate >= this date passes.
 */
export function getFirstShortMinDate(nowMs = Date.now()) {
  const cutoff = new Date(nowMs - POLICY.FIRST_SHORT_MAX_AGE_DAYS * 86_400_000);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * @param {{ subscribers: number, nLong?: number, nLive?: number, exactLong?: number, exactLive?: number, exactShorts?: number, avgViews: number, firstShortDateRaw: string | null }} input
 * @returns {{ ok: true } | { ok: false, reason: string, detail?: string }}
 */
export function evaluateChannelGates(input) {
  const subs = input.subscribers ?? 0;
  const nLong = input.exactLong ?? input.nLong ?? 0;
  const nLive = input.exactLive ?? input.nLive ?? 0;
  const exactShorts = input.exactShorts ?? 0;
  const avg = input.avgViews ?? 0;

  if (subs > POLICY.MAX_SUBS) {
    return { ok: false, reason: REASON.SUBS_OVER_LIMIT, detail: String(subs) };
  }
  if (nLong > POLICY.MAX_LONG || nLive > POLICY.MAX_LIVE) {
    return { ok: false, reason: REASON.HAS_LONG_OR_LIVE, detail: `long:${nLong} live:${nLive}` };
  }
  if (exactShorts < POLICY.MIN_SHORTS) {
    return { ok: false, reason: REASON.TOO_FEW_SHORTS, detail: String(exactShorts) };
  }
  if (avg < POLICY.MIN_AVG_VIEWS) {
    return { ok: false, reason: REASON.LOW_TRACTION, detail: String(avg) };
  }

  const raw = input.firstShortDateRaw;
  if (raw == null || raw === '') {
    return { ok: false, reason: REASON.DATE_UNKNOWN };
  }
  const first = parseISODateStartOfDayUTC(raw);
  if (!first) {
    return { ok: false, reason: REASON.DATE_UNKNOWN, detail: String(raw) };
  }
  const minDate = getFirstShortMinDate();
  if (first < minDate) {
    return { ok: false, reason: REASON.FIRST_SHORT_TOO_OLD, detail: raw };
  }

  return { ok: true };
}

/**
 * Stage-1: video publish date must be within policy window (cheap HTML / metadata check).
 * @param {string | null} publishDateStr YYYY-MM-DD
 */
export function isVideoPublishRecentEnough(publishDateStr, nowMs = Date.now()) {
  if (!publishDateStr) return { ok: false, reason: REASON.DATE_UNKNOWN };
  const d = parseISODateStartOfDayUTC(publishDateStr);
  if (!d) return { ok: false, reason: REASON.DATE_UNKNOWN };
  const minDate = getFirstShortMinDate(nowMs);
  if (d < minDate) return { ok: false, reason: REASON.FIRST_SHORT_TOO_OLD };
  return { ok: true };
}

/**
 * Age gate only (after cheap gates passed and firstShortDateRaw resolved).
 * @param {string | null | undefined} firstShortDateRaw
 */
export function passesFirstShortAge(firstShortDateRaw, nowMs = Date.now()) {
  if (firstShortDateRaw == null || firstShortDateRaw === '') {
    return { ok: false, reason: REASON.DATE_UNKNOWN };
  }
  const first = parseISODateStartOfDayUTC(firstShortDateRaw);
  if (!first) {
    return { ok: false, reason: REASON.DATE_UNKNOWN, detail: String(firstShortDateRaw) };
  }
  const minDate = getFirstShortMinDate(nowMs);
  if (first < minDate) {
    return { ok: false, reason: REASON.FIRST_SHORT_TOO_OLD, detail: firstShortDateRaw };
  }
  return { ok: true };
}
