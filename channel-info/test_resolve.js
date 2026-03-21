const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';

async function testResolve() {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
            context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } },
            browseId: "UCBJycsmduvYEL83R_U4JriQ",
            params: "EgVhYm91dLgBAJIDAPIGBgoCMgBKAA%3D%3D"
        })
    });
    const data = await res.json();
    const fs = require('fs');
    fs.writeFileSync('about_test.json', JSON.stringify(data, null, 2));
    console.log("Saved about_test.json");
}
testResolve();
