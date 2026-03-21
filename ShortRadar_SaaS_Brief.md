**ShortRadar**

World-Scale YouTube Shorts Channel Discovery Engine

*Full SaaS Architecture Brief --- For AI Implementation*

**Context for the AI Reading This**

  -----------------------------------------------------------------------
  *You must start by opening the existing project folder I created last
  week --- it contains the initial codebase and structure. Then consult
  the following GitHub repositories as references. You are NOT required
  to copy them directly --- just inspect them for useful code snippets,
  patterns, or utilities that could accelerate development: 1.
  https://github.com/Jill09166/youtube-shorts-scraper 2.
  https://github.com/Taylor5690/youtube-channel-scrapper 3.
  https://github.com/SamueleAmato/OsintTube 4.
  https://github.com/YT-Advanced/is-youtube-channel-monetized-extension
  Each repo may contribute something different: scraping logic, channel
  metadata parsing, OSINT-style analysis, or monetization detection.
  Extract what is relevant and discard the rest.*

  -----------------------------------------------------------------------

**1. Product Vision**

Build the largest database of YouTube Shorts channels in the world,
powered by thousands of distributed scrapers permanently scrolling the
Shorts feed 24/7. This is a direct, free competitor to Nexlev --- but
far more powerful in scope and data depth.

**The core thesis:**

-   The YouTube Shorts feed is an infinite, ever-changing stream of
    content.

-   Every video in that feed reveals a channel.

-   If thousands of scrapers scroll this feed non-stop, without
    duplicates, the database will eventually contain the majority of all
    Shorts channels in existence.

-   Creators can then filter this database to instantly find winning
    faceless niches before they go mainstream.

**2. System Architecture**

The pipeline is split into 5 distinct layers:

> \[ Distributed Scrapers \]
>
> ↓
>
> \[ Central Queue (buffer / rate limiter) \]
>
> ↓
>
> \[ Deduplication Engine \]
>
> ↓
>
> \[ Metadata Scraper + Calculator \]
>
> ↓
>
> \[ Scalable Database (channels + videos) \]
>
> ↓
>
> \[ Real-Time Dashboard + Filters \]

**3. Distributed Scrapers**

Deploy thousands of scraper instances running simultaneously and
permanently. Each instance performs the following loop:

1.  Open the YouTube Shorts feed

2.  Scroll continuously, capturing every video that appears

3.  Extract the channel URL, handle, and channel_id from each video

4.  Check immediately whether that channel already exists (dedup check)

5.  If new: scrape full metadata and write to database

6.  If already exists: skip immediately, continue scrolling

**Performance target:**

-   Maximum 5--10 seconds per channel analysis per instance

-   1,000 active instances → \~700,000 channels analysed per day

-   Scale to tens of thousands of instances for millions/day

**4. Anti-Duplicate System (3 Levels)**

This is the most critical part of the system. Without it, thousands of
scrapers would redundantly process the same channels millions of times.

**Unique Identifier**

Each channel is uniquely identified by:

> channel_id (YouTube internal ID --- never changes)
>
> handle (e.g. \@channelname --- used as fast lookup key)

**Level 1 --- Bloom Filter (RAM, microseconds)**

-   An in-memory distributed Bloom Filter holds all known handles.

-   Each scraper checks the Bloom Filter before doing anything else.

-   If already present → skip instantly (microseconds).

-   This eliminates \~99% of duplicate checks before they reach the DB.

**Level 2 --- Redis Cache (milliseconds)**

-   If not in Bloom Filter → verify against a fast Redis cache.

-   Redis stores recently seen channel_ids for ultra-fast lookups.

**Level 3 --- Database Atomic Insert**

> INSERT INTO channels (\...) ON CONFLICT (channel_id) DO NOTHING

-   Final safety net --- even if two scrapers race on the same channel,
    only one row is ever created.

**5. Metadata Collected Per Channel**

When a new channel is detected, the following data is scraped and stored
immediately:

**5.1 --- Channel Core Info**

  -------------------------- --------------------------------------------
  **Field**                  Description

  **channel_id**             YouTube internal unique ID

  **channel_handle**         e.g. \@channelname

  **channel_url**            Full YouTube channel URL

  **channel_name**           Display name of the channel

  **channel_avatar**         Profile image URL

  **subscribers**            Current subscriber count

  **total_videos**           Total number of videos on the channel

  **description**            Full channel description text

  **is_monetized**           Boolean --- whether the channel is monetized
                             (see GitHub #4)

  **scraped_at**             Timestamp of when the channel was first
                             discovered
  -------------------------- --------------------------------------------

**5.2 --- Last 5 Shorts Analysed**

For each of the 5 most recent Shorts published by the channel:

  -------------------------- --------------------------------------------
  **Field**                  Description

  **video_id**               YouTube video ID

  **channel_id**             Foreign key to channels table

  **title**                  Video title

  **thumbnail**              Thumbnail image URL

  **views**                  Total view count

  **likes**                  Total like count

  **publish_date**           Date the short was published

  **video_url**              Full YouTube short URL

  **duration**               Duration in seconds
  -------------------------- --------------------------------------------

**6. Channel Age --- First Shorts Date**

IMPORTANT: Channel Age is NOT the YouTube account creation date. It is
calculated from the date of the very first Short ever published by the
channel.

**How to Retrieve It**

-   Navigate to the channel\'s Shorts tab.

-   Scroll to the oldest visible Short, or use a reverse-chronological
    sort if available.

-   Extract the publish_date of that oldest Short via HTML parsing or
    internal API.

-   This step must complete in a few milliseconds --- use lightweight
    HTML parsing, not full page rendering.

**Calculation**

> first_short_date = date of oldest Short published
>
> channel_age_days = today_date - first_short_date

**Display Format**

> channel_age_days \< 30 → \'Started X days ago\'
>
> channel_age_days \< 365 → \'Started X months ago\'
>
> channel_age_days \>= 365 → \'Started X years ago\'

This is crucial for detecting new channels that are already going viral.

**7. Automatically Calculated Metrics**

After scraping, these metrics are computed and stored on the channels
table:

**Average Views (Last 5 Shorts)**

> average_views_last_5 = sum(views of last 5 shorts) / 5

**Views / Subscribers Ratio**

Measures how viral the content is relative to channel size. Simply
calculate and store the ratio --- no threshold label needed.

> views_to_sub_ratio = average_views_last_5 / subscribers

**Upload Frequency**

> shorts_per_week = total_shorts / (channel_age_days / 7)

**Growth Indicator**

How fast the channel is gaining traction from day one:

> growth_score = average_views_last_5 / channel_age_days

**8. Database Schema**

The database must be designed for tens of millions of rows. Use a
scalable cloud solution (e.g. PostgreSQL on Supabase, PlanetScale, or
Neon for near-infinite storage).

**Table: channels**

> channel_id TEXT PRIMARY KEY
>
> handle TEXT UNIQUE
>
> name TEXT
>
> avatar_url TEXT
>
> channel_url TEXT
>
> description TEXT
>
> subscribers BIGINT
>
> total_videos INT
>
> is_monetized BOOLEAN
>
> first_short_date DATE
>
> channel_age_days INT
>
> average_views_last5 BIGINT
>
> views_to_sub_ratio FLOAT
>
> shorts_per_week FLOAT
>
> growth_score FLOAT
>
> scraped_at TIMESTAMP

**Table: shorts**

> video_id TEXT PRIMARY KEY
>
> channel_id TEXT REFERENCES channels(channel_id)
>
> title TEXT
>
> thumbnail TEXT
>
> views BIGINT
>
> likes BIGINT
>
> publish_date DATE
>
> video_url TEXT
>
> duration INT

**9. Dashboard**

**9.1 --- Global Stats Bar (Real-Time)**

Always visible at the top of the screen, updating live:

-   Total channels discovered (all-time)

-   Channels scraped today

-   Active scrapers right now

These counters must update in real-time (WebSocket or polling every few
seconds).

**9.2 --- Refresh Button**

-   Reloads the feed of latest scraped channels.

-   Refreshes global stats.

**9.3 --- Channel Cards Feed**

Each discovered channel appears as a rectangular card showing:

-   Channel avatar image

-   Channel name

-   Subscribers count

-   Average views (last 5 shorts)

-   Channel age: \'Started X days/months/years ago\' (from
    first_short_date)

-   Total number of videos

-   Thumbnails of the 5 most recent Shorts (clickable)

-   \'Open Channel\' button --- opens the YouTube channel page in a new
    tab

**9.4 --- Advanced Filters**

Users can filter the entire database using:

  -------------------------- --------------------------------------------
  **Filter**                 Example Value

  **Max subscribers**        \< 50,000

  **Min average views**      \> 100,000

  **Max channel age**        \< 6 months

  **Min upload frequency**   \> 3 shorts/week

  **Views/sub ratio**        custom value

  **Monetized**              Yes / No / All

  **Min total videos**       \> 20
  -------------------------- --------------------------------------------

The goal: surface small channels with huge view counts in unsaturated
niches.

**10. Automatic Niche Detection**

Channels are automatically clustered by topic using NLP analysis on
video titles, thumbnails, and descriptions. Each niche gets its own
dedicated page.

Example niches auto-detected:

-   AI Facts

-   Horror Stories

-   History Shorts

-   Movie Clips

-   Motivation

-   Islamic Reminders

-   Reddit Stories

Each niche page shows: number of channels, average views, growth trend,
top performing channels in the niche.

**11. Monetization Detection**

Checking whether a channel is monetized is a key signal for niche
viability. Use the logic/approach from:

  ------------------------------------------------------------------------
  *https://github.com/YT-Advanced/is-youtube-channel-monetized-extension
  Review this extension\'s source code to extract the monetization
  detection method (likely based on checking the channel\'s about page or
  internal YouTube API endpoints). Adapt it as a lightweight function
  called once per new channel during the metadata scraping phase.*

  ------------------------------------------------------------------------

Store result as is_monetized BOOLEAN in the channels table. Display on
the channel card with a badge.

**12. Continuous 24/7 Operation**

-   Scrapers never stop --- they run permanently in cloud workers.

-   The database grows by the minute with newly discovered channels.

-   New channels appear in the dashboard feed as soon as they are
    written to the DB.

-   The system self-heals: if a scraper crashes, it restarts
    automatically.

**13. Scale Target**

  -------------------------- --------------------------------------------
  **Milestone**              Target

  **Day 1 (1k scrapers)**    700k channels/day

  **Month 1**                \~10M channels in DB

  **Long-term**              Majority of all Shorts channels worldwide
  -------------------------- --------------------------------------------

**14. Cornell Summary**

  -----------------------------------------------------------------------
  *ShortRadar is a world-scale YouTube Shorts channel discovery engine.
  Thousands of distributed scrapers permanently scroll the Shorts feed
  24/7, extract channels from every video, and pass them through a
  3-level anti-duplicate pipeline (Bloom Filter → Redis → atomic DB
  insert). Each new channel is fully analysed in under 10 seconds: core
  metadata, description, monetization status, 5 latest Shorts with full
  video stats, and channel age computed from the date of the very first
  Short ever published (not the YouTube account age). Metrics like
  average views, views-to-subscribers ratio, upload frequency, and growth
  score are auto-calculated and stored. The real-time dashboard shows a
  live counter of scraped channels, a filterable feed of channel cards,
  and advanced filters to surface small channels with explosive view
  counts in low-competition faceless niches. The product is a free,
  massively more powerful alternative to Nexlev.*

  -----------------------------------------------------------------------

**15. GitHub Reference Repositories**

Consult these repos for reusable code snippets. Do not copy blindly ---
evaluate what is useful:

-   Shorts scraping logic:
    https://github.com/Jill09166/youtube-shorts-scraper

-   Channel metadata scraping:
    https://github.com/Taylor5690/youtube-channel-scrapper

-   OSINT-style channel analysis:
    https://github.com/SamueleAmato/OsintTube

-   Monetization detection:
    https://github.com/YT-Advanced/is-youtube-channel-monetized-extension

These are references only. Always start from the existing project folder
that was created last week.
