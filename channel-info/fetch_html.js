const https = require('https');
const fs = require('fs');

https.get('https://www.youtube.com/shorts/purAsH7pXTQ', {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const match = data.match(/ytInitialPlayerResponse\s*=\s*({.+?});var/);
        if (match && match[1]) {
            fs.writeFileSync('dump_html.json', match[1]);
            console.log('Saved dump_html.json');
        } else {
            console.log('ytInitialPlayerResponse not found');
            fs.writeFileSync('dump_raw.html', data);
        }
    });
});
