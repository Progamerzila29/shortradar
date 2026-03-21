const fs = require('fs');

async function main() {
    const channelId = 'UCBJycsmduvYEL83R_U4JriQ';
    const id = channelId.substring(2);
    
    const playlists = [
        { name: 'all', id: `UU${id}` },
        { name: 'long', id: `UULF${id}` },
        { name: 'shorts', id: `UUSH${id}` },
        { name: 'live', id: `UULV${id}` },
    ];

    for (const pl of playlists) {
        try {
            const url = `https://www.youtube.com/playlist?list=${pl.id}`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            const html = await res.text();
            
            const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
            if (match) {
                const data = JSON.parse(match[1]);
                // Let's find "1,805 videos" or similar
                let foundCount = null;
                // It usually is in header.playlistHeaderRenderer.numVideosText.runs[0].text
                try {
                    const stats = data.header.playlistHeaderRenderer.byline[0].playlistBylineRenderer.text.runs;
                    console.log(`Playlist ${pl.name} (${pl.id}) byline: ${JSON.stringify(stats)}`);
                } catch(e) {}
                try {
                    const numVideos = data.header.playlistHeaderRenderer.numVideosText.runs[0].text;
                    console.log(`Playlist ${pl.name} (${pl.id}) total count: ${numVideos}`);
                } catch (e) {}
                // Also search generically
                let out = '';
                function search(obj, path = '') {
                    if (typeof obj === 'string') {
                        if (obj.toLowerCase().includes('video') || obj.toLowerCase().includes('count')) {
                            if (obj.length < 50) out += `${path}: ${obj}\n`;
                        }
                    } else if (Array.isArray(obj)) {
                        obj.forEach((i, idx) => search(i, `${path}[${idx}]`));
                    } else if (typeof obj === 'object' && obj !== null) {
                        for (const [k, v] of Object.entries(obj)) {
                            search(v, `${path}.${k}`);
                        }
                    }
                }
                search(data);
                fs.writeFileSync(`${pl.name}_pl.txt`, out, 'utf-8');
            } else {
                console.log(`Playlist ${pl.name} not found or no ytInitialData`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}
main();
