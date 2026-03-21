const { chromium } = require('playwright');

const WORKER_API = 'https://shortradar-scraper-api.shortradar.workers.dev';

// ─── COLORS FOR TERMINAL ─────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
    cyan: '\x1b[36m', magenta: '\x1b[35m', white: '\x1b[37m',
    bgGreen: '\x1b[42m', bgRed: '\x1b[41m', bgYellow: '\x1b[43m', bgCyan: '\x1b[46m',
};
function log(icon, msg) { console.log(`${C.dim}[${new Date().toLocaleTimeString()}]${C.reset} ${icon}  ${msg}`); }

async function main() {
    console.log(`\n${C.bgCyan}${C.bold}  🚀 SHORT RADAR — CRAWLER v3 (Real Chrome)  ${C.reset}\n`);

    // ── LAUNCH YOUR REAL CHROME (not Playwright's detectable Chromium) ────────
    // This uses your actual installed Chrome browser, so YouTube trusts it.
    log('🌐', 'Launching your real Chrome browser...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',           // ← Uses your real installed Chrome!
        args: [
            '--disable-blink-features=AutomationControlled',  // Hide automation flag
            '--window-size=500,900'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 500, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });

    // Remove the "navigator.webdriver" flag that YouTube uses to detect bots
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();

    // ── NAVIGATE TO SHORTS ───────────────────────────────────────────────────
    log('🌐', 'Navigating to YouTube Shorts...');
    await page.goto('https://www.youtube.com/shorts', { waitUntil: 'networkidle', timeout: 30000 });

    // Accept cookies if prompted (EU)
    try {
        const cookieBtn = page.locator('button:has-text("Accept all"), button:has-text("Tout accepter")').first();
        if (await cookieBtn.isVisible({ timeout: 3000 })) {
            await cookieBtn.click();
            log('🍪', 'Accepted cookies dialog.');
            await page.waitForTimeout(2000);
        }
    } catch (e) {
        log('🍪', `${C.dim}No cookies dialog, continuing.${C.reset}`);
    }

    // Wait for first Short to render — give it plenty of time
    log('⏳', 'Waiting for Shorts to start playing...');
    try {
        // Wait for any video element to appear (the actual Short playing)
        await page.waitForSelector('ytd-reel-video-renderer, ytd-shorts, #shorts-container', { timeout: 20000 });
        log('✅', `${C.green}Shorts container detected!${C.reset}`);
    } catch (e) {
        // Dump the page for debugging
        const pageTitle = await page.title();
        const pageUrl = page.url();
        log('❌', `${C.red}Shorts feed did not load.${C.reset}`);
        log('🔍', `Page title: "${pageTitle}"`);
        log('🔍', `Page URL: ${pageUrl}`);

        // Check if YouTube redirected us somewhere else
        if (pageUrl.includes('consent') || pageUrl.includes('accounts.google')) {
            log('💡', `${C.yellow}YouTube wants you to sign in or accept consent. Waiting 30s for you to do it manually...${C.reset}`);
            await page.waitForTimeout(30000);
        } else {
            log('💡', `${C.yellow}Try closing other Chrome windows first, then run again.${C.reset}`);
            await browser.close();
            process.exit(1);
        }
    }

    // Extra wait for overlays and handles to render
    await page.waitForTimeout(3000);

    log('🎬', `${C.green}${C.bold}Feed is live! Starting infinite scroll...${C.reset}\n`);

    // ── STATE ────────────────────────────────────────────────────────────────
    const processedHandles = new Set();
    let totalFound = 0;
    let totalValid = 0;
    let totalIgnored = 0;
    let totalErrors = 0;
    let shortIndex = 0;
    let consecutiveEmpty = 0;

    // ── MAIN LOOP ────────────────────────────────────────────────────────────
    while (true) {
        shortIndex++;

        // 1. Check for "Video unavailable" and click skip
        try {
            const skipBtn = page.locator('text="Skip video"').first();
            if (await skipBtn.isVisible({ timeout: 300 })) {
                log('⏭️', `${C.yellow}Dead video! Skipping...${C.reset}`);
                await skipBtn.click();
                await page.waitForTimeout(2000);
                continue;
            }
        } catch (e) {}

        // 2. Extract handles: dump ALL links on the page that point to a channel
        let handles = [];
        let shortTitle = '(loading...)';
        let debugInfo = '';

        try {
            const result = await page.evaluate(() => {
                const data = { handles: [], title: '(unknown)', debug: '' };

                // Find the active short renderer
                const active = document.querySelector('ytd-reel-video-renderer[is-active]');
                const searchRoot = active || document;

                // GRAB EVERY LINK that contains /@
                const allLinks = searchRoot.querySelectorAll('a[href*="/@"]');
                data.debug = `Found ${allLinks.length} /@-links in ${active ? 'active renderer' : 'full page'}`;

                const seen = new Set();
                allLinks.forEach(el => {
                    const href = el.getAttribute('href') || el.href || '';
                    const m = href.match(/\/@([^\/\?\s]+)/);
                    if (m && !seen.has(m[1])) {
                        seen.add(m[1]);
                        data.handles.push('@' + m[1]);
                    }
                });

                // Title: try multiple selectors
                const titleEl = (active || document).querySelector(
                    'yt-shorts-video-title-view-model h2 span, ' +
                    'h2.ytShortsVideoTitleViewModelHostEndpoint, ' +
                    '#title yt-formatted-string, ' +
                    '[class*="title"] span'
                );
                if (titleEl) data.title = titleEl.textContent.trim().substring(0, 80);

                return data;
            });

            handles = result.handles;
            shortTitle = result.title;
            debugInfo = result.debug;
        } catch (e) {
            debugInfo = `DOM error: ${e.message}`;
        }

        // ── Display what the crawler is looking at ───────────────────────────
        console.log(`${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
        log('📺', `${C.bold}Short #${shortIndex}${C.reset} — "${C.white}${shortTitle}${C.reset}"`);
        log('🔬', `${C.dim}${debugInfo}${C.reset}`);

        if (handles.length === 0) {
            consecutiveEmpty++;
            log('🔍', `${C.dim}No handles found. (${consecutiveEmpty} empty in a row)${C.reset}`);

            // If we get 10+ empty shorts in a row, YouTube might be blocking
            if (consecutiveEmpty >= 10) {
                log('⚠️', `${C.yellow}${C.bold}10 empty shorts in a row! YouTube may be throttling.${C.reset}`);
                log('💡', `${C.yellow}Pausing 10 seconds to cool down...${C.reset}`);
                await page.waitForTimeout(10000);
                consecutiveEmpty = 0;
            }
        } else {
            consecutiveEmpty = 0;
        }

        // 3. Process each handle
        for (const handle of handles) {
            if (processedHandles.has(handle)) {
                log('♻️', `${C.dim}Already seen ${handle}${C.reset}`);
                continue;
            }
            processedHandles.add(handle);
            totalFound++;

            log('🔎', `${C.magenta}${C.bold}NEW: ${handle}${C.reset} — Pinging Cloudflare API...`);

            try {
                const t = Date.now();
                const res = await fetch(WORKER_API + `?handle=${encodeURIComponent(handle.replace('@', ''))}`);
                const data = await res.json();
                const ms = Date.now() - t;

                if (data.status === 'ignored') {
                    totalIgnored++;
                    log('❌', `${C.red}IGNORED${C.reset} ${handle} — ${data.reason} (${data.channelAgeDays || '?'} days) [${ms}ms]`);
                } else if (data.status === 'success') {
                    totalValid++;
                    const ch = data.data.channel;
                    log('✅', `${C.bgGreen}${C.bold} VALID CHANNEL! ${C.reset} ${C.green}${C.bold}${handle}${C.reset} [${ms}ms]`);
                    log('  ', `   ${C.cyan}Subs:${C.reset} ${ch.subscribers_text}  ${C.cyan}Views:${C.reset} ${ch.total_views?.toLocaleString()}  ${C.cyan}Shorts:${C.reset} ${ch.videos_shorts}/${ch.total_videos}`);
                    log('  ', `   ${C.cyan}Age:${C.reset} ${ch.channel_age_days}d  ${C.cyan}Avg Views:${C.reset} ${ch.average_views_last5?.toLocaleString()}  ${C.cyan}Monetized:${C.reset} ${ch.is_monetized ? '✅ YES' : '❌ No'}`);
                } else {
                    totalErrors++;
                    log('⚠️', `${C.yellow}API: ${data.error || 'Unknown error'}${C.reset} [${ms}ms]`);
                }
            } catch (err) {
                totalErrors++;
                log('💥', `${C.red}Network error: ${err.message}${C.reset}`);
            }
        }

        // 4. Running stats bar
        console.log(`${C.dim}   ┌─ Stats: Found=${C.bold}${totalFound}${C.reset}${C.dim}  Valid=${C.green}${totalValid}${C.reset}${C.dim}  Ignored=${C.red}${totalIgnored}${C.reset}${C.dim}  Errors=${C.yellow}${totalErrors}${C.reset}${C.dim}  Queue=${processedHandles.size}${C.reset}`);

        // 5. Scroll to next short
        log('⬇️', `${C.dim}Scrolling...${C.reset}`);
        await page.keyboard.press('ArrowDown');

        // Wait 2.5-4.5 seconds (human pacing)
        const waitTime = Math.floor(Math.random() * 2000) + 2500;
        await page.waitForTimeout(waitTime);
    }
}

main().catch(err => {
    console.error(`\n${C.red}💥 CRASH: ${err.message}${C.reset}`);
    console.error(`${C.yellow}Tip: Close all other Chrome windows and try again.${C.reset}`);
    process.exit(1);
});
