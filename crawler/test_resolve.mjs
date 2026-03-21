import { Innertube } from 'youtubei.js';

async function testResolve() {
  const yt = await Innertube.create();
  const res = await yt.resolveURL("https://www.youtube.com/shorts/_OBlgSz8sSM");
  console.log("Type of res:", res.constructor.name);
  console.log("Keys:", Object.keys(res));
  
  if (res.videos) {
      console.log("Videos length:", res.videos.length);
      if (res.videos.length > 0) {
          console.log("First video keys:", Object.keys(res.videos[0]));
          console.log("ID:", res.videos[0].video_id, "Title:", res.videos[0].headline?.text);
      }
  }
}
testResolve();
