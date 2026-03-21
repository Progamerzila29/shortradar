# ShortRadar (v4) - The Ultimate 0$ To-Do List

**PHASE 1: Database Preparation & Foundations (CockroachDB)**
-   [x] Create a free account on CockroachLabs Cloud.
-   [x] Provision the Serverless PostgreSQL cluster (Free Tier).
-   [x] Obtain the SQL connection string.
-   [x] Execute the SQL command to create the `channels` table (`channel_id` PK, `handle`, `subscribers`, `growth_score`, etc.).
-   [x] Execute the SQL command to create the `shorts` table (`video_id` PK, `channel_id` FK).
-   [x] Create SQL indexes for dashboard sorting (on `subscribers`, `average_views_last5`, `channel_age_days`).
-   [x] Insert a "Dummy" channel manually to validate DB access.

**PHASE 2: Local Scripts Renovation (Deep Extraction)**
-   [x] Clean and refactor `extract_oldest.js`:
    -   [x] Target specifically the very first Short of the channel.
    -   [x] Add the strict date comparator: `if (firstShortDate < '2025-01-01') return false; else return true;`
-   [x] Clean and refactor `fast_metadata.js` & `local_test_pipeline.js`:
    -   [x] **NEW:** Extract Exact Video Counts (Shorts vs Long vs Live) via async playlist API to ensure sub-1s runtime.
    -   [x] **NEW:** Extract Channel Location and Language from the database/API headers.
    -   [x] **NEW:** Implement YouTube Partner Program proxy logic (`subscribers > 1000 & avgViews > 10000`) for Monetization tracking.
    -   [x] **NEW:** Display channel age in exact `days`, `weeks`, `months`, and `years` format in payload independently.
    -   [x] Simplify the network extraction to target only necessary data (Subscribers, Name, Avatar URL).
    -   [x] Extract the 5 latest Shorts (thumbnails, titles, views).
-   [x] Create the "Metrics Calculator" module:
    -   [x] Code `calculateAverageViews(last5ShortsViewsArray)`.
    -   [x] Code `calculateViewsToSubRatio()`.
    -   [x] Code `calculateGrowthScore()`.
    -   [x] Code `calculateShortsPerWeek()`.
-   [x] Create a consolidated test script (`local_test_pipeline.js`) executing steps 1-3 on a given channel (`node test_pipeline.js UCxxxxx`).
-   [x] Validate that the JSON object generated matches the exact CockroachDB table schema (including new fields).

**PHASE 3: The Cloud Brain & Crawlers (Lightpanda + Cloudflare)**
-   [ ] Create a free Cloudflare account if none exists.
-   [ ] Provision the "KV Namespace" named `SHORT_RADAR_CACHE`.
-   [ ] **Deploy the Crawlers (Lightpanda):**
    -   [ ] Setup a lightweight VPS (or edge instance) to run the Lightpanda headless browser 24/7.
    -   [ ] Program the Lightpanda crawler script to scroll the YouTube Shorts feed continuously.
    -   [ ] Extract only the `URL` and the `Date` of the Shorts on the screen.
    -   [ ] If a post-2025 Short is found, Lightpanda fires the `channel_id` to the Scraper API (via HTTP).
-   [ ] **Initiate the Scraper API (Cloudflare Worker):**
    -   [ ] Create the Cloudflare Worker API endpoint to receive data from Lightpanda.
    -   [ ] Add KV verification: If `channel_id` is known -> Stop execution.
    -   [ ] Execute the full JSON extraction logic (`extract_oldest.js` + `fast_metadata.js`).
    -   [ ] Add the PostgreSQL connection for the final insertion into CockroachDB.
-   [ ] Deploy in staging and test the full pipeline: Lightpanda scrolls -> finds a video -> Worker API ensures it's unique -> analyzes -> inserts to DB.

**PHASE 4: Perpetual Engine & Data Refresh (Automation)**
-   [ ] Add "Cron Triggers" to the Lightpanda host to ensure the browser restarts automatically if it crashes.
-   [ ] Write Worker #2: **"The Stats Updater"**
    -   [ ] Code the SQL query `SELECT channel_id FROM channels ORDER BY scraped_at ASC LIMIT 100`.
    -   [ ] Re-run `fast_metadata.js` on those channels to fetch fresh subscriber and view counts.
    -   [ ] Execute an `SQL UPDATE` in CockroachDB.
-   [ ] Bind Worker #2 to a Cron Trigger (e.g., runs once an hour to cycle through the database daily).
-   [ ] Perform a 24-hour full operational test and monitor Cloudflare KV/Worker quotas.

**PHASE 5: SaaS Dashboard (Next.js Application)**
-   [ ] Initialize the frontend: `npx create-next-app@latest shortradar --typescript --tailwind --eslint`.
-   [ ] Install the `pg` database library and secure the CockroachDB URL in `.env`.
-   [ ] Develop the Next.js API Routes:
    -   [ ] Route `/api/stats`: returns `COUNT(*)` of total channels.
    -   [ ] Route `/api/feed`: returns the latest 50 channels applying filters via `req.query`.
-   [ ] Create the UI Components:
    -   [ ] `HeaderStatusBar.tsx` (Live Counters).
    -   [ ] `FilterSidebar.tsx` (Sliders and checkboxes for Max Subs, Channel Age, etc.).
    -   [ ] `ChannelCard.tsx` (Profile, Monetization badge, grid view of the 5 newest Shorts).
-   [ ] Implement asynchronous fetching in React to filter the dataset instantly.
-   [ ] Link the UI to the API (e.g., `/api/feed?min_views=X&max_subs=Y`).
-   [ ] Push the public repository to GitHub.
-   [ ] Link GitHub to Vercel and deploy to production.
-   [ ] Perform final UI/UX testing.
