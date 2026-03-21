const https = require('https');
const fs = require('fs');

https.get('https://raw.githubusercontent.com/YT-Advanced/is-youtube-channel-monetized-extension/master/content.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('monetized_extension.js', data);
        const lines = data.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('monetiz') || lines[i].includes('yt_ad') || lines[i].includes('channel_id')) {
                console.log(`Line ${i+1}: ${lines[i].trim()}`);
            }
        }
    });
});
