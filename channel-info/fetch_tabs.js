const fs = require('fs');

async function main() {
    const channel = process.argv[2] || 'mkbhd';
    
    async function getTab(name) {
        const url = `https://www.youtube.com/@${channel}/${name}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            const html = await response.text();
            const match = html.match(/var ytInitialData = (\{.*?});<\/script>/);
            if (match) {
                fs.writeFileSync(`${name}.json`, match[1]);
                console.log(`Saved ${name}.json`);
            } else {
                console.log(`No ytInitialData found in ${name}`);
            }
        } catch (e) {
            console.error(e);
        }
    }

    await getTab('videos');
    await getTab('shorts');
    await getTab('streams');
}
main();
