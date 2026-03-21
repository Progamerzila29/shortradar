import { Innertube } from 'youtubei.js';

async function testDuration() {
  const yt = await Innertube.create({ generate_session_locally: true });
  
  let info = await yt.getInfo("kZyTCtV_bqY");
  const feed = info.watch_next_feed || [];
  console.log("Feed size:", feed.length);
  
  let shortsCount = 0;
  
  for (const item of feed) {
      const raw = JSON.stringify(item);
      const vidMatch = raw.match(/(?:videoId|video_id)[":\s]+"([a-zA-Z0-9_-]{11})"/);
      const vid = vidMatch ? vidMatch[1] : null;
      
      let isLongVideo = false;
      const bottomText = item.content_image?.bottom_text?.text || item.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;
      if (bottomText) {
          const t = bottomText.split(':');
          if (t.length > 2 || (t.length === 2 && (parseInt(t[0]) > 1 || (parseInt(t[0])===1 && parseInt(t[1]) > 0)))) {
              isLongVideo = true;
          }
      }
      
      const label = item.renderer_context?.accessibility_context?.label || "";
      if (label.match(/\d+\s*minutes?/i) || label.match(/\d+\s*hours?/i)) {
          isLongVideo = true;
      }
      
      const lengthMatch = raw.match(/"text"\s*:\s*"(\d+:\d{2}:\d{2}|\d+:\d{2})"/);
      if (!isLongVideo && lengthMatch) {
          const t = lengthMatch[1].split(':');
          if (t.length > 2 || (t.length === 2 && (parseInt(t[0]) > 1 || (parseInt(t[0])===1 && parseInt(t[1]) > 0)))) {
              isLongVideo = true;
          }
      }
      
      if (!isLongVideo) {
          shortsCount++;
          console.log("✅ Short found:", vid);
      } else {
          console.log("❌ Long skipped:", vid);
      }
  }
  
  console.log(`Summary: ${shortsCount}/${feed.length} are actual Shorts!`);
}

testDuration();
