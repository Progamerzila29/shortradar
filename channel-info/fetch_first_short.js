const fetchOptions = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/'
    }
};

function extractFromJSON(obj, targetKey, targetValueCallback) {
    let result = null;
    function search(o) {
        if (result) return;
        if (Array.isArray(o)) {
            for (const item of o) search(item);
        } else if (typeof o === 'object' && o !== null) {
            for (const [k, v] of Object.entries(o)) {
                if (k === targetKey && (!targetValueCallback || targetValueCallback(v))) {
                    result = o;
                    return;
                }
                search(v);
            }
        }
    }
    search(obj);
    return result;
}

async function main() {
    const handle = 'mkbhd';
    // 1. Fetch channel shorts tab
    const res = await fetch(`https://www.youtube.com/@${handle}/shorts`, fetchOptions);
    const html = await res.text();

    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"(.*?)"/);
    if (!apiKeyMatch) return console.log("No API Key");
    const apiKey = apiKeyMatch[1];
    const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"(.*?)"/)[1];

    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!match) return console.log("No ytInitialData");
    const data = JSON.parse(match[1]);

    // Find "Oldest" chip token
    let oldestToken = null;
    function findOldest(obj) {
        if (oldestToken) return;
        if (Array.isArray(obj)) {
            for (const i of obj) findOldest(i);
        } else if (typeof obj === 'object' && obj !== null) {
            if (obj.chipViewModel && obj.chipViewModel.text === 'Oldest') {
                try {
                    oldestToken = obj.chipViewModel.tapCommand.innertubeCommand.continuationCommand.token;
                } catch(e){}
            }
            if (obj.text === 'Oldest' && obj.tapCommand) {
                try {
                    oldestToken = obj.tapCommand.innertubeCommand.continuationCommand.token;
                } catch(e){}
            }
            for (const v of Object.values(obj)) findOldest(v);
        }
    }
    findOldest(data);

    if (oldestToken) {
        console.log("Found Oldest Token:", oldestToken);
        const payload = {
            context: {
                client: {
                    clientName: 'WEB',
                    clientVersion: clientVersion,
                    hl: 'en',
                    gl: 'US'
                }
            },
            continuation: oldestToken
        };

        const sortRes = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
            body: JSON.stringify(payload)
        });
        const sortData = await sortRes.json();
        
        // Find first short videoId
        let firstShortId = null;
        function findShort(obj) {
            if (firstShortId) return;
            if (Array.isArray(obj)) {
                for (const i of obj) findShort(i);
            } else if (typeof obj === 'object' && obj !== null) {
                if (obj.shortsLockupViewModel && obj.shortsLockupViewModel.entityId) {
                    firstShortId = obj.shortsLockupViewModel.entityId.replace('shorts-shelf-item-', '');
                } else if (obj.videoId) {
                    firstShortId = obj.videoId;
                }
                for (const v of Object.values(obj)) findShort(v);
            }
        }
        findShort(sortData);

        if (firstShortId) {
            console.log("First Short ID:", firstShortId);
            // Fetch the short page
            const shortHtmlRes = await fetch(`https://www.youtube.com/shorts/${firstShortId}`, fetchOptions);
            const shortHtml = await shortHtmlRes.text();
            
            const dateMatch = shortHtml.match(/"uploadDate":"(.*?)"/);
            const titleMatch = shortHtml.match(/"name":"(.*?)"/);
            console.log("Upload Date:", dateMatch ? dateMatch[1] : "Unknown");
            console.log("Title:", titleMatch ? titleMatch[1] : "Unknown");
        } else {
            console.log("No Shorts listed in Oldest sort");
        }
    } else {
        console.log("Oldest chip not found on this channel.");
    }
}
main();
