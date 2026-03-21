const fs = require('fs');

async function main() {
    const channel = process.argv[2] || 'mkbhd';
    const url = `https://www.youtube.com/@${channel}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = await response.text();
        fs.writeFileSync('yt.html', html);
        
        const match = html.match(/var ytInitialData = (\{.*?});<\/script>/);
        if (match) {
            fs.writeFileSync('yt.json', match[1]);
            console.log('Saved yt.json');
        } else {
            console.log('No ytInitialData found');
            console.log('HTML start:', html.substring(0, 500));
        }
    } catch (e) {
        console.error(e);
    }
}
main();
