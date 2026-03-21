"""
  🚀 SHORT RADAR — BOTASAURUS CRAWLER v3 (UNDEFEATABLE)
  
  Uses the Botasaurus AntiDetectDriver to scroll YouTube Shorts
  and discover new channels. Zero monkey pages, ever.
"""

import os
import sys
import time
import random
import requests
import psycopg2
from botasaurus.browser import browser, Driver

WORKER_API = "https://shortradar-scraper-api.shortradar.workers.dev"
DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://user:password@cockroachlabs.cloud:26257/defaultdb?sslmode=require",
)

# ─── ANSI Colors ───
class C:
    RESET  = '\033[0m'
    BOLD   = '\033[1m'
    DIM    = '\033[2m'
    GREEN  = '\033[32m'
    RED    = '\033[31m'
    YELLOW = '\033[33m'
    CYAN   = '\033[36m'
    MAG    = '\033[35m'
    BG_GRN = '\033[42m'


def log(icon, msg):
    t = time.strftime("%I:%M:%S %p")
    print(f"{C.DIM}[{t}]{C.RESET} {icon}  {msg}")


# ─── The single extraction JS (wrapped in IIFE so it never collides) ───
EXTRACT_JS = """
return (function() {
    const activeRenderer = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (!activeRenderer) {
        return { handles: [], title: "(unknown)" };
    }

    const handleElements = activeRenderer.querySelectorAll('a[href*="/@"]');
    const handles = Array.from(handleElements)
        .map(el => (el.innerText || el.textContent || '').trim())
        .filter(text => text.startsWith('@'));

    const titleViewModel = activeRenderer.querySelector('yt-shorts-video-title-view-model');
    const title = titleViewModel ? (titleViewModel.innerText || titleViewModel.textContent || '').trim() : "(unknown)";

    return {
        handles: [...new Set(handles)], 
        title: title.substring(0, 80)
    };
})();
"""


# ─── The Crawler ───
@browser(
    reuse_driver=True,
    close_on_crash=False,          # Pause on error so we can debug
    max_retry=3,
)
def start_crawling(driver: Driver, data):

    # ── 1. DATABASE ──
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        conn.autocommit = True
        log("🗄️", f"{C.GREEN}Connected to CockroachDB.{C.RESET}")
    except Exception:
        log("⚠️", f"{C.YELLOW}No DB connection — channels won't be saved.{C.RESET}")

    # ── 2. NAVIGATE LIKE A HUMAN ──
    # Step A: First land on youtube.com homepage via Google referrer.
    #         This establishes a legitimate session cookie.
    log("🌐", "Landing on YouTube homepage via Google referrer...")
    driver.google_get("https://www.youtube.com")
    driver.sleep(3)

    # Step B: Handle cookie consent (EU / GDPR)
    try:
        # Run JS to find and click the "Accept all" or "Agree" button
        # YouTube often puts this in a dialog
        driver.run_js("""
            const btns = Array.from(document.querySelectorAll('button, yt-button-shape, .yt-spec-button-shape-next'));
            const acceptBtn = btns.find(b => {
                const text = (b.innerText || b.textContent || '').trim().toLowerCase();
                return text === 'accept all' || text === 'agree' || text === 'i agree';
            });
            if (acceptBtn) { 
                acceptBtn.click(); 
            }
        """)
        log("🍪", "Handled cookies popups (if any).")
        driver.sleep(2)
    except Exception as e:
        log("⚠️", f"Cookie handling error: {e}")

    # Step C: Now navigate to /shorts WITHIN the same session
    #         (like a user clicking "Shorts" in the sidebar)
    log("🌐", "Navigating to Shorts feed...")
    driver.get_via_this_page("https://www.youtube.com/shorts")
    driver.sleep(4)

    # Step D: Verify we're on Shorts, not the monkey page
    page_text = driver.page_html[:2000].lower()
    if "our systems have detected unusual traffic" in page_text or "monkeys" in page_text:
        log("🐵", f"{C.RED}{C.BOLD}MONKEY PAGE DETECTED — rotating strategy...{C.RESET}")
        # Try one more time after a cooldown
        driver.sleep(10)
        driver.get("https://www.youtube.com/shorts")
        driver.sleep(5)

    log("✅", f"{C.GREEN}{C.BOLD}SHORTS FEED LOADED. Starting discovery...{C.RESET}")

    # ── 3. INFINITE SCROLL LOOP ──
    processed = set()
    stats = {"found": 0, "valid": 0, "ignored": 0, "errors": 0}
    idx = 0

    while True:
        idx += 1
        # Human-like pause before reading this short
        driver.sleep(random.uniform(2.0, 4.0))

        # Extract handles + title from current short
        try:
            result = driver.run_js(EXTRACT_JS)
        except Exception as js_err:
            log("⚠️", f"JS extraction failed: {js_err}")
            driver.sleep(2)
            driver.run_js("window.scrollBy(0, window.innerHeight)")
            continue

        if not result or not isinstance(result, dict):
            driver.run_js("window.scrollBy(0, window.innerHeight)")
            continue

        handles = result.get("handles", [])
        title   = result.get("title", "(unknown)")

        print(f"\n{C.CYAN}{'━' * 60}{C.RESET}")
        log("📺", f"{C.BOLD}Short #{idx}{C.RESET} — \"{title}\"")

        for handle in handles:
            if handle in processed:
                continue

            processed.add(handle)
            stats["found"] += 1
            log("🔎", f"{C.MAG}{C.BOLD}NEW: {handle}{C.RESET} — Pinging Cloudflare Brain...")

            try:
                t0 = time.time()
                clean = handle.lstrip("@")
                resp = requests.get(f"{WORKER_API}?handle={clean}", timeout=15)
                api = resp.json()
                ms = int((time.time() - t0) * 1000)

                status = api.get("status", "")

                if status == "ignored":
                    stats["ignored"] += 1
                    reason = api.get("reason", "Too old")
                    days   = api.get("channelAgeDays", "?")
                    log("❌", f"{C.RED}IGNORED{C.RESET} {handle} — {reason} ({days}d) [{ms}ms]")

                elif status == "success":
                    stats["valid"] += 1
                    ch = api["data"]["channel"]
                    log("✅", (
                        f"{C.BG_GRN}{C.BOLD} VALID CHANNEL! {C.RESET} "
                        f"{C.GREEN}{C.BOLD}{handle}{C.RESET} [{ms}ms]"
                    ))
                    log("  ", (
                        f"   Subs: {ch.get('subscribers_text','?')} | "
                        f"Views: {ch.get('total_views',0):,} | "
                        f"Age: {ch.get('channel_age_days','?')}d"
                    ))

                    # Save to DB
                    if conn:
                        try:
                            with conn.cursor() as cur:
                                cur.execute("""
                                    INSERT INTO channels (
                                        channel_id, handle, channel_name, description,
                                        avatar_url, channel_url, location, subscribers,
                                        total_views, total_videos, videos_shorts,
                                        videos_long, is_monetized, first_short_date,
                                        channel_age_days
                                    ) VALUES (
                                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                                    ) ON CONFLICT (channel_id) DO NOTHING
                                """, (
                                    ch["channel_id"], ch["handle"],
                                    ch["channel_name"], ch["description"],
                                    ch["avatar_url"], ch["channel_url"],
                                    ch.get("location"), ch["subscribers"],
                                    ch["total_views"], ch["total_videos"],
                                    ch["videos_shorts"], ch["videos_long"],
                                    ch["is_monetized"], ch["first_short_date"],
                                    ch["channel_age_days"],
                                ))
                            log("  ", f"   🗄️ Saved {handle} to Database.")
                        except Exception as db_err:
                            log("⚠️", f"DB error: {db_err}")

                else:
                    stats["errors"] += 1
                    log("⚠️", f"API error: {api.get('error','unknown')} [{ms}ms]")

            except Exception as net_err:
                stats["errors"] += 1
                log("💥", f"Network error: {str(net_err)[:120]}")

        # Session scoreboard
        board = (
            f"Found={stats['found']}  "
            f"{C.GREEN}Valid={stats['valid']}{C.RESET}  "
            f"{C.RED}Rejected={stats['ignored']}{C.RESET}  "
            f"Errors={stats['errors']}"
        )
        print(f"{C.DIM}   📊 {board}{C.RESET}")

        # Scroll to next Short (human-like)
        driver.run_js("window.scrollBy(0, window.innerHeight)")
        driver.sleep(random.uniform(1.5, 3.0))


# ─── Entry Point ───
if __name__ == "__main__":
    print(f"\n  {C.BOLD}🚀 SHORT RADAR — BOTASAURUS v3 (UNDEFEATABLE){C.RESET}\n")
    try:
        start_crawling()
    except KeyboardInterrupt:
        print(f"\n{C.YELLOW}Crawler stopped by user.{C.RESET}")
        sys.exit(0)
    except Exception as e:
        print(f"\n{C.RED}FATAL: {e}{C.RESET}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
