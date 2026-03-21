import { Innertube } from 'youtubei.js';

function extractValidVideoIds(obj, ids = new Set()) {
    if (!obj) return ids;
    if (Array.isArray(obj)) {
        for (const item of obj) extractValidVideoIds(item, ids);
        return ids;
    }
    if (typeof obj === 'object') {
        // Only accept actual 11-char IDs from explicitly named keys
        if (typeof obj.videoId === 'string' && obj.videoId.length === 11) ids.add(obj.videoId);
        if (typeof obj.video_id === 'string' && obj.video_id.length === 11) ids.add(obj.video_id);
        for (const key in obj) {
            extractValidVideoIds(obj[key], ids);
        }
    }
    return ids;
}

async function testHomeFeedProper() {
  const yt = await Innertube.create({ generate_session_locally: true });
  const home = await yt.getHomeFeed();
  
  const allIds = Array.from(extractValidVideoIds(home.page));
  console.log(`Extracted ${allIds.length} valid 11-char Video IDs from Home Feed.`);
  console.log(allIds.slice(0, 10)); // See what we got
}

testHomeFeedProper();
