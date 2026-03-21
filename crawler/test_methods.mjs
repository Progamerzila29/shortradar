import { Innertube } from 'youtubei.js';
async function test() {
  const yt = await Innertube.create();
  console.log("METHODS:", Object.getOwnPropertyNames(Object.getPrototypeOf(yt)));
  // also check yt.actions
  console.log("ACTIONS:", Object.getOwnPropertyNames(Object.getPrototypeOf(yt.actions)));
  process.exit();
}
test();
