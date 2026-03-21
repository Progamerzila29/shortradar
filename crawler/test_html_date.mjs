// Quick test of the HTML scraping date extraction method
const vid = 'kZyTCtV_bqY'; // known test video

const res = await fetch(`https://www.youtube.com/shorts/${vid}`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

const html = await res.text();

const dateMatch = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
const publishDate = dateMatch ? dateMatch[1] : null;

const channelMatch = html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
const channelId = channelMatch ? channelMatch[1] : null;

console.log("✅ DATE:", publishDate || "Not Found");
console.log("✅ CHANNEL:", channelId || "Not Found");
console.log("✅ Status:", res.status);
