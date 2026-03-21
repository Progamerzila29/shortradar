const fs = require('fs');
let out = '';
['videos', 'shorts', 'streams'].forEach(tab => {
    if (!fs.existsSync(`${tab}.json`)) return;
    const data = JSON.parse(fs.readFileSync(`${tab}.json`, 'utf-8'));
    function findPlaylists(obj, path = '') {
        if (typeof obj === 'string') {
            if (obj.includes('playlist?list=')) {
                out += `${tab} - ${path}: ${obj}\n`;
            }
            if (obj.length > 1 && obj.startsWith('UU') && obj.length === 24) {
                 out += `${tab} - POtential Playlist ID ${path}: ${obj}\n`;
            }
        } else if (Array.isArray(obj)) {
            obj.forEach((i, idx) => findPlaylists(i, `${path}[${idx}]`));
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [k, v] of Object.entries(obj)) {
                if (k === 'playlistId') {
                    out += `${tab} - PLAYLIST FOUND: ${v}\n`;
                }
                findPlaylists(v, `${path}.${k}`);
            }
        }
    }
    findPlaylists(data);
});
fs.writeFileSync('playlists_search.txt', out, 'utf-8');
