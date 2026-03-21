# ShortRadar - Architecture Plan & Roadmap (v4)

This document outlines the definitive technical strategy to build ShortRadar—a YouTube Shorts channel discovery SaaS—at a massive scale, fully automated, and running 24/7 for **$0**. We prioritize extreme speed and the targeted collection of new channels (born after 01/01/2025).

---

## 1. The Core Architecture (Distributed Brain)

Following the original brief, the architecture splits the workload into two distinct roles: Discovery (Crawlers) and Deep Extraction (Scrapers). This hybrid approach guarantees maximum speed and minimum resource usage.

1.  **The Crawlers (The Fast Discovery Fleet): Lightpanda**
    *   *Role:* Lightpanda is an ultra-fast headless browser built in Zig, designed specifically for automation. Its job is to open the YouTube Shorts feed, scroll infinitely like a human, and read incoming video URLs and channel IDs.
    *   *Why Lightpanda:* Extreme speed and low memory footprint. While it lacks heavy anti-bot evasion, YouTube Shorts feeds are generally accessible. By using Lightpanda, we can scroll through thousands of Shorts per minute with minimal server overhead.
2.  **The Fast Queue & Anti-Duplicate (Redis / Cloudflare KV)**
    *   *Role:* When a Lightpanda crawler spots a channel, it checks this high-speed RAM cache. KV verifies in 1 millisecond if we already know this channel. If yes, it's ignored. If no, it's passed down the pipeline.
3.  **The Scrapers (Deep Extraction API): Cloudflare Workers (Your `.js` scripts)**
    *   *Role:* This is the lightweight extraction force. Once the crawler finds a new channel, it hands the ID over to a Cloudflare Worker. The Worker uses your existing scripts (`fast_metadata.js`, `extract_oldest.js`) to query YouTube's internal API (InnerTube) directly. It pulls subscribers, monetization status, and the last 5 Shorts without needing a heavy browser.
    *   *Why this separation:* If the crawler had to navigate to the channel profile and wait for it to render, it would take 10+ seconds per channel. By delegating to the Scraper API, deep extraction takes < 0.5 seconds.
4.  **The Vault (Scalable Database): CockroachDB Serverless**
    *   *Role:* A robust PostgreSQL database storing all fully validated post-2025 channels. It provides 10GB free, which is enough for millions of channels.
5.  **The SaaS Dashboard: Vercel + Next.js**
    *   *Role:* The public-facing dashboard connected to the database to display real-time analytics and advanced filters to outcompete Nexlev.

---

## 2. The Triage Pipeline (Crawler + Scraper Workflow)

To maintain a pure and highly actionable database, every time a **Lightpanda Crawler** encounters a video in the feed, this ultra-fast relay occurs:

1.  **Crawler Discovery:** Lightpanda scrolls and sees a video. It extracts only the upload date and the `channel_id`.
2.  **Video Time Check:** Was the video published before `01/01/2025`?
    *   *Yes ->* Video ignored. Crawler keeps scrolling.
    *   *No ->* Validated. Move to step 3.
3.  **Exclusion Cache Check (Cloudflare KV):** Is the `channel_id` already in our cache (marked as "Ignored" or "Stored")?
    *   *Yes ->* Channel already processed. Crawler keeps scrolling.
    *   *No ->* First encounter. Crawler hands the `channel_id` over to the **Cloudflare API Scraper**.
4.  **True Channel Age Check (Scraper via `extract_oldest.js`):** The Scraper queries the date of the *very first Short* published by the channel.
    *   *Before 01/01/2025 ->* Channel is too old. Scraper adds `channel_id` to the cache as "Ignored". End.
    *   *After 01/01/2025 ->* We found a new rising channel! Move to step 5.
5.  **Deep Extraction & Storage (Scraper via `fast_metadata.js`):**
    *   Extract: All essential metadata (`channel_name`, `description`, `avatar_url`, `channel_url`, `location`, `language`).
    *   Extract: Exact counts for Long-form videos, Shorts, and Live Streams.
    *   Extract: Subscribers, monetization status (via YouTube Partner proxy logic), and compute metrics (Views/Sub ratio, Growth Score).
    *   Extract: Title, views, and thumbnails for the 5 latest Shorts.
    *   Insert the complete data into **CockroachDB**.
    *   Update the Cache KV to "Stored".

---

## 3. The Crawlers vs. Scrapers Distinction

To clarify the roles based on your options:

### Crawlers (Headless Browsers: Lightpanda / HeadlessX)
*   **What they are:** Real web browsers running without a visual interface. They render CSS, execute complex JavaScript, and simulate human scrolling.
*   **Use case:** Needed to physically trigger the infinite scroll of the YouTube Shorts feed to discover new videos dynamically.
*   **Our Choice:** **Lightpanda**. It is lightweight, incredibly fast, and consumes minimal RAM compared to HeadlessX, making it perfect for rapid discovery.

### Scrapers (Data Extractors: Your Scripts)
*   **What they are:** Simple, direct code scripts that bypass the browser entirely and speak directly to YouTube's hidden servers (the InnerTube API).
*   **Use case:** Extracting precise data (like exact subscriber counts or monetization flags) in milliseconds.
*   **Our Choice:** **Cloudflare Workers**. They execute your existing `@channel-info` scripts for free, handling up to 100,000 deep extractions per day at zero cost.

---

## 4. Development Roadmap

The roadmap consists of 5 focused phases to bring ShortRadar to life:

1.  **Database Foundation (CockroachDB):** Setup PostgreSQL clusters, tables (`channels`, `shorts`), and indexes for sub-second dashboard filtering. Ensure exact counting schema (`videos_long`, `videos_shorts`, `videos_live`, `country`, `language`).
2.  **Script Renovation (Local Extractors):** Refactor `extract_oldest.js` and `fast_metadata.js` to strictly enforce the post-2025 rule, verify proxy monetization status, calculate metrics (Growth Score, Upload Frequency), and output exact age strings.
3.  **Cloud Brain & Crawlers (Lightpanda + Workers):** Deploy Lightpanda to scroll the feed continuously. Deploy the Cloudflare Workers API to receive Lightpanda's discoveries and process them.
4.  **Automation & Data Refresh:** Setup Cron tasks to update subscriber metrics and views for existing channels in the database every 24 hours.
5.  **The SaaS Dashboard (Next.js):** Build the frontend interface deployed on Vercel, integrating complex SQL filters to display explosive new, low-competition channels.
