const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20240314.07.00';

async function fetchJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Origin': 'https://www.youtube.com'
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        console.log("Fetch failed:", res.status, await res.text());
        return null;
    }
    return await res.json();
}

async function getPublishDate(videoId) {
    const r = await fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
        context: { client: { clientName: 'WEB', clientVersion: CLIENT_VERSION } }, videoId
    });
    console.log("Response payload keys:", Object.keys(r));
    if (r?.playabilityStatus?.status === 'ERROR') {
        console.log("Playability Error:", r.playabilityStatus.reason);
    }
    return r?.microformat?.playerMicroformatRenderer?.publishDate || null;
}

getPublishDate('eWlcszvljcE').then(date => console.log("Final Date:", date));
